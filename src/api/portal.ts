// src/api/portal.ts
import { useMutation, useQuery } from '@tanstack/react-query';
import apiClient, { unwrapData } from '@/api/client';
import type { ApiResponse, Customer, Property, PaymentPlan, Payment } from '@/types';

export interface PortalAuthResponse {
  token: string;
  customer: Customer;
}

export interface RequestOtpPayload {
  phoneNumber: string;
}

export interface VerifyOtpPayload {
  phoneNumber: string;
  code: string;
}

export interface PortalActivatePayload {
  phoneNumber: string;
  password: string;
}

export interface PortalLoginPayload {
  phoneNumber: string;
  password: string;
}

export interface PortalMeData {
  customer: Customer;
  property?: Property;
  paymentPlan?: PaymentPlan;
}

export interface PortalPaymentsData {
  installments: Array<{
    id: string;
    sequence: number;
    dueDate: string;
    expectedAmountMinor: number;
    isPaid: boolean;
    paidAt?: string;
  }>;
  payments: Payment[];
}

export interface PortalSummaryData {
  customer: Customer;
  property?: Property;
  paymentPlan?: PaymentPlan;
  payments: Payment[];
}

export const portalKeys = {
  me: ['portal', 'me'] as const,
  payments: ['portal', 'payments'] as const,
  summary: ['portal', 'summary'] as const,
};

export function usePortalActivateMutation() {
  return useMutation({
    mutationFn: async (payload: PortalActivatePayload) => {
      const res = await apiClient.post<ApiResponse<PortalAuthResponse>>('/portal/auth/activate', payload);
      return unwrapData(res);
    },
  });
}

export function usePortalLoginMutation() {
  return useMutation({
    mutationFn: async (payload: PortalLoginPayload) => {
      const res = await apiClient.post<ApiResponse<PortalAuthResponse>>('/portal/auth/login', payload);
      return unwrapData(res);
    },
  });
}

export function usePortalRequestOtpMutation() {
  return useMutation({
    mutationFn: async (payload: RequestOtpPayload) => {
      const res = await apiClient.post<ApiResponse<{ message: string }>>('/portal/auth/request-otp', payload);
      return unwrapData(res);
    },
  });
}

export function usePortalVerifyOtpMutation() {
  return useMutation({
    mutationFn: async (payload: VerifyOtpPayload) => {
      const res = await apiClient.post<ApiResponse<PortalAuthResponse>>('/portal/auth/verify-otp', payload);
      return unwrapData(res);
    },
  });
}

export function usePortalMeQuery(token?: string) {
  return useQuery({
    queryKey: portalKeys.me,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PortalMeData>>('/portal/me', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      return unwrapData(res);
    },
    enabled: Boolean(token || localStorage.getItem('portal_token')),
  });
}

export function usePortalPaymentsQuery(token?: string) {
  return useQuery({
    queryKey: portalKeys.payments,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PortalPaymentsData>>('/portal/me/payments', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      return unwrapData(res);
    },
    enabled: Boolean(token || localStorage.getItem('portal_token')),
  });
}

export function usePortalSummaryQuery(token?: string) {
  return useQuery({
    queryKey: portalKeys.summary,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PortalSummaryData>>('/portal/summary', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      return unwrapData(res);
    },
    enabled: Boolean(token || localStorage.getItem('portal_token')),
  });
}
