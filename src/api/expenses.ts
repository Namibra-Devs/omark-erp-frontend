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
  recordedByUserId?: string;
  recordedByUserName?: string;
  recordedByUserRole?: string;
}

export interface ExpenseDecisionPayload {
  decision: 'approved' | 'rejected';
  note?: string;
}

export const EXPENSES_STORAGE_KEY = 'omark_expenses_records_store';

const DEFAULT_SEEDED_EXPENSES: ExpenseEntity[] = [
  // ── Secretary Role Expenses ──────────────────────────────────────────────
  {
    id: 'exp-sec-1',
    code: 'EXP-SEC-001',
    category: 'Client Hospitality',
    type: 'internal',
    amountMinor: 145000, // GHS 1,450.00
    incurredOn: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
    branchId: 'branch-el',
    branchName: 'East Legon Branch',
    description: 'Front desk executive lounge refreshments, mineral water packs & coffee beans',
    status: 'approved',
    recordedByUserId: 'usr-sec-1',
    recordedByUserName: 'Ama Serwaa',
    recordedByUserRole: 'secretary',
    createdAt: dayjs().subtract(1, 'day').toISOString(),
    updatedAt: dayjs().subtract(1, 'day').toISOString(),
  },
  {
    id: 'exp-sec-2',
    code: 'EXP-SEC-002',
    category: 'Office Supplies',
    type: 'internal',
    amountMinor: 85000, // GHS 850.00
    incurredOn: dayjs().subtract(3, 'day').format('YYYY-MM-DD'),
    branchId: 'branch-ho',
    branchName: 'Head Office',
    description: 'Corporate visitor logbooks, branded folders, high-capacity toner & reams',
    status: 'approved',
    recordedByUserId: 'usr-sec-1',
    recordedByUserName: 'Ama Serwaa',
    recordedByUserRole: 'secretary',
    createdAt: dayjs().subtract(3, 'day').toISOString(),
    updatedAt: dayjs().subtract(3, 'day').toISOString(),
  },
  {
    id: 'exp-sec-3',
    code: 'EXP-SEC-003',
    category: 'Courier & Dispatch',
    type: 'internal',
    amountMinor: 65000, // GHS 650.00
    incurredOn: dayjs().subtract(5, 'day').format('YYYY-MM-DD'),
    branchId: 'branch-el',
    branchName: 'East Legon Branch',
    description: 'Express courier delivery of executed land purchase deeds to clients',
    status: 'approved',
    recordedByUserId: 'usr-sec-2',
    recordedByUserName: 'Beatrice Darko',
    recordedByUserRole: 'secretary',
    createdAt: dayjs().subtract(5, 'day').toISOString(),
    updatedAt: dayjs().subtract(5, 'day').toISOString(),
  },
  {
    id: 'exp-sec-4',
    code: 'EXP-SEC-004',
    category: 'Office Maintenance',
    type: 'internal',
    amountMinor: 135000, // GHS 1,350.00
    incurredOn: dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
    branchId: 'branch-ho',
    branchName: 'Head Office',
    description: 'Biometric clocking device sensor replacement & visitor badge accessories',
    status: 'pending',
    recordedByUserId: 'usr-sec-1',
    recordedByUserName: 'Ama Serwaa',
    recordedByUserRole: 'secretary',
    createdAt: dayjs().subtract(6, 'day').toISOString(),
    updatedAt: dayjs().subtract(6, 'day').toISOString(),
  },

  // ── Marketing Director Role Expenses ──────────────────────────────────────
  {
    id: 'exp-mkt-1',
    code: 'EXP-MKT-001',
    category: 'Mega Billboard & Out-Of-Home',
    type: 'external',
    amountMinor: 1250000, // GHS 12,500.00
    incurredOn: dayjs().subtract(2, 'day').format('YYYY-MM-DD'),
    branchId: 'branch-ho',
    branchName: 'Head Office',
    description: 'Airport bypass highway mega-billboard hoarding lease & night floodlight maintenance',
    status: 'approved',
    recordedByUserId: 'usr-mkt-dir',
    recordedByUserName: 'David Osei',
    recordedByUserRole: 'marketing_director',
    createdAt: dayjs().subtract(2, 'day').toISOString(),
    updatedAt: dayjs().subtract(2, 'day').toISOString(),
  },
  {
    id: 'exp-mkt-2',
    code: 'EXP-MKT-002',
    category: 'Exhibitions & Events',
    type: 'external',
    amountMinor: 680000, // GHS 6,800.00
    incurredOn: dayjs().subtract(4, 'day').format('YYYY-MM-DD'),
    branchId: 'branch-ho',
    branchName: 'Head Office',
    description: 'Accra International Property Expo prime exhibition booth space & roll-up banners',
    status: 'approved',
    recordedByUserId: 'usr-mkt-dir',
    recordedByUserName: 'David Osei',
    recordedByUserRole: 'marketing_director',
    createdAt: dayjs().subtract(4, 'day').toISOString(),
    updatedAt: dayjs().subtract(4, 'day').toISOString(),
  },
  {
    id: 'exp-mkt-3',
    code: 'EXP-MKT-003',
    category: 'Digital Ads & Media',
    type: 'external',
    amountMinor: 450000, // GHS 4,500.00
    incurredOn: dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
    branchId: 'branch-ho',
    branchName: 'Head Office',
    description: 'Targeted Google Ads & Meta video ad placement for Lakeside Hill residential plots',
    status: 'approved',
    recordedByUserId: 'usr-mkt-dir',
    recordedByUserName: 'David Osei',
    recordedByUserRole: 'marketing_director',
    createdAt: dayjs().subtract(7, 'day').toISOString(),
    updatedAt: dayjs().subtract(7, 'day').toISOString(),
  },
  {
    id: 'exp-mkt-4',
    code: 'EXP-MKT-004',
    category: 'Print & Collateral',
    type: 'external',
    amountMinor: 320000, // GHS 3,200.00
    incurredOn: dayjs().subtract(8, 'day').format('YYYY-MM-DD'),
    branchId: 'branch-ho',
    branchName: 'Head Office',
    description: 'High-gloss full color project prospectus brochures (2,500 copies) & promo bags',
    status: 'pending',
    recordedByUserId: 'usr-mkt-dir',
    recordedByUserName: 'David Osei',
    recordedByUserRole: 'marketing_director',
    createdAt: dayjs().subtract(8, 'day').toISOString(),
    updatedAt: dayjs().subtract(8, 'day').toISOString(),
  },

  // ── Branch Manager Role Expenses ──────────────────────────────────────────
  {
    id: 'exp-bm-1',
    code: 'EXP-BM-001',
    category: 'Power & Generator Servicing',
    type: 'internal',
    amountMinor: 420000, // GHS 4,200.00
    incurredOn: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
    branchId: 'branch-el',
    branchName: 'East Legon Branch',
    description: '150kVA Standby Generator quarterly major maintenance & 500L diesel fueling',
    status: 'approved',
    recordedByUserId: 'usr-bm-1',
    recordedByUserName: 'Prince Boateng',
    recordedByUserRole: 'branch_manager',
    createdAt: dayjs().subtract(1, 'day').toISOString(),
    updatedAt: dayjs().subtract(1, 'day').toISOString(),
  },
  {
    id: 'exp-bm-2',
    code: 'EXP-BM-002',
    category: 'Site Inspection Logistics',
    type: 'internal',
    amountMinor: 260000, // GHS 2,600.00
    incurredOn: dayjs().subtract(3, 'day').format('YYYY-MM-DD'),
    branchId: 'branch-el',
    branchName: 'East Legon Branch',
    description: 'Weekend client site inspection shuttle fueling, toll tags & chauffeur stipends',
    status: 'approved',
    recordedByUserId: 'usr-bm-1',
    recordedByUserName: 'Prince Boateng',
    recordedByUserRole: 'branch_manager',
    createdAt: dayjs().subtract(3, 'day').toISOString(),
    updatedAt: dayjs().subtract(3, 'day').toISOString(),
  },
  {
    id: 'exp-bm-3',
    code: 'EXP-BM-003',
    category: 'Facility Air Conditioning',
    type: 'internal',
    amountMinor: 195000, // GHS 1,950.00
    incurredOn: dayjs().subtract(5, 'day').format('YYYY-MM-DD'),
    branchId: 'branch-km',
    branchName: 'Kumasi Branch',
    description: 'Branch multi-split AC refrigerant top-up, compressor cleaning and filter overhaul',
    status: 'approved',
    recordedByUserId: 'usr-bm-2',
    recordedByUserName: 'Kwame Poku',
    recordedByUserRole: 'branch_manager',
    createdAt: dayjs().subtract(5, 'day').toISOString(),
    updatedAt: dayjs().subtract(5, 'day').toISOString(),
  },
  {
    id: 'exp-bm-4',
    code: 'EXP-BM-004',
    category: 'Branch Security & Sanitation',
    type: 'internal',
    amountMinor: 98000, // GHS 980.00
    incurredOn: dayjs().subtract(9, 'day').format('YYYY-MM-DD'),
    branchId: 'branch-km',
    branchName: 'Kumasi Branch',
    description: 'CCTV perimeter surveillance recalibration & municipal waste management fee',
    status: 'pending',
    recordedByUserId: 'usr-bm-2',
    recordedByUserName: 'Kwame Poku',
    recordedByUserRole: 'branch_manager',
    createdAt: dayjs().subtract(9, 'day').toISOString(),
    updatedAt: dayjs().subtract(9, 'day').toISOString(),
  },

  // ── Accounts Role Expenses ────────────────────────────────────────────────
  {
    id: 'exp-acc-1',
    code: 'EXP-ACC-001',
    category: 'Lands Commission Title Searches',
    type: 'external',
    amountMinor: 580000, // GHS 5,800.00
    incurredOn: dayjs().subtract(4, 'day').format('YYYY-MM-DD'),
    branchId: 'branch-ho',
    branchName: 'Head Office',
    description: 'Official Lands Commission cadastral search clearances and deed registry stamping fees',
    status: 'approved',
    recordedByUserId: 'usr-acc-1',
    recordedByUserName: 'Kwame Mensah',
    recordedByUserRole: 'accounts',
    createdAt: dayjs().subtract(4, 'day').toISOString(),
    updatedAt: dayjs().subtract(4, 'day').toISOString(),
  },
  {
    id: 'exp-acc-2',
    code: 'EXP-ACC-002',
    category: 'Banking & Audit Charges',
    type: 'internal',
    amountMinor: 165000, // GHS 1,650.00
    incurredOn: dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
    branchId: 'branch-ho',
    branchName: 'Head Office',
    description: 'Mid-year financial auditor documentation filing and secure escrow bank charges',
    status: 'approved',
    recordedByUserId: 'usr-acc-1',
    recordedByUserName: 'Kwame Mensah',
    recordedByUserRole: 'accounts',
    createdAt: dayjs().subtract(6, 'day').toISOString(),
    updatedAt: dayjs().subtract(6, 'day').toISOString(),
  },
];

export function getStoredExpenses(): ExpenseEntity[] {
  try {
    const raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(DEFAULT_SEEDED_EXPENSES));
      return DEFAULT_SEEDED_EXPENSES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure each item has a recordedByUserRole attributed
      const resolved = parsed.map((item: any) => {
        if (item.recordedByUserRole) return item;
        const name = (item.recordedByUserName || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();
        let role = 'branch_manager';
        if (name.includes('director') || cat.includes('marketing') || desc.includes('billboard') || desc.includes('ad run') || desc.includes('expo') || desc.includes('brochure')) {
          role = 'marketing_director';
        } else if (name.includes('secretary') || name.includes('serwaa') || name.includes('darko') || cat.includes('office supplies') || cat.includes('hospitality') || desc.includes('stationery') || desc.includes('refreshment') || desc.includes('courier')) {
          role = 'secretary';
        } else if (name.includes('accounts') || cat.includes('legal') || cat.includes('lands commission') || desc.includes('title search')) {
          role = 'accounts';
        } else if (name.includes('admin')) {
          role = 'admin';
        }
        return { ...item, recordedByUserRole: role };
      });
      return resolved;
    }
    localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(DEFAULT_SEEDED_EXPENSES));
    return DEFAULT_SEEDED_EXPENSES;
  } catch (err) {
    console.warn('Failed to read stored expenses, returning defaults:', err);
    return DEFAULT_SEEDED_EXPENSES;
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
    console.warn('Failed to save expense locally:', err);
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
      let serverExpenses: ExpenseEntity[] = [];
      try {
        const res = await apiClient.get<ApiResponse<ExpenseEntity[]>>('/expenses', { params });
        const unwrapped = unwrapList(res);
        if (unwrapped && unwrapped.items && unwrapped.items.length > 0) {
          serverExpenses = unwrapped.items;
        }
      } catch (err: any) {
        // Backend optional fallback
      }

      const localExpenses = getStoredExpenses();
      const map = new Map<string, ExpenseEntity>();
      localExpenses.forEach((e) => map.set(e.id, e));
      serverExpenses.forEach((e) => map.set(e.id, e));
      let all = Array.from(map.values());

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
        pageSize: params?.pageSize ?? all.length,
        totalPages: 1,
      };
    },
  });
}

export function useCreateExpenseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateExpensePayload) => {
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
        status: 'approved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        const res = await apiClient.post<ApiResponse<ExpenseEntity>>('/expenses', payload);
        const saved = unwrapData(res);
        saveStoredExpense(saved || newExpense);
        return saved || newExpense;
      } catch (err) {
        saveStoredExpense(newExpense);
        return newExpense;
      }
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
      try {
        const res = await apiClient.post<ApiResponse<ExpenseEntity>>(`/expenses/${id}/decision`, payload);
        return unwrapData(res);
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expensesKeys.all });
      window.dispatchEvent(new Event('omark-expenses-changed'));
    },
  });
}
