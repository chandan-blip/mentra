import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateJobInput,
  DiscoverJobsInput,
  HrDiscoverJobsInput,
  JobDiscoveryResult,
  JobView,
  UpdateJobInput,
} from '@mentra/shared';
import { apiFetch } from './api.js';

const base = '/api/v1/jobs';

// --- Student board ---

export function useStudentJobs() {
  return useQuery({
    queryKey: ['jobs', 'board'],
    queryFn: () => apiFetch<JobView[]>(base),
    staleTime: 30_000,
  });
}

export function useDiscoverJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DiscoverJobsInput) =>
      apiFetch<JobDiscoveryResult>(`${base}/discover`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs', 'board'] }),
  });
}

// --- HR management ---

export function useHrJobs() {
  return useQuery({
    queryKey: ['jobs', 'manage'],
    queryFn: () => apiFetch<JobView[]>(`${base}/manage`),
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJobInput) =>
      apiFetch<JobView>(`${base}/manage`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs', 'manage'] }),
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateJobInput }) =>
      apiFetch<JobView>(`${base}/manage/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs', 'manage'] }),
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: boolean }>(`${base}/manage/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs', 'manage'] }),
  });
}

export function useHrDiscoverJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: HrDiscoverJobsInput) =>
      apiFetch<JobDiscoveryResult>(`${base}/manage/discover`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs', 'manage'] }),
  });
}

// --- Shared presentation helpers ---

export const LOCATION_TYPE_LABEL: Record<JobView['locationType'], string> = {
  onsite: 'On-site',
  remote: 'Remote',
  hybrid: 'Hybrid',
};

export const EMPLOYMENT_LABEL: Record<JobView['employmentType'], string> = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  internship: 'Internship',
  contract: 'Contract',
};

export const EXPERIENCE_LABEL: Record<JobView['experienceLevel'], string> = {
  entry: 'Entry',
  mid: 'Mid',
  senior: 'Senior',
};
