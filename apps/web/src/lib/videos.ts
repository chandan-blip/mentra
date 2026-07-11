import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LiveSessionView } from '@mentra/shared';
import { apiFetch } from './api.js';
import { uploadFileToR2 } from './live.js';

/**
 * Videos-management module ('manage-videos'). CRUD over the existing recordings + uploads:
 * list, edit title/topic, toggle visibility, delete, and manage the cover (regenerate AI
 * or upload a custom image). Mutations invalidate both the videos list and the student
 * `['live', …]` feeds so hidden/deleted videos disappear there too.
 */
const base = '/api/v1/videos';

export function useManagedVideos(search: string) {
  return useQuery({
    queryKey: ['videos', 'list', search],
    queryFn: () => apiFetch<LiveSessionView[]>(`${base}${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  });
}

function useInvalidateVideos() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['videos'] });
    qc.invalidateQueries({ queryKey: ['live'] });
  };
}

export function useUpdateVideo() {
  const invalidate = useInvalidateVideos();
  return useMutation({
    mutationFn: ({ id, title, topic }: { id: string; title?: string; topic?: string }) =>
      apiFetch<LiveSessionView>(`${base}/${id}`, { method: 'PATCH', body: JSON.stringify({ title, topic }) }),
    onSuccess: invalidate,
  });
}

export function useSetVideoVisibility() {
  const invalidate = useInvalidateVideos();
  return useMutation({
    mutationFn: ({ id, visible }: { id: string; visible: boolean }) =>
      apiFetch<LiveSessionView>(`${base}/${id}/visibility`, {
        method: 'POST',
        body: JSON.stringify({ visible }),
      }),
    onSuccess: invalidate,
  });
}

export function useSetVideoPublic() {
  const invalidate = useInvalidateVideos();
  return useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      apiFetch<LiveSessionView>(`${base}/${id}/public`, {
        method: 'POST',
        body: JSON.stringify({ isPublic }),
      }),
    onSuccess: invalidate,
  });
}

/** Public (no-auth) fetch of a shared video for the /watch/:id page. */
export function usePublicVideo(id: string | null) {
  return useQuery({
    queryKey: ['public-video', id],
    queryFn: () => apiFetch<LiveSessionView>(`/api/v1/public/videos/${id}`),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useDeleteVideo() {
  const invalidate = useInvalidateVideos();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: boolean }>(`${base}/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useRegenerateThumbnail() {
  const invalidate = useInvalidateVideos();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`${base}/${id}/thumbnail/regenerate`, { method: 'POST' }),
    // The worker fills thumbnailUrl asynchronously; invalidate so a later refetch picks it up.
    onSuccess: invalidate,
  });
}

/** Upload a custom cover: presign → PUT to R2 → finalize (sets thumbnailUrl). */
export function useUploadThumbnail() {
  const invalidate = useInvalidateVideos();
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const contentType = file.type;
      const { uploadUrl, key } = await apiFetch<{ uploadUrl: string; key: string }>(
        `${base}/${id}/thumbnail/upload`,
        { method: 'POST', body: JSON.stringify({ contentType }) },
      );
      await uploadFileToR2(uploadUrl, file, contentType);
      return apiFetch<LiveSessionView>(`${base}/${id}/thumbnail/finalize`, {
        method: 'POST',
        body: JSON.stringify({ key }),
      });
    },
    onSuccess: invalidate,
  });
}
