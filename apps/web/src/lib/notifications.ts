import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationView } from '@mentra/shared';
import { apiFetch } from './api.js';

const base = '/api/v1/notification';

export function useNotifications() {
  return useQuery({
    queryKey: ['notif', 'list'],
    queryFn: () => apiFetch<NotificationView[]>(base),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notif', 'count'],
    queryFn: () => apiFetch<{ count: number }>(`${base}/unread-count`),
    refetchInterval: 30_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`${base}/${id}/read`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notif', 'list'] });
      qc.invalidateQueries({ queryKey: ['notif', 'count'] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ ok: true }>(`${base}/read-all`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notif', 'list'] });
      qc.invalidateQueries({ queryKey: ['notif', 'count'] });
    },
  });
}
