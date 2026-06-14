import { useQuery } from '@tanstack/react-query';
import type { AdminPlan, MeAccess } from '@mentra/shared';
import { apiFetch } from './api.js';

export function useMyAccess() {
  return useQuery({
    queryKey: ['me', 'modules'],
    queryFn: () => apiFetch<MeAccess>('/api/v1/me/modules'),
    staleTime: 60_000,
  });
}

/** Active subscription plans, for the student-facing Subscriptions page. */
export function useStudentPlans() {
  return useQuery({
    queryKey: ['me', 'plans'],
    queryFn: () => apiFetch<AdminPlan[]>('/api/v1/me/plans'),
    staleTime: 60_000,
  });
}
