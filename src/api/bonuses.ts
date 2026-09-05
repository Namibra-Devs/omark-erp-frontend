// src/api/bonuses.ts
//
// React Query API hooks for Commission & Performance Bonuses
// Integrated with backend API endpoints at /api/v1/bonuses

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList } from '@/api/client';
import type { ApiResponse } from '@/types';

export type BonusType =
  | 'prospect_conversion'
  | 'appointment_completed'
  | 'punctuality_streak'
  | 'monthly_target_met'
  | 'cash_recovery'
  | 'deed_completion'
  | 'custom_award';

export type BonusStatus = 'PENDING_PAYROLL' | 'APPROVED' | 'PAID' | 'VOIDED';

export interface BonusRule {
  id: string;
  ruleName: string;
  bonusType: BonusType;
  description: string;
  triggerEvent: string;
  rewardType: 'FIXED_GHS' | 'PERCENTAGE';
  rewardAmountGHS?: number;
  rewardAmountMinor?: number;
  rewardPercentage?: number;
  qualificationCriteria?: string;
  isActive: boolean;
  applicableRoles?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StaffBonusRecord {
  id: string;
  userId: string;
  staffName?: string;
  staffEmail?: string;
  branchId: string;
  branchName?: string;
  ruleId?: string;
  ruleName: string;
  bonusType: BonusType;
  amountGHS: number;
  amountMinor: number;
  reason: string;
  status: BonusStatus;
  earnedAt: string;
  awardedByUserId?: string;
  awardedByUserName?: string;
  relatedEntityId?: string;
  relatedEntityType?: 'prospect' | 'appointment' | 'property' | 'attendance' | 'deed';
  includedInPayrollRunId?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const bonusTypeLabels: Record<BonusType, string> = {
  prospect_conversion: '🎯 Lead Converted to Sale (2% Commission)',
  appointment_completed: '📅 Site Visit / Consultation Completed',
  punctuality_streak: '⏰ Monthly Punctuality & Perfect Attendance',
  monthly_target_met: '🏆 Monthly Branch / Individual Sales Target Met',
  cash_recovery: '💰 Delinquent Account Recovery Milestone',
  deed_completion: '📜 Expedited Deed Documentation',
  custom_award: '⭐ Executive Performance Discretionary Award',
};

export const bonusesKeys = {
  all: ['bonuses'] as const,
  rules: () => ['bonuses', 'rules'] as const,
  list: (params?: any) => ['bonuses', 'list', params] as const,
  staff: (userId?: string, month?: string) => ['bonuses', 'staff', userId, month] as const,
};

export function useBonusRulesQuery() {
  return useQuery({
    queryKey: bonusesKeys.rules(),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<BonusRule[]>>('/bonuses/rules');
        const list = unwrapList(res);
        return Array.isArray(list) ? list : (list as any)?.items || [];
      } catch {
        return [];
      }
    },
  });
}

export function useBonusesQuery(params?: { userId?: string; branchId?: string; month?: string; status?: BonusStatus; type?: BonusType }) {
  return useQuery({
    queryKey: bonusesKeys.list(params),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<StaffBonusRecord[]>>('/bonuses', { params });
        const list = unwrapList(res);
        return Array.isArray(list) ? list : (list as any)?.items || [];
      } catch {
        return [];
      }
    },
  });
}

export function useStaffBonusesQuery(userId?: string, month?: string) {
  return useBonusesQuery({ userId, month });
}

export function useCreateBonusRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<BonusRule>) => {
      const res = await apiClient.post<ApiResponse<BonusRule>>('/bonuses/rules', payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bonusesKeys.rules() });
    },
  });
}

export function useUpdateBonusRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<BonusRule> }) => {
      const res = await apiClient.put<ApiResponse<BonusRule>>(`/bonuses/rules/${id}`, payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bonusesKeys.rules() });
    },
  });
}

export function useAwardBonusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      userId: string;
      branchId?: string;
      ruleId?: string;
      ruleName?: string;
      bonusType?: BonusType;
      amountGHS: number;
      reason: string;
      relatedEntityId?: string;
      relatedEntityType?: string;
    }) => {
      const res = await apiClient.post<ApiResponse<StaffBonusRecord>>('/bonuses', payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bonusesKeys.all });
    },
  });
}

export function useReviewBonusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, remarks }: { id: string; status: BonusStatus; remarks?: string }) => {
      const res = await apiClient.patch<ApiResponse<StaffBonusRecord>>(`/bonuses/${id}`, { status, remarks });
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bonusesKeys.all });
    },
  });
}
