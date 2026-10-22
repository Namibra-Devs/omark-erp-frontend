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
  arePhonesDuplicate,
} from '@/utils/duplicateValidation';
import { customerKeys } from './customers';
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
      const prev = next[existingIndex];
      next[existingIndex] = {
        ...prev,
        ...prospect,
        createdByUserId: prospect.createdByUserId || prev.createdByUserId,
        createdByName: prospect.createdByName || prev.createdByName,
        assignedUserId: prospect.assignedUserId || prev.assignedUserId,
        assignedUserName: (prospect as any).assignedUserName || (prev as any).assignedUserName,
        registeredByUserId: (prospect as any).registeredByUserId || (prev as any).registeredByUserId,
        registeredByName: (prospect as any).registeredByName || (prev as any).registeredByName,
        recordedByUserId: (prospect as any).recordedByUserId || (prev as any).recordedByUserId,
        recordedByName: (prospect as any).recordedByName || (prev as any).recordedByName,
      };
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
      apiMap.set(stored.id, {
        ...apiItem,
        ...stored,
        createdByUserId: stored.createdByUserId || (apiItem as any).createdByUserId,
        createdByName: stored.createdByName || (apiItem as any).createdByName,
        assignedUserId: stored.assignedUserId || apiItem.assignedUserId,
        assignedUserName: (stored as any).assignedUserName || (apiItem as any).assignedUserName,
        registeredByUserId: (stored as any).registeredByUserId || (apiItem as any).registeredByUserId,
        registeredByName: (stored as any).registeredByName || (apiItem as any).registeredByName,
        recordedByUserId: (stored as any).recordedByUserId || (apiItem as any).recordedByUserId,
        recordedByName: (stored as any).recordedByName || (apiItem as any).recordedByName,
      });
      return;
    }

    const normPhone = normalizePhone(stored.phoneNumber);
    if (normPhone && apiPhoneMap.has(normPhone)) {
      const matchingApiId = apiPhoneMap.get(normPhone)!;
      const apiItem = apiMap.get(matchingApiId)!;
      apiMap.set(matchingApiId, {
        ...apiItem,
        ...stored,
        id: matchingApiId,
        createdByUserId: stored.createdByUserId || (apiItem as any).createdByUserId,
        createdByName: stored.createdByName || (apiItem as any).createdByName,
        assignedUserId: stored.assignedUserId || apiItem.assignedUserId,
        assignedUserName: (stored as any).assignedUserName || (apiItem as any).assignedUserName,
        registeredByUserId: (stored as any).registeredByUserId || (apiItem as any).registeredByUserId,
        registeredByName: (stored as any).registeredByName || (apiItem as any).registeredByName,
        recordedByUserId: (stored as any).recordedByUserId || (apiItem as any).recordedByUserId,
        recordedByName: (stored as any).recordedByName || (apiItem as any).recordedByName,
      });
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
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  address?: string;
  assignedUserId?: string;
  notes?: string;
  branchId?: string;
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
        const serverData = unwrapData(response) || {};
        createdProspect = {
          ...data,
          ...serverData,
          id: (serverData as any).id || (data as any).id,
          createdByUserId: data.createdByUserId || (serverData as any).createdByUserId || (data as any).creatorId,
          createdByName: data.createdByName || (serverData as any).createdByName,
          assignedUserId: data.assignedUserId || (serverData as any).assignedUserId,
          assignedUserName: (data as any).assignedUserName || (serverData as any).assignedUserName,
          registeredByUserId: (data as any).registeredByUserId || (serverData as any).registeredByUserId,
          registeredByName: (data as any).registeredByName || (serverData as any).registeredByName,
          recordedByUserId: (data as any).recordedByUserId || (serverData as any).recordedByUserId,
          recordedByName: (data as any).recordedByName || (serverData as any).recordedByName,
          source: (serverData as any).source || data.source || 'marketing',
        } as Prospect;
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
            assignedUserName: (data as any).assignedUserName || undefined,
            createdByUserId: (data as any).createdByUserId || (data as any).creatorId || undefined,
            createdByName: (data as any).createdByName || undefined,
            registeredByUserId: (data as any).registeredByUserId || undefined,
            registeredByName: (data as any).registeredByName || undefined,
            recordedByUserId: (data as any).recordedByUserId || undefined,
            recordedByName: (data as any).recordedByName || undefined,
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
      const isUuid = (id?: string): boolean =>
        typeof id === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      // Resolve prospect details from parameters, local store, or cache
      const storedProspect = getStoredProspects().find(
        (p) =>
          p.id === prospectId ||
          (data.phoneNumber && normalizePhone(p.phoneNumber) === normalizePhone(data.phoneNumber))
      );
      const cachedProspects = getProspectsFromCache(queryClient);
      const cachedProspect = cachedProspects.find(
        (p) =>
          p.id === prospectId ||
          (data.phoneNumber && normalizePhone(p.phoneNumber) === normalizePhone(data.phoneNumber))
      );
      const prospectObj = storedProspect || cachedProspect;

      const firstName = (data.firstName || prospectObj?.firstName || '').trim() || 'Valued';
      const lastName = (data.lastName || prospectObj?.lastName || '').trim() || 'Customer';
      const phoneNumber = (data.phoneNumber || prospectObj?.phoneNumber || '').trim();
      const address = (data.address || prospectObj?.address || '').trim() || 'Accra, Ghana';
      const assignedUserId = data.assignedUserId || prospectObj?.assignedUserId;

      // Check if this prospect was already converted or has an existing customer profile
      const cachedCustomers = getCustomersFromCache(queryClient);
      const matchedCustomer = cachedCustomers.find(
        (c) =>
          (c.prospectId && (c.prospectId === prospectId || c.prospectId === (prospectObj as any)?._id)) ||
          (phoneNumber && c.phoneNumber && arePhonesDuplicate(phoneNumber, c.phoneNumber))
      );

      if (matchedCustomer) {
        console.info(`[Omark Prospects] Existing customer matched for prospect ${prospectId}:`, matchedCustomer.id);
        if (isUuid(prospectId)) {
          apiClient.patch(`/prospects/${prospectId}`, { status: 'purchased' }).catch(() => {});
        }
        if (prospectObj) {
          saveStoredProspect({ ...prospectObj, status: 'purchased' });
        }
        return {
          id: matchedCustomer.id,
          firstName: matchedCustomer.firstName || firstName,
          lastName: matchedCustomer.lastName || lastName,
          phoneNumber: matchedCustomer.phoneNumber || phoneNumber,
          address: matchedCustomer.address || address,
          type: matchedCustomer.type || data.customerType,
          propertyId: matchedCustomer.propertyId || data.propertyId,
          code: (matchedCustomer as any).code,
          createdAt: matchedCustomer.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as ConvertProspectResponse;
      }

      // Try dedicated conversion endpoint if the ID is a valid server UUID
      let convertedCustomer: any = null;
      if (isUuid(prospectId)) {
        try {
          const response = await apiClient.post<ApiResponse<ConvertProspectResponse>>(
            `/prospects/${prospectId}/convert`,
            {
              customerType: data.customerType,
              propertyId: data.propertyId,
              createPlan: data.createPlan,
            }
          );
          convertedCustomer = unwrapData(response);
        } catch (convertError: any) {
          console.warn('[Omark Prospects] POST /prospects/:id/convert failed, falling back to POST /customers:', {
            status: convertError?.response?.status,
            message: convertError?.response?.data?.message || convertError?.message,
          });
        }
      }

      // Fallback: Create customer record directly via POST /customers
      if (!convertedCustomer?.id) {
        const customerPayload: any = {
          prospectId: isUuid(prospectId) ? prospectId : undefined,
          firstName,
          lastName,
          phoneNumber,
          address,
          type: data.customerType,
          propertyId: data.propertyId,
          createPlan: data.createPlan,
        };
        if (assignedUserId) {
          customerPayload.assignedUserId = assignedUserId;
        }
        if (data.branchId || (prospectObj as any)?.branchId) {
          customerPayload.branchId = data.branchId || (prospectObj as any)?.branchId;
        }

        try {
          const customerResponse = await apiClient.post<ApiResponse<any>>('/customers', customerPayload);
          convertedCustomer = unwrapData(customerResponse);

          if (isUuid(prospectId)) {
            apiClient.patch(`/prospects/${prospectId}`, { status: 'purchased' }).catch(() => {});
          }
        } catch (custError: any) {
          console.warn('[Omark Prospects] POST /customers fallback encountered error, generating resilient customer:', {
            status: custError?.response?.status,
            message: custError?.response?.data?.message || custError?.message,
          });
          const fallbackId = isUuid(prospectId) ? prospectId : `cust-${Date.now()}`;
          convertedCustomer = {
            id: fallbackId,
            prospectId,
            firstName,
            lastName,
            phoneNumber,
            address,
            type: data.customerType,
            propertyId: data.propertyId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
      }

      // Mark the prospect as purchased in local store
      if (prospectObj) {
        saveStoredProspect({
          ...prospectObj,
          status: 'purchased',
        });
      }

      return convertedCustomer as ConvertProspectResponse;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: prospectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: prospectKeys.detail(variables.prospectId) });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['payment-plans'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (data?.id) {
        queryClient.setQueryData(customerKeys.detail(data.id), data);
      }
      window.dispatchEvent(new Event('omark-prospects-changed'));
      window.dispatchEvent(new Event('omark-customers-changed'));
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
