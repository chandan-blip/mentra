import { Worker } from 'bullmq';
import { createBullConnection } from './core/redis.js';
import { logger } from './logger.js';
import { TRANSCODE_QUEUE, type TranscodeJob } from './modules/live-session/recording.queue.js';
import { transcodeRecording } from './modules/live-session/recording.transcode.js';
import { THUMBNAIL_QUEUE, type ThumbnailJob } from './modules/live-session/thumbnail.queue.js';
import { generateThumbnail } from './modules/live-session/thumbnail.generate.js';
import * as repo from './modules/live-session/live-session.repository.js';

/**
 * Recording transcode worker — a SEPARATE process from the API (run as its own systemd
 * unit) because ffmpeg is CPU/IO heavy and must not contend with request handling.
 * Consumes the `recording-transcode` queue; `concurrency: 1` keeps a single ffmpeg per
 * worker (scale by running more worker processes). Needs `ffmpeg` + `ffprobe` on PATH.
 */

const worker = new Worker<TranscodeJob>(
  TRANSCODE_QUEUE,
  async (job) => {
    logger.info({ jobId: job.id, sessionId: job.data.sessionId }, 'transcode job started');
    await transcodeRecording(job.data);
  },
  { connection: createBullConnection(), concurrency: 1 },
);

worker.on('completed', (job) =>
  logger.info({ jobId: job.id, sessionId: job.data.sessionId }, 'transcode job completed'),
);

worker.on('failed', async (job, err) => {
  logger.error({ err, jobId: job?.id, sessionId: job?.data.sessionId }, 'transcode job failed');
  // Only mark the recording 'failed' once BullMQ has exhausted its retries.
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await repo.setRecordingStatus(job.data.sessionId, 'failed').catch((e) =>
      logger.error({ err: e, sessionId: job.data.sessionId }, 'failed to mark recording failed'),
    );
  }
});

/**
 * AI-cover worker — same process, but its own BullMQ consumer. Launches headless Chrome
 * (Puppeteer) per job, so keep `concurrency: 1` to avoid stacking Chrome instances against
 * ffmpeg/egress on the shared host. Best-effort: a failure just leaves `thumbnailUrl` null
 * (the card falls back to the frame-grab poster), so we never mark anything 'failed'.
 */
const thumbnailWorker = new Worker<ThumbnailJob>(
  THUMBNAIL_QUEUE,
  async (job) => {
    logger.info({ jobId: job.id, sessionId: job.data.sessionId, phase: job.data.phase }, 'thumbnail job started');
    await generateThumbnail(job.data);
  },
  { connection: createBullConnection(), concurrency: 1 },
);

thumbnailWorker.on('completed', (job) =>
  logger.info({ jobId: job.id, sessionId: job.data.sessionId }, 'thumbnail job completed'),
);
thumbnailWorker.on('failed', (job, err) =>
  logger.error({ err, jobId: job?.id, sessionId: job?.data.sessionId }, 'thumbnail job failed'),
);

logger.info('recording transcode + thumbnail worker started');

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'worker shutting down');
  await Promise.all([worker.close(), thumbnailWorker.close()]);
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
