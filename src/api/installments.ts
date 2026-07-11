// src/api/installments.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

export interface Installment {
  id: string;
  paymentPlanId: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: 'pending' | 'paid' | 'overdue' | 'partial';
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  installmentId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reference?: string;
}

export const installmentKeys = {
  all: ['installments'] as const,
  lists: () => [...installmentKeys.all, 'list'] as const,
  list: (filters: any) => [...installmentKeys.lists(), filters] as const,
  details: () => [...installmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...installmentKeys.details(), id] as const,
};

export const useInstallmentsQuery = (planId: string) => {
  return useQuery({
    queryKey: installmentKeys.list({ planId }),
    queryFn: async () => {
      const response = await apiClient.get(`/payment-plans/${planId}/installments`);
      return response.data.data;
    },
    enabled: !!planId,
  });
};

export const useRecentPaymentsQuery = (customerId: string, limit?: number) => {
  return useQuery({
    queryKey: ['payments', 'recent', customerId],
    queryFn: async () => {
      const response = await apiClient.get('/payments/recent', {
        params: { customerId, limit },
      });
      return response.data.data;
    },
    enabled: !!customerId,
  });
};