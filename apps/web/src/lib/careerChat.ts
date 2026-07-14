import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CareerChatMessageView } from '@mentra/shared';
import { apiFetch } from './api.js';

const base = '/api/v1/career-chat';
const key = ['career-chat', 'messages'];

/** The full conversation with the mentor coach. */
export function useCareerChat() {
  return useQuery({
    queryKey: key,
    queryFn: () => apiFetch<CareerChatMessageView[]>(`${base}/messages`),
  });
}

/** Send a message; the coach's reply (and any session invite) come back in the list. */
export function useSendCareerMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<CareerChatMessageView[]>(`${base}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    onSuccess: (messages) => qc.setQueryData(key, messages),
  });
}

/**
 * Proactive idle nudge: after the student goes quiet, ask the coach to send a gentle
 * follow-up. The backend no-ops (returns the same list) if a nudge isn't warranted.
 */
export function useNudge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<CareerChatMessageView[]>(`${base}/nudge`, { method: 'POST' }),
    onSuccess: (messages) => qc.setQueryData(key, messages),
  });
}

/** Enroll on a session-invite card — auto-likes + comments, then confirms in-chat. */
export function useEnrollSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch<CareerChatMessageView[]>(`${base}/enroll`, {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      }),
    onSuccess: (messages) => qc.setQueryData(key, messages),
  });
}
