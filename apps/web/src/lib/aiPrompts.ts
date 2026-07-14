import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AiPromptView, UpdateAiPromptInput } from '@mentra/shared';
import { apiFetch } from './api.js';

/**
 * AI-prompt tuning module ('manage-ai-prompts'). Lists every tunable AI system prompt
 * (registry default merged with any stored override), lets a manager save an override
 * (system text + temperature) or reset a prompt back to its code default. Every mutation
 * invalidates the list so the effective values re-render immediately.
 */
const base = '/api/v1/ai-prompts';

export function useAiPrompts() {
  return useQuery({
    queryKey: ['ai-prompts'],
    queryFn: () => apiFetch<AiPromptView[]>(base),
  });
}

function useInvalidatePrompts() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['ai-prompts'] });
}

export function useSaveAiPrompt() {
  const invalidate = useInvalidatePrompts();
  return useMutation({
    mutationFn: ({ key, ...input }: UpdateAiPromptInput & { key: string }) =>
      apiFetch<AiPromptView>(`${base}/${encodeURIComponent(key)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

export function useResetAiPrompt() {
  const invalidate = useInvalidatePrompts();
  return useMutation({
    mutationFn: (key: string) =>
      apiFetch<AiPromptView>(`${base}/${encodeURIComponent(key)}/reset`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}
