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

export function isDummyFuelExpense(expense: any): boolean {
  if (!expense) return false;
  const code = String(expense.code || '').toUpperCase();
  const desc = String(expense.description || '').trim().toUpperCase();
  const name = String(expense.recordedByUserName || '').trim().toLowerCase();

  // Filter out repeated placeholder ATM-EXP-* FUEL records with generic "Staff Member"
  if (
    code.startsWith('ATM-EXP-') &&
    (desc === 'FUEL' || desc === '') &&
    (!expense.recordedByUserId || name === 'staff member' || name === '')
  ) {
    return true;
  }
  return false;
}

export const DEFAULT_ROLE_OPERATIONAL_EXPENSES: ExpenseEntity[] = [
  // ── Today's Fresh Cycle Operational Expenses ──────────────────────────────
  {
    id: 'exp-role-sec-today',
    code: 'EXP-SEC-TODAY-001',
    category: 'Client Hospitality',
    type: 'internal',
    amountMinor: 32000, // GHS 320.00
    incurredOn: dayjs().format('YYYY-MM-DD'),
    branchId: 'b1',
    branchName: 'Kumasi Main',
    description: 'Executive client lounge refreshments, mineral water packs & coffee beans for morning meetings',
    status: 'approved',
    recordedByUserRole: 'secretary',
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
  },
  {
    id: 'exp-role-bm-today',
    code: 'EXP-BM-TODAY-001',
    category: 'Power & Fuel',
    type: 'internal',
    amountMinor: 65000, // GHS 650.00
    incurredOn: dayjs().format('YYYY-MM-DD'),
    branchId: 'b1',
    branchName: 'Kumasi Main',
    description: 'Standby generator diesel fuel replenishment for showroom continuity',
    status: 'pending',
    recordedByUserRole: 'branch_manager',
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
  },
  {
    id: 'exp-role-mkt-today',
    code: 'EXP-MKT-TODAY-001',
    category: 'Digital Media Ads',
    type: 'external',
    amountMinor: 120000, // GHS 1,200.00
    incurredOn: dayjs().format('YYYY-MM-DD'),
    branchId: 'b2',
    branchName: 'Accra Central',
    description: 'Social media sponsored video ad promotion for weekend land exhibition',
    status: 'pending',
    recordedByUserRole: 'marketing_director',
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
  },

  // ── Secretary Role Expenses ───────────────────────────────────────────────
  {
    id: 'exp-role-sec-001',
    code: 'EXP-SEC-2026-001',
    category: 'Client Hospitality',
    type: 'internal',
    amountMinor: 145000, // GHS 1,450.00
    incurredOn: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
    branchId: 'b2',
    branchName: 'Accra Central',
    description: 'Executive client lounge refreshments, mineral water packs & coffee beans for investor meetings',
    status: 'approved',
    recordedByUserRole: 'secretary',
    createdAt: dayjs().subtract(1, 'day').toISOString(),
    updatedAt: dayjs().subtract(1, 'day').toISOString(),
  },
  {
    id: 'exp-role-sec-002',
    code: 'EXP-SEC-2026-002',
    category: 'Office Supplies',
    type: 'internal',
    amountMinor: 85000, // GHS 850.00
    incurredOn: dayjs().subtract(3, 'day').format('YYYY-MM-DD'),
    branchId: 'b1',
    branchName: 'Kumasi Main',
    description: 'Corporate visitor logbooks, branded presentation folders, toner cartridges & paperwork reams',
    status: 'approved',
    recordedByUserRole: 'secretary',
    createdAt: dayjs().subtract(3, 'day').toISOString(),
    updatedAt: dayjs().subtract(3, 'day').toISOString(),
  },
  {
    id: 'exp-role-sec-003',
    code: 'EXP-SEC-2026-003',
    category: 'Courier & Dispatch',
    type: 'internal',
    amountMinor: 65000, // GHS 650.00
    incurredOn: dayjs().subtract(5, 'day').format('YYYY-MM-DD'),
    branchId: 'b2',
    branchName: 'Accra Central',
    description: 'Express international courier dispatch of executed land deeds & indentures to diaspora buyers',
    status: 'approved',
    recordedByUserRole: 'secretary',
    createdAt: dayjs().subtract(5, 'day').toISOString(),
    updatedAt: dayjs().subtract(5, 'day').toISOString(),
  },

  // ── Marketing Director Role Expenses ──────────────────────────────────────
  {
    id: 'exp-role-mkt-001',
    code: 'EXP-MKT-2026-001',
    category: 'Mega Billboard & Out-Of-Home',
    type: 'external',
    amountMinor: 1250000, // GHS 12,500.00
    incurredOn: dayjs().subtract(2, 'day').format('YYYY-MM-DD'),
    branchId: 'b2',
    branchName: 'Accra Central',
    description: 'Airport bypass highway mega-billboard hoarding rental & night illumination maintenance',
    status: 'approved',
    recordedByUserRole: 'marketing_director',
    createdAt: dayjs().subtract(2, 'day').toISOString(),
    updatedAt: dayjs().subtract(2, 'day').toISOString(),
  },
  {
    id: 'exp-role-mkt-002',
    code: 'EXP-MKT-2026-002',
    category: 'Property Expo & Roadshow',
    type: 'external',
    amountMinor: 680000, // GHS 6,800.00
    incurredOn: dayjs().subtract(4, 'day').format('YYYY-MM-DD'),
    branchId: 'b2',
    branchName: 'Accra Central',
    description: 'Accra International Conference Centre Real Estate Summit exhibition booth & roll-up banners',
    status: 'approved',
    recordedByUserRole: 'marketing_director',
    createdAt: dayjs().subtract(4, 'day').toISOString(),
    updatedAt: dayjs().subtract(4, 'day').toISOString(),
  },
  {
    id: 'exp-role-mkt-003',
    code: 'EXP-MKT-2026-003',
    category: 'Digital Media Ads',
    type: 'external',
    amountMinor: 420000, // GHS 4,200.00
    incurredOn: dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
    branchId: 'b1',
    branchName: 'Kumasi Main',
    description: 'Targeted Google search and social media promotional campaigns for gated community plots',
    status: 'approved',
    recordedByUserRole: 'marketing_director',
    createdAt: dayjs().subtract(6, 'day').toISOString(),
    updatedAt: dayjs().subtract(6, 'day').toISOString(),
  },

  // ── Branch Manager Role Expenses ──────────────────────────────────────────
  {
    id: 'exp-role-bm-001',
    code: 'EXP-BM-2026-001',
    category: 'Power & Fuel',
    type: 'internal',
    amountMinor: 240000, // GHS 2,400.00
    incurredOn: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
    branchId: 'b1',
    branchName: 'Kumasi Main',
    description: 'Diesel delivery for 60kVA standby generator to maintain uninterrupted showroom operations',
    status: 'approved',
    recordedByUserRole: 'branch_manager',
    createdAt: dayjs().subtract(1, 'day').toISOString(),
    updatedAt: dayjs().subtract(1, 'day').toISOString(),
  },
  {
    id: 'exp-role-bm-002',
    code: 'EXP-BM-2026-002',
    category: 'Logistics & Transit',
    type: 'internal',
    amountMinor: 180000, // GHS 1,800.00
    incurredOn: dayjs().subtract(3, 'day').format('YYYY-MM-DD'),
    branchId: 'b3',
    branchName: 'Takoradi Branch',
    description: 'Client site inspection utility vehicle fuel, expressway tolls & weekend site viewing transport',
    status: 'approved',
    recordedByUserRole: 'branch_manager',
    createdAt: dayjs().subtract(3, 'day').toISOString(),
    updatedAt: dayjs().subtract(3, 'day').toISOString(),
  },
  {
    id: 'exp-role-bm-003',
    code: 'EXP-BM-2026-003',
    category: 'Premises Repairs',
    type: 'internal',
    amountMinor: 120000, // GHS 1,200.00
    incurredOn: dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
    branchId: 'b1',
    branchName: 'Kumasi Main',
    description: 'Branch showroom air conditioning preventive servicing and compound security light repairs',
    status: 'approved',
    recordedByUserRole: 'branch_manager',
    createdAt: dayjs().subtract(7, 'day').toISOString(),
    updatedAt: dayjs().subtract(7, 'day').toISOString(),
  },

  // ── Accounts & Finance Role Expenses ──────────────────────────────────────
  {
    id: 'exp-role-acc-001',
    code: 'EXP-ACC-2026-001',
    category: 'Legal & Regulatory',
    type: 'internal',
    amountMinor: 350000, // GHS 3,500.00
    incurredOn: dayjs().subtract(2, 'day').format('YYYY-MM-DD'),
    branchId: 'b2',
    branchName: 'Accra Central',
    description: 'Official title search fees, cadastral survey verification & zoning clearances at Lands Commission',
    status: 'approved',
    recordedByUserRole: 'accounts',
    createdAt: dayjs().subtract(2, 'day').toISOString(),
    updatedAt: dayjs().subtract(2, 'day').toISOString(),
  },
  {
    id: 'exp-role-acc-002',
    code: 'EXP-ACC-2026-002',
    category: 'Audit & Compliance',
    type: 'internal',
    amountMinor: 210000, // GHS 2,100.00
    incurredOn: dayjs().subtract(8, 'day').format('YYYY-MM-DD'),
    branchId: 'b1',
    branchName: 'Kumasi Main',
    description: 'GRA stamp duty assessment filing and quarterly tax compliance documentation retainers',
    status: 'approved',
    recordedByUserRole: 'accounts',
    createdAt: dayjs().subtract(8, 'day').toISOString(),
    updatedAt: dayjs().subtract(8, 'day').toISOString(),
  },

  // ── Administration Role Expenses ──────────────────────────────────────────
  {
    id: 'exp-role-adm-001',
    code: 'EXP-ADM-2026-001',
    category: 'Cloud & IT Systems',
    type: 'internal',
    amountMinor: 560000, // GHS 5,600.00
    incurredOn: dayjs().subtract(5, 'day').format('YYYY-MM-DD'),
    branchId: 'b1',
    branchName: 'Kumasi Main',
    description: 'Omark ERP cloud server hosting, automated daily backups & enterprise SSL security certificate renewal',
    status: 'approved',
    recordedByUserRole: 'admin',
    createdAt: dayjs().subtract(5, 'day').toISOString(),
    updatedAt: dayjs().subtract(5, 'day').toISOString(),
  },
];

export function getStoredExpenses(): ExpenseEntity[] {
  try {
    const raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Purge any legacy mock seed data and the repeated dummy "ATM-EXP" fuel placeholders
      const clean = parsed.filter((item: any) => {
        if (!item || !item.id) return false;
        const id = String(item.id);
        if (
          id.startsWith('exp-sec-') ||
          id.startsWith('exp-mkt-') ||
          id.startsWith('exp-bm-') ||
          id.startsWith('exp-acc-') ||
          id.startsWith('appr-seed-') ||
          isDummyFuelExpense(item)
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
    branchId: raw.branchId || (typeof raw.branch === 'object' ? raw.branch?.id : raw.branch) || undefined,
    branchName: raw.branchName || (typeof raw.branch === 'object' ? raw.branch?.name : undefined) || undefined,
    description: raw.description || raw.notes || raw.title || undefined,
    status,
    recordedByUserId:
      raw.recordedByUserId ||
      raw.userId ||
      raw.createdById ||
      raw.createdByUserId ||
      (typeof raw.createdBy === 'object' ? raw.createdBy?.id : (typeof raw.createdBy === 'string' ? raw.createdBy : undefined)) ||
      (typeof raw.user === 'object' ? raw.user?.id : undefined) ||
      undefined,
    recordedByUserName:
      raw.recordedByUserName ||
      raw.userName ||
      raw.createdByName ||
      (typeof raw.createdBy === 'object' ? (raw.createdBy?.name || `${raw.createdBy?.firstName || ''} ${raw.createdBy?.lastName || ''}`.trim()) : undefined) ||
      (typeof raw.user === 'object' ? (raw.user?.name || `${raw.user?.firstName || ''} ${raw.user?.lastName || ''}`.trim()) : undefined) ||
      undefined,
    recordedByUserRole:
      raw.recordedByUserRole ||
      raw.userRole ||
      raw.role ||
      (typeof raw.createdBy === 'object' ? raw.createdBy?.role : undefined) ||
      (typeof raw.user === 'object' ? raw.user?.role : undefined) ||
      undefined,
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

      const localExpenses = getStoredExpenses()
        .filter((e) => !isDummyFuelExpense(e))
        .map(normalizeExpenseEntity);
      let all: ExpenseEntity[] = [];

      if (serverExpenses !== null) {
        if (serverExpenses.length > 0) {
          try {
            const existingList = getStoredExpenses().filter((e) => !isDummyFuelExpense(e));
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

      // If all contains no expenses or misses roles, supplement with DEFAULT_ROLE_OPERATIONAL_EXPENSES
      const presentRoles = new Set(all.map((e) => (e.recordedByUserRole || '').toLowerCase()));
      const supplemental = DEFAULT_ROLE_OPERATIONAL_EXPENSES.filter(
        (def) => !presentRoles.has((def.recordedByUserRole || '').toLowerCase())
      );
      all = [...all, ...supplemental];

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
