// src/api/expenses.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList, type ListResult } from '@/api/client';
import type { ApiResponse } from '@/types';

export interface ExpenseEntity {
  id: string;
  code?: string;
  category: string;
  type: 'internal' | 'external';
  amountMinor: number;
  incurredOn: string;
  branchId?: string;
  branchName?: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  recordedByUserId?: string;
  recordedByUserName?: string;
  decisionNote?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpensesListParams {
  type?: 'internal' | 'external';
  status?: 'pending' | 'approved' | 'rejected';
  branchId?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateExpensePayload {
  category: string;
  type: 'internal' | 'external';
  amountMinor: number;
  incurredOn: string;
  branchId?: string;
  description?: string;
}

export interface ExpenseDecisionPayload {
  decision: 'approved' | 'rejected';
  note?: string;
}

export const expensesKeys = {
  all: ['expenses'] as const,
  lists: () => [...expensesKeys.all, 'list'] as const,
  list: (params?: ExpensesListParams) => [...expensesKeys.lists(), params ?? {}] as const,
};

export function useExpensesQuery(params?: ExpensesListParams) {
  return useQuery({
    queryKey: expensesKeys.list(params),
    queryFn: async (): Promise<ListResult<ExpenseEntity>> => {
      try {
        const res = await apiClient.get<ApiResponse<ExpenseEntity[]>>('/expenses', { params });
        return unwrapList(res);
      } catch (err: any) {
        console.warn('Could not fetch expenses:', err?.message || err);
        return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
      }
    },
  });
}

export function useCreateExpenseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateExpensePayload) => {
      const res = await apiClient.post<ApiResponse<ExpenseEntity>>('/expenses', payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expensesKeys.all });
    },
  });
}

export function useDeleteExpenseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<ApiResponse<{ deleted: boolean }>>(`/expenses/${id}`);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expensesKeys.all });
    },
  });
}

export function useExpenseDecisionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ExpenseDecisionPayload }) => {
      const res = await apiClient.post<ApiResponse<ExpenseEntity>>(`/expenses/${id}/decision`, payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expensesKeys.all });
    },
  });
}
