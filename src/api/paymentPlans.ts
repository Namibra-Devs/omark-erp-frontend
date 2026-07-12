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

export function usePaymentPlansQuery(params?: PaymentPlansListParams) {
  return useQuery({
    queryKey: paymentPlansKeys.list(params),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<PaymentPlan[]>>('/payment-plans', { params });
        return unwrapList(res) as PaymentPlansListResult;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error fetching payment plans:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
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
      try {
        const response = await apiClient.post<ApiResponse<PaymentPlan>>('/payment-plans', payload);
        return unwrapData(response);
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error creating payment plan:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
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
