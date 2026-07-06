import { Queue } from 'bullmq';
import { createBullConnection } from '../../core/redis.js';
import { logger } from '../../logger.js';

/**
 * Transcode queue — bridges egress completion to the FFmpeg worker. When an egress
 * finishes, the API enqueues one job per recording; the worker (separate process,
 * Phase 2) pulls the raw MP4 from R2, builds the HLS ABR ladder, uploads it back, and
 * flips the session's `recordingStatus` to 'ready' with the master-playlist URL.
 */
export const TRANSCODE_QUEUE = 'recording-transcode';

export type TranscodeJob = {
  sessionId: string;
  /** R2 key of the raw composite MP4 produced by egress. */
  sourceKey: string;
};

export const transcodeQueue = new Queue<TranscodeJob>(TRANSCODE_QUEUE, {
  connection: createBullConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: 50,
    removeOnFail: 200,
  },
});

/** R2 key of the HLS master playlist for a session's recording (worker writes it here). */
export function hlsMasterKey(sessionId: string): string {
  return `recordings/${sessionId}/hls/master.m3u8`;
}

export async function enqueueTranscode(sessionId: string, sourceKey: string): Promise<void> {
  await transcodeQueue.add('transcode', { sessionId, sourceKey });
  logger.info({ sessionId, sourceKey }, 'transcode job enqueued');
}
