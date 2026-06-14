import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DashboardOverview } from '@mentra/shared';
import { apiFetch } from './api.js';

export function useDashboardOverview() {
  return useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => apiFetch<DashboardOverview>('/api/v1/dashboard/overview'),
    staleTime: 30_000,
  });
}

export function useAckRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { recId: string; action: 'clicked' | 'dismissed' }) =>
      apiFetch<void>(`/api/v1/dashboard/next-steps/${encodeURIComponent(args.recId)}/ack`, {
        method: 'POST',
        body: JSON.stringify({ action: args.action }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard', 'overview'] }),
  });
}
