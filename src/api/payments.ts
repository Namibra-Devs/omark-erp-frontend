// src/api/payments.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';

export interface Payment {
  id: string;
  customerId: string;
  paymentPlanId?: string;
  amountMinor: number;
  paidOn: string;
  method: 'cash' | 'bank_transfer' | 'mobile_money' | 'cheque' | 'other';
  reference?: string;
  notes?: string;
  recordedBy: string;
  recordedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecordPaymentPayload {
  customerId: string;
  paymentPlanId?: string;
  amountMinor: number;
  paidOn: string;
  method: string;
  reference?: string;
  notes?: string;
}

// Query Keys
export const paymentKeys = {
  all: ['payments'] as const,
  lists: () => [...paymentKeys.all, 'list'] as const,
  list: (filters: any) => [...paymentKeys.lists(), filters] as const,
};

// Hook to get payments
export const usePaymentsQuery = (filters?: { customerId?: string; paymentPlanId?: string }) => {
  return useQuery({
    queryKey: paymentKeys.list(filters),
    queryFn: async () => {
      const response = await apiClient.get('/payments', { params: filters });
      return response.data;
    },
    enabled: !!filters?.customerId || !!filters?.paymentPlanId,
  });
};

// Hook to record payment
export const useRecordPaymentMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payload: RecordPaymentPayload) => {
      const response = await apiClient.post('/payments', payload);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.list({ customerId: variables.customerId }) });
      queryClient.invalidateQueries({ queryKey: ['paymentPlans', variables.customerId] });
      queryClient.invalidateQueries({ queryKey: ['installments', variables.customerId] });
    },
  });
};