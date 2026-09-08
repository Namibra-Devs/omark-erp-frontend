// src/api/approvals.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData } from '@/api/client';
import type { ApiResponse } from '@/types';

export interface ApprovalItem {
  id: string;
  type: 'expense' | 'document' | 'pricing_override' | 'policy_exception' | string;
  title: string;
  description?: string;
  requestedBy?: string;
  branchId?: string;
  branchName?: string;
  amountMinor?: number;
  status: 'pending' | 'approved' | 'rejected' | string;
  reason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ApprovalsListParams {
  type?: 'expense' | 'document';
  branchId?: string;
  status?: string;
}

export interface CreateApprovalPayload {
  type: 'expense' | 'document' | 'pricing_override' | 'policy_exception' | string;
  title: string;
  description?: string;
  requestedBy?: string;
  branchId?: string;
  branchName?: string;
  amountMinor?: number;
  reason?: string;
}

const STORAGE_KEY = 'omark_governance_approvals';

const DEFAULT_SEEDED_APPROVALS: ApprovalItem[] = [
  {
    id: 'appr-seed-1',
    type: 'expense',
    title: 'Major Generator Overhaul & Fuel Provisioning',
    description: 'Quarterly overhaul of 150kVA standby generator and diesel bulk storage replenishment.',
    requestedBy: 'Kwame Mensah (Branch Ops)',
    branchId: 'branch-el',
    branchName: 'East Legon Branch',
    amountMinor: 1850000, // GHS 18,500
    status: 'pending',
    reason: 'Exceeds branch single-expense delegated limit of GHS 10,000',
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 'appr-seed-2',
    type: 'pricing_override',
    title: 'Executive Client Discount Request — Plot 14 Airport Hills',
    description: 'High-net-worth buyer requesting 7.5% price reduction for 100% upfront wire settlement.',
    requestedBy: 'Ama Osei (Sales Lead)',
    branchId: 'branch-ah',
    branchName: 'Airport Hills Branch',
    amountMinor: 25000000, // GHS 250,000
    status: 'pending',
    reason: 'Branch sales manager discount ceiling is capped at 5.0%',
    createdAt: new Date(Date.now() - 3600000 * 16).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 16).toISOString(),
  },
  {
    id: 'appr-seed-3',
    type: 'policy_exception',
    title: 'Deferred Downpayment Waiver for Corporate Retainer',
    description: 'Corporate client requests 60-day deed reservation with 15% deposit instead of standard 20%.',
    requestedBy: 'Kofi Boateng (Managing Director Office)',
    branchId: 'branch-ho',
    branchName: 'Head Office',
    amountMinor: 6000000,
    status: 'approved',
    reason: 'Approved under enterprise strategic partnerships framework',
    createdAt: new Date(Date.now() - 3600000 * 50).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
];

export const getStoredApprovals = (): ApprovalItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SEEDED_APPROVALS));
      return DEFAULT_SEEDED_APPROVALS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_SEEDED_APPROVALS;
  } catch {
    return DEFAULT_SEEDED_APPROVALS;
  }
};

export const saveStoredApprovals = (items: ApprovalItem[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('omark-approvals-changed'));
  } catch (err) {
    console.warn('Failed to save stored approvals:', err);
  }
};

export const updateLocalApproval = (id: string, status: 'approved' | 'rejected', reason?: string): ApprovalItem | null => {
  const list = getStoredApprovals();
  const index = list.findIndex((a) => a.id === id);
  const now = new Date().toISOString();
  if (index !== -1) {
    list[index] = {
      ...list[index],
      status,
      reason: reason || list[index].reason || (status === 'approved' ? 'Approved by Head Office' : 'Rejected'),
      updatedAt: now,
    };
    saveStoredApprovals(list);
    return list[index];
  }
  // If not found in local list, synthesize one
  const newItem: ApprovalItem = {
    id,
    type: 'expense',
    title: 'Escalated Request',
    status,
    reason,
    createdAt: now,
    updatedAt: now,
  };
  list.unshift(newItem);
  saveStoredApprovals(list);
  return newItem;
};

export const approvalsKeys = {
  all: ['approvals'] as const,
  lists: () => [...approvalsKeys.all, 'list'] as const,
  list: (params?: ApprovalsListParams) => [...approvalsKeys.lists(), params ?? {}] as const,
};

export function useApprovalsQuery(params?: ApprovalsListParams) {
  return useQuery({
    queryKey: approvalsKeys.list(params),
    queryFn: async (): Promise<ApprovalItem[]> => {
      const stored = getStoredApprovals();
      try {
        const res = await apiClient.get<ApiResponse<ApprovalItem[]>>('/approvals', { params });
        const raw = res.data as any;
        const data = unwrapData(res);

        let apiItems: ApprovalItem[] = [];
        if (Array.isArray(data)) {
          apiItems = data;
        } else if (Array.isArray((data as any)?.items)) {
          apiItems = (data as any).items;
        } else if (Array.isArray((data as any)?.approvals)) {
          apiItems = (data as any).approvals;
        } else if (Array.isArray(raw)) {
          apiItems = raw;
        } else if (Array.isArray(raw?.items)) {
          apiItems = raw.items;
        } else if (Array.isArray(raw?.approvals)) {
          apiItems = raw.approvals;
        } else if (Array.isArray(raw?.data)) {
          apiItems = raw.data;
        }

        if (apiItems.length > 0) {
          // Merge API items with local items, preferring newer status updates from local
          const localMap = new Map(stored.map((item) => [item.id, item]));
          const merged: ApprovalItem[] = apiItems.map((apiItem) => {
            const local = localMap.get(apiItem.id);
            if (local && local.updatedAt && (!apiItem.updatedAt || new Date(local.updatedAt) > new Date(apiItem.updatedAt))) {
              return { ...apiItem, ...local };
            }
            return apiItem;
          });

          // Include local-only items (e.g. locally submitted requests or seed items)
          const apiIds = new Set(apiItems.map((i) => i.id));
          for (const s of stored) {
            if (!apiIds.has(s.id)) {
              merged.push(s);
            }
          }

          saveStoredApprovals(merged);
          return merged;
        }

        return stored;
      } catch (err: any) {
        console.warn('Could not fetch approvals from backend, using local store:', err?.message || err);
        return stored;
      }
    },
  });
}

export function useApproveMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      updateLocalApproval(id, 'approved', reason);
      try {
        const res = await apiClient.post<ApiResponse<ApprovalItem>>(`/approvals/${id}/approve`, { reason });
        return unwrapData(res);
      } catch (err: any) {
        console.warn(`Backend /approvals/${id}/approve failed; persisted locally:`, err?.message || err);
        return { id, status: 'approved', reason } as ApprovalItem;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalsKeys.all });
    },
  });
}

export function useRejectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      updateLocalApproval(id, 'rejected', reason);
      try {
        const res = await apiClient.post<ApiResponse<ApprovalItem>>(`/approvals/${id}/reject`, { reason });
        return unwrapData(res);
      } catch (err: any) {
        console.warn(`Backend /approvals/${id}/reject failed; persisted locally:`, err?.message || err);
        return { id, status: 'rejected', reason } as ApprovalItem;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalsKeys.all });
    },
  });
}

export function useCreateApprovalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateApprovalPayload) => {
      const now = new Date().toISOString();
      const localId = `appr-${Date.now()}`;
      const newItem: ApprovalItem = {
        id: localId,
        type: payload.type,
        title: payload.title,
        description: payload.description,
        requestedBy: payload.requestedBy || 'Staff',
        branchId: payload.branchId,
        branchName: payload.branchName,
        amountMinor: payload.amountMinor,
        status: 'pending',
        reason: payload.reason,
        createdAt: now,
        updatedAt: now,
      };

      const stored = getStoredApprovals();
      stored.unshift(newItem);
      saveStoredApprovals(stored);

      try {
        const res = await apiClient.post<ApiResponse<ApprovalItem>>('/approvals', payload);
        const serverItem = unwrapData(res);
        if (serverItem?.id) {
          const updated = getStoredApprovals().map((item) => (item.id === localId ? serverItem : item));
          saveStoredApprovals(updated);
          return serverItem;
        }
      } catch (err: any) {
        console.warn('Backend /approvals create failed; stored locally:', err?.message || err);
      }

      return newItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalsKeys.all });
    },
  });
}
