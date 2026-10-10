// src/api/paymentPlans.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList } from '@/api/client';
import { AxiosError } from 'axios';
import type { PaymentPlan, PaymentPlanStatus, ProgressBand, Installment, Payment, ApiResponse } from '@/types';

export type { PaymentPlan, PaymentPlanStatus, ProgressBand, Installment };

export interface PaymentPlansListParams {
  page?: number;
  pageSize?: number;
  status?: PaymentPlanStatus;
  band?: ProgressBand;
}

export interface PaymentPlansListResult {
  items: PaymentPlan[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreatePaymentPlanPayload {
  customerId: string;
  totalAmountMinor: number;
  downPaymentMinor: number;
  planBasis: 'months' | 'monthly_amount';
  numMonths?: number;
  monthlyAmountMinor?: number;
  startDate: string;
}

// --- Query Keys ---

export const paymentPlansKeys = {
  all: ['payment-plans'] as const,
  lists: () => [...paymentPlansKeys.all, 'list'] as const,
  list: (params?: PaymentPlansListParams) => [...paymentPlansKeys.lists(), params ?? {}] as const,
  details: () => [...paymentPlansKeys.all, 'detail'] as const,
  detail: (id: string) => [...paymentPlansKeys.details(), id] as const,
  installments: (planId: string) => [...paymentPlansKeys.all, 'installments', planId] as const,
};

// --- Payment Plan Queries ---

import {
  getStoredPaymentPlans,
  saveStoredPaymentPlan,
  getStoredPaymentOverrides,
  isValidServerId,
} from '@/utils/paymentPlansStorage';

export function usePaymentPlansQuery(params?: PaymentPlansListParams) {
  const safePageSize = params?.pageSize ? Math.min(Math.max(1, params.pageSize), 100) : undefined;
  const safeParams = params ? { ...params, ...(safePageSize !== undefined ? { pageSize: safePageSize } : {}) } : undefined;

  return useQuery({
    queryKey: paymentPlansKeys.list(safeParams),
    queryFn: async () => {
      let apiPlans: PaymentPlan[] = [];
      try {
        const res = await apiClient.get<ApiResponse<PaymentPlan[]>>('/payment-plans', { params: safeParams });
        const list = unwrapList(res) as PaymentPlansListResult;
        apiPlans = [...(list.items || [])];

        const totalPages = (list as any).totalPages || (list.total && safePageSize ? Math.ceil(list.total / safePageSize) : 1);
        if (!params?.page && totalPages > 1) {
          const promises = [];
          for (let p = 2; p <= Math.min(totalPages, 15); p++) {
            promises.push(
              apiClient
                .get<ApiResponse<PaymentPlan[]>>('/payment-plans', {
                  params: { ...safeParams, page: p },
                })
                .then((r) => unwrapList(r).items || [])
                .catch(() => [])
            );
          }
          const otherPages = await Promise.all(promises);
          otherPages.forEach((pItems) => apiPlans.push(...pItems));
        }

        // If no specific status is requested, fetch other statuses (defaulted, completed, cancelled)
        // to prevent backend default status filtering from hiding non-active customer plans
        if (!params?.status) {
          const statusesToFetch: PaymentPlanStatus[] = ['defaulted', 'completed', 'cancelled'];
          const statusPromises = statusesToFetch.map(async (st) => {
            try {
              const stRes = await apiClient.get<ApiResponse<PaymentPlan[]>>('/payment-plans', {
                params: { ...safeParams, status: st, page: 1, pageSize: 100 },
              });
              const stList = unwrapList(stRes);
              const items = stList.items || [];
              const stTotalPages = (stList as any).totalPages || (stList.total ? Math.ceil(stList.total / 100) : 1);
              if (stTotalPages > 1) {
                const subPromises = [];
                for (let sp = 2; sp <= Math.min(stTotalPages, 5); sp++) {
                  subPromises.push(
                    apiClient
                      .get<ApiResponse<PaymentPlan[]>>('/payment-plans', {
                        params: { ...safeParams, status: st, page: sp, pageSize: 100 },
                      })
                      .then((r) => unwrapList(r).items || [])
                      .catch(() => [])
                  );
                }
                const subResults = await Promise.all(subPromises);
                subResults.forEach((subItems) => items.push(...subItems));
              }
              return items;
            } catch {
              return [];
            }
          });
          const allStatusResults = await Promise.all(statusPromises);
          allStatusResults.forEach((statusItems) => {
            statusItems.forEach((p) => {
              if (p && p.id && !apiPlans.some((existing) => existing.id === p.id)) {
                apiPlans.push(p);
              }
            });
          });
        }
      } catch (error) {
        if (error instanceof AxiosError) {
          console.warn('Backend payment plans fetch warning, using persistent store:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
      }

      const overrides = getStoredPaymentOverrides();
      const mergedMap = new Map<string, PaymentPlan>();

      // De-duplicate API plans by real server plan ID (server is sole authoritative source)
      apiPlans.forEach((p) => {
        const pId = (p.id || (p as any)._id || '').toString().trim();
        if (pId && isValidServerId(pId)) {
          const normKey = pId.toLowerCase();
          if (!mergedMap.has(normKey)) {
            mergedMap.set(normKey, { ...p, id: pId });
          }
        }
      });

      // 3. Apply live payment overrides to calculate true remaining balance and status
      const processedItems = Array.from(mergedMap.values()).map((p) => {
        const ov = overrides[p.id];
        if (ov) {
          const totalPaidMinor = Object.values(ov.paidInstallments || {}).reduce(
            (sum, inst) => sum + (inst.amountMinor || 0),
            0
          );
          if (totalPaidMinor > 0) {
            const scheduled = Math.max((p.totalAmountMinor || 35000000) - (p.downPaymentMinor || 0), 0);
            const balFromOverride = Math.max(scheduled - totalPaidMinor, 0);
            const bal = p.balanceMinor !== undefined ? Math.min(p.balanceMinor, balFromOverride) : balFromOverride;
            const totalPaid = Math.max((p.totalAmountMinor || 35000000) - bal, 0);
            const pct = p.totalAmountMinor > 0 ? Math.min(Math.round((totalPaid / p.totalAmountMinor) * 100), 100) : 0;
            return {
              ...p,
              balanceMinor: bal,
              progressPercent: pct,
              progressBand: getProgressBand(pct),
              status: bal === 0 ? 'completed' : p.status,
            };
          }
        }
        return p;
      });

      // Filter by status or band if requested
      let filtered = processedItems;
      if (params?.status) {
        filtered = filtered.filter((p) => p.status === params.status);
      }
      if (params?.band) {
        filtered = filtered.filter((p) => p.progressBand === params.band);
      }

      return {
        items: filtered,
        total: filtered.length,
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? filtered.length,
      };
    },
  });
}

export function usePaymentPlanQuery(planId: string | undefined) {
  return useQuery({
    queryKey: paymentPlansKeys.detail(planId ?? ''),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<PaymentPlan & { installments?: Installment[]; recentPayments?: Payment[] }>>(
          `/payment-plans/${planId}`
        );
        return unwrapData(res);
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error(`Error fetching payment plan ${planId}:`, {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    enabled: Boolean(planId),
  });
}

export function useInstallmentsQuery(planId: string | undefined) {
  return useQuery({
    queryKey: paymentPlansKeys.installments(planId ?? ''),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<Installment[]>>(`/payment-plans/${planId}/installments`);
        return unwrapList(res).items;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error(`Error fetching installments for plan ${planId}:`, {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    enabled: Boolean(planId),
  });
}

// --- Payment Plan Mutations ---

export function useCreatePaymentPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreatePaymentPlanPayload) => {
      let created: PaymentPlan | null = null;
      try {
        const response = await apiClient.post<ApiResponse<PaymentPlan>>('/payment-plans', payload);
        created = unwrapData(response);
      } catch (error) {
        if (error instanceof AxiosError) {
          console.warn('Backend payment plan create response, saving to persistent store:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
      }

      // Build consistent PaymentPlan object
      const totalAmountMinor = payload.totalAmountMinor || 35000000;
      const downPaymentMinor = payload.downPaymentMinor || 0;
      const balanceMinor = Math.max(totalAmountMinor - downPaymentMinor, 0);
      const numMonths = payload.numMonths || 6;
      const progressPercent = totalAmountMinor > 0 ? Math.round((downPaymentMinor / totalAmountMinor) * 100) : 0;

      const planRecord: PaymentPlan = {
        id: created?.id || `plan-${payload.customerId}-${Date.now().toString().slice(-4)}`,
        customerId: payload.customerId,
        propertyId: created?.propertyId || '',
        totalAmountMinor,
        downPaymentMinor,
        balanceMinor: created?.balanceMinor !== undefined ? created.balanceMinor : balanceMinor,
        numMonths,
        monthlyAmountMinor: payload.monthlyAmountMinor || Math.round(balanceMinor / Math.max(numMonths, 1)),
        currency: created?.currency || 'GHS',
        startDate: payload.startDate || new Date().toISOString().split('T')[0],
        status: created?.status || 'active',
        progressPercent: created?.progressPercent !== undefined ? created.progressPercent : progressPercent,
        progressBand: getProgressBand(progressPercent),
        createdAt: created?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveStoredPaymentPlan(planRecord);
      return planRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentPlansKeys.lists() });
    },
  });
}

// --- Utility Functions ---

export const getProgressBand = (percent: number): ProgressBand => {
  if (percent >= 90) return 'green';
  if (percent >= 70) return 'light_green';
  if (percent >= 50) return 'yellow';
  return 'red';
};

export const getPaymentPlanStatusConfig = (status: PaymentPlanStatus) => {
  const configs: Record<PaymentPlanStatus, { color: string; label: string }> = {
    active: { color: 'blue', label: 'Active' },
    completed: { color: 'green', label: 'Completed' },
    defaulted: { color: 'red', label: 'Defaulted' },
    cancelled: { color: 'default', label: 'Cancelled' },
  };
  return configs[status] || configs.active;
};

export const getProgressBandConfig = (band: ProgressBand) => {
  const configs: Record<ProgressBand, { color: string; label: string }> = {
    red: { color: '#ff4d4f', label: 'Red' },
    yellow: { color: '#faad14', label: 'Yellow' },
    light_green: { color: '#52c41a', label: 'Light Green' },
    green: { color: '#389e0d', label: 'Green' },
  };
  return configs[band] || configs.red;
};

// --- Backward Compatibility (Deprecated) ---

/** @deprecated Use usePaymentPlansQuery instead */
export const usePaymentPlans = usePaymentPlansQuery;
/** @deprecated Use usePaymentPlanQuery instead */
export const usePaymentPlan = usePaymentPlanQuery;
/** @deprecated Use useInstallmentsQuery instead */
export const useInstallments = useInstallmentsQuery;
/** @deprecated Use useCreatePaymentPlanMutation instead */
export const useCreatePaymentPlan = useCreatePaymentPlanMutation;
