// src/api/customers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList } from './client';
import { AxiosError } from 'axios';
import type { Customer, PaymentPlan, Installment, Payment, Appointment, ApiResponse, CustomerType } from '@/types';

export type { CustomerType };

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
  address: string;
  type: CustomerType;
  propertyId: string;
  createPlan?: CreatePlanPayload;
}

export interface CustomersFilter {
  type?: CustomerType;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface CustomersListResult {
  items: Customer[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UpdateCustomerPayload {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  address?: string;
}

export interface CustomerDetail extends Customer {
  plan?: PaymentPlan & { installments?: Installment[]; payments?: Payment[] };
  appointments?: Appointment[];
}

// --- Query Keys ---

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (filter?: CustomersFilter) => [...customerKeys.lists(), filter ?? {}] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
};

// --- Customer Queries ---

export const useCustomersQuery = (filter?: CustomersFilter) => {
  return useQuery({
    queryKey: customerKeys.list(filter),
    queryFn: async () => {
      try {
        const response = await apiClient.get<ApiResponse<Customer[]>>('/customers', { params: filter });
        return unwrapList(response) as CustomersListResult;
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
        const response = await apiClient.get<ApiResponse<CustomerDetail>>(`/customers/${id}`);
        return unwrapData(response);
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

// --- Customer Mutations ---

export const useCreateCustomerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateCustomerPayload) => {
      try {
        const response = await apiClient.post<ApiResponse<Customer>>('/customers', payload);
        return unwrapData(response);
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
        return unwrapData(response);
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
        const response = await apiClient.delete(`/customers/${id}`);
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

/** @deprecated Use useCustomersQuery instead */
export const useCustomers = useCustomersQuery;
/** @deprecated Use useCustomerQuery instead */
export const useCustomer = useCustomerQuery;
/** @deprecated Use useCreateCustomerMutation instead */
export const useCreateCustomer = useCreateCustomerMutation;
/** @deprecated Use useUpdateCustomerMutation instead */
export const useUpdateCustomer = useUpdateCustomerMutation;
/** @deprecated Use useDeleteCustomerMutation instead */
export const useDeleteCustomer = useDeleteCustomerMutation;
