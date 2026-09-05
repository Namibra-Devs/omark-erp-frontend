// src/api/notifications.ts
//
// Integrated with backend API endpoints at /api/v1/notifications

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  category: 'Attendance' | 'Payroll & Bonuses' | 'Sales & Deeds' | 'Security Sentinel' | 'General';
  severity: 'info' | 'success' | 'warning' | 'error';
  targetUserId?: string;
  targetRole?: string[];
  targetBranchId?: string;
  isBroadcast?: boolean;
  linkUrl?: string;
  isRead: boolean;
  createdAt: string;
}

export interface SendTestSMSPayload {
  phoneNumber: string;
  message: string;
}

export interface SendTestSMSResult {
  sent: boolean;
  providerMessageId?: string;
}

export interface SendBroadcastSMSPayload {
  recipientPhoneNumbers: string[];
  messageText: string;
  senderId?: string;
}

// --- Query Keys ---

export const notificationsKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationsKeys.all, 'list'] as const,
  list: (params?: NotificationsListParams) => [...notificationsKeys.lists(), params ?? {}] as const,
  inApp: (userId?: string, unreadOnly?: boolean) => [...notificationsKeys.all, 'in-app', userId, unreadOnly] as const,
};

// --- Hooks ---

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
        return { items: [], total: 0, page: 1, pageSize: 20 };
      }
    },
    enabled,
  });
}

export function useInAppNotificationsQuery(userId?: string, unreadOnly = false) {
  return useQuery({
    queryKey: notificationsKeys.inApp(userId, unreadOnly),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<InAppNotification[]>>('/notifications/in-app', {
          params: { userId, unreadOnly },
        });
        const list = unwrapList(res);
        return Array.isArray(list) ? list : (list as any)?.items || [];
      } catch {
        return [];
      }
    },
    refetchInterval: 15000,
  });
}

export function usePendingNotificationsCountQuery(enabled = true) {
  return useQuery({
    queryKey: [...notificationsKeys.all, 'pending-count'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<NotificationLog[]>>('/notifications', {
          params: { status: 'pending', pageSize: 1 },
        });
        return unwrapList(res).total;
      } catch {
        return 0;
      }
    },
    refetchInterval: 30000,
    enabled,
  });
}

export function useSendTestSMSMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SendTestSMSPayload) => {
      const res = await apiClient.post<ApiResponse<SendTestSMSResult>>('/notifications/test', payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}

export function useSendBroadcastSMSMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SendBroadcastSMSPayload) => {
      const res = await apiClient.post<ApiResponse<any>>('/notifications/send-sms', payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}

export function useMarkNotificationAsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch<ApiResponse<any>>(`/notifications/${id}/read`);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}

export function useMarkAllNotificationsAsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiResponse<any>>('/notifications/mark-all-read');
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
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
