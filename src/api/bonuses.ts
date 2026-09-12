// src/api/bonuses.ts
//
// React Query API hooks for Commission & Performance Bonuses
// Integrated with backend API endpoints at /api/v1/bonuses with resilient offline/local fallback

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList } from '@/api/client';
import type { ApiResponse } from '@/types';
import { recordSystemEvent } from '@/utils/activityNotificationEngine';

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
  name?: string;
  ruleName: string;
  bonusType: BonusType;
  description: string;
  triggerEvent: string;
  eventType?: string;
  rewardType: 'FIXED_GHS' | 'PERCENTAGE';
  rewardAmountGHS?: number;
  amountGHS?: number;
  rewardAmountMinor?: number;
  amountMinor?: number;
  rewardPercentage?: number;
  qualificationCriteria?: string;
  criteria?: string;
  isActive: boolean;
  applicableRoles?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StaffBonusRecord {
  id: string;
  userId: string;
  staffUserId?: string;
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

const RULES_STORAGE_KEY = 'omark_bonus_rules_store';
const BONUSES_STORAGE_KEY = 'omark_staff_bonuses_store';

const DEFAULT_SEEDED_RULES: BonusRule[] = [
  {
    id: 'rule-sales-closing',
    name: 'Closed Sale Commission (2%)',
    ruleName: 'Closed Sale Commission (2%)',
    bonusType: 'prospect_conversion',
    description: 'Standard 2% commission awarded upon successful client contract execution and deposit receipt.',
    triggerEvent: 'prospect_converted',
    rewardType: 'FIXED_GHS',
    rewardAmountGHS: 500,
    amountGHS: 500,
    rewardAmountMinor: 50000,
    amountMinor: 50000,
    qualificationCriteria: 'Customer contract signed with verified initial payment deposit',
    criteria: 'Customer contract signed with verified initial payment deposit',
    isActive: true,
    applicableRoles: ['marketing_staff', 'marketing_director', 'customer_service', 'branch_manager'],
    createdAt: new Date(Date.now() - 3600000 * 24 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
  },
  {
    id: 'rule-site-visit',
    name: 'Completed Site Consultation Bonus',
    ruleName: 'Completed Site Consultation Bonus',
    bonusType: 'appointment_completed',
    description: 'Awarded when a scheduled prospect inspection or site visit is conducted and logged with geotag.',
    triggerEvent: 'appointment_completed',
    rewardType: 'FIXED_GHS',
    rewardAmountGHS: 150,
    amountGHS: 150,
    rewardAmountMinor: 15000,
    amountMinor: 15000,
    qualificationCriteria: 'Appointment status marked completed with client feedback recorded',
    criteria: 'Appointment status marked completed with client feedback recorded',
    isActive: true,
    applicableRoles: ['marketing_staff', 'customer_service'],
    createdAt: new Date(Date.now() - 3600000 * 24 * 25).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
  },
  {
    id: 'rule-punctuality',
    name: 'Punctuality & Early Bird Bonus',
    ruleName: 'Punctuality & Early Bird Bonus',
    bonusType: 'punctuality_streak',
    description: 'Awarded for consistent on-time check-ins before the 08:30 AM grace window cutoff across the month.',
    triggerEvent: 'attendance_evaluated',
    rewardType: 'FIXED_GHS',
    rewardAmountGHS: 200,
    amountGHS: 200,
    rewardAmountMinor: 20000,
    amountMinor: 20000,
    qualificationCriteria: 'Zero late check-ins recorded for the entire monthly register',
    criteria: 'Zero late check-ins recorded for the entire monthly register',
    isActive: true,
    applicableRoles: ['secretary', 'customer_service', 'accounts', 'marketing_staff'],
    createdAt: new Date(Date.now() - 3600000 * 24 * 20).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
  },
  {
    id: 'rule-deed-milestone',
    name: 'Expedited Deed Documentation Milestone',
    ruleName: 'Expedited Deed Documentation Milestone',
    bonusType: 'deed_completion',
    description: 'Awarded for expedited vetting and customer delivery of registered Deed packets within 14 days.',
    triggerEvent: 'deed_delivered',
    rewardType: 'FIXED_GHS',
    rewardAmountGHS: 350,
    amountGHS: 350,
    rewardAmountMinor: 35000,
    amountMinor: 35000,
    qualificationCriteria: 'Deed packet verified, notarized, and handed over to customer',
    criteria: 'Deed packet verified, notarized, and handed over to customer',
    isActive: true,
    applicableRoles: ['secretary', 'admin', 'branch_manager'],
    createdAt: new Date(Date.now() - 3600000 * 24 * 15).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
  },
  {
    id: 'rule-cash-recovery',
    name: 'Delinquent Defaulter Recovery Bonus',
    ruleName: 'Delinquent Defaulter Recovery Bonus',
    bonusType: 'cash_recovery',
    description: 'Special incentive for recovering installment arrears from delinquent accounts >30 days overdue.',
    triggerEvent: 'overdue_payment_recovered',
    rewardType: 'FIXED_GHS',
    rewardAmountGHS: 300,
    amountGHS: 300,
    rewardAmountMinor: 30000,
    amountMinor: 30000,
    qualificationCriteria: 'Successful recovery of overdue balance exceeding GH₵ 2,000',
    criteria: 'Successful recovery of overdue balance exceeding GH₵ 2,000',
    isActive: true,
    applicableRoles: ['accounts', 'customer_service', 'marketing_staff'],
    createdAt: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
  },
];

export const getStoredBonusRules = (): BonusRule[] => {
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(DEFAULT_SEEDED_RULES));
      return DEFAULT_SEEDED_RULES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SEEDED_RULES;
  } catch {
    return DEFAULT_SEEDED_RULES;
  }
};

export const saveStoredBonusRules = (rules: BonusRule[]): void => {
  try {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
    window.dispatchEvent(new Event('omark-bonus-rules-changed'));
  } catch (err) {
    console.warn('Failed to save bonus rules to local storage:', err);
  }
};

export const getStoredStaffBonuses = (): StaffBonusRecord[] => {
  try {
    const raw = localStorage.getItem(BONUSES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveStoredStaffBonuses = (bonuses: StaffBonusRecord[]): void => {
  try {
    localStorage.setItem(BONUSES_STORAGE_KEY, JSON.stringify(bonuses));
    window.dispatchEvent(new Event('omark-bonuses-changed'));
  } catch (err) {
    console.warn('Failed to save staff bonuses to local storage:', err);
  }
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
        const serverItems = Array.isArray(list) ? list : (list as any)?.items;
        if (serverItems && serverItems.length > 0) {
          saveStoredBonusRules(serverItems);
          return serverItems;
        }
      } catch {
        // Fall back to persistent local storage
      }
      return getStoredBonusRules();
    },
  });
}

export function useBonusesQuery(params?: { userId?: string; branchId?: string; month?: string; status?: BonusStatus; type?: BonusType }) {
  return useQuery({
    queryKey: bonusesKeys.list(params),
    queryFn: async () => {
      let serverBonuses: StaffBonusRecord[] = [];
      try {
        const res = await apiClient.get<ApiResponse<StaffBonusRecord[]>>('/bonuses', { params });
        const list = unwrapList(res);
        serverBonuses = Array.isArray(list) ? list : (list as any)?.items || [];
      } catch {
        // Fall back to local store
      }

      const localBonuses = getStoredStaffBonuses();
      // Merge unique by id
      const bonusMap = new Map<string, StaffBonusRecord>();
      localBonuses.forEach((b) => bonusMap.set(b.id, b));
      serverBonuses.forEach((b) => bonusMap.set(b.id, b));
      let all = Array.from(bonusMap.values());

      if (params?.userId) {
        all = all.filter((b) => b.userId === params.userId || b.staffUserId === params.userId);
      }
      if (params?.branchId) {
        all = all.filter((b) => b.branchId === params.branchId);
      }
      if (params?.status) {
        all = all.filter((b) => b.status === params.status);
      }
      if (params?.type) {
        all = all.filter((b) => b.bonusType === params.type);
      }
      return all;
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
      const normalizedPayload: any = {
        name: payload.name || payload.ruleName,
        ruleName: payload.ruleName || payload.name || 'Bonus Rule',
        bonusType: payload.bonusType || 'custom_award',
        triggerEvent: payload.triggerEvent || payload.eventType || 'custom',
        eventType: payload.eventType || payload.triggerEvent || 'custom',
        rewardType: payload.rewardType || 'FIXED_GHS',
        rewardAmountGHS: payload.rewardAmountGHS ?? payload.amountGHS ?? 0,
        amountGHS: payload.amountGHS ?? payload.rewardAmountGHS ?? 0,
        rewardAmountMinor: payload.rewardAmountMinor ?? payload.amountMinor ?? Math.round((payload.amountGHS || 0) * 100),
        amountMinor: payload.amountMinor ?? payload.rewardAmountMinor ?? Math.round((payload.amountGHS || 0) * 100),
        qualificationCriteria: payload.qualificationCriteria || payload.criteria || '',
        criteria: payload.criteria || payload.qualificationCriteria || '',
        description: payload.description || '',
        applicableRoles: payload.applicableRoles || ['marketing_staff', 'customer_service'],
        isActive: payload.isActive !== false,
      };

      try {
        const res = await apiClient.post<ApiResponse<BonusRule>>('/bonuses/rules', normalizedPayload);
        const serverData = unwrapData(res);
        if (serverData) {
          const rules = getStoredBonusRules();
          saveStoredBonusRules([serverData, ...rules]);
          return serverData;
        }
      } catch (err) {
        console.warn('Backend bonus rule creation skipped, saving locally:', err);
      }

      // Local fallback
      const newRule: BonusRule = {
        id: `rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ...normalizedPayload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const existing = getStoredBonusRules();
      saveStoredBonusRules([newRule, ...existing]);
      return newRule;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: bonusesKeys.rules() });
      queryClient.setQueryData(bonusesKeys.rules(), (old: BonusRule[] = []) => [saved, ...old.filter((r) => r.id !== saved.id)]);
      recordSystemEvent({
        title: 'Bonus Rule Created',
        details: `Configured new rule: ${saved.ruleName || saved.name} (GH₵ ${(saved.rewardAmountGHS || saved.amountGHS || 0).toLocaleString()})`,
        category: 'payroll',
        type: 'info',
      });
    },
  });
}

export function useUpdateBonusRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<BonusRule> }) => {
      try {
        const res = await apiClient.put<ApiResponse<BonusRule>>(`/bonuses/rules/${id}`, payload);
        const updated = unwrapData(res);
        if (updated) {
          const list = getStoredBonusRules().map((r) => (r.id === id ? { ...r, ...updated } : r));
          saveStoredBonusRules(list);
          return updated;
        }
      } catch {
        // Local fallback
      }

      const rules = getStoredBonusRules();
      const updatedRules = rules.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            ...payload,
            amountGHS: payload.rewardAmountGHS ?? payload.amountGHS ?? r.amountGHS,
            rewardAmountGHS: payload.rewardAmountGHS ?? payload.amountGHS ?? r.rewardAmountGHS,
            amountMinor: payload.rewardAmountMinor ?? payload.amountMinor ?? r.amountMinor,
            rewardAmountMinor: payload.rewardAmountMinor ?? payload.amountMinor ?? r.rewardAmountMinor,
            updatedAt: new Date().toISOString(),
          };
        }
        return r;
      });
      saveStoredBonusRules(updatedRules);
      return updatedRules.find((r) => r.id === id)!;
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
      staffUserId?: string;
      staffName?: string;
      branchId?: string;
      ruleId?: string;
      ruleName?: string;
      bonusType?: BonusType;
      amountGHS: number;
      amountMinor?: number;
      reason: string;
      relatedEntityId?: string;
      relatedEntityType?: string;
    }) => {
      const amountGHS = Number(payload.amountGHS) || 0;
      const amountMinor = payload.amountMinor ?? Math.round(amountGHS * 100);

      const normalizedPayload = {
        userId: payload.userId || payload.staffUserId,
        staffUserId: payload.userId || payload.staffUserId,
        staffName: payload.staffName,
        branchId: payload.branchId || 'branch-kumasi',
        ruleId: payload.ruleId || 'custom-award',
        ruleName: payload.ruleName || 'Performance Award',
        bonusType: payload.bonusType || 'custom_award',
        amountGHS,
        amountMinor,
        reason: payload.reason || 'Management Discretionary Bonus',
        relatedEntityId: payload.relatedEntityId,
        relatedEntityType: payload.relatedEntityType,
      };

      try {
        const res = await apiClient.post<ApiResponse<StaffBonusRecord>>('/bonuses', normalizedPayload);
        const serverRecord = unwrapData(res);
        if (serverRecord) {
          const list = getStoredStaffBonuses();
          saveStoredStaffBonuses([serverRecord, ...list]);
          return serverRecord;
        }
      } catch (err) {
        console.warn('Backend bonus award skipped, saving locally:', err);
      }

      // Local fallback
      const newRecord: StaffBonusRecord = {
        id: `bonus-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId: normalizedPayload.userId!,
        staffUserId: normalizedPayload.userId,
        staffName: normalizedPayload.staffName || 'Staff Member',
        branchId: normalizedPayload.branchId,
        ruleId: normalizedPayload.ruleId,
        ruleName: normalizedPayload.ruleName,
        bonusType: normalizedPayload.bonusType as BonusType,
        amountGHS,
        amountMinor,
        reason: normalizedPayload.reason,
        status: 'APPROVED',
        earnedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        relatedEntityId: normalizedPayload.relatedEntityId,
      };

      const existing = getStoredStaffBonuses();
      saveStoredStaffBonuses([newRecord, ...existing]);
      return newRecord;
    },
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: bonusesKeys.all });
      recordSystemEvent({
        title: 'Performance Bonus Awarded',
        details: `GH₵ ${record.amountGHS.toLocaleString(undefined, { minimumFractionDigits: 2 })} awarded to staff (${record.reason})`,
        category: 'payroll',
        type: 'success',
        link: '/branches/payroll',
        refId: record.id,
      });
    },
  });
}

export function useReviewBonusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, remarks }: { id: string; status: BonusStatus; remarks?: string }) => {
      try {
        const res = await apiClient.patch<ApiResponse<StaffBonusRecord>>(`/bonuses/${id}`, { status, remarks });
        const updated = unwrapData(res);
        if (updated) {
          const list = getStoredStaffBonuses().map((b) => (b.id === id ? { ...b, ...updated } : b));
          saveStoredStaffBonuses(list);
          return updated;
        }
      } catch {
        // Fallback
      }

      const list = getStoredStaffBonuses().map((b) => (b.id === id ? { ...b, status, updatedAt: new Date().toISOString() } : b));
      saveStoredStaffBonuses(list);
      return list.find((b) => b.id === id)!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bonusesKeys.all });
    },
  });
}
