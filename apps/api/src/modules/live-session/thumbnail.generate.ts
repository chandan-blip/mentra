import { logger } from '../../logger.js';
import { publicUrl, r2Put } from '../../core/r2.js';
import * as repo from './live-session.repository.js';
import { thumbnailKey, type ThumbnailJob } from './thumbnail.queue.js';
import { generateThumbnailCopy } from './thumbnail.ai.js';
import { renderThumbnailPng } from './thumbnail.render.js';

/**
 * End-to-end cover generation for one session (runs in the worker): Groq writes the copy
 * (folding in chat comments at 'end'), Puppeteer renders it to a PNG, we upload to R2 and
 * store the public URL on the session. Best-effort — the caller (worker) logs failures and
 * leaves `thumbnailUrl` null so the card falls back to the frame-grab poster.
 */
export async function generateThumbnail({ sessionId, phase }: ThumbnailJob): Promise<void> {
  const session = await repo.findById(sessionId);
  if (!session) {
    logger.warn({ sessionId }, 'thumbnail: session not found, skipping');
    return;
  }

  const comments = phase === 'end' ? await repo.topComments(sessionId) : [];
  const copy = await generateThumbnailCopy({
    title: session.title,
    topic: session.topic,
    comments,
  });

  const png = await renderThumbnailPng({ ...copy, topic: session.topic });

  const key = thumbnailKey(sessionId);
  await r2Put(key, png, 'image/jpeg');

  const url = publicUrl(key);
  if (!url) {
    logger.warn({ sessionId }, 'thumbnail: R2_PUBLIC_BASE_URL unset, cannot store URL');
    return;
  }
  await repo.setThumbnail(sessionId, url);
  logger.info({ sessionId, phase, accent: copy.accent }, 'thumbnail generated');
}
