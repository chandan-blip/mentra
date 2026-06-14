import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssignmentStatusView, AssignmentSubmission, AssignmentView } from '@mentra/shared';
import { apiFetch } from './api.js';

const base = '/api/v1/assignment';

/** Cheap status for CTAs — does NOT trigger AI generation. */
export function useAssignmentStatus() {
  return useQuery({
    queryKey: ['assignment', 'status'],
    queryFn: () => apiFetch<AssignmentStatusView>(`${base}/me/status`),
  });
}

/**
 * The student's assignment. The first load may take a few seconds — the API
 * generates it from their profile via the AI on demand, then caches it. We don't
 * retry on failure (a failed generation is surfaced, not silently re-attempted).
 */
export function useAssignment() {
  return useQuery({
    queryKey: ['assignment', 'me'],
    queryFn: () => apiFetch<AssignmentView>(`${base}/me`),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useSubmitAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (submission: AssignmentSubmission) =>
      apiFetch<AssignmentView>(`${base}/me/submit`, {
        method: 'POST',
        body: JSON.stringify(submission),
      }),
    onSuccess: (view) => {
      qc.setQueryData(['assignment', 'me'], view);
      qc.invalidateQueries({ queryKey: ['assignment', 'status'] });
      // Completing the assignment triggers roadmap (re)generation server-side.
      qc.invalidateQueries({ queryKey: ['roadmap'] });
    },
  });
}
