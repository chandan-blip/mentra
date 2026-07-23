import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CustomLearningRequestInput,
  CustomLearningResult,
  LearningCategoryView,
  LearningProgressView,
  LearningTestSubmitResult,
  LearningTestView,
  SubmitLearningTestInput,
} from '@mentra/shared';
import { apiFetch } from './api.js';

const base = '/api/v1/learning';

/** Test-series categories: the student's own + the shared library. */
export function useLearningCategories() {
  return useQuery({
    queryKey: ['learning', 'categories', 'me'],
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

/** Live topic search (own + shared) for the "an existing topic matches" hint. Skips short queries. */
export function useSearchTopics(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['learning', 'search', q],
    queryFn: () => apiFetch<LearningCategoryView[]>(`${base}/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    staleTime: 30_000,
  });
}

/**
 * "Build your own" custom quiz — serves an existing shared quiz if one matches the topic +
 * experience level, otherwise generates and caches a new one (this call may take several
 * seconds while the AI generates). Returns where to navigate.
 */
export function useCreateCustomQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomLearningRequestInput) =>
      apiFetch<CustomLearningResult>(`${base}/custom`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['learning'] }),
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
