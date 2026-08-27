// src/api/payroll.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList, type ListResult } from '@/api/client';
import type { ApiResponse } from '@/types';

export interface PayrollRecord {
  id: string;
  staffUserId: string;
  staffName?: string;
  staffRole?: string;
  branchId?: string;
  branchName?: string;
  month: string; // YYYY-MM
  baseSalaryMinor: number;
  bonusMinor: number;
  deductionsMinor: number;
  netSalaryMinor: number;
  status: 'pending' | 'approved' | 'paid';
  paidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollListParams {
  month?: string;
  staffUserId?: string;
  branchId?: string;
  status?: 'pending' | 'approved' | 'paid';
  page?: number;
  pageSize?: number;
}

export interface CreatePayrollPayload {
  staffUserId: string;
  month: string;
  baseSalaryMinor: number;
  bonusMinor?: number;
  deductionsMinor?: number;
  notes?: string;
}

export interface BulkPayrollRunPayload {
  month: string;
  branchId?: string;
}

export interface UpdatePayrollPayload {
  baseSalaryMinor?: number;
  bonusMinor?: number;
  deductionsMinor?: number;
  status?: 'pending' | 'approved' | 'paid';
  notes?: string;
}

export const payrollKeys = {
  all: ['payroll'] as const,
  lists: () => [...payrollKeys.all, 'list'] as const,
  list: (params?: PayrollListParams) => [...payrollKeys.lists(), params ?? {}] as const,
};

export function usePayrollQuery(params?: PayrollListParams) {
  return useQuery({
    queryKey: payrollKeys.list(params),
    queryFn: async (): Promise<ListResult<PayrollRecord>> => {
      try {
        const res = await apiClient.get<ApiResponse<PayrollRecord[]>>('/payroll', { params });
        return unwrapList(res);
      } catch (err: any) {
        console.warn('Could not fetch payroll records:', err?.message || err);
        return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
      }
    },
  });
}

export function useCreatePayrollMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreatePayrollPayload) => {
      const res = await apiClient.post<ApiResponse<PayrollRecord>>('/payroll', payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all });
    },
  });
}

export function useBulkPayrollRunMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: BulkPayrollRunPayload) => {
      const res = await apiClient.post<ApiResponse<{ count: number; items: PayrollRecord[] }>>('/payroll/run', payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all });
    },
  });
}

export function useUpdatePayrollMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdatePayrollPayload }) => {
      const res = await apiClient.patch<ApiResponse<PayrollRecord>>(`/payroll/${id}`, payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all });
    },
  });
}
