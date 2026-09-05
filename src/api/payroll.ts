// src/api/payroll.ts
//
// React Query API hooks for Payroll & Salary Records
// Integrated with backend API endpoints at /api/v1/payroll

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList, type ListResult } from '@/api/client';
import type { ApiResponse } from '@/types';
import type { SalaryType, PaymentMethod } from '@/api/compensation';

export interface PayrollRecord {
  id: string;
  code?: string;
  staffUserId: string;
  staffName?: string;
  staffRole?: string;
  branchId?: string;
  branchName?: string;
  month: string; // YYYY-MM
  salaryType?: SalaryType;
  
  // Earnings & Allowances
  baseSalaryMinor: number;
  overtimeMinor?: number;
  transportAllowanceMinor?: number;
  housingAllowanceMinor?: number;
  mealAllowanceMinor?: number;
  otherAllowanceMinor?: number;
  
  // Rule-Based Bonuses & Commission
  commissionMinor?: number;
  salesBonusMinor?: number;
  attendanceBonusMinor?: number;
  punctualityBonusMinor?: number;
  productivityBonusMinor?: number;
  projectCompletionBonusMinor?: number;
  bonusMinor: number;
  
  // Deductions
  latenessDeductionMinor?: number;
  absenceDeductionMinor?: number;
  statutoryDeductionMinor?: number;
  loanDeductionMinor?: number;
  advanceDeductionMinor?: number;
  deductionsMinor?: number;
  
  // Totals
  grossEarningsMinor?: number;
  netSalaryMinor: number;
  
  paymentMethod?: PaymentMethod;
  paymentDetails?: any;
  status: 'pending' | 'approved' | 'paid';
  paidAt?: string;
  paymentReference?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollListParams {
  page?: number;
  pageSize?: number;
  month?: string;
  branchId?: string;
  status?: 'pending' | 'approved' | 'paid';
  staffUserId?: string;
}

export interface CreatePayrollPayload {
  staffUserId: string;
  month: string;
  baseSalaryMinor: number;
  bonusMinor?: number;
  deductionsMinor?: number;
  salaryType?: SalaryType;
  overtimeMinor?: number;
  transportAllowanceMinor?: number;
  housingAllowanceMinor?: number;
  mealAllowanceMinor?: number;
  otherAllowanceMinor?: number;
  commissionMinor?: number;
  salesBonusMinor?: number;
  attendanceBonusMinor?: number;
  punctualityBonusMinor?: number;
  productivityBonusMinor?: number;
  projectCompletionBonusMinor?: number;
  latenessDeductionMinor?: number;
  absenceDeductionMinor?: number;
  statutoryDeductionMinor?: number;
  loanDeductionMinor?: number;
  advanceDeductionMinor?: number;
  grossEarningsMinor?: number;
  netSalaryMinor?: number;
  paymentMethod?: PaymentMethod;
  paymentDetails?: any;
  notes?: string;
}

export interface UpdatePayrollPayload {
  baseSalaryMinor?: number;
  bonusMinor?: number;
  deductionsMinor?: number;
  status?: 'pending' | 'approved' | 'paid';
  paidAt?: string;
  paymentReference?: string;
  notes?: string;
  [key: string]: any;
}

export interface BulkPayrollRunPayload {
  month: string;
  branchId?: string;
  staffList?: any[];
}

// --- Query Keys ---

export const payrollKeys = {
  all: ['payroll'] as const,
  lists: () => [...payrollKeys.all, 'list'] as const,
  list: (params?: PayrollListParams) => [...payrollKeys.lists(), params ?? {}] as const,
  details: () => [...payrollKeys.all, 'detail'] as const,
  detail: (id: string) => [...payrollKeys.details(), id] as const,
};

// --- Hooks ---

export function usePayrollQuery(params?: PayrollListParams) {
  return useQuery({
    queryKey: payrollKeys.list(params),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<PayrollRecord[]>>('/payroll', { params });
        const list = unwrapList(res);
        return Array.isArray(list) ? { items: list, total: list.length, page: 1, pageSize: 50 } : (list as any);
      } catch {
        return { items: [], total: 0, page: 1, pageSize: 50 };
      }
    },
  });
}

export function usePayrollDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: payrollKeys.detail(id ?? ''),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<PayrollRecord>>(`/payroll/${id}`);
        return unwrapData(res);
      } catch {
        return null;
      }
    },
    enabled: Boolean(id),
  });
}

export function useCreatePayrollMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreatePayrollPayload): Promise<PayrollRecord> => {
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
      const res = await apiClient.post<ApiResponse<any>>('/payroll/run', payload);
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
    mutationFn: async ({ id, payload }: { id: string; payload: UpdatePayrollPayload }): Promise<PayrollRecord> => {
      const res = await apiClient.patch<ApiResponse<PayrollRecord>>(`/payroll/${id}`, payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all });
    },
  });
}

export function useDeletePayrollMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<ApiResponse<any>>(`/payroll/${id}`);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all });
    },
  });
}

export function useClearPayrollMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete<ApiResponse<any>>('/payroll');
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all });
    },
  });
}
