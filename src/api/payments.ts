// src/api/payments.ts
// Implements the "Payments" tag from the API docs: all three routes hang off
// a payment plan — there is no standalone /payments list endpoint.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData } from '@/api/client';
import { AxiosError } from 'axios';
import type { PaymentMethod, PaymentPlanStatus, ProgressBand, ApiResponse } from '@/types';
import { paymentPlansKeys } from './paymentPlans';

export interface RecordPaymentPayload {
  amountMinor: number;
  paidOn: string;
  method: PaymentMethod;
  reference?: string;
}

export interface RecordPaymentResult {
  id: string;
  balanceMinor: number;
  progressPercent: number;
  progressBand: ProgressBand;
  status: PaymentPlanStatus;
}

export interface PaystackInitializePayload {
  amountMinor: number;
  email: string;
}

export interface PaystackInitializeResult {
  authorizationUrl: string;
  reference: string;
}

export interface PaystackVerifyPayload {
  reference: string;
}

/**
 * Record a manual payment against a payment plan — POST /payment-plans/{planId}/payments.
 * The response is the updated plan state (balance, progress, status), not a Payment entity.
 */
export const useRecordPaymentMutation = (planId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RecordPaymentPayload) => {
      try {
        const response = await apiClient.post<ApiResponse<RecordPaymentResult>>(
          `/payment-plans/${planId}/payments`,
          payload
        );
        return unwrapData(response);
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error recording payment:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentPlansKeys.detail(planId) });
      queryClient.invalidateQueries({ queryKey: paymentPlansKeys.installments(planId) });
      queryClient.invalidateQueries({ queryKey: paymentPlansKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

/**
 * Initialize a Paystack online payment — POST /payment-plans/{planId}/payments/paystack/initialize.
 * Returns an authorization URL to redirect the customer to.
 */
export const usePaystackInitializeMutation = (planId: string) => {
  return useMutation({
    mutationFn: async (payload: PaystackInitializePayload) => {
      try {
        const response = await apiClient.post<ApiResponse<PaystackInitializeResult>>(
          `/payment-plans/${planId}/payments/paystack/initialize`,
          payload
        );
        return unwrapData(response);
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error initializing Paystack payment:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
  });
};

/**
 * Verify a completed Paystack payment and record it — POST /payment-plans/{planId}/payments/paystack/verify.
 * Call this after the customer returns from the Paystack checkout redirect.
 */
export const usePaystackVerifyMutation = (planId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: PaystackVerifyPayload) => {
      try {
        const response = await apiClient.post<ApiResponse<RecordPaymentResult>>(
          `/payment-plans/${planId}/payments/paystack/verify`,
          payload
        );
        return unwrapData(response);
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error verifying Paystack payment:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentPlansKeys.detail(planId) });
      queryClient.invalidateQueries({ queryKey: paymentPlansKeys.installments(planId) });
      queryClient.invalidateQueries({ queryKey: paymentPlansKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const getPaymentMethodConfig = (method: PaymentMethod) => {
  const configs: Record<PaymentMethod, { color: string; label: string }> = {
    cash: { color: 'gold', label: 'Cash' },
    bank_transfer: { color: 'blue', label: 'Bank Transfer' },
    mobile_money: { color: 'green', label: 'Mobile Money' },
    cheque: { color: 'purple', label: 'Cheque' },
    other: { color: 'default', label: 'Other' },
  };
  return configs[method] || configs.other;
};
