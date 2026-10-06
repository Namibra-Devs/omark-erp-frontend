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
  installmentMinor: number; // Dynamically adjusted expected amount for this month
  installmentGHS: number;
  accumulatedMinor: number;
  accumulatedGHS: number;
  remainingBalanceMinor: number;
  remainingBalanceGHS: number;
  isPaid: boolean;
  paidAt?: string;
  paymentMethod?: string;
  reference?: string;
  status: 'overdue' | 'due_today' | 'pending' | 'completed' | 'partially_paid';
  isOverdue: boolean;
  isDueToday: boolean;
  priorityScore: number; // 0 for overdue, 1 for due_today, 2 for partially_paid, 3 for pending, 4 for completed

  // Dynamic amortization & ledger fields
  originalExpectedMinor: number;
  originalExpectedGHS: number;
  paidMinor: number;
  paidGHS: number;
  deficitMinor: number; // Deficit in this installment rolling over to subsequent installments
  deficitGHS: number;
  surplusAppliedMinor: number; // Surplus credit applied from prior installment(s)
  surplusAppliedGHS: number;
  deficitCarriedMinor: number; // Deficit rolled in from prior installment(s)
  deficitCarriedGHS: number;
  isPartiallyPaid: boolean;
  notes?: string;
}

export interface PaymentPlanScheduleInfo {
  planId: string;
  numMonths: number;
  totalAmountMinor: number;
  totalScheduledMinor: number;
  downPaymentMinor: number;
  currentBalanceMinor: number;
  currentBalanceGHS: number;
  totalPaidMinor: number;
  totalPaidGHS: number;
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
  partiallyPaidCount: number;
  nextActiveInstallment?: ScheduleInstallmentRow;
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

export interface LocalPaymentRecord {
  sequence: number;
  paidAt: string;
  amountMinor: number;
  method?: PaymentMethod | string;
  reference?: string;
  notes?: string;
}

interface LocalPlanOverride {
  paidInstallments: Record<number, {
    paidAt: string;
    amountMinor: number;
    method?: PaymentMethod | string;
    reference?: string;
    notes?: string;
    records?: LocalPaymentRecord[];
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
  paidOn?: string,
  notes?: string
): void => {
  const map = loadOverrides();
  const existing = map[planId] || { paidInstallments: {}, updatedAt: new Date().toISOString() };
  if (!existing.paidInstallments) {
    existing.paidInstallments = {};
  }

  const newRecord: LocalPaymentRecord = {
    sequence,
    paidAt: paidOn || new Date().toISOString(),
    amountMinor,
    method: method || 'bank_transfer',
    reference: reference || `PAY-INST-${sequence}-${Date.now().toString().slice(-4)}`,
    notes,
  };

  const prev = existing.paidInstallments[sequence];
  if (prev) {
    // Accumulate payment for this installment sequence
    existing.paidInstallments[sequence] = {
      paidAt: newRecord.paidAt,
      amountMinor: prev.amountMinor + amountMinor,
      method: newRecord.method,
      reference: newRecord.reference,
      notes: newRecord.notes || prev.notes,
      records: [...(prev.records || []), newRecord],
    };
  } else {
    existing.paidInstallments[sequence] = {
      paidAt: newRecord.paidAt,
      amountMinor,
      method: newRecord.method,
      reference: newRecord.reference,
      notes: newRecord.notes,
      records: [newRecord],
    };
  }

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
 * Builds the official Payment Plan Schedule matching the contract document with
 * dynamic amortization:
 * - Underpayments credit exact cash received, flag status as 'partially_paid', and roll
 *   deficit forward into subsequent installments.
 * - Overpayments credit exact cash received, flag status as 'completed', and cascade surplus
 *   forward to reduce or eliminate subsequent installments.
 * - Total Outstanding Balance and customer statements are recalculated dynamically.
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
    : (plan.balanceMinor || totalAmountMinor || 35000000);

  if (totalScheduledMinor <= 0) {
    totalScheduledMinor = plan.balanceMinor || 35000000;
  }

  // Base start date
  const rawStart = plan.startDate ? dayjs(plan.startDate) : dayjs();
  const startDate = rawStart.isValid() ? rawStart : dayjs();

  // If API provided installments, use them; otherwise generate synthetic installments
  const sortedApi = [...apiInstallments].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  // Base monthly amount rounded to pesewas/cents
  const baseMonthlyMinor = Math.floor(totalScheduledMinor / numMonths);
  const today = dayjs().startOf('day');

  // Compute total cash received across all records
  let totalPaidMinor = 0;
  for (let i = 1; i <= numMonths; i++) {
    const existing = sortedApi.find(item => item.sequence === i);
    const localPayment = overrides?.paidInstallments?.[i];
    if (localPayment?.amountMinor !== undefined) {
      totalPaidMinor += localPayment.amountMinor;
    } else if (existing?.paidAmountMinor !== undefined && existing.paidAmountMinor > 0) {
      totalPaidMinor += existing.paidAmountMinor;
    } else if (existing?.isPaid) {
      totalPaidMinor += (existing.expectedAmountMinor || baseMonthlyMinor);
    }
  }

  if (plan.status === 'completed') {
    totalPaidMinor = Math.max(totalPaidMinor, totalScheduledMinor);
  } else if (plan.balanceMinor !== undefined && totalPaidMinor === 0) {
    totalPaidMinor = Math.max(0, totalScheduledMinor - plan.balanceMinor);
  }

  const currentBalanceMinor = Math.max(0, totalScheduledMinor - totalPaidMinor);

  // Dynamic amortization simulation
  const rows: ScheduleInstallmentRow[] = [];
  let runningRemainderMinor = totalScheduledMinor;
  let carriedDeficitMinor = 0;
  let carriedSurplusMinor = 0;
  let accumulatedCreditedMinor = 0;

  for (let i = 1; i <= numMonths; i++) {
    const existing = sortedApi.find(item => item.sequence === i);
    const localPayment = overrides?.paidInstallments?.[i];

    // Determine baseline original expected amount
    let baseOriginalExpectedMinor = existing?.expectedAmountMinor ?? 0;
    if (!baseOriginalExpectedMinor || baseOriginalExpectedMinor <= 0) {
      if (i === numMonths) {
        baseOriginalExpectedMinor = runningRemainderMinor;
      } else {
        baseOriginalExpectedMinor = baseMonthlyMinor;
      }
    }
    runningRemainderMinor -= baseOriginalExpectedMinor;

    const originalExpectedMinor = baseOriginalExpectedMinor;
    const deficitCarriedMinor = carriedDeficitMinor;

    // Apply carried surplus from prior installments if any
    let surplusAppliedMinor = 0;
    const nominalWithDeficit = originalExpectedMinor + deficitCarriedMinor;
    if (carriedSurplusMinor > 0) {
      surplusAppliedMinor = Math.min(carriedSurplusMinor, nominalWithDeficit);
      carriedSurplusMinor -= surplusAppliedMinor;
    }

    // Dynamic adjusted expected amount for this month
    const adjustedExpectedMinor = Math.max(0, nominalWithDeficit - surplusAppliedMinor);
    // Absorbed into adjustedExpectedMinor, so reset carriedDeficit
    carriedDeficitMinor = 0;

    // Compute due date
    let dueDateObj = existing?.dueDate ? dayjs(existing.dueDate) : startDate.add(i - 1, 'month');
    if (!existing?.dueDate) {
      dueDateObj = startDate.add(i - 1, 'month').endOf('month');
    }
    const dueDateStr = dueDateObj.format('YYYY-MM-DD');
    const dueDateFormatted = dueDateObj.format('D MMM YYYY');

    // How much direct cash was credited to this installment
    let paidAmountMinor = 0;
    let paidAt = localPayment?.paidAt || existing?.paidAt;
    let paymentMethod = localPayment?.method || (existing?.isPaid ? 'bank_transfer' : undefined);
    let reference = localPayment?.reference || (existing?.isPaid ? `VERIFIED-${i}` : undefined);
    let notes = localPayment?.notes;

    if (localPayment?.amountMinor !== undefined) {
      paidAmountMinor = localPayment.amountMinor;
    } else if (existing?.paidAmountMinor !== undefined && existing.paidAmountMinor > 0) {
      paidAmountMinor = existing.paidAmountMinor;
    } else if (existing?.isPaid) {
      paidAmountMinor = adjustedExpectedMinor;
    }

    const isDueToday = dueDateObj.isSame(today, 'day');
    const isOverdue = dueDateObj.isBefore(today, 'day');

    let status: 'overdue' | 'due_today' | 'pending' | 'completed' | 'partially_paid' = 'pending';
    let isPaid = false;
    let isPartiallyPaid = false;
    let deficitMinor = 0;
    let priorityScore = 3; // default pending

    if (paidAmountMinor > 0) {
      if (paidAmountMinor < adjustedExpectedMinor) {
        // UNDERPAYMENT (Partial Payment):
        // Credit exact cash received. Flag as Partially Paid.
        // Roll deficit over to subsequent monthly installments!
        isPartiallyPaid = true;
        isPaid = false;
        status = 'partially_paid';
        priorityScore = 1;
        deficitMinor = adjustedExpectedMinor - paidAmountMinor;
        carriedDeficitMinor += deficitMinor;
      } else if (paidAmountMinor === adjustedExpectedMinor) {
        // EXACT PAYMENT
        isPaid = true;
        isPartiallyPaid = false;
        status = 'completed';
        priorityScore = 4;
        deficitMinor = 0;
      } else {
        // OVERPAYMENT (Surplus / Pre-payment):
        // Credit exact cash received. Flag as Paid.
        // Apply surplus directly against future scheduled installments!
        isPaid = true;
        isPartiallyPaid = false;
        status = 'completed';
        priorityScore = 4;
        deficitMinor = 0;
        const surplusMinor = paidAmountMinor - adjustedExpectedMinor;
        carriedSurplusMinor += surplusMinor;
      }
    } else {
      // No direct payment on this installment sequence
      if (adjustedExpectedMinor === 0 && (surplusAppliedMinor > 0 || currentBalanceMinor <= 0)) {
        // Wiped out / paid in full via prior surplus credit or full payoff!
        isPaid = true;
        status = 'completed';
        priorityScore = 4;
        paidAt = paidAt || dayjs().toISOString();
        notes = notes || 'Paid in full via pre-payment surplus credit';
      } else if (plan.status === 'completed' || currentBalanceMinor <= 0) {
        isPaid = true;
        status = 'completed';
        priorityScore = 4;
      } else if (isOverdue) {
        status = 'overdue';
        priorityScore = 0;
      } else if (isDueToday) {
        status = 'due_today';
        priorityScore = 2;
      } else {
        status = 'pending';
        priorityScore = 3;
      }
    }

    accumulatedCreditedMinor += (isPaid ? Math.max(paidAmountMinor, adjustedExpectedMinor) : paidAmountMinor);
    const rowRemainingBalanceMinor = Math.max(0, totalScheduledMinor - accumulatedCreditedMinor);

    rows.push({
      id: existing?.id || `${plan.id}-inst-${i}`,
      sequence: i,
      ordinal: getOrdinal(i),
      dueDate: dueDateStr,
      dueDateFormatted,
      installmentMinor: adjustedExpectedMinor,
      installmentGHS: adjustedExpectedMinor / 100,
      accumulatedMinor: accumulatedCreditedMinor,
      accumulatedGHS: accumulatedCreditedMinor / 100,
      remainingBalanceMinor: i === numMonths ? 0 : rowRemainingBalanceMinor,
      remainingBalanceGHS: i === numMonths ? 0 : rowRemainingBalanceMinor / 100,
      isPaid,
      paidAt,
      paymentMethod,
      reference,
      notes,
      status,
      isOverdue: !isPaid && !isPartiallyPaid && isOverdue,
      isDueToday: !isPaid && !isPartiallyPaid && isDueToday,
      priorityScore,
      originalExpectedMinor,
      originalExpectedGHS: originalExpectedMinor / 100,
      paidMinor: paidAmountMinor,
      paidGHS: paidAmountMinor / 100,
      deficitMinor,
      deficitGHS: deficitMinor / 100,
      surplusAppliedMinor,
      surplusAppliedGHS: surplusAppliedMinor / 100,
      deficitCarriedMinor,
      deficitCarriedGHS: deficitCarriedMinor / 100,
      isPartiallyPaid,
    });
  }

  const firstDueDate = rows[0]?.dueDateFormatted || startDate.format('D MMM YYYY');
  const lastDueDate = rows[rows.length - 1]?.dueDateFormatted || startDate.add(numMonths - 1, 'month').format('D MMM YYYY');

  const agreementRemainingGHS = totalScheduledMinor / 100;
  const agreementTotalGHS = (totalAmountMinor || totalScheduledMinor) / 100;
  const numMonthsWord = numberToWord(numMonths);

  const agreementLeadText = `Both parties have agreed that the remaining amount of ₵${agreementRemainingGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} shall be paid in ${numMonthsWord} (${numMonths}) monthly installments starting from ${firstDueDate} and ending in ${lastDueDate}`;
  const agreementDueText = `Each monthly payment shall be due on or before the 1st day of every month, as detailed below:`;
  const planTitleText = `${numMonths}-MONTH PAYMENT PLAN (₵${agreementRemainingGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total)`;

  const overdueCount = rows.filter(r => r.isOverdue).length;
  const pendingCount = rows.filter(r => !r.isPaid && !r.isPartiallyPaid).length;
  const paidCount = rows.filter(r => r.isPaid).length;
  const partiallyPaidCount = rows.filter(r => r.isPartiallyPaid).length;

  const nextActiveInstallment = rows.find(r => !r.isPaid) || rows[rows.length - 1];

  return {
    planId: plan.id,
    numMonths,
    totalAmountMinor,
    totalScheduledMinor,
    downPaymentMinor,
    currentBalanceMinor,
    currentBalanceGHS: currentBalanceMinor / 100,
    totalPaidMinor,
    totalPaidGHS: totalPaidMinor / 100,
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
    partiallyPaidCount,
    nextActiveInstallment,
  };
}
