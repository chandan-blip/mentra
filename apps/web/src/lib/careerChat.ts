import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CareerChatMessageView } from '@mentra/shared';
import { apiFetch } from './api.js';

const base = '/api/v1/career-chat';
const key = ['career-chat', 'messages'];

/**
 * Merge a turn's delta into the cached thread by id: existing messages keep their place
 * (an updated row — e.g. an invite card flipping to "enrolled" — is replaced in situ),
 * and genuinely new messages append in order. So the write endpoints only send the rows
 * they created/changed, never the whole conversation.
 */
function appendMessages(qc: ReturnType<typeof useQueryClient>, delta: CareerChatMessageView[]) {
  if (delta.length === 0) return;
  qc.setQueryData<CareerChatMessageView[]>(key, (prev) => {
    const byId = new Map((prev ?? []).map((m) => [m.id, m]));
    for (const m of delta) byId.set(m.id, m);
    return [...byId.values()];
  });
}

/** The full conversation with the mentor coach (loaded once; writes append to it). */
export function useCareerChat() {
  return useQuery({
    queryKey: key,
    queryFn: () => apiFetch<CareerChatMessageView[]>(`${base}/messages`),
  });
}

/** Send a message; only the new student turn + coach reply (+ any invite) come back. */
export function useSendCareerMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<CareerChatMessageView[]>(`${base}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    onSuccess: (delta) => appendMessages(qc, delta),
  });
}

/**
 * Proactive idle nudge: after the student goes quiet, ask the coach to send a gentle
 * follow-up. Returns just the new nudge message, or an empty array when none is warranted.
 */
export function useNudge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<CareerChatMessageView[]>(`${base}/nudge`, { method: 'POST' }),
    onSuccess: (delta) => appendMessages(qc, delta),
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
    onSuccess: (delta) => appendMessages(qc, delta),
  });
}
