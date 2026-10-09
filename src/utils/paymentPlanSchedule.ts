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
  baseInstallmentMinor: number;
  baseInstallmentGHS: number;
  installmentMinor: number; // Adjusted expected amount for this month
  installmentGHS: number;
  paidAmountMinor: number; // Actual cash credited to this installment
  paidAmountGHS: number;
  deficitMinor: number; // Deficit rolled over to future installments
  deficitGHS: number;
  surplusAppliedMinor: number; // Surplus credited from previous overpayments
  surplusAppliedGHS: number;
  accumulatedMinor: number;
  accumulatedGHS: number;
  remainingBalanceMinor: number;
  remainingBalanceGHS: number;
  isPaid: boolean;
  isPartiallyPaid: boolean;
  paidAt?: string;
  paymentMethod?: string;
  reference?: string;
  status: 'overdue' | 'due_today' | 'pending' | 'partially_paid' | 'completed';
  statusLabel: 'Paid' | 'Partially Paid' | 'Overdue' | 'Due Today' | 'Upcoming';
  isOverdue: boolean;
  isDueToday: boolean;
  priorityScore: number; // 0 for overdue, 1 for due_today, 2 for partially_paid, 3 for pending, 4 for completed
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
  nextDueRow?: ScheduleInstallmentRow;
  agreementLeadText: string;
  agreementDueText: string;
  planTitleText: string;
  hasOverdue: boolean;
  overdueCount: number;
  pendingCount: number;
  partiallyPaidCount: number;
  paidCount: number;
  overpaymentCreditMinor: number;
  overpaymentCreditGHS: number;
  carriedDeficitMinor: number;
  carriedDeficitGHS: number;
  transactions: PlanPaymentTransaction[];
}

export interface PlanPaymentTransaction {
  id: string;
  sequence?: number;
  amountMinor: number;
  paidOn: string;
  method: PaymentMethod | string;
  reference?: string;
  notes?: string;
  recordedBy?: string;
  deficitMinor?: number;
  surplusAppliedMinor?: number;
  balanceAfterMinor?: number;
  effect?: 'overpayment' | 'underpayment' | 'exact' | 'advance';
}

export interface LocalPlanOverride {
  paidInstallments: Record<
    number,
    {
      paidAt: string;
      amountMinor: number;
      method?: PaymentMethod | string;
      reference?: string;
      notes?: string;
    }
  >;
  transactions?: PlanPaymentTransaction[];
  balanceMinor?: number;
  updatedAt: string;
}

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

import {
  getStoredPaymentOverrides,
  saveStoredPaymentOverrides,
  OVERRIDES_STORAGE_KEY,
  SCHEDULE_CHANGE_EVENT,
} from '@/utils/paymentPlansStorage';

export { OVERRIDES_STORAGE_KEY, SCHEDULE_CHANGE_EVENT };

export const getPlanPaymentOverrides = (planId: string): LocalPlanOverride | undefined => {
  return getStoredPaymentOverrides()[planId];
};

/**
 * Records an installment payment locally with dynamic ledger logging so UI updates reactively and persists
 */
export const recordLocalInstallmentPayment = (
  planId: string,
  sequence: number,
  amountMinor: number,
  method?: PaymentMethod | string,
  reference?: string,
  paidOn?: string,
  notes?: string,
  recordedBy?: string,
  meta?: {
    deficitMinor?: number;
    surplusAppliedMinor?: number;
    balanceAfterMinor?: number;
    effect?: 'overpayment' | 'underpayment' | 'exact' | 'advance';
  }
): void => {
  const map = getStoredPaymentOverrides();
  const existing = map[planId] || { paidInstallments: {}, transactions: [], updatedAt: new Date().toISOString() };

  if (!existing.transactions) {
    existing.transactions = [];
  }

  // Accumulate or record payment for this sequence
  const currentSeqPayment = existing.paidInstallments[sequence];
  const newAmount = (currentSeqPayment?.amountMinor || 0) + amountMinor;

  existing.paidInstallments[sequence] = {
    paidAt: paidOn || new Date().toISOString(),
    amountMinor: newAmount,
    method: method || 'bank_transfer',
    reference: reference || `PAY-INST-${sequence}-${Date.now().toString().slice(-4)}`,
    notes,
  };

  existing.transactions.push({
    id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    sequence,
    amountMinor,
    paidOn: paidOn || new Date().toISOString(),
    method: method || 'bank_transfer',
    reference: reference || `REC-${Date.now().toString().slice(-6)}`,
    notes,
    recordedBy,
    deficitMinor: meta?.deficitMinor,
    surplusAppliedMinor: meta?.surplusAppliedMinor,
    balanceAfterMinor: meta?.balanceAfterMinor,
    effect: meta?.effect,
  });

  existing.updatedAt = new Date().toISOString();
  map[planId] = existing;
  saveStoredPaymentOverrides(map);
};

/**
 * React hook to re-render when payment plan overrides change
 */
export const usePaymentPlanScheduleListener = () => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener(SCHEDULE_CHANGE_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(SCHEDULE_CHANGE_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);
};

/**
 * Builds the official Payment Plan Schedule with dynamic amortization:
 * - Dynamic balance adjustment for partial payments (deficit automatically rolls over into subsequent installments)
 * - Dynamic amortization for overpayments (surplus automatically credits and reduces future scheduled installments)
 * - Accurate real-time total outstanding balance calculation
 */
export function buildPaymentPlanSchedule(
  plan: Partial<PaymentPlan> & { id: string },
  apiInstallments: Installment[] = [],
  apiPaymentsArg: any[] = []
): PaymentPlanScheduleInfo {
  const overrides = getPlanPaymentOverrides(plan.id);
  const numMonths = Math.max(plan.numMonths || 6, 1);

  // Normalize API payments from arguments or embedded in plan
  const rawApiPayments: any[] = [
    ...(Array.isArray(apiPaymentsArg) ? apiPaymentsArg : []),
    ...((plan as any)?.recentPayments || []),
    ...((plan as any)?.payments || []),
  ];
  const apiPayments: any[] = [];
  const seenRawRefs = new Set<string>();
  rawApiPayments.forEach((p, idx) => {
    if (!p || typeof p !== 'object') return;
    const key = p.reference ? `ref:${p.reference}` : p.id ? `id:${p.id}` : `idx:${idx}`;
    if (!seenRawRefs.has(key)) {
      seenRawRefs.add(key);
      apiPayments.push(p);
    }
  });

  // Total contract liability to be settled in installments:
  // In real estate agreements, this is totalAmount minus downPayment, or the initial balance
  const downPaymentMinor = plan.downPaymentMinor || 0;
  const totalAmountMinor = plan.totalAmountMinor || 0;

  let totalScheduledMinor =
    totalAmountMinor > downPaymentMinor
      ? totalAmountMinor - downPaymentMinor
      : (plan.balanceMinor || totalAmountMinor || 35000000);

  if (totalScheduledMinor <= 0) {
    totalScheduledMinor = plan.balanceMinor || 35000000;
  }

  // Calculate server-verified paid amounts
  const backendPaidAmountMinor =
    plan.balanceMinor !== undefined && plan.balanceMinor >= 0
      ? Math.max(0, totalScheduledMinor - plan.balanceMinor)
      : 0;
  const apiPaymentsSumMinor = apiPayments.reduce((s, p) => s + (p.amountMinor || 0), 0);
  const knownServerPaidMinor = Math.max(backendPaidAmountMinor, apiPaymentsSumMinor);

  // Base start date
  const rawStart = plan.startDate ? dayjs(plan.startDate) : dayjs();
  const startDate = rawStart.isValid() ? rawStart : dayjs();

  // If API provided installments, use them; otherwise generate synthetic installments
  const sortedApi = [...apiInstallments].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  // Base monthly amount rounded to pesewas/cents
  const baseMonthlyMinor = Math.floor(totalScheduledMinor / numMonths);
  let runningRemainderMinor = totalScheduledMinor;

  const today = dayjs().startOf('day');

  // Total payments tracked across plan
  const planIsFullyCompleted = plan.status === 'completed' || (plan.balanceMinor !== undefined && plan.balanceMinor <= 0);

  // Rolling amortization trackers:
  let carriedSurplusMinor = 0;
  let carriedDeficitMinor = 0;
  let totalCashPaidMinor = 0;
  const rows: ScheduleInstallmentRow[] = [];

  for (let i = 1; i <= numMonths; i++) {
    const existing = sortedApi.find((item) => item.sequence === i);
    const localPayment = overrides?.paidInstallments?.[i];
    const seqApiPayment = apiPayments.find((p) => p.sequence === i);

    // Determine baseline expected amount for this month
    let baseInstallmentMinor = existing?.expectedAmountMinor ?? 0;
    if (!baseInstallmentMinor || baseInstallmentMinor <= 0) {
      if (i === numMonths) {
        baseInstallmentMinor = runningRemainderMinor;
      } else {
        baseInstallmentMinor = baseMonthlyMinor;
      }
    }
    runningRemainderMinor -= baseInstallmentMinor;

    // Apply rolling surplus or deficit from prior months:
    let surplusAppliedMinor = 0;
    let adjustedExpectedMinor = baseInstallmentMinor + carriedDeficitMinor;

    if (carriedSurplusMinor > 0) {
      if (carriedSurplusMinor >= adjustedExpectedMinor) {
        surplusAppliedMinor = adjustedExpectedMinor;
        carriedSurplusMinor -= adjustedExpectedMinor;
        adjustedExpectedMinor = 0;
      } else {
        surplusAppliedMinor = carriedSurplusMinor;
        adjustedExpectedMinor -= carriedSurplusMinor;
        carriedSurplusMinor = 0;
      }
    }
    // Deficit was absorbed into adjustedExpectedMinor, so reset carried deficit
    carriedDeficitMinor = 0;

    // Determine actual cash paid for this installment:
    let paidAmountMinor = 0;
    const matchedMethod = localPayment?.method || seqApiPayment?.method;
    const matchedRef = localPayment?.reference || seqApiPayment?.reference;
    const matchedPaidAt = localPayment?.paidAt || seqApiPayment?.paidOn || existing?.paidAt;

    if (localPayment?.amountMinor && localPayment.amountMinor > 0) {
      paidAmountMinor = localPayment.amountMinor;
    } else if (seqApiPayment?.amountMinor && seqApiPayment.amountMinor > 0) {
      paidAmountMinor = seqApiPayment.amountMinor;
    } else if (existing?.isPaid) {
      paidAmountMinor = (existing as any).actualAmountMinor || existing.expectedAmountMinor || baseInstallmentMinor;
    } else if (planIsFullyCompleted) {
      paidAmountMinor = baseInstallmentMinor;
    } else if (knownServerPaidMinor > totalCashPaidMinor) {
      // Credit portion of server-verified paid funds to this installment in sequence
      const remainingVerifiedMinor = knownServerPaidMinor - totalCashPaidMinor;
      paidAmountMinor = Math.min(adjustedExpectedMinor, remainingVerifiedMinor);
    }

    totalCashPaidMinor += paidAmountMinor;

    // Compute due date
    let dueDateObj = existing?.dueDate ? dayjs(existing.dueDate) : startDate.add(i - 1, 'month');
    if (!existing?.dueDate) {
      dueDateObj = startDate.add(i - 1, 'month').endOf('month');
    }
    const dueDateStr = dueDateObj.format('YYYY-MM-DD');
    const dueDateFormatted = dueDateObj.format('D MMM YYYY');

    // Dynamic Amortization Evaluation:
    let isPaid = false;
    let isPartiallyPaid = false;
    let deficitMinor = 0;
    let status: 'overdue' | 'due_today' | 'pending' | 'partially_paid' | 'completed' = 'pending';
    let statusLabel: 'Paid' | 'Partially Paid' | 'Overdue' | 'Due Today' | 'Upcoming' = 'Upcoming';
    let priorityScore = 3;

    if (paidAmountMinor > 0) {
      if (paidAmountMinor >= adjustedExpectedMinor) {
        // Full payment or Overpayment
        isPaid = true;
        const surplus = paidAmountMinor - adjustedExpectedMinor;
        if (surplus > 0) {
          // Carry surplus over to reduce upcoming future installments!
          carriedSurplusMinor += surplus;
        }
        status = 'completed';
        statusLabel = 'Paid';
        priorityScore = 4;
      } else {
        // Underpayment (Partial Payment)
        isPartiallyPaid = true;
        deficitMinor = adjustedExpectedMinor - paidAmountMinor;
        // Automatically roll unpaid deficit into subsequent monthly installments!
        carriedDeficitMinor += deficitMinor;
        status = 'partially_paid';
        statusLabel = 'Partially Paid';
        priorityScore = 2;
      }
    } else {
      // 0 cash paid directly this month
      if (adjustedExpectedMinor === 0 && surplusAppliedMinor > 0) {
        // Fully covered by prior overpayment / surplus!
        isPaid = true;
        status = 'completed';
        statusLabel = 'Paid';
        priorityScore = 4;
      } else {
        // Unpaid
        const isDueToday = dueDateObj.isSame(today, 'day');
        const isOverdue = dueDateObj.isBefore(today, 'day');

        if (isOverdue) {
          status = 'overdue';
          statusLabel = 'Overdue';
          priorityScore = 0; // Highest collection priority
        } else if (isDueToday) {
          status = 'due_today';
          statusLabel = 'Due Today';
          priorityScore = 1;
        } else {
          status = 'pending';
          statusLabel = 'Upcoming';
          priorityScore = 3;
        }
      }
    }

    // Remaining total plan balance after this month's payments
    const remainingBalanceMinor = Math.max(0, totalScheduledMinor - totalCashPaidMinor);

    const paidAt =
      matchedPaidAt ||
      existing?.paidAt ||
      (isPaid ? plan.updatedAt || plan.startDate || dueDateStr : undefined);
    const paymentMethod = matchedMethod || (isPaid ? 'bank_transfer' : undefined);
    const reference = matchedRef || (isPaid ? `REC-${i}` : undefined);

    rows.push({
      id: existing?.id || `${plan.id}-inst-${i}`,
      sequence: i,
      ordinal: getOrdinal(i),
      dueDate: dueDateStr,
      dueDateFormatted,
      baseInstallmentMinor,
      baseInstallmentGHS: baseInstallmentMinor / 100,
      installmentMinor: adjustedExpectedMinor,
      installmentGHS: adjustedExpectedMinor / 100,
      paidAmountMinor,
      paidAmountGHS: paidAmountMinor / 100,
      deficitMinor,
      deficitGHS: deficitMinor / 100,
      surplusAppliedMinor,
      surplusAppliedGHS: surplusAppliedMinor / 100,
      accumulatedMinor: totalCashPaidMinor,
      accumulatedGHS: totalCashPaidMinor / 100,
      remainingBalanceMinor,
      remainingBalanceGHS: remainingBalanceMinor / 100,
      isPaid,
      isPartiallyPaid,
      paidAt,
      paymentMethod,
      reference,
      status,
      statusLabel,
      isOverdue: status === 'overdue',
      isDueToday: status === 'due_today',
      priorityScore,
    });
  }

  // Calculate current outstanding balance with server balance priority
  const localOverridesTotalMinor = Object.values(overrides?.paidInstallments || {}).reduce(
    (sum: number, inst: any) => sum + (inst.amountMinor || 0),
    0
  );
  const unsyncedLocalMinor = Math.max(0, localOverridesTotalMinor - backendPaidAmountMinor);

  let currentBalanceMinor = Math.max(0, totalScheduledMinor - totalCashPaidMinor);
  if (plan.balanceMinor !== undefined) {
    const backendRemaining = Math.max(0, plan.balanceMinor - unsyncedLocalMinor);
    // Never allow balance to exceed backend remaining if backend is lower
    currentBalanceMinor = Math.min(currentBalanceMinor, backendRemaining);
  }

  const firstDueDate = rows[0]?.dueDateFormatted || startDate.format('D MMM YYYY');
  const lastDueDate =
    rows[rows.length - 1]?.dueDateFormatted ||
    startDate.add(numMonths - 1, 'month').format('D MMM YYYY');

  const agreementRemainingGHS = totalScheduledMinor / 100;
  const agreementTotalGHS = (totalAmountMinor || totalScheduledMinor) / 100;
  const numMonthsWord = numberToWord(numMonths);

  const agreementLeadText = `Both parties have agreed that the remaining amount of ₵${agreementRemainingGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} shall be paid in ${numMonthsWord} (${numMonths}) monthly installments starting from ${firstDueDate} and ending in ${lastDueDate}`;
  const agreementDueText = `Each monthly payment shall be due on or before the specified due date, with dynamic balance adjustments applied for partial payments or surplus pre-payments:`;
  const planTitleText = `${numMonths}-MONTH PAYMENT PLAN (₵${agreementRemainingGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total)`;

  const overdueCount = rows.filter((r) => r.status === 'overdue').length;
  const partiallyPaidCount = rows.filter((r) => r.status === 'partially_paid').length;
  const pendingCount = rows.filter((r) => r.status === 'pending' || r.status === 'due_today' || r.status === 'overdue').length;
  const paidCount = rows.filter((r) => r.isPaid).length;

  // Find next upcoming / unpaid / partially paid installment
  const nextDueRow = rows.find((r) => !r.isPaid);

  // Real-time ledger compilation: combine API payments, local overrides, and confirmed installments
  const rawTransactions = overrides?.transactions || [];
  const transactions: PlanPaymentTransaction[] = [];
  const seenTxRefs = new Set<string>();

  // 1. Add API payments from backend database
  apiPayments.forEach((p, idx) => {
    const ref = p.reference || `REC-${(p.id || String(idx)).slice(-6)}`;
    const txId = p.id || `api-tx-${idx}`;
    if (ref) seenTxRefs.add(ref);
    if (p.id) seenTxRefs.add(p.id);

    transactions.push({
      id: txId,
      sequence: p.sequence,
      amountMinor: p.amountMinor,
      paidOn: p.paidOn || p.createdAt || new Date().toISOString(),
      method: p.method || 'bank_transfer',
      reference: ref,
      notes: p.notes || 'Recorded server payment',
      recordedBy: p.recordedByUserId || p.recordedBy,
      deficitMinor: 0,
      surplusAppliedMinor: 0,
      balanceAfterMinor: p.balanceMinor,
      effect: 'exact',
    });
  });

  // 2. Add local overrides transactions (if not already represented)
  rawTransactions.forEach((t) => {
    if (t.reference && seenTxRefs.has(t.reference)) return;
    if (t.id && seenTxRefs.has(t.id)) return;
    if (t.reference) seenTxRefs.add(t.reference);
    if (t.id) seenTxRefs.add(t.id);
    transactions.push(t);
  });

  // 3. Synthesize ledger records from confirmed/paid rows if not already represented
  rows.forEach((row) => {
    if (row.isPaid || row.paidAmountMinor > 0) {
      const alreadyCovered = transactions.some(
        (t) => (t.sequence === row.sequence) || (row.reference && t.reference === row.reference)
      );
      if (!alreadyCovered) {
        transactions.push({
          id: `seed-tx-${plan.id}-${row.sequence}`,
          sequence: row.sequence,
          amountMinor: row.paidAmountMinor || row.baseInstallmentMinor,
          paidOn: row.paidAt || row.dueDate,
          method: row.paymentMethod || 'bank_transfer',
          reference: row.reference || `REC-INST-${row.sequence}`,
          notes: `${row.ordinal} installment settled`,
          deficitMinor: row.deficitMinor,
          surplusAppliedMinor: row.surplusAppliedMinor,
          balanceAfterMinor: row.remainingBalanceMinor,
          effect: row.surplusAppliedMinor > 0 ? 'overpayment' : row.deficitMinor > 0 ? 'underpayment' : 'exact',
        });
      }
    }
  });

  // Sort transactions latest first
  transactions.sort((a, b) => dayjs(b.paidOn).valueOf() - dayjs(a.paidOn).valueOf());

  const overpaymentCreditMinor = Math.max(0, carriedSurplusMinor);

  return {
    planId: plan.id,
    numMonths,
    totalAmountMinor,
    totalScheduledMinor,
    downPaymentMinor,
    currentBalanceMinor,
    currentBalanceGHS: currentBalanceMinor / 100,
    totalPaidMinor: totalCashPaidMinor,
    totalPaidGHS: totalCashPaidMinor / 100,
    startDate: startDate.format('YYYY-MM-DD'),
    startDateFormatted: firstDueDate,
    endDate: rows[rows.length - 1]?.dueDate || startDate.add(numMonths - 1, 'month').format('YYYY-MM-DD'),
    endDateFormatted: lastDueDate,
    agreementRemainingGHS,
    agreementTotalGHS,
    rows,
    nextDueRow,
    agreementLeadText,
    agreementDueText,
    planTitleText,
    hasOverdue: overdueCount > 0,
    overdueCount,
    pendingCount,
    partiallyPaidCount,
    paidCount,
    overpaymentCreditMinor,
    overpaymentCreditGHS: overpaymentCreditMinor / 100,
    carriedDeficitMinor,
    carriedDeficitGHS: carriedDeficitMinor / 100,
    transactions,
  };
}
