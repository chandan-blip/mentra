import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  LearningCategoryView,
  LearningProgressView,
  LearningTestSubmitResult,
  LearningTestView,
  SubmitLearningTestInput,
} from '@mentra/shared';
import { apiFetch } from './api.js';

const base = '/api/v1/learning';

/** The student's test-series categories. Generated (AI) + cached server-side on first fetch. */
export function useLearningCategories() {
  return useQuery({
    queryKey: ['learning', 'categories'],
    queryFn: () => apiFetch<LearningCategoryView[]>(`${base}/categories`),
  });
}

export function useLearningCategory(categoryId: string | undefined) {
  return useQuery({
    queryKey: ['learning', 'category', categoryId],
    queryFn: () => apiFetch<LearningCategoryView>(`${base}/categories/${categoryId}`),
    enabled: Boolean(categoryId),
  });
}

/** Aggregate learning stats for progress / achievements surfaces. */
export function useLearningProgress() {
  return useQuery({
    queryKey: ['learning', 'progress'],
    queryFn: () => apiFetch<LearningProgressView>(`${base}/progress`),
  });
}

/** Start a test — triggers on-demand MCQ generation server-side on first start. */
export function useStartLearningTest() {
  return useMutation({
    mutationFn: (testId: string) =>
      apiFetch<LearningTestView>(`${base}/tests/${testId}/start`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
  });
}

export function useSubmitLearningTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, answers }: { testId: string; answers: SubmitLearningTestInput['answers'] }) =>
      apiFetch<LearningTestSubmitResult>(`${base}/tests/${testId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learning'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}
