import { Queue } from 'bullmq';
import { createBullConnection } from '../../core/redis.js';
import { logger } from '../../logger.js';

/**
 * AI-cover queue — bridges session lifecycle events to the (Puppeteer-heavy) thumbnail
 * worker. Groq writes the cover copy from the session title/topic (+ chat comments at
 * end); the worker renders a branded HTML template to a PNG and uploads it to R2, then
 * stores the URL on `LiveSession.thumbnailUrl`. Runs in the SAME worker process as the
 * transcode queue (separate from the API) because it launches headless Chrome.
 */
export const THUMBNAIL_QUEUE = 'thumbnail-generate';

/** 'create' → cover from title+topic (upcoming/live). 'end' → refresh folding in chat. */
export type ThumbnailPhase = 'create' | 'end';

export type ThumbnailJob = {
  sessionId: string;
  phase: ThumbnailPhase;
};

export const thumbnailQueue = new Queue<ThumbnailJob>(THUMBNAIL_QUEUE, {
  connection: createBullConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 15_000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

/** R2 key for a session's AI-designed cover image (JPEG for a small, fast-loading file). */
export function thumbnailKey(sessionId: string): string {
  return `thumbnails/${sessionId}.jpg`;
}

export async function enqueueThumbnail(sessionId: string, phase: ThumbnailPhase): Promise<void> {
  // One job id per (session, phase) so a duplicate event coalesces instead of piling up.
  await thumbnailQueue.add('thumbnail', { sessionId, phase }, { jobId: `thumb:${sessionId}:${phase}` });
  logger.info({ sessionId, phase }, 'thumbnail job enqueued');
}
