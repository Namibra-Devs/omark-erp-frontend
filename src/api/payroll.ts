// src/api/payroll.ts
//
// React Query API hooks for Payroll & Salary Records
// Integrated with backend API endpoints at /api/v1/payroll with resilient offline/local fallback

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList, type ListResult } from '@/api/client';
import type { ApiResponse } from '@/types';
import type { SalaryType, PaymentMethod } from '@/api/compensation';
import { recordSystemEvent } from '@/utils/activityNotificationEngine';

export interface PayrollRecord {
  id: string;
  code?: string;
  staffUserId: string;
  staffName?: string;
  staffRole?: string;
  branchId?: string;
  branchName?: string;
  month: string; // YYYY-MM
  salaryType?: SalaryType;
  
  // Earnings & Allowances
  baseSalaryMinor: number;
  overtimeMinor?: number;
  transportAllowanceMinor?: number;
  housingAllowanceMinor?: number;
  mealAllowanceMinor?: number;
  otherAllowanceMinor?: number;
  
  // Rule-Based Bonuses & Commission
  commissionMinor?: number;
  salesBonusMinor?: number;
  attendanceBonusMinor?: number;
  punctualityBonusMinor?: number;
  productivityBonusMinor?: number;
  projectCompletionBonusMinor?: number;
  bonusMinor: number;
  
  // Deductions
  latenessDeductionMinor?: number;
  absenceDeductionMinor?: number;
  statutoryDeductionMinor?: number;
  loanDeductionMinor?: number;
  advanceDeductionMinor?: number;
  deductionsMinor?: number;
  
  // Totals
  grossEarningsMinor?: number;
  netSalaryMinor: number;
  
  paymentMethod?: PaymentMethod;
  paymentDetails?: any;
  status: 'pending' | 'approved' | 'paid';
  paidAt?: string;
  paymentReference?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollListParams {
  page?: number;
  pageSize?: number;
  month?: string;
  branchId?: string;
  status?: 'pending' | 'approved' | 'paid';
  staffUserId?: string;
}

export interface CreatePayrollPayload {
  staffUserId: string;
  month: string;
  baseSalaryMinor: number;
  bonusMinor?: number;
  deductionsMinor?: number;
  salaryType?: SalaryType;
  overtimeMinor?: number;
  transportAllowanceMinor?: number;
  housingAllowanceMinor?: number;
  mealAllowanceMinor?: number;
  otherAllowanceMinor?: number;
  commissionMinor?: number;
  salesBonusMinor?: number;
  attendanceBonusMinor?: number;
  punctualityBonusMinor?: number;
  productivityBonusMinor?: number;
  projectCompletionBonusMinor?: number;
  latenessDeductionMinor?: number;
  absenceDeductionMinor?: number;
  statutoryDeductionMinor?: number;
  loanDeductionMinor?: number;
  advanceDeductionMinor?: number;
  grossEarningsMinor?: number;
  netSalaryMinor?: number;
  paymentMethod?: PaymentMethod;
  paymentDetails?: any;
  notes?: string;
}

export interface UpdatePayrollPayload {
  baseSalaryMinor?: number;
  bonusMinor?: number;
  deductionsMinor?: number;
  status?: 'pending' | 'approved' | 'paid';
  paidAt?: string;
  paymentReference?: string;
  notes?: string;
  [key: string]: any;
}

export interface BulkPayrollRunPayload {
  month: string;
  branchId?: string;
  staffList?: any[];
}

const STORAGE_KEY = 'omark_payroll_records_store';

const DEFAULT_SEEDED_PAYROLL: PayrollRecord[] = [];

export const getStoredPayrollRecords = (): PayrollRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SEEDED_PAYROLL));
      return DEFAULT_SEEDED_PAYROLL;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Remove placeholder seed records (payr-seed-*) so only genuine staff payroll statements exist
      const cleaned = parsed.filter((item: PayrollRecord) => !item.id?.startsWith('payr-seed-'));
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      }
      return cleaned;
    }
    return DEFAULT_SEEDED_PAYROLL;
  } catch {
    return DEFAULT_SEEDED_PAYROLL;
  }
};

export const saveStoredPayrollRecords = (records: PayrollRecord[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new Event('omark-payroll-changed'));
  } catch (err) {
    console.warn('Failed to save payroll records to storage:', err);
  }
};

// --- Query Keys ---

export const payrollKeys = {
  all: ['payroll'] as const,
  lists: () => [...payrollKeys.all, 'list'] as const,
  list: (params?: PayrollListParams) => [...payrollKeys.lists(), params ?? {}] as const,
  details: () => [...payrollKeys.all, 'detail'] as const,
  detail: (id: string) => [...payrollKeys.details(), id] as const,
};

// --- Hooks ---

export function usePayrollQuery(params?: PayrollListParams) {
  return useQuery({
    queryKey: payrollKeys.list(params),
    queryFn: async () => {
      let serverRecords: PayrollRecord[] = [];
      try {
        const res = await apiClient.get<ApiResponse<PayrollRecord[]>>('/payroll', { params });
        const list = unwrapList(res);
        serverRecords = Array.isArray(list) ? list : (list as any)?.items || [];
      } catch {
        // Fall back to local storage
      }

      const localRecords = getStoredPayrollRecords();
      const mergedMap = new Map<string, PayrollRecord>();
      localRecords.forEach((r) => mergedMap.set(r.id, r));
      serverRecords.forEach((r) => mergedMap.set(r.id, r));
      let all = Array.from(mergedMap.values());

      if (params?.month) {
        all = all.filter((r) => r.month === params.month);
      }
      if (params?.branchId) {
        all = all.filter((r) => r.branchId === params.branchId);
      }
      if (params?.status) {
        all = all.filter((r) => r.status === params.status);
      }
      if (params?.staffUserId) {
        all = all.filter((r) => r.staffUserId === params.staffUserId);
      }

      return {
        items: all,
        total: all.length,
        page: params?.page || 1,
        pageSize: params?.pageSize || 50,
      };
    },
  });
}

export function usePayrollDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: payrollKeys.detail(id ?? ''),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<PayrollRecord>>(`/payroll/${id}`);
        const data = unwrapData(res);
        if (data) return data;
      } catch {
        // Fallback
      }
      const local = getStoredPayrollRecords();
      return local.find((r) => r.id === id) || null;
    },
    enabled: Boolean(id),
  });
}

export function useCreatePayrollMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreatePayrollPayload): Promise<PayrollRecord> => {
      const grossEarningsMinor =
        (payload.baseSalaryMinor || 0) +
        (payload.overtimeMinor || 0) +
        (payload.transportAllowanceMinor || 0) +
        (payload.housingAllowanceMinor || 0) +
        (payload.mealAllowanceMinor || 0) +
        (payload.otherAllowanceMinor || 0) +
        (payload.bonusMinor || 0);

      const netSalaryMinor =
        payload.netSalaryMinor ??
        grossEarningsMinor - (payload.deductionsMinor || 0);

      const normalizedPayload: CreatePayrollPayload = {
        ...payload,
        grossEarningsMinor,
        netSalaryMinor,
      };

      try {
        const res = await apiClient.post<ApiResponse<PayrollRecord>>('/payroll', normalizedPayload);
        const serverData = unwrapData(res);
        if (serverData) {
          const records = getStoredPayrollRecords();
          saveStoredPayrollRecords([serverData, ...records]);
          return serverData;
        }
      } catch (err) {
        console.warn('Backend payroll creation skipped, persisting locally:', err);
      }

      // Local fallback
      const yearMonth = payload.month || new Date().toISOString().substring(0, 7);
      const codeSuffix = Math.floor(100 + Math.random() * 900);
      const newRecord: PayrollRecord = {
        id: `payroll-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        code: `PAYR-${yearMonth}-${codeSuffix}`,
        staffUserId: payload.staffUserId,
        month: payload.month,
        salaryType: payload.salaryType || 'monthly',
        baseSalaryMinor: payload.baseSalaryMinor,
        overtimeMinor: payload.overtimeMinor || 0,
        transportAllowanceMinor: payload.transportAllowanceMinor || 0,
        housingAllowanceMinor: payload.housingAllowanceMinor || 0,
        mealAllowanceMinor: payload.mealAllowanceMinor || 0,
        otherAllowanceMinor: payload.otherAllowanceMinor || 0,
        commissionMinor: payload.commissionMinor || 0,
        salesBonusMinor: payload.salesBonusMinor || 0,
        attendanceBonusMinor: payload.attendanceBonusMinor || 0,
        punctualityBonusMinor: payload.punctualityBonusMinor || 0,
        productivityBonusMinor: payload.productivityBonusMinor || 0,
        projectCompletionBonusMinor: payload.projectCompletionBonusMinor || 0,
        bonusMinor: payload.bonusMinor || 0,
        latenessDeductionMinor: payload.latenessDeductionMinor || 0,
        absenceDeductionMinor: payload.absenceDeductionMinor || 0,
        statutoryDeductionMinor: payload.statutoryDeductionMinor || 0,
        loanDeductionMinor: payload.loanDeductionMinor || 0,
        advanceDeductionMinor: payload.advanceDeductionMinor || 0,
        deductionsMinor: payload.deductionsMinor || 0,
        grossEarningsMinor,
        netSalaryMinor,
        paymentMethod: payload.paymentMethod || 'bank_transfer',
        status: 'pending',
        notes: payload.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const existing = getStoredPayrollRecords();
      saveStoredPayrollRecords([newRecord, ...existing.filter((r) => !(r.staffUserId === newRecord.staffUserId && r.month === newRecord.month))]);
      return newRecord;
    },
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all });
      recordSystemEvent({
        title: 'Payroll Record Generated',
        details: `Payroll entry for month ${record.month} submitted for Admin review (Net GH₵ ${(record.netSalaryMinor / 100).toLocaleString()})`,
        category: 'payroll',
        type: 'info',
        link: '/branches/payroll',
        refId: record.id,
      });
    },
  });
}

export function useBulkPayrollRunMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BulkPayrollRunPayload) => {
      try {
        const res = await apiClient.post<ApiResponse<any>>('/payroll/run', payload);
        const serverData = unwrapData(res);
        if (serverData) return serverData;
      } catch (err) {
        console.warn('Backend bulk payroll run skipped, generating locally:', err);
      }

      // Local generation for staff list
      const staffList = payload.staffList || [];
      const month = payload.month || new Date().toISOString().substring(0, 7);
      const existing = getStoredPayrollRecords();
      const existingMap = new Map<string, PayrollRecord>();
      existing.forEach((r) => existingMap.set(`${r.staffUserId}-${r.month}`, r));

      let generatedCount = 0;
      staffList.forEach((staff: any, idx: number) => {
        const key = `${staff.id}-${month}`;
        if (!existingMap.has(key)) {
          const baseSalaryMinor = staff.baseSalaryMinor || 450000;
          const transportAllowanceMinor = 30000;
          const housingAllowanceMinor = 50000;
          const bonusMinor = 0;
          const deductionsMinor = Math.round(baseSalaryMinor * 0.13); // 13% statutory estimate
          const grossEarningsMinor = baseSalaryMinor + transportAllowanceMinor + housingAllowanceMinor + bonusMinor;
          const netSalaryMinor = grossEarningsMinor - deductionsMinor;

          const rec: PayrollRecord = {
            id: `payroll-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
            code: `PAYR-${month}-${Math.floor(100 + Math.random() * 900)}`,
            staffUserId: staff.id,
            staffName: staff.name || `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || 'Staff Member',
            staffRole: staff.role || 'Staff',
            branchId: payload.branchId || staff.branchId || 'branch-ho',
            month,
            salaryType: 'monthly',
            baseSalaryMinor,
            transportAllowanceMinor,
            housingAllowanceMinor,
            bonusMinor,
            deductionsMinor,
            statutoryDeductionMinor: deductionsMinor,
            grossEarningsMinor,
            netSalaryMinor,
            paymentMethod: staff.paymentMethod || 'bank_transfer',
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          existingMap.set(key, rec);
          generatedCount++;
        }
      });

      const updatedAll = Array.from(existingMap.values());
      saveStoredPayrollRecords(updatedAll);
      return { count: generatedCount || staffList.length };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all });
      recordSystemEvent({
        title: 'Bulk Payroll Generated',
        details: `Generated payroll statements for ${data?.count || 'staff'} employees for ${variables.month}`,
        category: 'payroll',
        type: 'success',
        link: '/branches/payroll',
      });
    },
  });
}

export function useUpdatePayrollMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdatePayrollPayload }): Promise<PayrollRecord> => {
      try {
        const res = await apiClient.patch<ApiResponse<PayrollRecord>>(`/payroll/${id}`, payload);
        const serverData = unwrapData(res);
        if (serverData) {
          const list = getStoredPayrollRecords().map((r) => (r.id === id ? { ...r, ...serverData } : r));
          saveStoredPayrollRecords(list);
          return serverData;
        }
      } catch {
        // Fallback
      }

      const list = getStoredPayrollRecords();
      const updatedList = list.map((r) => {
        if (r.id === id) {
          const gross =
            (payload.baseSalaryMinor ?? r.baseSalaryMinor) +
            (r.overtimeMinor || 0) +
            (r.transportAllowanceMinor || 0) +
            (r.housingAllowanceMinor || 0) +
            (payload.bonusMinor ?? r.bonusMinor);
          const net = gross - (payload.deductionsMinor ?? r.deductionsMinor ?? 0);
          return {
            ...r,
            ...payload,
            grossEarningsMinor: gross,
            netSalaryMinor: net,
            updatedAt: new Date().toISOString(),
          };
        }
        return r;
      });
      saveStoredPayrollRecords(updatedList);
      return updatedList.find((r) => r.id === id)!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all });
    },
  });
}

export function useDeletePayrollMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await apiClient.delete<ApiResponse<any>>(`/payroll/${id}`);
      } catch {
        // Fallback
      }
      const list = getStoredPayrollRecords().filter((r) => r.id !== id);
      saveStoredPayrollRecords(list);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all });
    },
  });
}

export function useClearPayrollMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await apiClient.delete<ApiResponse<any>>('/payroll');
      } catch {
        // Fallback
      }
      saveStoredPayrollRecords([]);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all });
    },
  });
}
