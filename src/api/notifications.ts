// src/api/notifications.ts
// Implements the "Notifications" tag from the API docs: this is an
// SMS delivery log (GET /notifications) plus a test-send route
// (POST /notifications/test). There is no read/unread, resend, or delete
// concept on the backend — those actions don't exist as API routes.
import { useMutation, useQuery } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList } from '@/api/client';
import { AxiosError } from 'axios';
import type { NotificationLog, NotificationType, NotificationStatus, ApiResponse } from '@/types';

export type { NotificationLog, NotificationType, NotificationStatus };

export interface NotificationsListParams {
  page?: number;
  pageSize?: number;
  type?: NotificationType;
  status?: NotificationStatus;
}

export interface NotificationsListResult {
  items: NotificationLog[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SendTestSMSPayload {
  phoneNumber: string;
  message: string;
}

export interface SendTestSMSResult {
  sent: boolean;
  providerMessageId?: string;
}

// --- Query Keys ---

export const notificationsKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationsKeys.all, 'list'] as const,
  list: (params?: NotificationsListParams) => [...notificationsKeys.lists(), params ?? {}] as const,
};

// --- Hooks ---

// GET /notifications is only accessible to admin/secretary/accounts on the
// backend — pass `enabled: false` for other roles so this doesn't fire a
// request that's guaranteed to 403.
export function useNotificationsQuery(params?: NotificationsListParams, enabled = true) {
  return useQuery({
    queryKey: notificationsKeys.list(params),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<NotificationLog[]>>('/notifications', { params });
        return unwrapList(res) as NotificationsListResult;
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
    enabled,
  });
}

/**
 * Count of pending (undelivered) SMS notifications, used for the nav badge.
 * There is no dedicated "unread count" endpoint — this reads the pagination
 * meta.total off a 1-row pending-status query instead of fetching a full page.
 *
 * GET /notifications is only accessible to admin/secretary/accounts on the
 * backend — pass `enabled: false` for other roles so this doesn't fire a
 * request that's guaranteed to 403.
 */
export function usePendingNotificationsCountQuery(enabled = true) {
  return useQuery({
    queryKey: [...notificationsKeys.all, 'pending-count'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<NotificationLog[]>>('/notifications', {
          params: { status: 'pending', pageSize: 1 },
        });
        return unwrapList(res).total;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error fetching pending notifications count:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        return 0;
      }
    },
    refetchInterval: 30000,
    enabled,
  });
}

export function useSendTestSMSMutation() {
  return useMutation({
    mutationFn: async (payload: SendTestSMSPayload) => {
      try {
        const res = await apiClient.post<ApiResponse<SendTestSMSResult>>('/notifications/test', payload);
        return unwrapData(res);
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
  });
}

// --- Utility Functions ---

export const getNotificationStatusConfig = (status: NotificationStatus) => {
  const configs: Record<NotificationStatus, { color: string; label: string }> = {
    sent: { color: 'green', label: 'Sent' },
    failed: { color: 'red', label: 'Failed' },
    pending: { color: 'blue', label: 'Pending' },
  };
  return configs[status] || configs.pending;
};

export const getNotificationTypeConfig = (type: NotificationType) => {
  const configs: Record<NotificationType, { color: string; label: string }> = {
    contribution_due_soon: { color: 'blue', label: 'Due Soon' },
    contribution_overdue: { color: 'red', label: 'Overdue' },
  };
  return configs[type] || configs.contribution_due_soon;
};
