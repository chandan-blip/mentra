import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CodingProgressView,
  CodingSubmissionAdminView,
  CodingSubmissionView,
  CodingTaskAdminView,
  CodingTaskDetail,
  CodingTaskListItem,
  CreateCodingTaskInput,
  SubmitCodingInput,
  UpdateCodingTaskInput,
} from '@mentra/shared';
import { apiFetch } from './api.js';

/**
 * Coding module hooks. Student side (`/api/v1/coding`): task list, task detail, submit,
 * progress. Manager side (`/api/v1/coding-tasks`): CRUD + submissions. Manager mutations
 * invalidate both `['coding-tasks']` (manager table) and `['coding']` (student feed) so a
 * new/hidden/deleted task shows up for students immediately.
 */
const studentBase = '/api/v1/coding';
const adminBase = '/api/v1/coding-tasks';

// --- Student ---

export function useCodingTasks() {
  return useQuery({
    queryKey: ['coding', 'tasks'],
    queryFn: () => apiFetch<CodingTaskListItem[]>(`${studentBase}/tasks`),
  });
}

export function useCodingTask(taskId: string | null) {
  return useQuery({
    queryKey: ['coding', 'task', taskId],
    queryFn: () => apiFetch<CodingTaskDetail>(`${studentBase}/tasks/${taskId}`),
    enabled: Boolean(taskId),
  });
}

export function useCodingProgress() {
  return useQuery({
    queryKey: ['coding', 'progress'],
    queryFn: () => apiFetch<CodingProgressView>(`${studentBase}/progress`),
  });
}

export function useSubmitCoding(taskId: string, questionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitCodingInput) =>
      apiFetch<CodingSubmissionView>(`${studentBase}/tasks/${taskId}/questions/${questionId}/submit`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coding'] });
    },
  });
}

// --- Manager ---

function useInvalidateCoding() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['coding-tasks'] });
    qc.invalidateQueries({ queryKey: ['coding'] });
  };
}

export function useAdminCodingTasks() {
  return useQuery({
    queryKey: ['coding-tasks', 'list'],
    queryFn: () => apiFetch<CodingTaskAdminView[]>(adminBase),
  });
}

export function useCreateCodingTask() {
  const invalidate = useInvalidateCoding();
  return useMutation({
    mutationFn: (body: CreateCodingTaskInput) =>
      apiFetch<CodingTaskAdminView>(adminBase, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
}

export function useUpdateCodingTask() {
  const invalidate = useInvalidateCoding();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateCodingTaskInput }) =>
      apiFetch<CodingTaskAdminView>(`${adminBase}/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: invalidate,
  });
}

export function useDeleteCodingTask() {
  const invalidate = useInvalidateCoding();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: boolean }>(`${adminBase}/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useCodingTaskSubmissions(taskId: string | null) {
  return useQuery({
    queryKey: ['coding-tasks', 'submissions', taskId],
    queryFn: () => apiFetch<CodingSubmissionAdminView[]>(`${adminBase}/${taskId}/submissions`),
    enabled: Boolean(taskId),
  });
}
