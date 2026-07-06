import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CommunityCommentView,
  CommunityMemberView,
  CommunityPostView,
  CreateCommentInput,
  CreatePostInput,
  UpdatePostInput,
} from '@mentra/shared';
import { apiFetch } from './api.js';

const base = '/api/v1/community';

/** Compact relative-time label, e.g. "just now", "5m", "3h", "2d", else a date. */
export function formatAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(then);
}

// --- Posts ---

export function usePosts() {
  return useQuery({
    queryKey: ['community', 'posts'],
    queryFn: () => apiFetch<CommunityPostView[]>(`${base}/posts`),
  });
}

/** One student's posts — the activity feed on their public profile. */
export function useAuthorPosts(userId: string | undefined) {
  return useQuery({
    queryKey: ['community', 'posts', 'author', userId],
    queryFn: () => apiFetch<CommunityPostView[]>(`${base}/posts?author=${encodeURIComponent(userId ?? '')}`),
    enabled: Boolean(userId),
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput) =>
      apiFetch<CommunityPostView>(`${base}/posts`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community', 'posts'] }),
  });
}

export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePostInput }) =>
      apiFetch<CommunityPostView>(`${base}/posts/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community', 'posts'] }),
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`${base}/posts/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community', 'posts'] }),
  });
}

export function useTogglePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<CommunityPostView>(`${base}/posts/${id}/pin`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community', 'posts'] }),
  });
}

// --- Comments ---

export function useComments(postId: string | null) {
  return useQuery({
    queryKey: ['community', 'comments', postId],
    queryFn: () => apiFetch<CommunityCommentView[]>(`${base}/posts/${postId}/comments`),
    enabled: !!postId,
  });
}

export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, input }: { postId: string; input: CreateCommentInput }) =>
      apiFetch<CommunityCommentView>(`${base}/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['community', 'comments', c.postId] });
      qc.invalidateQueries({ queryKey: ['community', 'posts'] });
    },
  });
}

export function useDeleteComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`${base}/comments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community', 'comments', postId] });
      qc.invalidateQueries({ queryKey: ['community', 'posts'] });
    },
  });
}

// --- Mention autocomplete ---

export function useSearchMembers(q: string) {
  return useQuery({
    queryKey: ['community', 'members', q],
    queryFn: () => apiFetch<CommunityMemberView[]>(`${base}/members?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 0,
    staleTime: 30_000,
  });
}
