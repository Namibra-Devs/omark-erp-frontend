// src/api/expenses.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList, type ListResult } from '@/api/client';
import type { ApiResponse } from '@/types';
import dayjs from 'dayjs';

export interface ExpenseEntity {
  id: string;
  code?: string;
  category: string;
  type: 'internal' | 'external';
  amountMinor: number;
  incurredOn: string;
  branchId?: string;
  branchName?: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  recordedByUserId?: string;
  recordedByUserName?: string;
  recordedByUserRole?: string;
  decisionNote?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

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

export const EXPENSES_STORAGE_KEY = 'omark_expenses_records_store';

export function getStoredExpenses(): ExpenseEntity[] {
  try {
    const raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Purge any legacy mock seed data (IDs starting with exp-sec-, exp-mkt-, exp-bm-, exp-acc-, appr-seed-)
      const clean = parsed.filter((item: any) => {
        if (!item || !item.id) return false;
        const id = String(item.id);
        if (
          id.startsWith('exp-sec-') ||
          id.startsWith('exp-mkt-') ||
          id.startsWith('exp-bm-') ||
          id.startsWith('exp-acc-') ||
          id.startsWith('appr-seed-')
        ) {
          return false;
        }
        return true;
      });
      if (clean.length !== parsed.length) {
        localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(clean));
      }
      return clean;
    }
    return [];
  } catch (err) {
    console.warn('[Omark Expenses] Failed to read stored expenses:', err);
    return [];
  }
}

export function saveStoredExpense(expense: ExpenseEntity): void {
  try {
    const list = getStoredExpenses();
    const existingIndex = list.findIndex((e) => e.id === expense.id);
    let next: ExpenseEntity[];
    if (existingIndex >= 0) {
      next = [...list];
      next[existingIndex] = expense;
    } else {
      next = [expense, ...list];
    }
    localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('omark-expenses-changed'));
  } catch (err) {
    console.warn('[Omark Expenses] Failed to save expense locally:', err);
  }
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
        const res = await apiClient.get<ApiResponse<ExpenseEntity[]>>('/expenses', { params });
        const raw = res.data as any;
        const data = unwrapData(res);
        const unwrapped = unwrapList(res);

        if (Array.isArray(unwrapped?.items)) {
          serverExpenses = unwrapped.items;
        } else if (Array.isArray(data)) {
          serverExpenses = data;
        } else if (Array.isArray((data as any)?.items)) {
          serverExpenses = (data as any).items;
        } else if (Array.isArray(raw)) {
          serverExpenses = raw;
        } else if (Array.isArray(raw?.items)) {
          serverExpenses = raw.items;
        } else if (Array.isArray(raw?.data)) {
          serverExpenses = raw.data;
        }
      } catch (err: any) {
        console.warn('[Omark Expenses] Live backend /expenses fetch error:', err?.message || err);
      }

      const localExpenses = getStoredExpenses();
      let all: ExpenseEntity[] = [];

      if (serverExpenses !== null) {
        // Backend returned live data
        const serverIds = new Set(serverExpenses.map((e) => e.id));
        // Keep any unsynced local-only items that are not yet on the server
        const unsyncedLocal = localExpenses.filter((e) => !serverIds.has(e.id));
        all = [...serverExpenses, ...unsyncedLocal];
      } else {
        // Backend offline or unreachable: fall back to local stored expenses
        all = localExpenses;
      }

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
    refetchInterval: 30000, // Poll live system every 30s
    staleTime: 5000,
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
        description: payload.description,
        recordedByUserId: payload.recordedByUserId,
        recordedByUserName: payload.recordedByUserName,
        recordedByUserRole: payload.recordedByUserRole || 'branch_manager',
        status: initialStatus,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      let saved: ExpenseEntity | null = null;
      try {
        const res = await apiClient.post<ApiResponse<ExpenseEntity>>('/expenses', {
          ...payload,
          status: initialStatus,
        });
        saved = unwrapData(res);
      } catch (err: any) {
        // If backend has strict DTO validation (400 Bad Request on unknown properties),
        // retry with sanitized standard fields
        if (err?.status === 400 || err?.response?.status === 400) {
          try {
            const cleanPayload: any = {
              category: payload.category,
              type: payload.type,
              amountMinor: payload.amountMinor,
              incurredOn: payload.incurredOn,
            };
            if (payload.branchId) cleanPayload.branchId = payload.branchId;
            if (payload.description) cleanPayload.description = payload.description;
            const retryRes = await apiClient.post<ApiResponse<ExpenseEntity>>('/expenses', cleanPayload);
            saved = unwrapData(retryRes);
          } catch (retryErr) {
            console.warn('[Omark Expenses] Clean payload retry failed:', retryErr);
          }
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
    onSuccess: () => {
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
      } finally {
        const list = getStoredExpenses().filter((e) => e.id !== id);
        localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(list));
        window.dispatchEvent(new Event('omark-expenses-changed'));
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
