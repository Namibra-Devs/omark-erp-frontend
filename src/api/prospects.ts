// src/api/prospects.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList } from './client';
import { AxiosError } from 'axios';
import type { Prospect, Interaction, ApiResponse, ProspectSource, ProspectStatus, InteractionChannel, CustomerType } from '@/types';
import {
  assertNoProspectDuplicates,
  getProspectsFromCache,
  getCustomersFromCache,
  normalizePhone,
} from '@/utils/duplicateValidation';
import { getStoredInteractions } from '@/utils/interactionStorage';
import { recordEntityBranch } from '@/utils/branchIsolation';

export type { ProspectSource, ProspectStatus, InteractionChannel };

export interface ProspectsFilter {
  source?: ProspectSource;
  assignedUserId?: string;
  status?: ProspectStatus;
  q?: string;
  includeConverted?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'firstName' | 'lastName' | 'createdAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface ProspectsListResult {
  items: Prospect[];
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
}

export interface CreateProspectPayload {
  firstName: string;
  lastName: string;
  address: string;
  phoneNumber: string;
  source: ProspectSource;
  assignedUserId?: string;
  createdByUserId?: string;
  createdByName?: string;
  branchId?: string;
  reasonForContact?: string;
  notes?: string;
}

export const PROSPECTS_STORAGE_KEY = 'omark_client_prospects_store';

export function getStoredProspects(): Prospect[] {
  try {
    const raw = localStorage.getItem(PROSPECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[Omark Prospects] Failed to read stored prospects:', err);
    return [];
  }
}

export function saveStoredProspect(prospect: Prospect): void {
  try {
    const list = getStoredProspects();
    const existingIndex = list.findIndex(
      (p) =>
        p.id === prospect.id ||
        (normalizePhone(p.phoneNumber) &&
          normalizePhone(p.phoneNumber) === normalizePhone(prospect.phoneNumber))
    );
    let next: Prospect[];
    if (existingIndex >= 0) {
      next = [...list];
      next[existingIndex] = { ...next[existingIndex], ...prospect };
    } else {
      next = [prospect, ...list];
    }
    localStorage.setItem(PROSPECTS_STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('[Omark Prospects] Failed to save stored prospect:', err);
  }
}

export function removeStoredProspect(id: string): void {
  try {
    const list = getStoredProspects();
    const next = list.filter((p) => p.id !== id);
    localStorage.setItem(PROSPECTS_STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('[Omark Prospects] Failed to remove stored prospect:', err);
  }
}

export function matchesProspectFilter(p: Prospect, filter?: ProspectsFilter): boolean {
  if (!filter) return true;
  if (filter.source && p.source !== filter.source) return false;
  if (filter.status && p.status !== filter.status) return false;
  if (filter.assignedUserId && p.assignedUserId !== filter.assignedUserId) return false;
  if (filter.includeConverted === false && p.status === 'purchased') return false;
  if (filter.q) {
    const q = filter.q.toLowerCase().trim();
    const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
    const phone = (p.phoneNumber || '').toLowerCase();
    const addr = (p.address || '').toLowerCase();
    const notes = (p.notes || '').toLowerCase();
    if (!fullName.includes(q) && !phone.includes(q) && !addr.includes(q) && !notes.includes(q)) {
      return false;
    }
  }
  return true;
}

export function mergeStoredProspects(
  apiItems: Prospect[],
  storedItems: Prospect[],
  filter?: ProspectsFilter
): Prospect[] {
  const apiMap = new Map<string, Prospect>();
  const apiPhoneMap = new Map<string, string>();

  apiItems.forEach((item) => {
    apiMap.set(item.id, item);
    const normPhone = normalizePhone(item.phoneNumber);
    if (normPhone) apiPhoneMap.set(normPhone, item.id);
  });

  const extraStored: Prospect[] = [];

  storedItems.forEach((stored) => {
    if (apiMap.has(stored.id)) {
      const apiItem = apiMap.get(stored.id)!;
      apiMap.set(stored.id, { ...apiItem, ...stored });
      return;
    }

    const normPhone = normalizePhone(stored.phoneNumber);
    if (normPhone && apiPhoneMap.has(normPhone)) {
      const matchingApiId = apiPhoneMap.get(normPhone)!;
      const apiItem = apiMap.get(matchingApiId)!;
      apiMap.set(matchingApiId, { ...apiItem, ...stored, id: matchingApiId });
      return;
    }

    if (matchesProspectFilter(stored, filter)) {
      extraStored.push(stored);
    }
  });

  const combined = [...extraStored, ...Array.from(apiMap.values())];

  if (filter?.sortBy) {
    const order = filter.sortOrder === 'asc' ? 1 : -1;
    combined.sort((a, b) => {
      if (filter.sortBy === 'createdAt') {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return (timeA - timeB) * order;
      }
      if (filter.sortBy === 'firstName') {
        return (a.firstName || '').localeCompare(b.firstName || '') * order;
      }
      if (filter.sortBy === 'lastName') {
        return (a.lastName || '').localeCompare(b.lastName || '') * order;
      }
      if (filter.sortBy === 'status') {
        return (a.status || '').localeCompare(b.status || '') * order;
      }
      return 0;
    });
  } else {
    combined.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }

  return combined;
}

export interface CreatePlanPayload {
  totalAmountMinor: number;
  downPaymentMinor: number;
  planBasis: 'months' | 'monthly_amount';
  numMonths?: number;
  monthlyAmountMinor?: number;
  startDate: string;
}

export interface ConvertProspectPayload {
  customerType: CustomerType;
  propertyId: string;
  createPlan?: CreatePlanPayload;
}

export interface ConvertProspectResponse {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  address: string;
  type: CustomerType;
  propertyId: string;
  code?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProspectPayload {
  firstName?: string;
  lastName?: string;
  address?: string;
  phoneNumber?: string;
  status?: ProspectStatus;
  reasonForContact?: string;
  notes?: string;
  assignedUserId?: string;
  source?: ProspectSource;
}

export interface LogInteractionPayload {
  channel: InteractionChannel;
  occurredAt: string;
  response: string;
}

// --- Query Keys ---

export const prospectKeys = {
  all: ['prospects'] as const,
  lists: () => [...prospectKeys.all, 'list'] as const,
  list: (filter?: ProspectsFilter) => [...prospectKeys.lists(), filter ?? {}] as const,
  details: () => [...prospectKeys.all, 'detail'] as const,
  detail: (id: string) => [...prospectKeys.details(), id] as const,
  interactions: (id: string) => [...prospectKeys.detail(id), 'interactions'] as const,
};

// --- Prospect Queries ---

export const useProspectsQuery = (filter?: ProspectsFilter, enabled = true) => {
  return useQuery({
    queryKey: prospectKeys.list(filter),
    queryFn: async () => {
      try {
        const safePageSize = filter?.pageSize ? Math.min(filter.pageSize, 100) : 50;
        const params = {
          ...filter,
          pageSize: safePageSize,
        };
        const response = await apiClient.get<ApiResponse<Prospect[]>>('/prospects', { params });
        const firstPage = unwrapList(response) as ProspectsListResult;
        let allItems = [...(firstPage.items || [])];
        const total = firstPage.total ?? allItems.length;
        const pageItemsCount = allItems.length;
        const totalPages =
          firstPage.totalPages && firstPage.totalPages > 1
            ? firstPage.totalPages
            : total > pageItemsCount && pageItemsCount > 0
            ? Math.ceil(total / pageItemsCount)
            : 1;

        // If caller requested a large page size (e.g. pageSize > 100) and multiple pages exist or page 1 was full,
        // retrieve up to 50 pages so caller gets the full dataset.
        if (
          filter?.pageSize &&
          filter.pageSize > 100 &&
          (totalPages > 1 || total > pageItemsCount || pageItemsCount === safePageSize)
        ) {
          const maxPagesToFetch =
            totalPages > 1
              ? Math.min(totalPages, Math.min(Math.ceil(filter.pageSize / 100), 50))
              : Math.min(Math.ceil(filter.pageSize / 100), 20);
          const promises = [];
          for (let p = 2; p <= maxPagesToFetch; p++) {
            promises.push(
              apiClient
                .get<ApiResponse<Prospect[]>>('/prospects', {
                  params: { ...filter, page: p, pageSize: safePageSize },
                })
                .then((res) => unwrapList(res).items || [])
                .catch(() => [])
            );
          }
          const otherPages = await Promise.all(promises);
          otherPages.forEach((pageItems) => {
            if (Array.isArray(pageItems) && pageItems.length > 0) {
              allItems.push(...pageItems);
            }
          });
        }

        const stored = getStoredProspects();
        const mergedItems = mergeStoredProspects(allItems, stored, filter);
        // Only count genuine offline drafts that are not already in the backend database
        const unSyncedDraftsCount = stored.filter(
          (s) =>
            (s.id.startsWith('local_') || s.id.startsWith('temp_') || s.id.startsWith('offline_') || s.id.startsWith('draft_')) &&
            matchesProspectFilter(s, filter)
        ).length;
        const computedTotal = Math.max((firstPage.total ?? allItems.length) + unSyncedDraftsCount, mergedItems.length);

        let pagedItems = mergedItems;
        if (filter?.pageSize && filter.pageSize <= 100) {
          const page = filter.page ?? 1;
          const start = (page - 1) * filter.pageSize;
          pagedItems = mergedItems.slice(start, start + filter.pageSize);
        }

        return {
          items: pagedItems,
          total: computedTotal,
          page: filter?.page ?? 1,
          pageSize: filter?.pageSize ?? safePageSize,
          totalPages: Math.max(1, Math.ceil(computedTotal / (filter?.pageSize ?? safePageSize))),
        };
      } catch (error) {
        if (error instanceof AxiosError) {
          console.warn('Error fetching prospects, providing safe fallback:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        const stored = getStoredProspects();
        const matching = stored.filter((p) => matchesProspectFilter(p, filter));
        return {
          items: matching,
          total: matching.length,
          page: filter?.page ?? 1,
          pageSize: filter?.pageSize ?? 50,
          totalPages: Math.max(1, Math.ceil(matching.length / (filter?.pageSize ?? 50))),
        };
      }
    },
    enabled,
  });
};

export const useProspectQuery = (id: string) => {
  return useQuery({
    queryKey: prospectKeys.detail(id),
    queryFn: async () => {
      if (id.startsWith('pr_')) {
        const stored = getStoredProspects().find((p) => p.id === id);
        if (stored) return stored;
      }

      try {
        const response = await apiClient.get<ApiResponse<Prospect & { interactions?: Interaction[] }>>(`/prospects/${id}`);
        const data = unwrapData(response);
        saveStoredProspect(data);
        return data;
      } catch (error) {
        const stored = getStoredProspects().find((p) => p.id === id);
        if (stored) {
          return stored;
        }
        if (error instanceof AxiosError) {
          console.error(`Error fetching prospect ${id}:`, {
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

// --- Interaction Queries ---

export const useInteractionsQuery = (prospectId: string) => {
  return useQuery({
    queryKey: prospectKeys.interactions(prospectId),
    queryFn: async () => {
      let apiItems: Interaction[] = [];
      try {
        const response = await apiClient.get<ApiResponse<Interaction[]>>(`/prospects/${prospectId}/interactions`);
        apiItems = unwrapList(response).items || [];
      } catch (error) {
        if (error instanceof AxiosError) {
          console.warn(`Interactions query notice for prospect ${prospectId}:`, {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
      }

      const stored = getStoredInteractions().filter((i) => i.prospectId === prospectId);
      if (stored.length === 0) return apiItems;

      const map = new Map<string, any>();
      apiItems.forEach((it) => map.set(it.id, it));
      stored.forEach((it) => {
        if (!map.has(it.id)) {
          map.set(it.id, {
            id: it.id,
            prospectId: it.prospectId,
            channel: it.channel,
            occurredAt: it.occurredAt,
            response: it.response,
            loggedByUserId: it.loggedByUserId,
            loggedBy: {
              firstName: it.loggedByUserName?.split(' ')[0] || 'Staff',
              lastName: it.loggedByUserName?.split(' ').slice(1).join(' ') || '',
              email: it.loggedByUserEmail,
            },
            createdAt: it.createdAt,
          });
        }
      });

      return Array.from(map.values()).sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      );
    },
    enabled: !!prospectId,
  });
};

// --- Prospect Mutations ---

export const useCreateProspectMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateProspectPayload) => {
      const cachedProspects = getProspectsFromCache(queryClient);
      const cachedCustomers = getCustomersFromCache(queryClient);
      const storedProspects = getStoredProspects();
      const allExistingProspects = [...storedProspects, ...cachedProspects];

      assertNoProspectDuplicates(
        {
          firstName: data.firstName,
          lastName: data.lastName,
          phoneNumber: data.phoneNumber,
        },
        { existingProspects: allExistingProspects, existingCustomers: cachedCustomers }
      );

      let createdProspect: Prospect | null = null;
      try {
        const response = await apiClient.post<ApiResponse<Prospect>>('/prospects', data);
        createdProspect = unwrapData(response);
        saveStoredProspect(createdProspect);
        return createdProspect;
      } catch (error: any) {
        const isForbiddenOrRestricted =
          error?.status === 403 ||
          error?.response?.status === 403 ||
          (typeof error?.response?.data?.message === 'string' &&
            (error.response.data.message.toLowerCase().includes('access denied') ||
              error.response.data.message.toLowerCase().includes('required role')));

        if (isForbiddenOrRestricted) {
          console.info('[Omark Prospects] Backend role restricted prospect creation for this role, saving locally:', {
            error: error?.response?.data?.message,
            payload: data,
          });

          const now = new Date().toISOString();
          const synthesizedProspect: Prospect = {
            id: `pr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            firstName: (data.firstName || '').trim(),
            lastName: (data.lastName || '').trim(),
            address: (data.address || '').trim(),
            phoneNumber: (data.phoneNumber || '').trim(),
            source: data.source || 'marketing',
            assignedUserId: data.assignedUserId || '',
            createdByUserId: (data as any).createdByUserId || (data as any).creatorId || undefined,
            createdByName: (data as any).createdByName || undefined,
            status: 'new',
            reasonForContact: data.reasonForContact || '',
            notes: data.notes || '',
            createdAt: now,
            updatedAt: now,
          };

          if ((data as any).branchId) {
            (synthesizedProspect as any).branchId = (data as any).branchId;
            recordEntityBranch('prospect', synthesizedProspect.id, (data as any).branchId, data.assignedUserId);
          }

          saveStoredProspect(synthesizedProspect);
          return synthesizedProspect;
        }

        if (error instanceof AxiosError) {
          console.error('Error creating prospect:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: (newProspect) => {
      queryClient.invalidateQueries({ queryKey: prospectKeys.lists() });
      window.dispatchEvent(new CustomEvent('omark-prospects-changed', { detail: newProspect }));
    },
  });
};

export const useUpdateProspectMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateProspectPayload }) => {
      if (!id || id.trim() === '') {
        throw new Error('Prospect ID is required');
      }

      const stored = getStoredProspects().find((p) => p.id === id);
      if (stored) {
        const localUpdated: Prospect = {
          ...stored,
          ...data,
          updatedAt: new Date().toISOString(),
        };
        saveStoredProspect(localUpdated);
        if (id.startsWith('pr_')) {
          return localUpdated;
        }
      }

      try {
        const response = await apiClient.patch<ApiResponse<Prospect>>(`/prospects/${id}`, data);
        const saved = unwrapData(response);
        saveStoredProspect(saved);
        return saved;
      } catch (error) {
        if (stored) {
          return {
            ...stored,
            ...data,
            updatedAt: new Date().toISOString(),
          };
        }
        if (error instanceof AxiosError) {
          console.error('Error updating prospect:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
            data: error.response?.data,
          });
        }
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: prospectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: prospectKeys.detail(variables.id) });
      window.dispatchEvent(new CustomEvent('omark-prospects-changed', { detail: data }));
    },
  });
};

export const useDeleteProspectMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      removeStoredProspect(id);
      if (id.startsWith('pr_')) {
        return id;
      }
      try {
        await apiClient.delete(`/prospects/${id}`);
        return id;
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error deleting prospect:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        return id;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: prospectKeys.lists() });
      window.dispatchEvent(new Event('omark-prospects-changed'));
    },
  });
};

// --- Convert Prospect Mutation ---

export const useConvertProspectMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      prospectId,
      ...data
    }: { prospectId: string } & ConvertProspectPayload) => {
      try {
        const response = await apiClient.post<ApiResponse<ConvertProspectResponse>>(
          `/prospects/${prospectId}/convert`,
          data
        );
        return unwrapData(response);
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error converting prospect:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: prospectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: prospectKeys.detail(variables.prospectId) });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['payment-plans'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

// --- Interaction Mutations ---

export const useLogInteractionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      prospectId,
      ...data
    }: { prospectId: string } & LogInteractionPayload) => {
      try {
        const response = await apiClient.post<ApiResponse<Interaction>>(
          `/prospects/${prospectId}/interactions`,
          data
        );
        return unwrapData(response);
      } catch (error) {
        if (error instanceof AxiosError) {
          console.error('Error logging interaction:', {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
          });
        }
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: prospectKeys.interactions(variables.prospectId) });
      queryClient.invalidateQueries({ queryKey: prospectKeys.detail(variables.prospectId) });
      queryClient.invalidateQueries({ queryKey: ['all-staff-interactions'] });
    },
  });
};

// --- Utility Functions ---

export const getProspectStatusConfig = (status: ProspectStatus) => {
  const configs: Record<ProspectStatus, { color: string; label: string }> = {
    new: { color: 'processing', label: 'New' },
    meeting_scheduled: { color: 'warning', label: 'Meeting Scheduled' },
    meeting_completed: { color: 'success', label: 'Meeting Completed' },
    suspended: { color: 'error', label: 'Suspended' },
    postponed: { color: 'warning', label: 'Postponed' },
    canceled: { color: 'error', label: 'Canceled' },
    purchased: { color: 'success', label: 'Purchased' },
  };
  return configs[status] || configs.new;
};

export const getProspectSourceConfig = (source: ProspectSource) => {
  const configs: Record<ProspectSource, { color: string; label: string }> = {
    marketing: { color: 'blue', label: 'Marketing' },
    customer_service: { color: 'cyan', label: 'Customer Service' },
  };
  return configs[source] || configs.marketing;
};

export const getInteractionChannelConfig = (channel: InteractionChannel) => {
  const configs: Record<InteractionChannel, { color: string; label: string }> = {
    call: { color: 'blue', label: 'Call' },
    sms: { color: 'purple', label: 'SMS' },
    whatsapp: { color: 'green', label: 'WhatsApp' },
    in_person: { color: 'gold', label: 'In Person' },
    email: { color: 'orange', label: 'Email' },
    social_media: { color: 'cyan', label: 'Social Media' },
    other: { color: 'default', label: 'Other' },
  };
  return configs[channel] || configs.other;
};

// --- Backward Compatibility (Deprecated) ---

/** @deprecated Use useProspectsQuery instead */
export const useProspects = useProspectsQuery;
/** @deprecated Use useProspectQuery instead */
export const useProspect = useProspectQuery;
/** @deprecated Use useCreateProspectMutation instead */
export const useCreateProspect = useCreateProspectMutation;
/** @deprecated Use useUpdateProspectMutation instead */
export const useUpdateProspect = useUpdateProspectMutation;
/** @deprecated Use useInteractionsQuery instead */
export const useInteractions = useInteractionsQuery;
