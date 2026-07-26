import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateReviewInput,
  ReviewUploadInit,
  StudentReviewView,
  UpdateReviewInput,
} from '@mentra/shared';
import { apiFetch } from './api.js';
import { uploadFileToR2 } from './live.js';

/**
 * Feedbacks & Reviews. Students read the visible gallery ('/api/v1/reviews'); managers
 * upload and manage reviews ('/api/v1/manage-reviews'). Manager mutations invalidate both
 * the manager list and the student gallery so changes appear in both places.
 */
const studentBase = '/api/v1/reviews';
const publicBase = '/api/v1/public/reviews';
const adminBase = '/api/v1/manage-reviews';

/** Student gallery — visible, finalized reviews. */
export function useReviews() {
  return useQuery({
    queryKey: ['reviews', 'published'],
    queryFn: () => apiFetch<StudentReviewView[]>(studentBase),
  });
}

/** Same gallery, no login required — powers the public /reviews page. */
export function usePublicReviews() {
  return useQuery({
    queryKey: ['reviews', 'public'],
    queryFn: () => apiFetch<StudentReviewView[]>(publicBase),
    retry: false,
  });
}

/** Manager list — all reviews (visible + hidden). */
export function useManagedReviews() {
  return useQuery({
    queryKey: ['reviews', 'managed'],
    queryFn: () => apiFetch<StudentReviewView[]>(adminBase),
  });
}

function useInvalidateReviews() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['reviews'] });
}

/**
 * Upload a review in one shot: create the row (presign) → PUT the file straight to R2 →
 * finalize (publish). Reports upload progress via the optional callback.
 */
export function useUploadReview() {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: async (args: {
      meta: Omit<CreateReviewInput, 'contentType'>;
      file: File;
      onProgress?: (fraction: number) => void;
    }) => {
      const contentType = args.file.type || (args.meta.mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
      const { review, uploadUrl } = await apiFetch<ReviewUploadInit>(adminBase, {
        method: 'POST',
        body: JSON.stringify({ ...args.meta, contentType }),
      });
      await uploadFileToR2(uploadUrl, args.file, contentType, args.onProgress);
      return apiFetch<StudentReviewView>(`${adminBase}/${review.id}/finalize`, { method: 'POST' });
    },
    onSuccess: invalidate,
  });
}

export function useUpdateReview() {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: (args: { id: string; patch: UpdateReviewInput }) =>
      apiFetch<StudentReviewView>(`${adminBase}/${args.id}`, {
        method: 'PATCH',
        body: JSON.stringify(args.patch),
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteReview() {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: boolean }>(`${adminBase}/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
