// src/api/appointments.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { erpClient } from '@/api/client';
import { AxiosError } from 'axios';

// --- Types ---

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface AppointmentEntity {
  id: string;
  prospectId?: string;
  customerId?: string;
  assignedToUserId?: string;
  title: string;
  scheduledAt: string;
  status: AppointmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentsListParams {
  page?: number;
  limit?: number;
  status?: AppointmentStatus;
  from?: string;
  to?: string;
  assignedToUserId?: string;
}

export interface AppointmentsListResponse {
  items: AppointmentEntity[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateAppointmentPayload {
  prospectId?: string;
  customerId?: string;
  assignedToUserId?: string;
  title: string;
  scheduledAt: string;
  notes?: string;
}

export interface UpdateAppointmentStatusPayload {
  status: AppointmentStatus;
  notes?: string;
}

export interface UpdateAppointmentPayload {
  title?: string;
  scheduledAt?: string;
  notes?: string;
  assignedToUserId?: string;
}

export interface PublicBookAppointmentPayload {
  fullName: string;
  phoneNumber: string;
  email?: string;
  preferredDate: string;
  propertyInterest?: string;
  notes?: string;
}

export interface PublicBookAppointmentResponse {
  id: string;
  confirmationCode?: string;
  scheduledAt: string;
}

// --- Query Keys ---

export const appointmentsKeys = {
  all: ['appointments'] as const,
  list: (params?: AppointmentsListParams) =>
    [...appointmentsKeys.all, 'list', params ?? {}] as const,
  detail: (id: string) => [...appointmentsKeys.all, 'detail', id] as const,
};

// --- Hooks ---

/**
 * Get appointments list with pagination and filters
 */
export function useAppointmentsQuery(params?: AppointmentsListParams) {
  return useQuery({
    queryKey: appointmentsKeys.list(params),
    queryFn: async () => {
      try {
        const response = await apiClient.get<AppointmentsListResponse>('/appointments', { 
          params 
        });
        
        // Handle both wrapped and unwrapped responses
        const data = response.data;
        
        // Check if response is wrapped with success/data
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as AppointmentsListResponse;
        }
        
        // Check if response is the actual data
        if (data && 'items' in data && 'total' in data) {
          return data as AppointmentsListResponse;
        }
        
        // Fallback: return empty response
        console.warn('Unexpected appointments response format:', data);
        return {
          items: [],
          total: 0,
          page: params?.page || 1,
          limit: params?.limit || 10,
        } as AppointmentsListResponse;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error fetching appointments:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
            data: error.response?.data,
          });
        }
        throw error;
      }
    },
  });
}

/**
 * Get single appointment by ID
 */
export function useAppointmentQuery(id: string) {
  return useQuery({
    queryKey: appointmentsKeys.detail(id),
    queryFn: async () => {
      try {
        const response = await apiClient.get<AppointmentEntity>(`/appointments/${id}`);
        
        // Handle both wrapped and unwrapped responses
        const data = response.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as AppointmentEntity;
        }
        
        return data as AppointmentEntity;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error(`Error fetching appointment ${id}:`, {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    enabled: !!id,
  });
}

/**
 * Create a new appointment
 */
export function useCreateAppointmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateAppointmentPayload) => {
      try {
        const response = await apiClient.post<AppointmentEntity>('/appointments', payload);
        
        // Handle both wrapped and unwrapped responses
        const data = response.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as AppointmentEntity;
        }
        
        return data as AppointmentEntity;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error creating appointment:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
            errors: error.response?.data?.errors,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.list() });
    },
  });
}

/**
 * Update appointment status
 */
export function useUpdateAppointmentStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateAppointmentStatusPayload;
    }) => {
      try {
        const response = await apiClient.patch<AppointmentEntity>(
          `/appointments/${id}/status`,
          payload
        );
        
        // Handle both wrapped and unwrapped responses
        const data = response.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as AppointmentEntity;
        }
        
        return data as AppointmentEntity;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error updating appointment status:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.list() });
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.detail(variables.id) });
    },
  });
}

/**
 * Update appointment details
 */
export function useUpdateAppointmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateAppointmentPayload;
    }) => {
      try {
        const response = await apiClient.patch<AppointmentEntity>(
          `/appointments/${id}`,
          payload
        );
        
        // Handle both wrapped and unwrapped responses
        const data = response.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as AppointmentEntity;
        }
        
        return data as AppointmentEntity;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error updating appointment:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.list() });
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.detail(variables.id) });
    },
  });
}

/**
 * Delete an appointment
 */
export function useDeleteAppointmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await apiClient.delete(`/appointments/${id}`);
        return id;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error deleting appointment:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.list() });
    },
  });
}

/**
 * Public booking (unauthenticated)
 * Uses erpClient because the endpoint is under /api/v1/public/*
 * and is intentionally unauthenticated
 */
export function usePublicBookAppointmentMutation() {
  return useMutation({
    mutationFn: async (payload: PublicBookAppointmentPayload) => {
      try {
        const response = await erpClient.post<PublicBookAppointmentResponse>(
          '/api/v1/public/appointments',
          payload
        );
        
        // Handle both wrapped and unwrapped responses
        const data = response.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as PublicBookAppointmentResponse;
        }
        
        return data as PublicBookAppointmentResponse;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error creating public booking:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
            errors: error.response?.data?.errors,
          });
        }
        throw error;
      }
    },
  });
}

// --- Utility Functions ---

/**
 * Get appointment status config for UI display
 */
export const getAppointmentStatusConfig = (status: AppointmentStatus) => {
  const configs: Record<AppointmentStatus, { color: string; icon: string; label: string }> = {
    scheduled: { color: '#1890ff', icon: '📅', label: 'Scheduled' },
    confirmed: { color: '#52c41a', icon: '✅', label: 'Confirmed' },
    completed: { color: '#722ed1', icon: '✔️', label: 'Completed' },
    cancelled: { color: '#ff4d4f', icon: '❌', label: 'Cancelled' },
    no_show: { color: '#faad14', icon: '⚠️', label: 'No Show' },
  };
  return configs[status] || configs.scheduled;
};

/**
 * Format appointment date for display
 */
export const formatAppointmentDate = (scheduledAt: string) => {
  return new Date(scheduledAt).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Check if appointment is upcoming
 */
export const isUpcomingAppointment = (scheduledAt: string) => {
  return new Date(scheduledAt) > new Date();
};

/**
 * Check if appointment is past
 */
export const isPastAppointment = (scheduledAt: string) => {
  return new Date(scheduledAt) < new Date();
};

/**
 * Check if appointment is today
 */
export const isTodayAppointment = (scheduledAt: string) => {
  const today = new Date();
  const appointmentDate = new Date(scheduledAt);
  return (
    appointmentDate.getDate() === today.getDate() &&
    appointmentDate.getMonth() === today.getMonth() &&
    appointmentDate.getFullYear() === today.getFullYear()
  );
};