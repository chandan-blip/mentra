import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ConnectChannelInput,
  CreateMarketingPostInput,
  LinkedInAuthUrlResponse,
  MarketingChannel,
  MarketingConnectionView,
  MarketingPostView,
} from '@mentra/shared';
import { apiFetch } from './api.js';

const base = '/api/v1/marketing';

/** Compact number, e.g. 1.2k. */
export const formatCount = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function useConnections() {
  return useQuery({
    queryKey: ['marketing', 'connections'],
    queryFn: () => apiFetch<MarketingConnectionView[]>(`${base}/connections`),
  });
}

export function useConnectChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ConnectChannelInput) =>
      apiFetch<MarketingConnectionView[]>(`${base}/connections`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'connections'] }),
  });
}

export function useDisconnectChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channel: MarketingChannel) =>
      apiFetch<MarketingConnectionView[]>(`${base}/connections/${channel}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'connections'] }),
  });
}

export function useMarketingPosts(channel: MarketingChannel) {
  return useQuery({
    queryKey: ['marketing', 'posts', channel],
    queryFn: () => apiFetch<MarketingPostView[]>(`${base}/posts?channel=${channel}`),
  });
}

export function useCreateMarketingPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMarketingPostInput) =>
      apiFetch<MarketingPostView>(`${base}/posts`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (post) => qc.invalidateQueries({ queryKey: ['marketing', 'posts', post.channel] }),
  });
}

/** Start the LinkedIn OAuth flow — returns the consent URL to redirect to. */
export function useLinkedInAuthUrl() {
  return useMutation({
    mutationFn: () => apiFetch<LinkedInAuthUrlResponse>(`${base}/linkedin/auth-url`),
  });
}

/** Pull real like/comment counts for the user's LinkedIn posts. */
export function useSyncLinkedInStats() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<MarketingPostView[]>(`${base}/linkedin/sync`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'posts', 'linkedin'] }),
  });
}
