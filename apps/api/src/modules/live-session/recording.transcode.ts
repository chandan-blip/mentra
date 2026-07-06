import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { logger } from '../../logger.js';
import { publicUrl, r2GetStream, r2Put } from '../../core/r2.js';
import { hlsMasterKey, type TranscodeJob } from './recording.queue.js';
import * as repo from './live-session.repository.js';

/**
 * FFmpeg transcode: raw composite MP4 (from egress, in R2) → HLS ABR ladder (also in
 * R2). Runs in the standalone worker process (see `src/worker.ts`) because ffmpeg is
 * CPU-heavy. On success the session's `recordingStatus` becomes 'ready' with the public
 * master-playlist URL; failures bubble up so BullMQ retries (status flips to 'failed'
 * only once retries are exhausted, handled in the worker).
 */

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

// x264 preset — speed/quality tradeoff. Lower (ultrafast/superfast) = much faster encode,
// slightly larger files. Default 'veryfast'; drop it in dev/VM to speed transcoding up.
const PRESET = process.env.TRANSCODE_PRESET || 'veryfast';
// Optional cap on the ABR ladder's top rung, e.g. 720 to skip the expensive 1080p rung on a
// slow VM. 0 / unset = no cap (full ladder up to the source height).
const MAX_HEIGHT = Number(process.env.TRANSCODE_MAX_HEIGHT) || 0;

type Rung = { height: number; vBitrate: number; vMax: number; vBuf: number; aBitrate: number };

// Target ABR ladder. Only rungs at or below the source height are produced (no upscaling).
const LADDER: Rung[] = [
  { height: 1080, vBitrate: 5000, vMax: 5350, vBuf: 7500, aBitrate: 128 },
  { height: 720, vBitrate: 2800, vMax: 2996, vBuf: 4200, aBitrate: 128 },
  { height: 480, vBitrate: 1400, vMax: 1498, vBuf: 2100, aBitrate: 96 },
  { height: 360, vBitrate: 800, vMax: 856, vBuf: 1200, aBitrate: 96 },
];

/** Upload concurrency for HLS files (a long lecture = thousands of small .ts segments). */
const UPLOAD_CONCURRENCY = 8;

export async function transcodeRecording(job: TranscodeJob): Promise<void> {
  const { sessionId, sourceKey } = job;
  const work = await mkdtemp(join(tmpdir(), `rec-${sessionId}-`));
  const sourcePath = join(work, 'source.mp4');
  const outDir = join(work, 'hls');

  try {
    // 1. Pull the raw recording from R2 to local disk (streamed, never fully buffered).
    await pipeline(await r2GetStream(sourceKey), createWriteStream(sourcePath));

    // 2. Probe height (rung selection) + duration + audio presence (uploads may be silent).
    const sourceHeight = await probeHeight(sourcePath);
    const durationSeconds = await probeDuration(sourcePath);
    const hasAudio = await probeHasAudio(sourcePath);
    const rungs = pickRungs(sourceHeight);
    logger.info(
      { sessionId, sourceHeight, durationSeconds, hasAudio, preset: PRESET, maxHeight: MAX_HEIGHT, rungs: rungs.map((r) => r.height) },
      'transcode plan',
    );
    await Promise.all(rungs.map((_, i) => mkdir(join(outDir, String(i)), { recursive: true })));

    // 3. Build the HLS ABR ladder + 4. a poster thumbnail.
    await runFfmpegLadder(sourcePath, outDir, rungs, hasAudio);
    const thumbPath = join(work, 'thumb.jpg');
    await runThumbnail(sourcePath, thumbPath);

    // 5. Upload everything to R2 under recordings/<id>/hls/** and the thumbnail.
    await uploadDir(outDir, `recordings/${sessionId}/hls`);
    await r2Put(`recordings/${sessionId}/thumb.jpg`, await readFile(thumbPath), 'image/jpeg');

    // 6. Publish: duration + master playlist URL + ready.
    if (durationSeconds > 0) await repo.setDuration(sessionId, durationSeconds);
    const masterUrl = publicUrl(hlsMasterKey(sessionId));
    await repo.setRecordingStatus(sessionId, 'ready', masterUrl);
    logger.info(
      { sessionId, masterUrl, rungs: rungs.map((r) => r.height) },
      'recording transcoded → ready',
    );
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/** Largest-first rungs that fit within the source height (and the optional cap); always at
 *  least the smallest. */
function pickRungs(sourceHeight: number): Rung[] {
  const cap = MAX_HEIGHT > 0 ? Math.min(sourceHeight, MAX_HEIGHT) : sourceHeight;
  const fit = LADDER.filter((r) => r.height <= cap + 8); // +8 tolerance for odd captures
  return fit.length ? fit : [LADDER[LADDER.length - 1]!];
}

async function probeHeight(path: string): Promise<number> {
  const out = await capture(FFPROBE, [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=height', '-of', 'csv=p=0', path,
  ]);
  const h = parseInt(out.trim(), 10);
  return Number.isFinite(h) && h > 0 ? h : 1080;
}

async function probeDuration(path: string): Promise<number> {
  const out = await capture(FFPROBE, [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path,
  ]);
  const d = parseFloat(out.trim());
  return Number.isFinite(d) && d > 0 ? Math.round(d) : 0;
}

/** True if the source has at least one audio stream (uploads may be video-only). */
async function probeHasAudio(path: string): Promise<boolean> {
  const out = await capture(FFPROBE, [
    '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', path,
  ]);
  return out.trim().length > 0;
}

async function runFfmpegLadder(src: string, outDir: string, rungs: Rung[], hasAudio: boolean): Promise<void> {
  const n = rungs.length;
  const split = `[0:v]split=${n}${rungs.map((_, i) => `[v${i}]`).join('')}`;
  const scales = rungs.map((r, i) => `[v${i}]scale=w=-2:h=${r.height}[v${i}out]`).join('; ');
  const filter = `${split}; ${scales}`;

  const args: string[] = ['-y', '-i', src, '-filter_complex', filter];

  // One H.264 video output per rung. Fixed GOP (2s @ ~24fps) keeps segments aligned for ABR.
  rungs.forEach((r, i) => {
    args.push(
      '-map', `[v${i}out]`,
      `-c:v:${i}`, 'libx264', '-preset', PRESET, '-profile:v', 'main',
      `-b:v:${i}`, `${r.vBitrate}k`, `-maxrate:v:${i}`, `${r.vMax}k`, `-bufsize:v:${i}`, `${r.vBuf}k`,
      '-g', '48', '-keyint_min', '48', '-sc_threshold', '0',
    );
  });
  // One AAC audio output per rung (same source audio re-encoded) — only if the source has
  // an audio stream. Uploaded videos are sometimes silent (no audio track at all).
  if (hasAudio) {
    rungs.forEach((r, i) => {
      args.push('-map', 'a:0', `-c:a:${i}`, 'aac', `-b:a:${i}`, `${r.aBitrate}k`, '-ac', '2');
    });
  }

  args.push(
    '-f', 'hls',
    '-hls_time', '4',
    '-hls_playlist_type', 'vod',
    '-hls_flags', 'independent_segments',
    '-hls_segment_type', 'mpegts',
    '-hls_segment_filename', join(outDir, '%v', 'seg_%03d.ts'),
    '-master_pl_name', 'master.m3u8',
    '-var_stream_map', rungs.map((_, i) => (hasAudio ? `v:${i},a:${i}` : `v:${i}`)).join(' '),
    join(outDir, '%v', 'playlist.m3u8'),
  );

  await run(FFMPEG, args);
}

async function runThumbnail(src: string, out: string): Promise<void> {
  await run(FFMPEG, ['-y', '-ss', '00:00:03', '-i', src, '-frames:v', '1', '-vf', 'scale=640:-2', out]);
}

// --- upload helpers ---

async function uploadDir(localDir: string, keyPrefix: string): Promise<void> {
  const files: string[] = [];
  for await (const f of walk(localDir)) files.push(f);
  await mapPool(files, UPLOAD_CONCURRENCY, async (file) => {
    const key = `${keyPrefix}/${relative(localDir, file).split(sep).join('/')}`;
    await r2Put(key, await readFile(file), contentTypeFor(file));
  });
}

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function contentTypeFor(file: string): string {
  if (file.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (file.endsWith('.ts')) return 'video/mp2t';
  if (file.endsWith('.jpg')) return 'image/jpeg';
  return 'application/octet-stream';
}

/** Run `fn` over `items` with bounded concurrency; rejects on the first failure. */
async function mapPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
}

// --- process helpers ---

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-2000)}`)),
    );
  });
}

function capture(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      out += d.toString();
    });
    child.stderr.on('data', (d) => {
      err += d.toString();
    });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err.slice(-1000)}`)),
    );
  });
}
