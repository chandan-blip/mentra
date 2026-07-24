import { z } from 'zod';

/**
 * Feedbacks & Reviews — managers upload student review videos and screenshots; students
 * browse them in a gallery. Each review is a single media item (a video OR an image) with
 * an optional caption. These schemas are the FE+BE contract for the REST surface.
 */

export const REVIEW_MEDIA_TYPES = ['video', 'image'] as const;
export const reviewMediaTypeSchema = z.enum(REVIEW_MEDIA_TYPES);
export type ReviewMediaType = z.infer<typeof reviewMediaTypeSchema>;

/** Upload caps for review media (enforced server-side on finalize). */
export const MAX_REVIEW_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB
export const MAX_REVIEW_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB

/** Manager starts a review upload — metadata + the file's MIME type for the presigned PUT. */
export const createReviewSchema = z.object({
  title: z.string().trim().min(1).max(200),
  studentName: z.string().trim().max(120).optional(),
  body: z.string().trim().max(2000).optional(),
  mediaType: reviewMediaTypeSchema,
  /** MIME type of the file being uploaded (e.g. video/mp4, image/png). */
  contentType: z.string().trim().min(1).max(120),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

/** Edit a review's caption / visibility / ordering. */
export const updateReviewSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  studentName: z.string().trim().max(120).nullable().optional(),
  body: z.string().trim().max(2000).nullable().optional(),
  visible: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

/** A single student review as returned by the API. */
export type StudentReviewView = {
  id: string;
  title: string;
  studentName: string | null;
  body: string | null;
  mediaType: ReviewMediaType;
  /** Public (CDN) URL of the uploaded video/image, or null until the upload is finalized. */
  mediaUrl: string | null;
  /** Optional poster image for videos. */
  thumbnailUrl: string | null;
  /** Hidden from students when false (managers still see it). */
  visible: boolean;
  sortOrder: number;
  createdAt: string;
};

/** Returned when a manager starts an upload: the row + a presigned R2 PUT URL and key. */
export type ReviewUploadInit = {
  review: StudentReviewView;
  uploadUrl: string;
  key: string;
};
