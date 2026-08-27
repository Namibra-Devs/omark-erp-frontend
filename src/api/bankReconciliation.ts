// src/api/bankReconciliation.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData } from '@/api/client';
import type { ApiResponse } from '@/types';

// --- Types ---

export interface UnmatchedBankEntry {
  id: string;
  date: string;
  description: string;
  amountMinor: number;
  reference?: string;
}

export interface BankTransactionInput {
  date: string;
  amountMinor: number;
  reference?: string;
  description?: string;
}

export interface ImportBankStatementPayload {
  transactions: BankTransactionInput[];
}

export interface MatchedReconciliationItem {
  transaction: {
    date: string;
    amountMinor: number;
    reference?: string;
    description?: string;
  };
  payment: {
    id: string;
    amountMinor: number;
    paidOn: string;
    reference?: string;
  };
}

export interface UnmatchedReconciliationItem {
  date: string;
  amountMinor: number;
  reference?: string;
  description?: string;
}

export interface BankReconciliationSummary {
  totalImported: number;
  matchedCount: number;
  unmatchedCount: number;
  matched: MatchedReconciliationItem[];
  unmatched: UnmatchedReconciliationItem[];
}

// --- Query Keys ---

export const bankReconciliationKeys = {
  all: ['bank-reconciliation'] as const,
  unmatched: () => [...bankReconciliationKeys.all, 'unmatched'] as const,
};

// --- Hooks ---

export function useUnmatchedBankEntriesQuery(enabled = true) {
  return useQuery({
    queryKey: bankReconciliationKeys.unmatched(),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<UnmatchedBankEntry[]>>('/bank-reconciliation/unmatched');
      return unwrapData(res) ?? [];
    },
    enabled,
  });
}

export function useImportBankStatementMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ImportBankStatementPayload) => {
      const res = await apiClient.post<ApiResponse<BankReconciliationSummary>>('/bank-reconciliation/import', payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankReconciliationKeys.all });
    },
  });
}
