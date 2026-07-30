import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api.js';

/**
 * SMM panel config + order queue (admin). The panel API key is write-only: the server
 * returns `apiKeySet` instead of the value, so the form submits a key only when changing it.
 */
const base = '/api/v1/smm';

export type SmmConfig = {
  enabled: boolean;
  apiUrl: string;
  apiKeySet: boolean;
  viewsEnabled: boolean;
  viewsServiceId: string;
  viewsQuantity: number;
  reactionsEnabled: boolean;
  reactionsServiceId: string;
  reactionsQuantity: number;
};

export type SmmQueueItem = {
  id: string;
  postUrl: string;
  contextLabel: string;
  status: 'pending' | 'processing' | 'done' | 'failed' | string;
  attempts: number;
  placed: number;
  viewsOrderId: string | null;
  reactionsOrderId: string | null;
  lastError: string | null;
  processedAt: string | null;
  createdAt: string;
};

export type SmmOverview = {
  config: SmmConfig;
  webhookEnabled: boolean;
  queue: SmmQueueItem[];
  counts: Record<string, number>;
};

export function useSmm() {
  return useQuery({
    queryKey: ['smm'],
    queryFn: () => apiFetch<SmmOverview>(base),
    // The worker processes rows on a 10–20s cadence, so a slow poll keeps the queue
    // honest without hammering the API.
    refetchInterval: 15_000,
  });
}

function useInvalidateSmm() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['smm'] });
}

export type SmmConfigInput = Partial<Omit<SmmConfig, 'apiKeySet'>> & { apiKey?: string };

export function useSaveSmmConfig() {
  const invalidate = useInvalidateSmm();
  return useMutation({
    mutationFn: (input: SmmConfigInput) =>
      apiFetch<SmmConfig>(`${base}/config`, { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: invalidate,
  });
}

export function useSetWebhookEnabled() {
  const invalidate = useInvalidateSmm();
  return useMutation({
    mutationFn: (enabled: boolean) =>
      apiFetch<{ enabled: boolean }>(`${base}/webhook-enabled`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: invalidate,
  });
}

export function useOrderPost() {
  const invalidate = useInvalidateSmm();
  return useMutation({
    mutationFn: (postUrl: string) =>
      apiFetch<{ queued: boolean }>(`${base}/orders`, { method: 'POST', body: JSON.stringify({ postUrl }) }),
    onSuccess: invalidate,
  });
}

export function useRetryQueueItem() {
  const invalidate = useInvalidateSmm();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ retried: boolean }>(`${base}/queue/${id}/retry`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

export function useDeleteQueueItem() {
  const invalidate = useInvalidateSmm();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`${base}/queue/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
