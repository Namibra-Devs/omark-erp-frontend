// src/api/customers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import type { Customer, PaymentPlan, Payment, Installment, ApiResponse } from '@/types';

export interface CustomersFilter {
  type?: 'payment_plan' | 'fully_paid';
  q?: string;
  page?: number;
  pageSize?: number;
}

export const useCustomers = (filter: CustomersFilter) => {
  return useQuery({
    queryKey: ['customers', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter.type) params.append('type', filter.type);
      if (filter.q) params.append('q', filter.q);
      if (filter.page) params.append('page', String(filter.page));
      if (filter.pageSize) params.append('pageSize', String(filter.pageSize));
      
      const response = await apiClient.get<ApiResponse<Customer[]>>(`/customers?${params}`);
      return response;
    },
  });
};

export const useCustomer = (id: string) => {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Customer & { plan?: PaymentPlan }>>(`/customers/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const usePaymentPlan = (id: string) => {
  return useQuery({
    queryKey: ['paymentPlan', id],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<PaymentPlan>>(`/payment-plans/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useInstallments = (planId: string) => {
  return useQuery({
    queryKey: ['installments', planId],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Installment[]>>(`/payment-plans/${planId}/installments`);
      return response.data;
    },
    enabled: !!planId,
  });
};

export const useRecordPayment = (planId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { amountMinor: number; paidOn: string; method: string; reference?: string }) => {
      const response = await apiClient.post<ApiResponse<Payment>>(`/payment-plans/${planId}/payments`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentPlan', planId] });
      queryClient.invalidateQueries({ queryKey: ['installments', planId] });
      queryClient.invalidateQueries({ queryKey: ['customer'] });
      queryClient.invalidateQueries({ queryKey: ['paymentPlans'] });
    },
  });
};

export const usePaymentPlanDocument = (planId: string) => {
  return useQuery({
    queryKey: ['paymentPlanDocument', planId],
    queryFn: async () => {
      const response = await apiClient.get<Blob>(`/payment-plans/${planId}/document`, {
        responseType: 'blob',
      });
      return response;
    },
    enabled: false,
  });
};