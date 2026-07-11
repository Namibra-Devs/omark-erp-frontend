// src/api/paymentPlans.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { AxiosError } from 'axios';

// --- Types ---

export type PaymentPlanStatus = 'active' | 'completed' | 'defaulted' | 'cancelled';
export type ProgressBand = 'red' | 'yellow' | 'light_green' | 'green';

export interface PaymentPlanEntity {
  id: string;
  customerId: string;
  customerName?: string;
  propertyId?: string;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  status: PaymentPlanStatus;
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentPlan {
  id: string;
  customerId: string;
  propertyId: string;
  totalAmountMinor: number;
  downPaymentMinor: number;
  balanceMinor: number;
  numMonths: number;
  monthlyAmountMinor: number;
  currency: string;
  startDate: string;
  status: PaymentPlanStatus;
  progressPercent: number;
  progressBand: ProgressBand;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentPlansListParams {
  page?: number;
  limit?: number;
  status?: PaymentPlanStatus;
  customerId?: string;
  search?: string;
}

export interface PaymentPlansListResponse {
  items: PaymentPlanEntity[];
  total: number;
  page: number;
  limit: number;
}

export interface InstallmentEntity {
  id: string;
  planId: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  paidAt?: string;
  status: 'pending' | 'paid' | 'overdue' | 'partial';
}

export interface CreatePaymentPlanPayload {
  customerId: string;
  propertyId: string;
  totalAmountMinor: number;
  downPaymentMinor: number;
  balanceMinor: number;
  numMonths: number;
  monthlyAmountMinor: number;
  currency: string;
  startDate: string;
  status: PaymentPlanStatus;
  progressPercent: number;
  progressBand: ProgressBand;
}

export interface UpdatePaymentPlanPayload {
  totalAmountMinor?: number;
  downPaymentMinor?: number;
  balanceMinor?: number;
  numMonths?: number;
  monthlyAmountMinor?: number;
  currency?: string;
  startDate?: string;
  status?: PaymentPlanStatus;
  progressPercent?: number;
  progressBand?: ProgressBand;
}

// --- Query Keys ---

export const paymentPlansKeys = {
  all: ['payment-plans'] as const,
  lists: () => [...paymentPlansKeys.all, 'list'] as const,
  list: (params?: PaymentPlansListParams) =>
    [...paymentPlansKeys.lists(), params ?? {}] as const,
  details: () => [...paymentPlansKeys.all, 'detail'] as const,
  detail: (id: string) => [...paymentPlansKeys.details(), id] as const,
  installments: (planId: string) =>
    [...paymentPlansKeys.all, 'installments', planId] as const,
};

// --- Payment Plan Queries ---

export function usePaymentPlansQuery(params?: PaymentPlansListParams) {
  return useQuery({
    queryKey: paymentPlansKeys.list(params),
    queryFn: async () => {
      try {
        const res = await apiClient.get<PaymentPlansListResponse>('/payment-plans', { params });
        
        const data = res.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as PaymentPlansListResponse;
        }
        
        if (data && 'items' in data && 'total' in data) {
          return data as PaymentPlansListResponse;
        }
        
        console.warn('Unexpected payment plans response format:', data);
        return {
          items: [],
          total: 0,
          page: params?.page || 1,
          limit: params?.limit || 10,
        } as PaymentPlansListResponse;
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
        const res = await apiClient.get<PaymentPlanEntity>(`/payment-plans/${planId}`);
        
        const data = res.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as PaymentPlanEntity;
        }
        
        return data as PaymentPlanEntity;
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
        const res = await apiClient.get<InstallmentEntity[]>(
          `/payment-plans/${planId}/installments`
        );
        
        const data = res.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as InstallmentEntity[];
        }
        
        if (Array.isArray(data)) {
          return data as InstallmentEntity[];
        }
        
        console.warn('Unexpected installments response format:', data);
        return [];
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
        const response = await apiClient.post<PaymentPlan>('/payment-plans', payload);
        
        const data = response.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as PaymentPlan;
        }
        
        return data as PaymentPlan;
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

export function useUpdatePaymentPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdatePaymentPlanPayload }) => {
      try {
        const response = await apiClient.patch<PaymentPlan>(`/payment-plans/${id}`, data);
        
        const result = response.data;
        
        if (result && typeof result === 'object' && 'data' in result) {
          return (result as any).data as PaymentPlan;
        }
        
        return result as PaymentPlan;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error updating payment plan:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: paymentPlansKeys.lists() });
      queryClient.invalidateQueries({ queryKey: paymentPlansKeys.detail(variables.id) });
    },
  });
}

export function useDeletePaymentPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await apiClient.delete(`/payment-plans/${id}`);
        return id;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error deleting payment plan:', {
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

/**
 * @deprecated Use usePaymentPlansQuery instead
 */
export const usePaymentPlans = usePaymentPlansQuery;

/**
 * @deprecated Use usePaymentPlanQuery instead
 */
export const usePaymentPlan = usePaymentPlanQuery;

/**
 * @deprecated Use useInstallmentsQuery instead
 */
export const useInstallments = useInstallmentsQuery;

/**
 * @deprecated Use useCreatePaymentPlanMutation instead
 */
export const useCreatePaymentPlan = useCreatePaymentPlanMutation;

/**
 * @deprecated Use useUpdatePaymentPlanMutation instead
 */
export const useUpdatePaymentPlan = useUpdatePaymentPlanMutation;

/**
 * @deprecated Use useDeletePaymentPlanMutation instead
 */
export const useDeletePaymentPlan = useDeletePaymentPlanMutation;