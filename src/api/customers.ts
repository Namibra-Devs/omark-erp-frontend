// src/api/customers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import { AxiosError } from 'axios';
import type { Customer, PaymentPlan, Payment, Installment, ApiResponse } from '@/types';

// --- Types ---

export type CustomerType = 'payment_plan' | 'fully_paid';

export interface CreatePlanPayload {
  totalAmountMinor: number;
  downPaymentMinor: number;
  planBasis: 'months' | 'monthly_amount';
  numMonths?: number;
  monthlyAmountMinor?: number;
  startDate: string;
}

export interface CreateCustomerPayload {
  prospectId?: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  address: string;
  type: CustomerType;
  propertyId: string;
  notes?: string;
  createPlan?: CreatePlanPayload;
}

export interface CustomersFilter {
  type?: 'payment_plan' | 'fully_paid';
  q?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  propertyId?: string;
}

export interface CustomersListResponse {
  items: Customer[];
  total: number;
  page: number;
  limit: number;
}

export interface UpdateCustomerPayload {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  type?: CustomerType;
  propertyId?: string;
  notes?: string;
}

// --- Query Keys ---

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (filter?: CustomersFilter) => [...customerKeys.lists(), filter ?? {}] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
  paymentPlans: (id: string) => [...customerKeys.detail(id), 'paymentPlans'] as const,
  paymentPlan: (id: string) => ['paymentPlan', id] as const,
  installments: (planId: string) => ['installments', planId] as const,
  payments: (planId: string) => ['payments', planId] as const,
  document: (planId: string) => ['paymentPlanDocument', planId] as const,
};

// --- Customer Queries ---

export const useCustomersQuery = (filter?: CustomersFilter) => {
  return useQuery({
    queryKey: customerKeys.list(filter),
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (filter?.type) params.append('type', filter.type);
        if (filter?.q) params.append('q', filter.q);
        if (filter?.search) params.append('search', filter.search);
        if (filter?.page) params.append('page', String(filter.page));
        if (filter?.pageSize) params.append('pageSize', String(filter.pageSize));
        if (filter?.propertyId) params.append('propertyId', filter.propertyId);
        
        const response = await apiClient.get<ApiResponse<Customer[]>>(`/customers?${params}`);
        
        const data = response.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as Customer[];
        }
        
        if (Array.isArray(data)) {
          return data as Customer[];
        }
        
        console.warn('Unexpected customers response format:', data);
        return [];
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error fetching customers:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
  });
};

export const useCustomerQuery = (id: string) => {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: async () => {
      try {
        const response = await apiClient.get<ApiResponse<Customer & { plan?: PaymentPlan }>>(`/customers/${id}`);
        
        const data = response.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as Customer & { plan?: PaymentPlan };
        }
        
        return data as Customer & { plan?: PaymentPlan };
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error(`Error fetching customer ${id}:`, {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    enabled: !!id,
  });
};

// --- Payment Plan Queries ---

export const usePaymentPlanQuery = (id: string) => {
  return useQuery({
    queryKey: customerKeys.paymentPlan(id),
    queryFn: async () => {
      try {
        const response = await apiClient.get<ApiResponse<PaymentPlan>>(`/payment-plans/${id}`);
        
        const data = response.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as PaymentPlan;
        }
        
        return data as PaymentPlan;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error(`Error fetching payment plan ${id}:`, {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    enabled: !!id,
  });
};

export const useInstallmentsQuery = (planId: string) => {
  return useQuery({
    queryKey: customerKeys.installments(planId),
    queryFn: async () => {
      try {
        const response = await apiClient.get<ApiResponse<Installment[]>>(`/payment-plans/${planId}/installments`);
        
        const data = response.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as Installment[];
        }
        
        if (Array.isArray(data)) {
          return data as Installment[];
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
    enabled: !!planId,
  });
};

export const usePaymentPlanDocumentQuery = (planId: string) => {
  return useQuery({
    queryKey: customerKeys.document(planId),
    queryFn: async () => {
      try {
        const response = await apiClient.get<Blob>(`/payment-plans/${planId}/document`, {
          responseType: 'blob',
        });
        return response.data;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error(`Error fetching document for plan ${planId}:`, {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    enabled: false,
  });
};

// --- Customer Mutations ---

export const useCreateCustomerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateCustomerPayload) => {
      try {
        const response = await apiClient.post<ApiResponse<Customer>>('/customers', payload);
        
        const data = response.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as Customer;
        }
        
        return data as Customer;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error creating customer:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
            errors: error.response?.data?.errors,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
};

export const useUpdateCustomerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateCustomerPayload }) => {
      try {
        const response = await apiClient.patch<ApiResponse<Customer>>(`/customers/${id}`, data);
        
        const result = response.data;
        
        if (result && typeof result === 'object' && 'data' in result) {
          return (result as any).data as Customer;
        }
        
        return result as Customer;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error updating customer:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(variables.id) });
    },
  });
};

export const useDeleteCustomerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        const response = await apiClient.delete<ApiResponse<any>>(`/customers/${id}`);
        return response.data;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error deleting customer:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
};

// --- Payment Mutations ---

export const useRecordPaymentMutation = (planId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { 
      amountMinor: number; 
      paidOn: string; 
      method: string; 
      reference?: string;
      notes?: string;
    }) => {
      try {
        const response = await apiClient.post<ApiResponse<Payment>>(`/payment-plans/${planId}/payments`, data);
        
        const result = response.data;
        
        if (result && typeof result === 'object' && 'data' in result) {
          return (result as any).data as Payment;
        }
        
        return result as Payment;
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
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.paymentPlan(planId) });
      queryClient.invalidateQueries({ queryKey: customerKeys.installments(planId) });
      queryClient.invalidateQueries({ queryKey: customerKeys.payments(planId) });
      queryClient.invalidateQueries({ queryKey: customerKeys.detail('') });
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
};

// --- Utility Functions ---

export const getCustomerTypeLabel = (type: CustomerType): string => {
  const labels: Record<CustomerType, string> = {
    payment_plan: 'Payment Plan',
    fully_paid: 'Fully Paid',
  };
  return labels[type] || type;
};

export const getCustomerTypeColor = (type: CustomerType): string => {
  const colors: Record<CustomerType, string> = {
    payment_plan: 'blue',
    fully_paid: 'green',
  };
  return colors[type] || 'default';
};

export const getCustomerFullName = (customer: Customer): string => {
  return `${customer.firstName} ${customer.lastName}`;
};

// --- Backward Compatibility (Deprecated) ---

/**
 * @deprecated Use useCustomersQuery instead
 */
export const useCustomers = useCustomersQuery;

/**
 * @deprecated Use useCustomerQuery instead
 */
export const useCustomer = useCustomerQuery;

/**
 * @deprecated Use usePaymentPlanQuery instead
 */
export const usePaymentPlan = usePaymentPlanQuery;

/**
 * @deprecated Use useInstallmentsQuery instead
 */
export const useInstallments = useInstallmentsQuery;

/**
 * @deprecated Use useRecordPaymentMutation instead
 */
export const useRecordPayment = useRecordPaymentMutation;

/**
 * @deprecated Use usePaymentPlanDocumentQuery instead
 */
export const usePaymentPlanDocument = usePaymentPlanDocumentQuery;

/**
 * @deprecated Use useCreateCustomerMutation instead
 */
export const useCreateCustomer = useCreateCustomerMutation;

/**
 * @deprecated Use useUpdateCustomerMutation instead
 */
export const useUpdateCustomer = useUpdateCustomerMutation;

/**
 * @deprecated Use useDeleteCustomerMutation instead
 */
export const useDeleteCustomer = useDeleteCustomerMutation;