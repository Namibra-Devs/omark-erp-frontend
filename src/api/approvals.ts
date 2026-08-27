// src/api/approvals.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData } from '@/api/client';
import type { ApiResponse } from '@/types';

export interface ApprovalItem {
  id: string;
  type: 'expense' | 'document' | 'pricing_override' | 'policy_exception' | string;
  title: string;
  description?: string;
  requestedBy?: string;
  branchId?: string;
  branchName?: string;
  amountMinor?: number;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ApprovalsListParams {
  type?: 'expense' | 'document';
}

export const approvalsKeys = {
  all: ['approvals'] as const,
  lists: () => [...approvalsKeys.all, 'list'] as const,
  list: (params?: ApprovalsListParams) => [...approvalsKeys.lists(), params ?? {}] as const,
};

export function useApprovalsQuery(params?: ApprovalsListParams) {
  return useQuery({
    queryKey: approvalsKeys.list(params),
    queryFn: async (): Promise<ApprovalItem[]> => {
      try {
        const res = await apiClient.get<ApiResponse<ApprovalItem[]>>('/approvals', { params });
        const data = unwrapData(res);
        if (Array.isArray(data)) return data;
        return [];
      } catch (err: any) {
        console.warn('Could not fetch approvals:', err?.message || err);
        return [];
      }
    },
  });
}

export function useApproveMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await apiClient.post<ApiResponse<ApprovalItem>>(`/approvals/${id}/approve`, { reason });
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalsKeys.all });
    },
  });
}

export function useRejectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await apiClient.post<ApiResponse<ApprovalItem>>(`/approvals/${id}/reject`, { reason });
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalsKeys.all });
    },
  });
}
