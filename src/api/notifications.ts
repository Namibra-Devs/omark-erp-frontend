// src/api/notifications.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { AxiosError } from 'axios';

// --- Types ---

export type NotificationStatus = 'sent' | 'failed' | 'pending' | 'unread' | 'read';
export type NotificationChannel = 'sms' | 'email';
export type NotificationType = 'contribution_due_soon' | 'contribution_overdue' | 'payment_confirmation' | 'general';

export interface NotificationEntity {
  id: string;
  channel: NotificationChannel;
  recipient: string;
  message: string;
  status: NotificationStatus;
  errorMessage?: string;
  sentAt?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  customerId: string;
  phoneNumber?: string;
  type: NotificationType;
  messageBody: string;
  status: NotificationStatus;
  providerMessageId?: string;
  sentAt?: string;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsListParams {
  page?: number;
  limit?: number;
  status?: NotificationStatus | 'unread';
  channel?: NotificationChannel;
  type?: NotificationType;
  search?: string;
}

export interface NotificationsListResponse {
  items: NotificationEntity[];
  total: number;
  page: number;
  limit: number;
}

export interface SendNotificationPayload {
  customerId: string;
  type: NotificationType;
  messageBody: string;
  phoneNumber?: string;
}

export interface SendTestSMSPayload {
  phoneNumber: string;
  message: string;
}

export interface SendTestSMSResponse {
  id: string;
  status: NotificationStatus;
}

// --- Query Keys ---

export const notificationsKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationsKeys.all, 'list'] as const,
  list: (params?: NotificationsListParams) =>
    [...notificationsKeys.lists(), params ?? {}] as const,
  details: () => [...notificationsKeys.all, 'detail'] as const,
  detail: (id: string) => [...notificationsKeys.details(), id] as const,
  unread: () => [...notificationsKeys.all, 'unread'] as const,
  count: () => [...notificationsKeys.all, 'count'] as const,
};

// --- Hooks ---

export function useNotificationsQuery(params?: NotificationsListParams) {
  return useQuery({
    queryKey: notificationsKeys.list(params),
    queryFn: async () => {
      try {
        const res = await apiClient.get<NotificationsListResponse>('/notifications', { params });
        
        const data = res.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as NotificationsListResponse;
        }
        
        if (data && 'items' in data && 'total' in data) {
          return data as NotificationsListResponse;
        }
        
        console.warn('Unexpected notifications response format:', data);
        return {
          items: [],
          total: 0,
          page: params?.page || 1,
          limit: params?.limit || 10,
        } as NotificationsListResponse;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error fetching notifications:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
  });
}

export function useUnreadNotificationsQuery() {
  return useQuery({
    queryKey: notificationsKeys.unread(),
    queryFn: async () => {
      try {
        const res = await apiClient.get<NotificationsListResponse>('/notifications', {
          params: { status: 'unread' }
        });
        
        const data = res.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as NotificationsListResponse;
        }
        
        if (data && 'items' in data && 'total' in data) {
          return data as NotificationsListResponse;
        }
        
        return {
          items: [],
          total: 0,
          page: 1,
          limit: 10,
        } as NotificationsListResponse;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error fetching unread notifications:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
  });
}

export function useUnreadCountQuery() {
  return useQuery({
    queryKey: notificationsKeys.count(),
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ count: number }>('/notifications/unread/count');
        
        const data = res.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data.count as number;
        }
        
        if (data && 'count' in data) {
          return data.count as number;
        }
        
        return 0;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error fetching unread count:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        return 0;
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useNotificationQuery(id: string | undefined) {
  return useQuery({
    queryKey: notificationsKeys.detail(id ?? ''),
    queryFn: async () => {
      try {
        const res = await apiClient.get<Notification>(`/notifications/${id}`);
        
        const data = res.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as Notification;
        }
        
        return data as Notification;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error(`Error fetching notification ${id}:`, {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    enabled: Boolean(id),
  });
}

// --- Notification Mutations ---

export function useSendNotificationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SendNotificationPayload) => {
      try {
        const res = await apiClient.post<Notification>('/notifications', payload);
        
        const data = res.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as Notification;
        }
        
        return data as Notification;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error sending notification:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unread() });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.count() });
    },
  });
}

export function useResendNotificationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        const res = await apiClient.post<Notification>(`/notifications/${id}/resend`);
        
        const data = res.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as Notification;
        }
        
        return data as Notification;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error resending notification:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unread() });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.count() });
    },
  });
}

export function useDeleteNotificationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await apiClient.delete(`/notifications/${id}`);
        return id;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error deleting notification:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unread() });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.count() });
    },
  });
}

export function useSendTestSMSMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SendTestSMSPayload) => {
      try {
        const res = await apiClient.post<SendTestSMSResponse>('/notifications/test', payload);
        
        const data = res.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as SendTestSMSResponse;
        }
        
        return data as SendTestSMSResponse;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error sending test SMS:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.list() });
    },
  });
}

// --- Mark as Read Mutations ---

export function useMarkAsReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        const res = await apiClient.patch<Notification>(`/notifications/${id}/read`);
        
        const data = res.data;
        
        if (data && typeof data === 'object' && 'data' in data) {
          return (data as any).data as Notification;
        }
        
        return data as Notification;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error marking notification as read:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unread() });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.count() });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.detail(variables) });
    },
  });
}

export function useMarkAllAsReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        const res = await apiClient.post('/notifications/read-all');
        return res.data;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error marking all notifications as read:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unread() });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.count() });
    },
  });
}

// --- Utility Functions ---

export const getNotificationStatusConfig = (status: NotificationStatus) => {
  const configs: Record<NotificationStatus, { color: string; label: string }> = {
    sent: { color: 'green', label: 'Sent' },
    failed: { color: 'red', label: 'Failed' },
    pending: { color: 'blue', label: 'Pending' },
    unread: { color: 'blue', label: 'Unread' },
    read: { color: 'green', label: 'Read' },
  };
  return configs[status] || configs.pending;
};

export const getNotificationTypeConfig = (type: NotificationType) => {
  const configs: Record<NotificationType, { color: string; label: string; icon?: string }> = {
    contribution_due_soon: { color: 'blue', label: 'Due Soon' },
    contribution_overdue: { color: 'red', label: 'Overdue' },
    payment_confirmation: { color: 'green', label: 'Payment Confirmed' },
    general: { color: 'default', label: 'General' },
  };
  return configs[type] || configs.general;
};

export const getNotificationChannelConfig = (channel: NotificationChannel) => {
  const configs: Record<NotificationChannel, { color: string; label: string }> = {
    sms: { color: 'blue', label: 'SMS' },
    email: { color: 'orange', label: 'Email' },
  };
  return configs[channel] || configs.sms;
};

// --- Backward Compatibility (Deprecated) ---

/**
 * @deprecated Use useNotificationsQuery instead
 */
export const useNotifications = useNotificationsQuery;

/**
 * @deprecated Use useNotificationQuery instead
 */
export const useNotification = useNotificationQuery;

/**
 * @deprecated Use useSendNotificationMutation instead
 */
export const useSendNotification = useSendNotificationMutation;

/**
 * @deprecated Use useResendNotificationMutation instead
 */
export const useResendNotification = useResendNotificationMutation;

/**
 * @deprecated Use useDeleteNotificationMutation instead
 */
export const useDeleteNotification = useDeleteNotificationMutation;

/**
 * @deprecated Use useSendTestSMSMutation instead
 */
export const useSendTestSMS = useSendTestSMSMutation;

/**
 * @deprecated Use useMarkAsReadMutation instead
 */
export const useMarkAsRead = useMarkAsReadMutation;

/**
 * @deprecated Use useMarkAllAsReadMutation instead
 */
export const useMarkAllAsRead = useMarkAllAsReadMutation;