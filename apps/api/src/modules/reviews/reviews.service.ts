import type {
  CreateReviewInput,
  ReviewMediaType,
  ReviewUploadInit,
  StudentReviewView,
  UpdateReviewInput,
} from '@mentra/shared';
import { MAX_REVIEW_IMAGE_BYTES, MAX_REVIEW_VIDEO_BYTES } from '@mentra/shared';
import { logger } from '../../logger.js';
import {
  DEV_PLACEHOLDER_IMAGE,
  devUploadsMocked,
  presignPut,
  publicUrl,
  r2Delete,
  r2Enabled,
  r2Head,
  r2List,
} from '../../core/r2.js';
import { ReviewError } from './reviews.errors.js';
import * as repo from './reviews.repository.js';

/**
 * Feedbacks & Reviews ('reviews' / 'manage-reviews'). Managers upload student review
 * videos and screenshots to R2 (presigned PUT → finalize); students read the visible
 * gallery. Route-level `requirePermission(...)` gates access — services assume the caller
 * is already authorized and operate globally.
 */

/** Deterministic R2 key holding a review's single media object. */
const mediaKey = (id: string): string => `reviews/${id}/media`;

function toView(row: repo.StudentReviewRow): StudentReviewView {
  return {
    id: row.id,
    title: row.title,
    studentName: row.studentName,
    body: row.body,
    mediaType: row.mediaType as ReviewMediaType,
    mediaUrl: row.mediaUrl,
    thumbnailUrl: row.thumbnailUrl,
    visible: Boolean(row.visible),
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

async function loadReview(id: string): Promise<repo.StudentReviewRow> {
  const row = await repo.findById(id);
  if (!row) throw new ReviewError('REVIEW_NOT_FOUND', 'Review not found', 404);
  return row;
}

/** Visible, finalized reviews for the student gallery. */
export async function listForStudents(): Promise<StudentReviewView[]> {
  return (await repo.listVisible()).map(toView);
}

/** Every review (visible + hidden, finalized or not) for the manager surface. */
export async function listForManagers(): Promise<StudentReviewView[]> {
  return (await repo.listAll()).map(toView);
}

/** True when the MIME type is allowed for the declared media kind. */
function contentTypeAllowed(mediaType: ReviewMediaType, contentType: string): boolean {
  return mediaType === 'video' ? contentType.startsWith('video/') : contentType.startsWith('image/');
}

/**
 * Start a review upload: create the row and hand back a presigned PUT URL. The browser
 * uploads the file straight to R2, then calls finalizeReview to publish it.
 */
export async function createReview(userId: string, input: CreateReviewInput): Promise<ReviewUploadInit> {
  if (!r2Enabled() && !devUploadsMocked()) {
    throw new ReviewError('R2_DISABLED', 'Storage is not configured', 400);
  }
  if (!contentTypeAllowed(input.mediaType, input.contentType)) {
    throw new ReviewError('BAD_MEDIA_TYPE', `The file type does not match a ${input.mediaType}`, 400);
  }
  const row = await repo.create({
    title: input.title,
    studentName: input.studentName?.trim() || null,
    body: input.body?.trim() || null,
    mediaType: input.mediaType,
    createdBy: userId,
  });
  const key = mediaKey(row.id);
  // Dev mock: hand back an empty upload URL so the browser skips the R2 PUT.
  const uploadUrl = devUploadsMocked() ? '' : await presignPut(key, input.contentType);
  return { review: toView(row), uploadUrl, key };
}

/**
 * Finalize an upload after the browser PUT: verify the object exists and is within the
 * size cap for its media kind, then point mediaUrl at the public CDN URL so it goes live.
 */
export async function finalizeReview(id: string): Promise<StudentReviewView> {
  const row = await loadReview(id);
  // Dev mock: no file was uploaded — publish a placeholder image (used as the video poster too).
  if (devUploadsMocked()) {
    await repo.setMediaUrl(id, DEV_PLACEHOLDER_IMAGE);
    await repo.setThumbnailUrl(id, DEV_PLACEHOLDER_IMAGE);
    return toView(await loadReview(id));
  }
  const key = mediaKey(id);
  const head = await r2Head(key);
  if (!head.exists) throw new ReviewError('UPLOAD_MISSING', 'No uploaded file was found', 400);
  const cap = row.mediaType === 'video' ? MAX_REVIEW_VIDEO_BYTES : MAX_REVIEW_IMAGE_BYTES;
  if (head.size > cap) {
    await r2Delete(key).catch(() => {});
    const label = row.mediaType === 'video' ? '200 MB' : '15 MB';
    throw new ReviewError('UPLOAD_TOO_LARGE', `The file exceeds the ${label} limit`, 413);
  }
  const url = publicUrl(key);
  if (!url) throw new ReviewError('R2_DISABLED', 'Storage public URL is not configured', 400);
  await repo.setMediaUrl(id, url);
  return toView((await loadReview(id)));
}

/** Edit caption / visibility / ordering. */
export async function updateReview(id: string, input: UpdateReviewInput): Promise<StudentReviewView> {
  await loadReview(id);
  await repo.update(id, {
    title: input.title,
    studentName: input.studentName === undefined ? undefined : (input.studentName?.trim() || null),
    body: input.body === undefined ? undefined : (input.body?.trim() || null),
    visible: input.visible,
    sortOrder: input.sortOrder,
  });
  return toView(await loadReview(id));
}

/**
 * Hard-delete a review: purge its R2 objects first (failure aborts, row kept, so storage
 * is never orphaned), then remove the DB row.
 */
export async function deleteReview(id: string): Promise<void> {
  await loadReview(id);
  if (r2Enabled()) {
    try {
      const keys = await r2List(`reviews/${id}/`);
      await Promise.all(keys.map((k) => r2Delete(k)));
    } catch (err) {
      logger.error({ err, id }, 'review delete: R2 cleanup failed — aborting, DB row kept');
      throw new ReviewError('R2_DELETE_FAILED', 'Could not delete the file from storage. Please try again.', 502);
    }
  }
  await repo.remove(id);
}
