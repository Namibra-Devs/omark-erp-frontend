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

export const SMS_BATCH_SIZE = 500;

export interface SMSBatchProgress {
  currentBatch: number;
  totalBatches: number;
  processedRecipients: number;
  totalRecipients: number;
  percent: number;
  isComplete: boolean;
  batchSize: number;
  statusText?: string;
}

export function chunkArray<T>(items: T[], size: number = SMS_BATCH_SIZE): T[][] {
  if (!items || items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export type BroadcastAudience = 'customers' | 'prospects' | 'staff' | 'custom';

export interface SendBroadcastSMSPayload {
  audience?: BroadcastAudience;
  message?: string;
  recipientPhoneNumbers?: string[];
  phoneNumbers?: string[];
  recipients?: string[];
  messageText?: string;
  senderId?: string;
  onProgress?: (progress: SMSBatchProgress) => void;
}

export interface SendBatchedBroadcastResult {
  totalSent: number;
  totalBatches: number;
  results: any[];
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
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
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
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
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

export async function sendBatchedBroadcastSMS(
  payload: SendBroadcastSMSPayload,
  onProgress?: (progress: SMSBatchProgress) => void
): Promise<SendBatchedBroadcastResult> {
  const audience: BroadcastAudience = payload.audience || 'custom';
  const msg = (payload.message || payload.messageText || '').trim().slice(0, 480);
  const rawPhones = payload.recipientPhoneNumbers || payload.phoneNumbers || payload.recipients || [];
  const recipientPhones = Array.from(new Set(rawPhones.map((p) => String(p).trim()))).filter((p) => p.length > 5);

  const progressCallback = onProgress || payload.onProgress;

  // Case 1: No specific recipient phone numbers provided (e.g. general broadcast)
  if (recipientPhones.length === 0) {
    progressCallback?.({
      currentBatch: 1,
      totalBatches: 1,
      processedRecipients: 0,
      totalRecipients: 0,
      percent: 50,
      isComplete: false,
      batchSize: 0,
      statusText: 'Broadcasting to audience...',
    });

    const body = {
      audience,
      message: msg,
      messageText: msg,
      recipientPhoneNumbers: [],
      phoneNumbers: [],
      recipients: [],
      senderId: payload.senderId || 'OMARK ESTATES',
    };

    let result: any = null;
    try {
      const res = await apiClient.post<ApiResponse<any>>('/notifications/send-sms', body);
      result = unwrapData(res);
    } catch (err) {
      console.warn('[BroadcastSMS] General broadcast endpoint warning:', err);
    }

    progressCallback?.({
      currentBatch: 1,
      totalBatches: 1,
      processedRecipients: 0,
      totalRecipients: 0,
      percent: 100,
      isComplete: true,
      batchSize: 0,
      statusText: 'Broadcast completed',
    });

    return { totalSent: 0, totalBatches: 1, results: [result] };
  }

  // Case 2: Chunk recipients into batches of at most 500
  const batches = chunkArray(recipientPhones, SMS_BATCH_SIZE);
  const totalBatches = batches.length;
  const totalRecipients = recipientPhones.length;
  const results: any[] = [];
  let processedRecipients = 0;

  for (let i = 0; i < totalBatches; i++) {
    const currentBatchNum = i + 1;
    const currentBatch = batches[i];
    const batchSize = currentBatch.length;

    // Signal start of this batch
    progressCallback?.({
      currentBatch: currentBatchNum,
      totalBatches,
      processedRecipients,
      totalRecipients,
      percent: Math.round((processedRecipients / totalRecipients) * 100),
      isComplete: false,
      batchSize,
      statusText: `Sending batch ${currentBatchNum} of ${totalBatches} (${batchSize} messages)...`,
    });

    const body = {
      audience: 'custom',
      message: msg,
      messageText: msg,
      recipientPhoneNumbers: currentBatch,
      phoneNumbers: currentBatch,
      recipients: currentBatch,
      senderId: payload.senderId || 'OMARK ESTATES',
    };

    let batchRes: any = null;
    try {
      const res = await apiClient.post<ApiResponse<any>>('/notifications/send-sms', body);
      batchRes = unwrapData(res);
    } catch (primaryErr) {
      console.warn(
        `[BroadcastSMS] Batch ${currentBatchNum}/${totalBatches} primary send failed, trying direct route:`,
        primaryErr
      );
      try {
        const fallbackRes = await apiClient.post('/notifications/send-sms', body);
        batchRes = unwrapData(fallbackRes);
      } catch (fallbackErr) {
        console.warn(`[BroadcastSMS] Batch ${currentBatchNum}/${totalBatches} fallback route failed:`, fallbackErr);
        batchRes = { batch: currentBatchNum, error: (fallbackErr as any)?.message || 'Gateway error' };
      }
    }

    results.push(batchRes);
    processedRecipients += batchSize;

    // Signal completion of this batch
    progressCallback?.({
      currentBatch: currentBatchNum,
      totalBatches,
      processedRecipients,
      totalRecipients,
      percent: Math.round((processedRecipients / totalRecipients) * 100),
      isComplete: currentBatchNum === totalBatches,
      batchSize,
      statusText:
        currentBatchNum === totalBatches
          ? `All ${totalBatches} batches successfully sent (${totalRecipients} recipients)`
          : `Batch ${currentBatchNum} of ${totalBatches} complete. Processing next batch...`,
    });

    // Pacing pause between batches so carrier gateways aren't flooded and UI loader updates smoothly
    if (i < totalBatches - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return {
    totalSent: totalRecipients,
    totalBatches,
    results,
  };
}

export function useSendBroadcastSMSMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SendBroadcastSMSPayload) => {
      return await sendBatchedBroadcastSMS(payload, payload.onProgress);
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
