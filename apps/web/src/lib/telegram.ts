import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api.js';

/**
 * Telegram channel registry (admin). One bot (server-side token) serves every channel;
 * this manages which chats it posts to and which events each one receives.
 */
const base = '/api/v1/telegram';

export type TelegramEvent = { key: string; label: string };

export type TelegramChannel = {
  id: string;
  label: string;
  chatId: string;
  purpose: 'notify' | 'smm' | string;
  /** Empty means "every event" — the API stores null for that. */
  events: string[];
  active: boolean;
  sortOrder: number;
  createdAt: string;
};

export type TelegramOverview = {
  botConfigured: boolean;
  webhookSecretSet: boolean;
  webhookUrl: string;
  events: TelegramEvent[];
  channels: TelegramChannel[];
};

export type ChannelInput = {
  label: string;
  chatId: string;
  purpose?: string;
  events?: string[];
  sortOrder?: number;
};

export function useTelegram() {
  return useQuery({
    queryKey: ['telegram'],
    queryFn: () => apiFetch<TelegramOverview>(base),
  });
}

function useInvalidateTelegram() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['telegram'] });
}

export function useCreateChannel() {
  const invalidate = useInvalidateTelegram();
  return useMutation({
    mutationFn: (input: ChannelInput) =>
      apiFetch<TelegramChannel>(`${base}/channels`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: invalidate,
  });
}

export function useUpdateChannel() {
  const invalidate = useInvalidateTelegram();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<ChannelInput> & { id: string; active?: boolean }) =>
      apiFetch<TelegramChannel>(`${base}/channels/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: invalidate,
  });
}

export function useDeleteChannel() {
  const invalidate = useInvalidateTelegram();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`${base}/channels/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

/** Sends a real message — the fastest way to prove the bot is an admin of the chat. */
export function useTestChannel() {
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ sent: boolean }>(`${base}/channels/${id}/test`, { method: 'POST' }),
  });
}
