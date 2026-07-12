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

export function useAppointmentsQuery(params?: AppointmentsListParams) {
  return useQuery({
    queryKey: appointmentsKeys.list(params),
    queryFn: async () => {
      try {
        // The backend 400s on some deployments when page/pageSize are
        // omitted (its own default-pagination path appears to break) —
        // always send them explicitly rather than relying on server defaults.
        const requestParams = { page: 1, pageSize: 20, ...params };
        const response = await apiClient.get<ApiResponse<Appointment[]>>('/appointments', { params: requestParams });
        return unwrapList(response) as AppointmentsListResult;
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
