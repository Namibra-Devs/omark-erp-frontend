// src/api/expenses.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList, type ListResult } from '@/api/client';
import type { ApiResponse } from '@/types';
import dayjs from 'dayjs';

export type { ExpenseEntity } from '@/utils/expensesStorage';
export {
  EXPENSES_STORAGE_KEY,
  DELETED_EXPENSES_STORAGE_KEY,
  IDB_DB_NAME,
  IDB_STORE_NAME,
  EXPENSES_CHANGE_EVENT,
  isDummyFuelExpense,
  DEFAULT_ROLE_OPERATIONAL_EXPENSES,
  normalizeExpenseEntity,
  getIndexedDBExpenses,
  setIndexedDBExpenses,
  getDeletedExpenseIds,
  recordDeletedExpenseId,
  syncExpensesToBackend,
  mergeExpenses,
  getStoredExpenses,
  saveStoredExpense,
  saveStoredExpenses,
  deleteStoredExpense,
  rehydrateAllExpensesData,
} from '@/utils/expensesStorage';
import { fetchAppSettings, updateAppSettings } from '@/api/settings';
import {
  type ExpenseEntity,
  isDummyFuelExpense,
  normalizeExpenseEntity,
  getStoredExpenses,
  saveStoredExpense,
  saveStoredExpenses,
  deleteStoredExpense,
  mergeExpenses,
  setSettingsApiHandlers,
} from '@/utils/expensesStorage';

// Connect server settings persistence to storage engine
setSettingsApiHandlers(fetchAppSettings, updateAppSettings);

export interface ExpensesListParams {
  type?: 'internal' | 'external';
  status?: 'pending' | 'approved' | 'rejected';
  branchId?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateExpensePayload {
  category: string;
  type: 'internal' | 'external';
  amountMinor: number;
  incurredOn: string;
  branchId?: string;
  department?: string;
  description?: string;
  status?: 'pending' | 'approved' | 'rejected';
  recordedByUserId?: string;
  recordedByUserName?: string;
  recordedByUserRole?: string;
}

export interface ExpenseDecisionPayload {
  decision: 'approved' | 'rejected';
  note?: string;
}

export const expensesKeys = {
  all: ['expenses'] as const,
  lists: () => [...expensesKeys.all, 'list'] as const,
  list: (params?: ExpensesListParams) => [...expensesKeys.lists(), params ?? {}] as const,
};

export function useExpensesQuery(params?: ExpensesListParams) {
  return useQuery({
    queryKey: expensesKeys.list(params),
    queryFn: async (): Promise<ListResult<ExpenseEntity>> => {
      let serverExpenses: ExpenseEntity[] | null = null;
      try {
        const requestedLimit = params?.pageSize || 100;
        const safePageSize = Math.min(requestedLimit, 100);
        const queryParams = {
          page: 1,
          ...params,
          pageSize: safePageSize,
        };
        const res = await apiClient.get<ApiResponse<ExpenseEntity[]>>('/expenses', { params: queryParams });
        const raw = res?.data as any;
        const data = unwrapData(res);
        const unwrapped = unwrapList(res);

        let candidates: any[] = [];
        if (Array.isArray(unwrapped?.items) && unwrapped.items.length > 0) {
          candidates = unwrapped.items;
        } else if (Array.isArray(data) && data.length > 0) {
          candidates = data;
        } else if (Array.isArray((data as any)?.items) && (data as any).items.length > 0) {
          candidates = (data as any).items;
        } else if (Array.isArray(raw)) {
          candidates = raw;
        } else if (Array.isArray(raw?.items) && raw.items.length > 0) {
          candidates = raw.items;
        } else if (Array.isArray(raw?.data) && raw.data.length > 0) {
          candidates = raw.data;
        } else if (Array.isArray(unwrapped?.items)) {
          candidates = [];
          serverExpenses = [];
        }

        // Walk remaining pages if dataset is multi-page and no single page was explicitly requested
        const totalPages = unwrapped?.totalPages || raw?.meta?.totalPages || raw?.totalPages || 1;
        if (totalPages > 1 && !params?.page) {
          const pagePromises: Promise<any[]>[] = [];
          for (let p = 2; p <= Math.min(totalPages, 10); p++) {
            pagePromises.push(
              apiClient.get<ApiResponse<ExpenseEntity[]>>('/expenses', {
                params: { ...queryParams, page: p },
              }).then((pageRes) => {
                const pUnwrapped = unwrapList(pageRes);
                const pData = unwrapData(pageRes);
                const pRaw = pageRes?.data as any;
                if (Array.isArray(pUnwrapped?.items)) return pUnwrapped.items;
                if (Array.isArray(pData)) return pData;
                if (Array.isArray(pRaw?.items)) return pRaw.items;
                if (Array.isArray(pRaw)) return pRaw;
                return [];
              }).catch(() => [])
            );
          }
          const additionalPages = await Promise.all(pagePromises);
          for (const pageItems of additionalPages) {
            candidates.push(...pageItems);
          }
        }

        // Filter out dummy repeated fuel placeholders
        candidates = candidates.filter((c) => !isDummyFuelExpense(c));

        if (candidates.length > 0) {
          serverExpenses = candidates.map(normalizeExpenseEntity);
        } else if (serverExpenses === null && (Array.isArray(raw) || Array.isArray(raw?.items))) {
          serverExpenses = [];
        }
      } catch (err: any) {
        console.warn('[Omark Expenses] Live backend /expenses fetch error:', err?.message || err);
      }

      const localExpenses = getStoredExpenses();
      let all: ExpenseEntity[] = [];

      if (serverExpenses !== null && serverExpenses.length > 0) {
        all = mergeExpenses(serverExpenses, localExpenses);
        // Persist reconciled dataset across IndexedDB, localStorage, and server settings
        saveStoredExpenses(all).catch(() => {});
      } else {
        all = localExpenses;
      }

      all.sort((a, b) => dayjs(b.incurredOn || b.createdAt).valueOf() - dayjs(a.incurredOn || a.createdAt).valueOf());

      if (params?.type) {
        all = all.filter((e) => e.type === params.type);
      }
      if (params?.status) {
        all = all.filter((e) => e.status === params.status);
      }
      if (params?.branchId) {
        all = all.filter((e) => e.branchId === params.branchId);
      }
      if (params?.category) {
        all = all.filter((e) => e.category === params.category);
      }

      return {
        items: all,
        total: all.length,
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? (all.length || 20),
        totalPages: 1,
      };
    },
    refetchInterval: 120000,
    staleTime: 60000,
    refetchIntervalInBackground: false,
  });
}

export function useCreateExpenseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateExpensePayload) => {
      const initialStatus = payload.status || 'pending';
      const newExpense: ExpenseEntity = {
        id: `exp-${Date.now()}`,
        code: `EXP-${Date.now().toString().slice(-4)}`,
        category: payload.category,
        type: payload.type,
        amountMinor: payload.amountMinor,
        incurredOn: payload.incurredOn,
        branchId: payload.branchId,
        department: payload.department,
        description: payload.description,
        recordedByUserId: payload.recordedByUserId,
        recordedByUserName: payload.recordedByUserName,
        recordedByUserRole: payload.recordedByUserRole || 'branch_manager',
        status: initialStatus,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const cleanPayload: Record<string, any> = {
        category: payload.category,
        type: payload.type,
        amountMinor: Math.round(Number(payload.amountMinor)),
        incurredOn: payload.incurredOn,
      };
      if (payload.branchId) cleanPayload.branchId = payload.branchId;
      if (payload.department) cleanPayload.department = payload.department;
      if (payload.description) cleanPayload.description = payload.description;

      let saved: ExpenseEntity | null = null;
      try {
        const res = await apiClient.post<ApiResponse<ExpenseEntity>>('/expenses', cleanPayload);
        const data = unwrapData(res) || (res?.data as any)?.data || res?.data;
        if (data) {
          saved = normalizeExpenseEntity(data);
        }
      } catch (err: any) {
        // Fallback retry with full payload in case backend expects it
        try {
          const retryRes = await apiClient.post<ApiResponse<ExpenseEntity>>('/expenses', {
            ...payload,
            status: initialStatus,
          });
          const retryData = unwrapData(retryRes) || (retryRes?.data as any)?.data || retryRes?.data;
          if (retryData) {
            saved = normalizeExpenseEntity(retryData);
          }
        } catch (retryErr) {
          console.warn('[Omark Expenses] Backend creation failed, saving to local store:', retryErr);
        }
      }

      const finalExpense: ExpenseEntity = {
        ...newExpense,
        ...(saved || {}),
        recordedByUserId: saved?.recordedByUserId || payload.recordedByUserId,
        recordedByUserName: saved?.recordedByUserName || payload.recordedByUserName,
        recordedByUserRole: saved?.recordedByUserRole || payload.recordedByUserRole,
      };

      saveStoredExpense(finalExpense);
      return finalExpense;
    },
    onSuccess: (finalExpense) => {
      // Immediately inject into cache so UI updates instantly
      queryClient.setQueriesData<ListResult<ExpenseEntity>>(
        { queryKey: expensesKeys.all },
        (old) => {
          if (!old) {
            return {
              items: [finalExpense],
              total: 1,
              page: 1,
              pageSize: 20,
              totalPages: 1,
            };
          }
          const exists = old.items.some((e) => e.id === finalExpense.id);
          const nextItems = exists
            ? old.items.map((e) => (e.id === finalExpense.id ? finalExpense : e))
            : [finalExpense, ...old.items];
          return {
            ...old,
            items: nextItems,
            total: nextItems.length,
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: expensesKeys.all });
      window.dispatchEvent(new Event('omark-expenses-changed'));
    },
  });
}

export function useDeleteExpenseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      try {
        const res = await apiClient.delete<ApiResponse<{ deleted: boolean }>>(`/expenses/${id}`);
        return unwrapData(res);
      } catch (err) {
        console.warn(`[Omark Expenses] Backend /expenses/${id} delete warning; applying locally:`, err);
        return { deleted: true };
      } finally {
        deleteStoredExpense(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expensesKeys.all });
      window.dispatchEvent(new Event('omark-expenses-changed'));
    },
  });
}

export function useExpenseDecisionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ExpenseDecisionPayload }) => {
      let serverRes: any = null;
      try {
        const res = await apiClient.post<ApiResponse<ExpenseEntity>>(`/expenses/${id}/decision`, payload);
        serverRes = unwrapData(res);
      } catch (err) {
        console.warn(`[Omark Expenses] Backend /expenses/${id}/decision error; applying locally:`, err);
      } finally {
        const list = getStoredExpenses();
        const item = list.find((e) => e.id === id);
        if (item) {
          item.status = payload.decision;
          item.decisionNote = payload.note;
          item.decidedAt = new Date().toISOString();
          saveStoredExpense(item);
        }
      }
      return serverRes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expensesKeys.all });
      window.dispatchEvent(new Event('omark-expenses-changed'));
    },
  });
}
