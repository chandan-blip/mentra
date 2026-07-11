import type { LiveSessionView } from '@mentra/shared';
import { createId } from '../../core/id.js';
import { logger } from '../../logger.js';
import { presignPut, publicUrl, r2Delete, r2Enabled, r2Head, r2List } from '../../core/r2.js';
import { LiveSessionError } from '../live-session/live-session.errors.js';
import { enqueueThumbnail } from '../live-session/thumbnail.queue.js';
import * as repo from '../live-session/live-session.repository.js';
import { toViews } from '../live-session/live-session.service.js';

/**
 * Videos-management module ('manage-videos'). A role-gated content surface over the
 * existing LiveSession recordings + mentor uploads: list all, edit title/topic, toggle
 * visibility to students, delete, and manage the cover (regenerate AI or upload custom).
 * Route-level `requirePermission('manage-videos', …)` gates access — services assume the
 * caller is authorized and operate globally (all mentors' videos).
 */

const MAX_THUMB_BYTES = 5 * 1024 * 1024; // 5 MB custom cover cap
const THUMB_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

async function loadVideo(id: string): Promise<repo.LiveSessionRow> {
  const row = await repo.findById(id);
  if (!row) throw new LiveSessionError('VIDEO_NOT_FOUND', 'Video not found', 404);
  return row;
}

/** All managed videos (uploads + recorded sessions), optionally filtered by title/topic. */
export async function listVideos(userId: string, search?: string): Promise<LiveSessionView[]> {
  const rows = await repo.listManagedVideos(search);
  return toViews(rows, userId);
}

/** Edit a video's title/topic. */
export async function updateVideo(
  id: string,
  fields: { title?: string; topic?: string },
): Promise<LiveSessionView> {
  await loadVideo(id);
  await repo.setVideoMeta(id, fields);
  return oneView(id);
}

/** Show/hide a video from students. */
export async function setVisibility(id: string, visible: boolean): Promise<LiveSessionView> {
  await loadVideo(id);
  await repo.setVisible(id, visible);
  return oneView(id);
}

/** Make a video public (watchable by anyone at /watch/:id) or private. */
export async function setPublic(id: string, isPublic: boolean): Promise<LiveSessionView> {
  await loadVideo(id);
  await repo.setPublic(id, isPublic);
  return oneView(id);
}

/**
 * Hard-delete a video: purge ALL its R2 objects, then remove the DB rows. R2 is cleaned
 * FIRST and its failure ABORTS the delete (row kept) so storage is never orphaned — the
 * manager just retries. r2List paginates (no 1000-key cap) and DeleteObject is idempotent,
 * so already-absent keys are harmless.
 */
export async function deleteVideo(id: string): Promise<void> {
  await loadVideo(id);

  if (r2Enabled()) {
    const keys = new Set<string>();
    // `thumbnails/<id>` (no trailing slash) catches the single-file cover (<id>.jpg, legacy
    // <id>.png) AND any custom uploads under <id>/.
    for (const prefix of [`recordings/${id}/`, `uploads/${id}/`, `thumbnails/${id}`]) {
      for (const k of await r2List(prefix)) keys.add(k);
    }
    try {
      await Promise.all([...keys].map((k) => r2Delete(k)));
    } catch (err) {
      logger.error({ err, id }, 'video delete: R2 cleanup failed — aborting, DB row kept');
      throw new LiveSessionError(
        'R2_DELETE_FAILED',
        'Could not delete the video files from storage. Please try again.',
        502,
      );
    }
    logger.info({ id, objects: keys.size }, 'video delete: removed R2 objects');
  }

  await repo.deleteVideoCascade(id);
}

/** Re-run the AI thumbnail (Groq + Puppeteer) for this video. */
export async function regenerateThumbnail(id: string): Promise<void> {
  await loadVideo(id);
  await enqueueThumbnail(id, 'end');
}

/** Start a custom-cover upload: presigned PUT to a fresh R2 key (cache-busting). */
export async function createThumbnailUpload(
  id: string,
  contentType: string,
): Promise<{ uploadUrl: string; key: string }> {
  if (!r2Enabled()) throw new LiveSessionError('R2_DISABLED', 'Storage is not configured', 400);
  await loadVideo(id);
  const ext = THUMB_EXT[contentType];
  if (!ext) throw new LiveSessionError('BAD_IMAGE_TYPE', 'Only PNG, JPEG or WebP images are allowed', 400);
  const key = `thumbnails/${id}/custom-${createId()}.${ext}`;
  const uploadUrl = await presignPut(key, contentType);
  return { uploadUrl, key };
}

/** Finalize a custom cover after the browser PUT: verify + point thumbnailUrl at it. */
export async function finalizeThumbnail(id: string, key: string): Promise<LiveSessionView> {
  await loadVideo(id);
  if (!key.startsWith(`thumbnails/${id}/`)) {
    throw new LiveSessionError('BAD_KEY', 'Thumbnail key does not belong to this video', 400);
  }
  const head = await r2Head(key);
  if (!head.exists) throw new LiveSessionError('UPLOAD_MISSING', 'No uploaded image was found', 400);
  if (head.size > MAX_THUMB_BYTES) {
    await r2Delete(key).catch(() => {});
    throw new LiveSessionError('UPLOAD_TOO_LARGE', 'The image exceeds the 5 MB limit', 413);
  }
  const url = publicUrl(key);
  if (!url) throw new LiveSessionError('R2_DISABLED', 'Storage public URL is not configured', 400);
  await repo.setThumbnail(id, url);
  return oneView(id);
}

async function oneView(id: string): Promise<LiveSessionView> {
  const row = await loadVideo(id);
  return (await toViews([row], row.mentorId))[0]!;
}
