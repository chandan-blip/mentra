import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  RoadmapHistoryEntry,
  RoadmapItemActionResult,
  RoadmapSummary,
  RoadmapTestSubmitResult,
  RoadmapTestView,
  RoadmapTopicView,
  RoadmapView,
  SubmitRoadmapTestInput,
} from '@mentra/shared';
import { apiFetch } from './api.js';

export function useRoadmap() {
  return useQuery({
    queryKey: ['roadmap', 'active'],
    queryFn: () => apiFetch<RoadmapView | null>('/api/v1/roadmap/me'),
  });
}

export function useRoadmapHistory() {
  return useQuery({
    queryKey: ['roadmap', 'history'],
    queryFn: () => apiFetch<RoadmapHistoryEntry[]>('/api/v1/roadmap/me/history'),
  });
}

export function useRoadmapHistoryDetail(roadmapId: string | undefined) {
  return useQuery({
    queryKey: ['roadmap', 'history', roadmapId],
    queryFn: () => apiFetch<RoadmapView>(`/api/v1/roadmap/me/history/${roadmapId}`),
    enabled: Boolean(roadmapId),
  });
}

export function useRoadmapSummary() {
  return useQuery({
    queryKey: ['roadmap', 'summary'],
    queryFn: () => apiFetch<RoadmapSummary>('/api/v1/roadmap/me/summary'),
  });
}

export function useRegenerateRoadmap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) =>
      apiFetch<RoadmapView>('/api/v1/roadmap/me/regenerate', {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roadmap'] });
      qc.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
    },
  });
}

export function useRoadmapItemAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, action }: { itemId: string; action: 'start' | 'complete' }) =>
      apiFetch<RoadmapItemActionResult>(`/api/v1/roadmap/items/${itemId}/${action}`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roadmap'] });
      qc.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
    },
  });
}

// --- Topic subtopics + completion test ---

/** Topic drilldown: subtopics to learn + best/last marks. Subtopics are AI-generated
 *  on demand the first time this is fetched, so keep it disabled until needed. */
export function useRoadmapTopic(itemId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['roadmap', 'topic', itemId],
    queryFn: () => apiFetch<RoadmapTopicView>(`/api/v1/roadmap/items/${itemId}/topic`),
    enabled: Boolean(itemId) && enabled,
  });
}

/** Start (or resume) the topic test. Triggers on-demand question generation server-side. */
export function useStartTopicTest() {
  return useMutation({
    mutationFn: (itemId: string) =>
      apiFetch<RoadmapTestView>(`/api/v1/roadmap/items/${itemId}/test`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
  });
}

export function useSubmitTopicTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, answers }: { testId: string; answers: SubmitRoadmapTestInput['answers'] }) =>
      apiFetch<RoadmapTestSubmitResult>(`/api/v1/roadmap/tests/${testId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roadmap'] });
      qc.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
    },
  });
}
