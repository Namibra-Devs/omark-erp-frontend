// src/api/appointments.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { erpClient, unwrapData, unwrapList } from '@/api/client';
import { AxiosError } from 'axios';
import type { Appointment, AppointmentStatus, AppointmentSource, ApiResponse } from '@/types';

export type { Appointment, AppointmentStatus, AppointmentSource };

export interface AppointmentsListParams {
  page?: number;
  pageSize?: number;
  status?: AppointmentStatus;
  source?: AppointmentSource;
  from?: string;
  to?: string;
}

export interface AppointmentsListResult {
  items: Appointment[];
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
}

export interface CreateAppointmentPayload {
  scheduledFor: string;
  prospectId?: string;
  customerId?: string;
  reason?: string;
}

export interface UpdateAppointmentPayload {
  status?: AppointmentStatus;
  feedback?: string;
  scheduledFor?: string;
}

export interface PublicBookAppointmentPayload {
  fullName: string;
  phoneNumber: string;
  scheduledFor: string;
  email?: string;
  reason?: string;
}

// POST /public/appointments doesn't publish a response schema in the docs —
// it returns the created Appointment entity.
export type PublicBookAppointmentResponse = Appointment;

// --- Query Keys ---

export const appointmentsKeys = {
  all: ['appointments'] as const,
  list: (params?: AppointmentsListParams) => [...appointmentsKeys.all, 'list', params ?? {}] as const,
  detail: (id: string) => [...appointmentsKeys.all, 'detail', id] as const,
};

// --- Hooks ---

export function useAppointmentsQuery(params?: AppointmentsListParams, enabled = true) {
  return useQuery({
    queryKey: appointmentsKeys.list(params),
    queryFn: async () => {
      try {
        const requestedLimit = params?.pageSize || 100;
        const safePageSize = Math.min(requestedLimit, 100);
        const requestParams = { page: 1, ...params, pageSize: safePageSize };
        const response = await apiClient.get<ApiResponse<Appointment[]>>('/appointments', { params: requestParams });
        const result = unwrapList(response) as AppointmentsListResult;

        let allItems = result.items || [];
        const totalPages = result.totalPages || (result.total ? Math.ceil(result.total / safePageSize) : 1);

        // If caller requested more than 100 items and total exceeds 100, fetch at most 2 pages
        if (requestedLimit > 100 && result.total > 100 && totalPages > 1) {
          const maxPagesToFetch = Math.min(totalPages, Math.min(Math.ceil(requestedLimit / 100), 2));
          const pagePromises = [];
          for (let p = 2; p <= maxPagesToFetch; p++) {
            pagePromises.push(
              apiClient.get<ApiResponse<Appointment[]>>('/appointments', {
                params: { ...requestParams, page: p },
              }).catch(() => null)
            );
          }
          const pageResponses = await Promise.all(pagePromises);
          pageResponses.forEach((res) => {
            if (res) {
              const extra = unwrapList(res).items || [];
              allItems.push(...extra);
            }
          });
        }

        return {
          items: allItems,
          total: result.total,
          page: result.page,
          pageSize: requestedLimit,
          totalPages,
        } as AppointmentsListResult;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.warn('Error fetching appointments, providing safe fallback:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        return { items: [], total: 0, page: 1, pageSize: 100 };
      }
    },
    enabled,
  });
}

/**
 * Create a new appointment for a prospect or customer.
 */
export function useCreateAppointmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateAppointmentPayload) => {
      try {
        const response = await apiClient.post<ApiResponse<Appointment>>('/appointments', payload);
        return unwrapData(response);
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
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.all });
    },
  });
}

/**
 * Update appointment status / feedback / reschedule.
 * Maps to PATCH /appointments/{id} — the only update route the API exposes.
 */
export function useUpdateAppointmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateAppointmentPayload }) => {
      try {
        const response = await apiClient.patch<ApiResponse<Appointment>>(`/appointments/${id}`, payload);
        return unwrapData(response);
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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.all });
    },
  });
}

/** @deprecated Use useUpdateAppointmentMutation with { status, feedback } instead */
export const useUpdateAppointmentStatusMutation = useUpdateAppointmentMutation;

/**
 * Public booking (unauthenticated) — POST /api/v1/public/appointments
 */
export function usePublicBookAppointmentMutation() {
  return useMutation({
    mutationFn: async (payload: PublicBookAppointmentPayload) => {
      try {
        const response = await erpClient.post<ApiResponse<PublicBookAppointmentResponse>>(
          '/api/v1/public/appointments',
          payload
        );
        return unwrapData(response);
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

export const getAppointmentStatusConfig = (status: AppointmentStatus) => {
  const configs: Record<AppointmentStatus, { color: string; icon: string; label: string }> = {
    scheduled: { color: '#1890ff', icon: '📅', label: 'Scheduled' },
    completed: { color: '#722ed1', icon: '✔️', label: 'Completed' },
    canceled: { color: '#ff4d4f', icon: '❌', label: 'Canceled' },
    no_show: { color: '#faad14', icon: '⚠️', label: 'No Show' },
    postponed: { color: '#fa8c16', icon: '⏳', label: 'Postponed' },
  };
  return configs[status] || configs.scheduled;
};

export const formatAppointmentDate = (scheduledFor: string) => {
  return new Date(scheduledFor).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const isUpcomingAppointment = (scheduledFor: string) => new Date(scheduledFor) > new Date();
export const isPastAppointment = (scheduledFor: string) => new Date(scheduledFor) < new Date();
export const isTodayAppointment = (scheduledFor: string) => {
  const today = new Date();
  const appointmentDate = new Date(scheduledFor);
  return (
    appointmentDate.getDate() === today.getDate() &&
    appointmentDate.getMonth() === today.getMonth() &&
    appointmentDate.getFullYear() === today.getFullYear()
  );
};
