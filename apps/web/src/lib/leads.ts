import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CallRunResult,
  CreateLeadInput,
  CreateLeadListInput,
  LeadCallView,
  LeadListView,
  LeadView,
  SendListEmailInput,
  StartCallRunInput,
  UpdateLeadInput,
  UpdateLeadListInput,
} from '@mentra/shared';
import { apiFetch } from './api.js';

const base = '/api/v1/leads';

// --- Leads ---

export function useLeads() {
  return useQuery({ queryKey: ['leads', 'all'], queryFn: () => apiFetch<LeadView[]>(base) });
}

export function useLead(id: string | null) {
  return useQuery({
    queryKey: ['leads', 'one', id],
    queryFn: () => apiFetch<LeadView>(`${base}/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLeadInput) => apiFetch<LeadView>(base, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLeadInput }) =>
      apiFetch<LeadView>(`${base}/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: boolean }>(`${base}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

// --- Lists ---

export function useLeadLists() {
  return useQuery({ queryKey: ['leads', 'lists'], queryFn: () => apiFetch<LeadListView[]>(`${base}/lists`) });
}

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLeadListInput) =>
      apiFetch<LeadListView>(`${base}/lists`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads', 'lists'] }),
  });
}

export function useUpdateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLeadListInput }) =>
      apiFetch<LeadListView>(`${base}/lists/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads', 'lists'] }),
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: boolean }>(`${base}/lists/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads', 'lists'] }),
  });
}

export function useListMembers(listId: string | null) {
  return useQuery({
    queryKey: ['leads', 'list-members', listId],
    queryFn: () => apiFetch<LeadView[]>(`${base}/lists/${listId}/members`),
    enabled: Boolean(listId),
  });
}

export function useAddToList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, leadIds }: { listId: string; leadIds: string[] }) =>
      apiFetch<LeadListView>(`${base}/lists/${listId}/members`, { method: 'POST', body: JSON.stringify({ leadIds }) }),
    onSuccess: (_d, { listId }) => {
      qc.invalidateQueries({ queryKey: ['leads', 'lists'] });
      qc.invalidateQueries({ queryKey: ['leads', 'list-members', listId] });
    },
  });
}

export function useRemoveFromList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, leadIds }: { listId: string; leadIds: string[] }) =>
      apiFetch<LeadListView>(`${base}/lists/${listId}/members`, { method: 'DELETE', body: JSON.stringify({ leadIds }) }),
    onSuccess: (_d, { listId }) => {
      qc.invalidateQueries({ queryKey: ['leads', 'lists'] });
      qc.invalidateQueries({ queryKey: ['leads', 'list-members', listId] });
    },
  });
}

// --- Actions ---

export function useStartCallRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, input }: { listId: string; input: StartCallRunInput }) =>
      apiFetch<CallRunResult>(`${base}/lists/${listId}/call`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads', 'calls'] }),
  });
}

export function useSendListEmail() {
  return useMutation({
    mutationFn: ({ listId, input }: { listId: string; input: SendListEmailInput }) =>
      apiFetch<{ recipients: number }>(`${base}/lists/${listId}/email`, { method: 'POST', body: JSON.stringify(input) }),
  });
}

export function useLeadCalls(listId?: string) {
  return useQuery({
    queryKey: ['leads', 'calls', listId ?? 'all'],
    queryFn: () => apiFetch<LeadCallView[]>(`${base}/calls${listId ? `?listId=${listId}` : ''}`),
    refetchInterval: 10_000,
  });
}

/** Call history for a single lead. */
export function useLeadCallHistory(leadId: string | null) {
  return useQuery({
    queryKey: ['leads', 'calls', 'lead', leadId],
    queryFn: () => apiFetch<LeadCallView[]>(`${base}/calls?leadId=${leadId}`),
    enabled: Boolean(leadId),
    refetchInterval: 10_000,
  });
}

/** Place a single AI call to one lead. */
export function useCallLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, input }: { leadId: string; input: StartCallRunInput }) =>
      apiFetch<LeadCallView>(`${base}/${leadId}/call`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (_d, { leadId }) => {
      qc.invalidateQueries({ queryKey: ['leads', 'calls', 'lead', leadId] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}
