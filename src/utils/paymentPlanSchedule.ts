// src/utils/paymentPlanSchedule.ts
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import type { Installment, PaymentPlan, PaymentMethod } from '@/types';

export interface ScheduleInstallmentRow {
  id: string;
  sequence: number;
  ordinal: string; // e.g., '1st', '2nd', '3rd', '4th', '5th', '6th'
  dueDate: string;
  dueDateFormatted: string; // e.g., '31 Jul 2026'
  installmentMinor: number;
  installmentGHS: number;
  accumulatedMinor: number;
  accumulatedGHS: number;
  remainingBalanceMinor: number;
  remainingBalanceGHS: number;
  isPaid: boolean;
  paidAt?: string;
  paymentMethod?: string;
  reference?: string;
  status: 'overdue' | 'due_today' | 'pending' | 'completed';
  isOverdue: boolean;
  isDueToday: boolean;
  priorityScore: number; // 0 for overdue, 1 for due_today, 2 for pending, 3 for completed
}

export interface PaymentPlanScheduleInfo {
  planId: string;
  numMonths: number;
  totalAmountMinor: number;
  totalScheduledMinor: number;
  downPaymentMinor: number;
  currentBalanceMinor: number;
  startDate: string;
  startDateFormatted: string;
  endDate: string;
  endDateFormatted: string;
  agreementRemainingGHS: number;
  agreementTotalGHS: number;
  rows: ScheduleInstallmentRow[];
  agreementLeadText: string;
  agreementDueText: string;
  planTitleText: string;
  hasOverdue: boolean;
  overdueCount: number;
  pendingCount: number;
  paidCount: number;
}

const OVERRIDES_STORAGE_KEY = 'omark_payment_plan_overrides';
const SCHEDULE_CHANGE_EVENT = 'omark-payment-plan-updated';

/**
 * Returns ordinal number string: 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th", etc.
 */
export function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Converts numbers 1-24 into English words (e.g. 6 -> "six")
 */
export function numberToWord(n: number): string {
  const words = [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
    'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two',
    'twenty-three', 'twenty-four'
  ];
  return words[n] || String(n);
}

interface LocalPlanOverride {
  paidInstallments: Record<number, {
    paidAt: string;
    amountMinor: number;
    method?: PaymentMethod | string;
    reference?: string;
  }>;
  balanceMinor?: number;
  updatedAt: string;
}

type OverridesMap = Record<string, LocalPlanOverride>;

const loadOverrides = (): OverridesMap => {
  try {
    const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore parsing errors
  }
  return {};
};

const saveOverrides = (map: OverridesMap) => {
  try {
    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SCHEDULE_CHANGE_EVENT));
  }
};

export const getPlanPaymentOverrides = (planId: string): LocalPlanOverride | undefined => {
  return loadOverrides()[planId];
};

/**
 * Records an installment payment locally so UI updates reactively and persists
 */
export const recordLocalInstallmentPayment = (
  planId: string,
  sequence: number,
  amountMinor: number,
  method?: PaymentMethod | string,
  reference?: string,
  paidOn?: string
): void => {
  const map = loadOverrides();
  const existing = map[planId] || { paidInstallments: {}, updatedAt: new Date().toISOString() };
  
  existing.paidInstallments[sequence] = {
    paidAt: paidOn || new Date().toISOString(),
    amountMinor,
    method: method || 'bank_transfer',
    reference: reference || `PAY-INST-${sequence}-${Date.now().toString().slice(-4)}`,
  };
  existing.updatedAt = new Date().toISOString();
  map[planId] = existing;
  saveOverrides(map);
};

/**
 * React hook to re-render when payment plan overrides change
 */
export const usePaymentPlanScheduleListener = () => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick(t => t + 1);
    window.addEventListener(SCHEDULE_CHANGE_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(SCHEDULE_CHANGE_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);
};

/**
 * Builds the official Payment Plan Schedule matching the contract document
 */
export function buildPaymentPlanSchedule(
  plan: Partial<PaymentPlan> & { id: string },
  apiInstallments: Installment[] = []
): PaymentPlanScheduleInfo {
  const overrides = getPlanPaymentOverrides(plan.id);
  const numMonths = Math.max(plan.numMonths || 6, 1);
  
  // Total contract liability to be settled in installments:
  // In real estate agreements, this is totalAmount minus downPayment, or the initial balance
  const downPaymentMinor = plan.downPaymentMinor || 0;
  const totalAmountMinor = plan.totalAmountMinor || 0;
  
  let totalScheduledMinor = totalAmountMinor > downPaymentMinor 
    ? totalAmountMinor - downPaymentMinor 
    : (plan.balanceMinor || totalAmountMinor || 3500000);

  if (totalScheduledMinor <= 0) {
    totalScheduledMinor = plan.balanceMinor || 3500000;
  }

  // Base start date
  const rawStart = plan.startDate ? dayjs(plan.startDate) : dayjs();
  // Ensure start date is realistic (e.g. end of current or next month)
  const startDate = rawStart.isValid() ? rawStart : dayjs();

  // If API provided installments, use them; otherwise generate synthetic installments
  const sortedApi = [...apiInstallments].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  const rows: ScheduleInstallmentRow[] = [];
  let accumulatedMinor = 0;
  let runningRemainderMinor = totalScheduledMinor;

  // Base monthly amount rounded to pesewas/cents
  const baseMonthlyMinor = Math.floor(totalScheduledMinor / numMonths);

  const today = dayjs().startOf('day');

  for (let i = 1; i <= numMonths; i++) {
    const existing = sortedApi.find(item => item.sequence === i);
    const localPayment = overrides?.paidInstallments?.[i];

    // Determine expected amount for this month (last installment absorbs pesewa remainder)
    let installmentMinor = existing?.expectedAmountMinor ?? 0;
    if (!installmentMinor || installmentMinor <= 0) {
      if (i === numMonths) {
        installmentMinor = runningRemainderMinor;
      } else {
        installmentMinor = baseMonthlyMinor;
      }
    }
    runningRemainderMinor -= installmentMinor;

    // Accumulated to date (column 4)
    accumulatedMinor += installmentMinor;

    // Remaining Balance (column 5)
    // On the final installment, force remaining balance to 0 as in the agreement document
    const remainingBalanceMinor = i === numMonths 
      ? 0 
      : Math.max(totalScheduledMinor - accumulatedMinor, 0);

    // Compute due date
    let dueDateObj = existing?.dueDate ? dayjs(existing.dueDate) : startDate.add(i - 1, 'month');
    // Align to the end of month or 1st day of month as in document "31 Jul 2026", "31 Aug 2026"
    if (!existing?.dueDate) {
      dueDateObj = startDate.add(i - 1, 'month').endOf('month');
    }
    const dueDateStr = dueDateObj.format('YYYY-MM-DD');
    const dueDateFormatted = dueDateObj.format('D MMM YYYY');

    // Determine status
    const isPaid = Boolean(localPayment || existing?.isPaid);
    const paidAt = localPayment?.paidAt || existing?.paidAt;
    const paymentMethod = localPayment?.method;
    const reference = localPayment?.reference;

    const isDueToday = !isPaid && dueDateObj.isSame(today, 'day');
    const isOverdue = !isPaid && dueDateObj.isBefore(today, 'day');

    let status: 'overdue' | 'due_today' | 'pending' | 'completed' = 'pending';
    let priorityScore = 2; // default pending

    if (isPaid) {
      status = 'completed';
      priorityScore = 3;
    } else if (isOverdue) {
      status = 'overdue';
      priorityScore = 0; // Highest priority - moves to top!
    } else if (isDueToday) {
      status = 'due_today';
      priorityScore = 1; // Second highest priority
    }

    rows.push({
      id: existing?.id || `${plan.id}-inst-${i}`,
      sequence: i,
      ordinal: getOrdinal(i),
      dueDate: dueDateStr,
      dueDateFormatted,
      installmentMinor,
      installmentGHS: installmentMinor / 100,
      accumulatedMinor,
      accumulatedGHS: accumulatedMinor / 100,
      remainingBalanceMinor,
      remainingBalanceGHS: remainingBalanceMinor / 100,
      isPaid,
      paidAt,
      paymentMethod,
      reference,
      status,
      isOverdue,
      isDueToday,
      priorityScore,
    });
  }

  const firstDueDate = rows[0]?.dueDateFormatted || startDate.format('D MMM YYYY');
  const lastDueDate = rows[rows.length - 1]?.dueDateFormatted || startDate.add(numMonths - 1, 'month').format('D MMM YYYY');

  const agreementRemainingGHS = totalScheduledMinor / 100;
  const agreementTotalGHS = (totalAmountMinor || totalScheduledMinor) / 100;

  const numMonthsWord = numberToWord(numMonths);

  const agreementLeadText = `Both parties have agreed that the remaining amount of ₵${agreementRemainingGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} shall be paid in ${numMonthsWord} (${numMonths}) equal monthly installments starting from ${firstDueDate} and ending in ${lastDueDate}`;
  const agreementDueText = `Each monthly payment shall be due on or before the 1st day of every month, as detailed below:`;
  const planTitleText = `${numMonths}-MONTH PAYMENT PLAN (₵${agreementRemainingGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total)`;

  const overdueCount = rows.filter(r => r.isOverdue).length;
  const pendingCount = rows.filter(r => !r.isPaid).length;
  const paidCount = rows.filter(r => r.isPaid).length;

  return {
    planId: plan.id,
    numMonths,
    totalAmountMinor,
    totalScheduledMinor,
    downPaymentMinor,
    currentBalanceMinor: plan.balanceMinor ?? (totalScheduledMinor - (paidCount * baseMonthlyMinor)),
    startDate: startDate.format('YYYY-MM-DD'),
    startDateFormatted: firstDueDate,
    endDate: rows[rows.length - 1]?.dueDate || startDate.add(numMonths - 1, 'month').format('YYYY-MM-DD'),
    endDateFormatted: lastDueDate,
    agreementRemainingGHS,
    agreementTotalGHS,
    rows,
    agreementLeadText,
    agreementDueText,
    planTitleText,
    hasOverdue: overdueCount > 0,
    overdueCount,
    pendingCount,
    paidCount,
  };
}
