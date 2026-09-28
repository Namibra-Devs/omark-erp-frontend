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

export function normalizeExpenseEntity(raw: any): ExpenseEntity {
  if (!raw) return raw;
  const id = String(raw.id || raw._id || `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

  // Handle amountMinor vs amount
  let amountMinor = 0;
  if (typeof raw.amountMinor === 'number' && !isNaN(raw.amountMinor)) {
    amountMinor = raw.amountMinor;
  } else if (raw.amountMinor != null && !isNaN(Number(raw.amountMinor))) {
    amountMinor = Number(raw.amountMinor);
  } else if (raw.amount != null && !isNaN(Number(raw.amount))) {
    amountMinor = Math.round(Number(raw.amount) * 100);
  } else if (raw.amountPesewas != null && !isNaN(Number(raw.amountPesewas))) {
    amountMinor = Number(raw.amountPesewas);
  }

  // Handle incurredOn
  const incurredOn =
    raw.incurredOn ||
    raw.incurredDate ||
    raw.date ||
    raw.createdAt ||
    new Date().toISOString();

  // Handle status casing
  let status: 'pending' | 'approved' | 'rejected' = 'pending';
  const rawStatus = String(raw.status || '').toLowerCase().trim();
  if (rawStatus === 'approved' || rawStatus === 'authorized') {
    status = 'approved';
  } else if (rawStatus === 'rejected' || rawStatus === 'declined') {
    status = 'rejected';
  } else {
    status = 'pending';
  }

  // Handle code
  const code = raw.code || raw.voucherNo || raw.reference || `EXP-${id.slice(-4).toUpperCase()}`;

  const type: 'internal' | 'external' =
    String(raw.type || '').toLowerCase() === 'external' ? 'external' : 'internal';

  return {
    id,
    code,
    category: raw.category || 'General Operations',
    type,
    amountMinor,
    incurredOn: dayjs(incurredOn).isValid() ? dayjs(incurredOn).format('YYYY-MM-DD') : incurredOn,
    branchId: raw.branchId || raw.branch || undefined,
    branchName: raw.branchName || undefined,
    description: raw.description || raw.notes || raw.title || undefined,
    status,
    recordedByUserId: raw.recordedByUserId || raw.userId || raw.createdById || undefined,
    recordedByUserName: raw.recordedByUserName || raw.userName || raw.createdByName || undefined,
    recordedByUserRole: raw.recordedByUserRole || raw.userRole || raw.role || undefined,
    decisionNote: raw.decisionNote || raw.rejectionNote || undefined,
    decidedAt: raw.decidedAt || undefined,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export function useExpensesQuery(params?: ExpensesListParams) {
  return useQuery({
    queryKey: expensesKeys.list(params),
    queryFn: async (): Promise<ListResult<ExpenseEntity>> => {
      let serverExpenses: ExpenseEntity[] | null = null;
      try {
        const queryParams = {
          pageSize: 200,
          ...params,
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

        if (candidates.length > 0) {
          serverExpenses = candidates.map(normalizeExpenseEntity);
        } else if (serverExpenses === null && (Array.isArray(raw) || Array.isArray(raw?.items))) {
          serverExpenses = [];
        }
      } catch (err: any) {
        console.warn('[Omark Expenses] Live backend /expenses fetch error:', err?.message || err);
      }

      const localExpenses = getStoredExpenses().map(normalizeExpenseEntity);
      let all: ExpenseEntity[] = [];

      if (serverExpenses !== null) {
        if (serverExpenses.length > 0) {
          try {
            const existingList = getStoredExpenses();
            const existingMap = new Map(existingList.map((e) => [e.id, e]));
            serverExpenses.forEach((se) => existingMap.set(se.id, se));
            localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(Array.from(existingMap.values())));
          } catch {
            // ignore silent sync
          }
        }
        const serverIds = new Set(serverExpenses.map((e) => e.id));
        const unsyncedLocal = localExpenses.filter((e) => !serverIds.has(e.id));
        all = [...serverExpenses, ...unsyncedLocal];
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
    refetchInterval: 30000,
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

      const cleanPayload: Record<string, any> = {
        category: payload.category,
        type: payload.type,
        amountMinor: Math.round(Number(payload.amountMinor)),
        incurredOn: payload.incurredOn,
      };
      if (payload.branchId) cleanPayload.branchId = payload.branchId;
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
