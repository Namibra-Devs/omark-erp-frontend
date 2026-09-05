// src/api/compensation.ts
//
// React Query API hooks for Staff Compensation & Payroll Profiles
// Integrated with backend API endpoints at /api/v1/compensation

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData } from '@/api/client';
import type { ApiResponse } from '@/types';

export type SalaryType = 'monthly' | 'weekly' | 'hourly' | 'commission_only';
export type PaymentMethod = 'bank_transfer' | 'momo' | 'cheque' | 'cash';
export type PayFrequency = 'monthly' | 'biweekly' | 'weekly';

export interface StaffCompensationProfile {
  id: string;
  userId: string;
  staffName?: string;
  staffRole?: string;
  salaryType: SalaryType;
  baseSalaryGHS: number;
  baseSalaryMinor: number;
  hourlyRateGHS?: number;
  commissionRatePct?: number;
  paymentMethod: PaymentMethod;
  bankName?: string;
  bankBranch?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  momoNetwork?: 'MTN' | 'Telecel' | 'AT';
  momoNumber?: string;
  ssnitNumber?: string;
  tinNumber?: string;
  ghanaCardNumber?: string;
  payFrequency: PayFrequency;
  taxReliefs?: Array<{ name: string; amountGHS: number }>;
  recurringAllowances?: Array<{ name: string; amountGHS: number; taxable: boolean }>;
  recurringDeductions?: Array<{ name: string; amountGHS: number }>;
  effectiveDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const salaryTypeLabels: Record<SalaryType, string> = {
  monthly: 'Fixed Monthly Salary',
  weekly: 'Weekly Salary',
  hourly: 'Hourly Rate',
  commission_only: 'Commission Only (100% Incentive)',
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank Transfer (Direct Deposit)',
  momo: 'Mobile Money (MTN / Telecel / AT)',
  cheque: 'Bank Cheque',
  cash: 'Cash at Branch Cashier',
};

export const payFrequencyLabels: Record<PayFrequency, string> = {
  monthly: 'Monthly (End of Month)',
  biweekly: 'Bi-Weekly (Every 2 Weeks)',
  weekly: 'Weekly (Every Friday)',
};

export const compensationKeys = {
  all: ['compensation'] as const,
  detail: (userId: string | undefined) => ['compensation', userId] as const,
};

export function useStaffCompensationQuery(userId: string | undefined) {
  return useQuery({
    queryKey: compensationKeys.detail(userId),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<StaffCompensationProfile>>(`/compensation/${userId}`);
        return unwrapData(res);
      } catch {
        return null;
      }
    },
    enabled: Boolean(userId),
  });
}

export function useUpdateStaffCompensationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, payload }: { userId: string; payload: Partial<StaffCompensationProfile> }) => {
      const res = await apiClient.put<ApiResponse<StaffCompensationProfile>>(`/compensation/${userId}`, payload);
      return unwrapData(res);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: compensationKeys.detail(variables.userId) });
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
}
