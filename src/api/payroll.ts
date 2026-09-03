// src/api/payroll.ts
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList, type ListResult } from '@/api/client';
import type { ApiResponse } from '@/types';
import {
  type SalaryType,
  type PaymentMethod,
  type PaymentDetails,
  type StaffCompensationProfile,
  getStaffCompensationProfile,
  loadStaffCompensationProfiles
} from '@/mock/staffCompensation';
import { getStaffBonuses } from '@/mock/bonusRules';
import { getStaffAssignment } from '@/mock/staffAssignments';
import { getBranchCanonicalKey } from '@/utils/branchIsolation';
import { calculateStaffAttendanceSummary } from '@/mock/staffAttendance';

const STORAGE_KEY = 'omark_mock_payroll';

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
  loanDeductionMinor?: number;
  advanceDeductionMinor?: number;
  statutoryDeductionMinor?: number; // SSNIT / Income Tax
  otherDeductionMinor?: number;
  deductionsMinor: number;
  
  // Totals
  grossEarningsMinor?: number;
  totalAllowancesMinor?: number;
  totalBonusesMinor?: number;
  totalDeductionsMinor?: number;
  netSalaryMinor: number;
  
  // Payment info & Workflow
  paymentMethod?: PaymentMethod;
  paymentDetails?: PaymentDetails;
  paymentReference?: string;
  status: 'pending' | 'approved' | 'paid';
  approvedBy?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollListParams {
  month?: string;
  staffUserId?: string;
  branchId?: string;
  status?: 'pending' | 'approved' | 'paid';
  page?: number;
  pageSize?: number;
}

export interface CreatePayrollPayload {
  staffUserId: string;
  staffName?: string;
  staffRole?: string;
  branchId?: string;
  branchName?: string;
  month: string;
  salaryType?: SalaryType;
  baseSalaryMinor: number;
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
  bonusMinor?: number;
  latenessDeductionMinor?: number;
  absenceDeductionMinor?: number;
  loanDeductionMinor?: number;
  advanceDeductionMinor?: number;
  statutoryDeductionMinor?: number;
  otherDeductionMinor?: number;
  deductionsMinor?: number;
  paymentMethod?: PaymentMethod;
  paymentDetails?: PaymentDetails;
  notes?: string;
}

export interface BulkPayrollRunPayload {
  month: string;
  branchId?: string;
  staffList?: Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    role?: any;
    branchId?: string;
    email?: string;
  }>;
}

export interface UpdatePayrollPayload {
  baseSalaryMinor?: number;
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
  bonusMinor?: number;
  latenessDeductionMinor?: number;
  absenceDeductionMinor?: number;
  loanDeductionMinor?: number;
  advanceDeductionMinor?: number;
  statutoryDeductionMinor?: number;
  otherDeductionMinor?: number;
  deductionsMinor?: number;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  status?: 'pending' | 'approved' | 'paid';
  paidAt?: string;
  notes?: string;
}

const SEED_PAYROLL: PayrollRecord[] = [
  {
    id: 'pr-1',
    code: 'HQ-PAYR-2026-001',
    staffUserId: '1',
    staffName: 'John Admin',
    staffRole: 'Administrator',
    branchId: 'b2',
    branchName: 'Head Office',
    month: '2026-08',
    salaryType: 'fixed',
    baseSalaryMinor: 750000,
    transportAllowanceMinor: 80000,
    housingAllowanceMinor: 120000,
    mealAllowanceMinor: 50000,
    bonusMinor: 50000,
    salesBonusMinor: 50000,
    statutoryDeductionMinor: 95000,
    deductionsMinor: 95000,
    netSalaryMinor: 855000,
    paymentMethod: 'bank_transfer',
    status: 'paid',
    paidAt: '2026-08-28T10:00:00.000Z',
    paymentReference: 'GCB-TRF-20260828-001',
    createdAt: '2026-08-25T09:00:00.000Z',
    updatedAt: '2026-08-28T10:00:00.000Z',
  },
  {
    id: 'pr-2',
    code: 'HQ-PAYR-2026-002',
    staffUserId: '2',
    staffName: 'Sarah Marketing',
    staffRole: 'Marketing Staff',
    branchId: 'b2',
    branchName: 'Head Office',
    month: '2026-08',
    salaryType: 'mixed',
    baseSalaryMinor: 350000,
    transportAllowanceMinor: 60000,
    mealAllowanceMinor: 40000,
    commissionMinor: 50000,
    salesBonusMinor: 50000,
    bonusMinor: 100000,
    statutoryDeductionMinor: 42000,
    loanDeductionMinor: 25000,
    deductionsMinor: 67000,
    netSalaryMinor: 483000,
    paymentMethod: 'momo',
    status: 'paid',
    paidAt: '2026-08-28T10:30:00.000Z',
    paymentReference: 'MTN-MOMO-20260828-044',
    createdAt: '2026-08-25T09:00:00.000Z',
    updatedAt: '2026-08-28T10:30:00.000Z',
  },
  {
    id: 'pr-3',
    code: 'HQ-PAYR-2026-003',
    staffUserId: '3',
    staffName: 'Michael Director',
    staffRole: 'Marketing Director',
    branchId: 'b2',
    branchName: 'Head Office',
    month: '2026-08',
    salaryType: 'mixed',
    baseSalaryMinor: 600000,
    transportAllowanceMinor: 100000,
    housingAllowanceMinor: 80000,
    mealAllowanceMinor: 60000,
    commissionMinor: 100000,
    bonusMinor: 100000,
    statutoryDeductionMinor: 78000,
    deductionsMinor: 78000,
    netSalaryMinor: 762000,
    paymentMethod: 'bank_transfer',
    status: 'approved',
    createdAt: '2026-08-25T09:00:00.000Z',
    updatedAt: '2026-08-27T11:00:00.000Z',
  },
  {
    id: 'pr-4',
    code: 'HQ-PAYR-2026-004',
    staffUserId: '4',
    staffName: 'Emma Service',
    staffRole: 'Customer Service',
    branchId: 'b2',
    branchName: 'Head Office',
    month: '2026-08',
    salaryType: 'fixed',
    baseSalaryMinor: 320000,
    transportAllowanceMinor: 50000,
    mealAllowanceMinor: 35000,
    attendanceBonusMinor: 20000,
    bonusMinor: 20000,
    statutoryDeductionMinor: 38000,
    deductionsMinor: 38000,
    netSalaryMinor: 387000,
    paymentMethod: 'momo',
    status: 'pending',
    createdAt: '2026-08-25T09:00:00.000Z',
    updatedAt: '2026-08-25T09:00:00.000Z',
  },
];

export const loadStoredPayroll = (): PayrollRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  saveStoredPayroll(SEED_PAYROLL);
  return SEED_PAYROLL;
};

export const saveStoredPayroll = (records: PayrollRecord[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event('omark-payroll-changed'));
};

export const payrollKeys = {
  all: ['payroll'] as const,
  lists: () => [...payrollKeys.all, 'list'] as const,
  list: (params?: PayrollListParams) => [...payrollKeys.lists(), params ?? {}] as const,
};

export function usePayrollQuery(params?: PayrollListParams) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all });
    };
    window.addEventListener('omark-payroll-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('omark-payroll-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: payrollKeys.list(params),
    queryFn: async (): Promise<ListResult<PayrollRecord>> => {
      let items = loadStoredPayroll();
      if (params?.month) {
        items = items.filter((p) => p.month === params.month);
      }
      if (params?.staffUserId) {
        items = items.filter((p) => p.staffUserId === params.staffUserId);
      }
      if (params?.branchId) {
        items = items.filter((p) => !p.branchId || p.branchId === params.branchId);
      }
      if (params?.status) {
        items = items.filter((p) => p.status === params.status);
      }

      // Sort newest month and creation first
      items.sort((a, b) => (b.month + (b.createdAt || '')).localeCompare(a.month + (a.createdAt || '')));

      return { items, total: items.length, page: 1, pageSize: 100, totalPages: 1 };
    },
  });
}

export function useCreatePayrollMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreatePayrollPayload): Promise<PayrollRecord> => {
      const records = loadStoredPayroll();
      const comp = getStaffCompensationProfile(payload.staffUserId);
      const code = `PAYR-${payload.month.replace('-', '')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      const grossEarningsMinor =
        payload.baseSalaryMinor +
        (payload.overtimeMinor || 0) +
        (payload.transportAllowanceMinor || 0) +
        (payload.housingAllowanceMinor || 0) +
        (payload.mealAllowanceMinor || 0) +
        (payload.otherAllowanceMinor || 0) +
        (payload.bonusMinor || 0);

      const deductionsMinor =
        payload.deductionsMinor !== undefined
          ? payload.deductionsMinor
          : (payload.statutoryDeductionMinor || 0) +
            (payload.loanDeductionMinor || 0) +
            (payload.advanceDeductionMinor || 0) +
            (payload.latenessDeductionMinor || 0) +
            (payload.absenceDeductionMinor || 0) +
            (payload.otherDeductionMinor || 0);

      const netSalaryMinor = grossEarningsMinor - deductionsMinor;
      const now = new Date().toISOString();

      const newRecord: PayrollRecord = {
        id: `pr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        code,
        staffUserId: payload.staffUserId,
        staffName: payload.staffName || comp.staffName,
        staffRole: payload.staffRole || comp.role,
        branchId: payload.branchId || comp.branchId || 'b2',
        branchName: payload.branchName || 'Head Office',
        month: payload.month,
        salaryType: payload.salaryType || comp.salaryType,
        baseSalaryMinor: payload.baseSalaryMinor,
        overtimeMinor: payload.overtimeMinor,
        transportAllowanceMinor: payload.transportAllowanceMinor,
        housingAllowanceMinor: payload.housingAllowanceMinor,
        mealAllowanceMinor: payload.mealAllowanceMinor,
        otherAllowanceMinor: payload.otherAllowanceMinor,
        commissionMinor: payload.commissionMinor,
        salesBonusMinor: payload.salesBonusMinor,
        attendanceBonusMinor: payload.attendanceBonusMinor,
        punctualityBonusMinor: payload.punctualityBonusMinor,
        productivityBonusMinor: payload.productivityBonusMinor,
        projectCompletionBonusMinor: payload.projectCompletionBonusMinor,
        bonusMinor: payload.bonusMinor || 0,
        statutoryDeductionMinor: payload.statutoryDeductionMinor,
        loanDeductionMinor: payload.loanDeductionMinor,
        advanceDeductionMinor: payload.advanceDeductionMinor,
        latenessDeductionMinor: payload.latenessDeductionMinor,
        absenceDeductionMinor: payload.absenceDeductionMinor,
        otherDeductionMinor: payload.otherDeductionMinor,
        deductionsMinor,
        grossEarningsMinor,
        netSalaryMinor,
        paymentMethod: payload.paymentMethod || comp.paymentDetails?.method || 'bank_transfer',
        paymentDetails: payload.paymentDetails || comp.paymentDetails,
        status: 'pending',
        notes: payload.notes,
        createdAt: now,
        updatedAt: now,
      };

      saveStoredPayroll([newRecord, ...records]);
      return newRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all });
    },
  });
}

export function useBulkPayrollRunMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: BulkPayrollRunPayload): Promise<{ count: number; items: PayrollRecord[] }> => {
      const records = loadStoredPayroll();
      const profiles = loadStaffCompensationProfiles();

      let eligibleProfiles: StaffCompensationProfile[] = [];

      if (payload.staffList && payload.staffList.length > 0) {
        const targetBranchKey = payload.branchId ? getBranchCanonicalKey(payload.branchId) : '';
        const filteredUsers = payload.staffList.filter((u) => {
          if (!payload.branchId) return true;
          const assignment = getStaffAssignment(u.id);
          const staffBranch = assignment?.branchId || u.branchId;
          if (!staffBranch) return false;
          return staffBranch === payload.branchId || getBranchCanonicalKey(staffBranch) === targetBranchKey;
        });

        eligibleProfiles = filteredUsers.map((u) => {
          const fullName = u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'Staff Member';
          return getStaffCompensationProfile(u.id, fullName, u.role || 'customer_service');
        });
      } else {
        const targetBranchKey = payload.branchId ? getBranchCanonicalKey(payload.branchId) : '';
        eligibleProfiles = profiles.filter((p) => {
          if (!payload.branchId) return true;
          const assignment = getStaffAssignment(p.userId);
          const staffBranch = assignment?.branchId || p.branchId;
          if (!staffBranch) return false;
          return staffBranch === payload.branchId || getBranchCanonicalKey(staffBranch) === targetBranchKey;
        });
      }

      const newRunRecords: PayrollRecord[] = [];
      const now = new Date().toISOString();

      for (const comp of eligibleProfiles) {
        // Calculate accrued bonuses for this employee
        const staffBonuses = getStaffBonuses(comp.userId);
        // Calculate attendance summary metrics for dynamic bonus and deduction integration
        const attendanceSummary = calculateStaffAttendanceSummary(comp.userId, payload.month);

        let dynamicAttendanceBonusGHS = staffBonuses.filter((b) => b.bonusType === 'attendance_bonus').reduce((s, b) => s + b.amountGHS, 0);
        let dynamicPunctualityBonusGHS = staffBonuses.filter((b) => b.bonusType === 'punctuality_bonus').reduce((s, b) => s + b.amountGHS, 0);

        // Attendance bonus qualification: rate >= 95% and 0 unexcused absences
        if (attendanceSummary.attendanceRate >= 95 && attendanceSummary.daysAbsent === 0 && dynamicAttendanceBonusGHS === 0) {
          dynamicAttendanceBonusGHS = 300;
        }

        // Punctuality bonus qualification: 0 late arrivals in month
        if (attendanceSummary.daysLate === 0 && dynamicPunctualityBonusGHS === 0) {
          dynamicPunctualityBonusGHS = 200;
        }

        const salesBonusGHS = staffBonuses.filter((b) => b.bonusType === 'sales_bonus').reduce((s, b) => s + b.amountGHS, 0);
        const productivityBonusGHS = staffBonuses.filter((b) => b.bonusType === 'productivity_bonus').reduce((s, b) => s + b.amountGHS, 0);
        const projectBonusGHS = staffBonuses.filter((b) => b.bonusType === 'project_completion_bonus').reduce((s, b) => s + b.amountGHS, 0);
        const totalBonusGHS = salesBonusGHS + dynamicAttendanceBonusGHS + dynamicPunctualityBonusGHS + productivityBonusGHS + projectBonusGHS;

        const baseSalaryMinor = Math.round((comp.baseSalaryGHS || 3500) * 100);
        const transportAllowanceMinor = Math.round((comp.allowances?.transportGHS || 0) * 100);
        const housingAllowanceMinor = Math.round((comp.allowances?.housingGHS || 0) * 100);
        const mealAllowanceMinor = Math.round((comp.allowances?.mealGHS || 0) * 100);
        const otherAllowanceMinor = Math.round((comp.allowances?.otherGHS || 0) * 100);
        const totalAllowancesMinor = transportAllowanceMinor + housingAllowanceMinor + mealAllowanceMinor + otherAllowanceMinor;

        const commissionMinor = Math.round((comp.commissionFlatGHS || 0) * 100);
        const salesBonusMinor = Math.round(salesBonusGHS * 100);
        const attendanceBonusMinor = Math.round(dynamicAttendanceBonusGHS * 100);
        const punctualityBonusMinor = Math.round(dynamicPunctualityBonusGHS * 100);
        const productivityBonusMinor = Math.round(productivityBonusGHS * 100);
        const projectCompletionBonusMinor = Math.round(projectBonusGHS * 100);
        const bonusMinor = Math.round(totalBonusGHS * 100) + commissionMinor;

        const statutoryDeductionMinor = Math.round((comp.deductions?.taxSSNITGHS || 0) * 100);
        const loanDeductionMinor = Math.round((comp.deductions?.loanRepaymentGHS || 0) * 100);
        const advanceDeductionMinor = Math.round((comp.deductions?.advanceDeductionGHS || 0) * 100);

        // Lateness deduction: 25 GHS per late punch
        const latenessDeductionGHS = (comp.deductions?.latenessDeductionGHS || 0) + (attendanceSummary.daysLate * 25);
        const latenessDeductionMinor = Math.round(latenessDeductionGHS * 100);

        // Absence deduction: daily base salary rate per unexcused absence
        const dailyRateGHS = (comp.baseSalaryGHS || 3500) / 22;
        const absenceDeductionGHS = (comp.deductions?.absenceDeductionGHS || 0) + (attendanceSummary.daysAbsent * dailyRateGHS);
        const absenceDeductionMinor = Math.round(absenceDeductionGHS * 100);

        const deductionsMinor = statutoryDeductionMinor + loanDeductionMinor + advanceDeductionMinor + latenessDeductionMinor + absenceDeductionMinor;

        const grossEarningsMinor = baseSalaryMinor + totalAllowancesMinor + bonusMinor;
        const netSalaryMinor = grossEarningsMinor - deductionsMinor;
        const userSnippet = String(comp.userId || 'USR').replace(/[^a-zA-Z0-9]/g, '').slice(0, 3);
        const code = `PAYR-${payload.month.replace(/[^0-9]/g, '')}-${userSnippet}-${Math.random().toString(36).substr(2, 3).toUpperCase()}`;

        const statement: PayrollRecord = {
          id: `pr-${payload.month}-${comp.userId}-${Date.now()}`,
          code,
          staffUserId: comp.userId,
          staffName: comp.staffName,
          staffRole: typeof comp.role === 'string' ? comp.role : 'Office Staff',
          branchId: payload.branchId || getStaffAssignment(comp.userId)?.branchId || comp.branchId || 'b2',
          branchName: 'Branch Office',
          month: payload.month,
          salaryType: comp.salaryType,
          baseSalaryMinor,
          transportAllowanceMinor,
          housingAllowanceMinor,
          mealAllowanceMinor,
          otherAllowanceMinor,
          commissionMinor,
          salesBonusMinor,
          attendanceBonusMinor,
          punctualityBonusMinor,
          productivityBonusMinor,
          projectCompletionBonusMinor,
          bonusMinor,
          statutoryDeductionMinor,
          loanDeductionMinor,
          advanceDeductionMinor,
          latenessDeductionMinor,
          absenceDeductionMinor,
          deductionsMinor,
          grossEarningsMinor,
          netSalaryMinor,
          paymentMethod: comp.paymentDetails?.method || 'bank_transfer',
          paymentDetails: comp.paymentDetails,
          status: 'pending',
          notes: `Automated bulk run for ${payload.month}`,
          createdAt: now,
          updatedAt: now,
        };

        newRunRecords.push(statement);
      }

      const updated = [...newRunRecords, ...records];
      saveStoredPayroll(updated);

      return { count: newRunRecords.length, items: newRunRecords };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all });
    },
  });
}

export function useUpdatePayrollMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdatePayrollPayload }): Promise<PayrollRecord> => {
      const records = loadStoredPayroll();
      const index = records.findIndex((p) => p.id === id);

      if (index === -1) {
        throw new Error('Payroll record not found');
      }

      const existing = records[index];
      const baseSalaryMinor = payload.baseSalaryMinor !== undefined ? payload.baseSalaryMinor : existing.baseSalaryMinor;
      const bonusMinor = payload.bonusMinor !== undefined ? payload.bonusMinor : existing.bonusMinor;
      const deductionsMinor = payload.deductionsMinor !== undefined ? payload.deductionsMinor : existing.deductionsMinor;
      const grossEarningsMinor = baseSalaryMinor + bonusMinor;
      const netSalaryMinor = grossEarningsMinor - deductionsMinor;

      const updated: PayrollRecord = {
        ...existing,
        ...payload,
        baseSalaryMinor,
        bonusMinor,
        deductionsMinor,
        grossEarningsMinor,
        netSalaryMinor,
        updatedAt: new Date().toISOString(),
      };

      records[index] = updated;
      saveStoredPayroll(records);
      return updated;
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
      const records = loadStoredPayroll();
      const updated = records.filter((p) => p.id !== id);
      saveStoredPayroll(updated);
      return id;
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
      saveStoredPayroll([]);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payrollKeys.all });
    },
  });
}
