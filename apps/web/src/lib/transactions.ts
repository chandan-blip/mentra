import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReviewTransactionInput, TransactionStatus, TransactionView } from '@mentra/shared';
import { apiFetch } from './api.js';

const base = '/api/v1/transaction';

export function useTransactions(status?: TransactionStatus) {
  return useQuery({
    queryKey: ['transaction', 'list', status ?? 'all'],
    queryFn: () =>
      apiFetch<TransactionView[]>(`${base}/transactions${status ? `?status=${status}` : ''}`),
    refetchInterval: 30_000,
  });
}

export function useReviewTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReviewTransactionInput }) =>
      apiFetch<TransactionView>(`${base}/transactions/${id}/review`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transaction', 'list'] }),
  });
}
