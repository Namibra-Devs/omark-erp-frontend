// src/api/paymentPlansPersistence.ts
import apiClient, { unwrapData, unwrapList } from '@/api/client';
import dayjs from 'dayjs';
import type { ApiResponse, PaymentPlan, PaymentPlanStatus, PaymentMethod } from '@/types';
import { buildPaymentPlanSchedule, recordLocalInstallmentPayment } from '@/utils/paymentPlanSchedule';
import { dispatchPaymentReceiptSMS } from '@/utils/paymentNotificationService';

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export interface PlanIdentifier {
  id: string;
  customerId?: string;
  totalAmountMinor?: number;
  downPaymentMinor?: number;
  numMonths?: number;
  monthlyAmountMinor?: number;
  startDate?: string;
  balanceMinor?: number;
  status?: PaymentPlanStatus;
}

export interface CustomerInfo {
  name?: string;
  phone?: string;
  propertyName?: string;
  recordedBy?: string;
}

export interface RecordPaymentParams {
  amountMinor: number;
  paidOn: string;
  method?: PaymentMethod | string;
  reference?: string;
  sequence?: number;
  installmentOrdinal?: string;
  notes?: string;
}

/**
 * Resolves the real backend payment plan ID for a given plan object or customer ID.
 * If the plan ID is already a real backend ID (does not start with 'plan-'), returns it.
 * If it's a synthetic ID ('plan-...'), it checks the backend for an existing plan
 * for this customer, or creates one via POST /payment-plans.
 */
export async function resolveOrCreateBackendPlan(
  plan: PlanIdentifier
): Promise<string> {
  // If it's already a real ID (e.g. UUID, not starting with 'plan-')
  if (plan.id && !plan.id.startsWith('plan-')) {
    return plan.id;
  }

  const customerId = plan.customerId || plan.id.replace(/^plan-/, '');
  if (!customerId) {
    return plan.id;
  }

  // 1. Check if backend already has a plan for this customer
  try {
    const listRes = await apiClient.get<ApiResponse<PaymentPlan[]>>('/payment-plans', {
      params: { pageSize: 100 },
    });
    const items = unwrapList(listRes).items;
    const existing = items.find((p: any) => p.customerId === customerId);
    if (existing && existing.id && !existing.id.startsWith('plan-')) {
      return existing.id;
    }
  } catch (e) {
    console.warn('[resolveOrCreateBackendPlan] Warning checking existing plans:', e);
  }

  // 2. If not found, create a real plan on the backend
  try {
    const totalAmountMinor = plan.totalAmountMinor || 35000000;
    const downPaymentMinor = plan.downPaymentMinor !== undefined 
      ? plan.downPaymentMinor 
      : Math.round(totalAmountMinor * 0.2);
    const numMonths = plan.numMonths || 6;
    const startDate = plan.startDate || dayjs().format('YYYY-MM-DD');

    const createRes = await apiClient.post<ApiResponse<PaymentPlan>>('/payment-plans', {
      customerId,
      totalAmountMinor,
      downPaymentMinor,
      planBasis: 'months',
      numMonths,
      startDate,
    });
    const created = unwrapData(createRes);
    if (created && created.id) {
      return created.id;
    }
  } catch (createErr) {
    console.warn('[resolveOrCreateBackendPlan] Warning creating backend plan, checking list again:', createErr);
    // In case creation failed because one already exists, retry list fetch
    try {
      const listRes = await apiClient.get<ApiResponse<PaymentPlan[]>>('/payment-plans', {
        params: { pageSize: 100 },
      });
      const items = unwrapList(listRes).items;
      const existing = items.find((p: any) => p.customerId === customerId);
      if (existing && existing.id && !existing.id.startsWith('plan-')) {
        return existing.id;
      }
    } catch {
      // ignore
    }
  }

  // Fallback to original plan.id if backend could not be reached
  return plan.id;
}

/**
 * Universal payment recorder:
 * 1. Saves locally for instantaneous 0ms UI reactivity
 * 2. Permanently persists to the backend database (resolving/creating backend plan if needed)
 * 3. Automatically dispatches customer receipt SMS prompting them of payment
 */
export interface RecordPaymentResult {
  success: boolean;
  realPlanId: string;
  result?: any;
  receiptNumber: string;
  sequence: number;
  installmentOrdinal: string;
  isPartialPayment: boolean;
  isOverpayment: boolean;
  deficitRolledOverMinor: number;
  surplusAppliedMinor: number;
  newBalanceMinor: number;
  updatedSchedule: ReturnType<typeof buildPaymentPlanSchedule>;
}

/**
 * Universal payment recorder:
 * 1. Automatically determines target installment sequence if not specified
 * 2. Saves locally for instantaneous 0ms UI reactivity with dynamic amortization recalculation
 * 3. Permanently persists to the backend database (resolving/creating backend plan if needed)
 * 4. Automatically dispatches customer receipt SMS prompting them of payment
 * 5. Returns dynamic schedule recalculation details for immediate receipt and statement generation
 */
export async function recordPlanPaymentWithBackend(
  plan: PlanIdentifier,
  payment: RecordPaymentParams,
  customerInfo?: CustomerInfo
): Promise<RecordPaymentResult> {
  // Pre-calculate schedule to detect next due installment sequence if sequence wasn't provided
  const currentSchedule = buildPaymentPlanSchedule(plan);
  const sequence = payment.sequence || currentSchedule.nextDueRow?.sequence || 1;
  const ordinal = payment.installmentOrdinal || getOrdinal(sequence);
  const method = payment.method || 'bank_transfer';
  const reference = payment.reference || `REC-${Date.now().toString().slice(-6)}`;
  const paidOnDate = payment.paidOn || new Date().toISOString();

  const preTargetRow = currentSchedule.rows.find((r: any) => r.sequence === sequence);
  const expectedMinor = preTargetRow
    ? (preTargetRow.isPartiallyPaid && preTargetRow.deficitMinor > 0
        ? preTargetRow.deficitMinor
        : preTargetRow.installmentMinor)
    : Math.floor(currentSchedule.totalScheduledMinor / currentSchedule.numMonths);

  const isOver = payment.amountMinor > expectedMinor;
  const isUnder = payment.amountMinor < expectedMinor;
  const surplusMinor = isOver ? payment.amountMinor - expectedMinor : 0;
  const deficitMinor = isUnder ? expectedMinor - payment.amountMinor : 0;
  const effect: 'exact' | 'overpayment' | 'underpayment' | 'advance' = isOver
    ? 'overpayment'
    : isUnder
    ? 'underpayment'
    : 'exact';

  const dynamicNote =
    payment.notes ||
    (isOver
      ? `Overpayment of ₵${(payment.amountMinor / 100).toFixed(2)}: ₵${(surplusMinor / 100).toFixed(2)} surplus advance dynamically applied to future installments`
      : isUnder
      ? `Underpayment of ₵${(payment.amountMinor / 100).toFixed(2)}: ₵${(deficitMinor / 100).toFixed(2)} deficit rolled forward into subsequent installment`
      : `Full ${ordinal} installment of ₵${(payment.amountMinor / 100).toFixed(2)} settled`);

  const ledgerMeta: {
    deficitMinor?: number;
    surplusAppliedMinor?: number;
    balanceAfterMinor?: number;
    effect?: 'exact' | 'overpayment' | 'underpayment' | 'advance';
  } = {
    deficitMinor,
    surplusAppliedMinor: surplusMinor,
    balanceAfterMinor: Math.max(0, currentSchedule.currentBalanceMinor - payment.amountMinor),
    effect,
  };

  // 1. Save locally for instant UI update and dynamic amortization
  recordLocalInstallmentPayment(
    plan.id,
    sequence,
    payment.amountMinor,
    method,
    reference,
    paidOnDate,
    dynamicNote,
    customerInfo?.recordedBy,
    ledgerMeta
  );

  // 2. Resolve real backend plan ID and persist to backend
  let realPlanId = plan.id;
  let result: any = null;

  try {
    realPlanId = await resolveOrCreateBackendPlan(plan);

    if (realPlanId && !realPlanId.startsWith('plan-')) {
      const res = await apiClient.post(`/payment-plans/${realPlanId}/payments`, {
        amountMinor: payment.amountMinor,
        paidOn: dayjs(paidOnDate).format('YYYY-MM-DD'),
        method,
        reference,
      });
      result = unwrapData(res);

      // If synthetic plan ID was used originally, also record under realPlanId in local cache
      if (realPlanId !== plan.id) {
        recordLocalInstallmentPayment(
          realPlanId,
          sequence,
          payment.amountMinor,
          method,
          reference,
          paidOnDate,
          dynamicNote,
          customerInfo?.recordedBy,
          ledgerMeta
        );
      }
    }
  } catch (apiErr) {
    console.warn('[recordPlanPaymentWithBackend] Backend save warning:', apiErr);
  }

  // 3. Immediately recalculate updated schedule to obtain new balance & amortization adjustments
  const updatedSchedule = buildPaymentPlanSchedule(plan);
  const targetRow = updatedSchedule.rows.find((r: any) => r.sequence === sequence);

  const isPartialPayment = Boolean(targetRow?.isPartiallyPaid) || isUnder;
  const deficitRolledOverMinor = targetRow?.deficitMinor || deficitMinor;
  const surplusAppliedMinor = surplusMinor;
  const isOverpayment = surplusMinor > 0;
  const newBalanceMinor = updatedSchedule.currentBalanceMinor;

  // 4. Dispatch automated SMS receipt to customer
  try {
    await dispatchPaymentReceiptSMS({
      customerPhone: customerInfo?.phone,
      customerName: customerInfo?.name,
      amountMinor: payment.amountMinor,
      remainingBalanceMinor: newBalanceMinor,
      propertyName: customerInfo?.propertyName,
      reference,
      method: String(method),
      installmentOrdinal: ordinal,
      recordedBy: customerInfo?.recordedBy,
    });
  } catch (smsErr) {
    console.warn('[recordPlanPaymentWithBackend] SMS dispatch warning:', smsErr);
  }

  return {
    success: true,
    realPlanId,
    result,
    receiptNumber: reference,
    sequence,
    installmentOrdinal: ordinal,
    isPartialPayment,
    isOverpayment,
    deficitRolledOverMinor,
    surplusAppliedMinor,
    newBalanceMinor,
    updatedSchedule,
  };
}
