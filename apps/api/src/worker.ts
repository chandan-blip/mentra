import { Worker } from 'bullmq';
import { createBullConnection } from './core/redis.js';
import { logger } from './logger.js';
import { TRANSCODE_QUEUE, type TranscodeJob } from './modules/live-session/recording.queue.js';
import { transcodeRecording } from './modules/live-session/recording.transcode.js';
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

logger.info('recording transcode worker started');

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'worker shutting down');
  await worker.close();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
