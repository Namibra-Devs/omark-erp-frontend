// src/api/paymentPlansPersistence.ts
import apiClient, { unwrapData, unwrapList } from '@/api/client';
import dayjs from 'dayjs';
import type { ApiResponse, PaymentPlan, PaymentPlanStatus, PaymentMethod } from '@/types';
import { buildPaymentPlanSchedule, recordLocalInstallmentPayment } from '@/utils/paymentPlanSchedule';
import { dispatchPaymentReceiptSMS } from '@/utils/paymentNotificationService';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * Resolves the real backend payment plan UUID for a given plan object or customer ID.
 * If the plan ID is already a valid UUID, returns it.
 * If it's a synthetic ID ('plan-...'), it checks the backend for an existing plan
 * for this customer, or creates one via POST /payment-plans.
 */
export async function resolveOrCreateBackendPlan(
  plan: PlanIdentifier
): Promise<string> {
  // If it's already a real UUID
  if (plan.id && UUID_REGEX.test(plan.id)) {
    return plan.id;
  }

  const customerId = plan.customerId || (plan.id.startsWith('plan-') ? plan.id.replace(/^plan-/, '') : plan.id);
  if (!customerId) {
    return plan.id;
  }

  // 1. Check customer detail endpoint directly (returns customer.plan or paymentPlan)
  try {
    const custRes = await apiClient.get<ApiResponse<any>>(`/customers/${customerId}`);
    const custData = unwrapData(custRes) || (custRes?.data as any)?.data || custRes?.data;
    const planCandidate =
      custData?.plan?.id ||
      custData?.paymentPlan?.id ||
      (typeof custData?.plan === 'string' ? custData.plan : undefined) ||
      custData?.planId ||
      custData?.paymentPlanId;
    if (planCandidate && UUID_REGEX.test(planCandidate)) {
      return planCandidate;
    }
  } catch (custErr) {
    console.warn('[resolveOrCreateBackendPlan] Warning fetching customer detail:', custErr);
  }

  // 2. Check if backend already has a plan for this customer in list (using safe pageSize: 100)
  try {
    const listRes = await apiClient.get<ApiResponse<PaymentPlan[]>>('/payment-plans', {
      params: { pageSize: 100 },
    });
    const listData = unwrapList(listRes);
    const existing = listData.items.find((p: any) => p.customerId === customerId);
    if (existing?.id && UUID_REGEX.test(existing.id)) {
      return existing.id;
    }

    // If there are more pages in the list, search remaining pages (up to 5 pages)
    if (listData.totalPages > 1) {
      for (let p = 2; p <= Math.min(listData.totalPages, 5); p++) {
        try {
          const nextRes = await apiClient.get<ApiResponse<PaymentPlan[]>>('/payment-plans', {
            params: { page: p, pageSize: 100 },
          });
          const nextItems = unwrapList(nextRes).items;
          const match = nextItems.find((item: any) => item.customerId === customerId);
          if (match?.id && UUID_REGEX.test(match.id)) {
            return match.id;
          }
        } catch {}
      }
    }
  } catch (e) {
    console.warn('[resolveOrCreateBackendPlan] Warning checking existing plans:', e);
  }

  // 3. If not found, create a real plan on the backend database
  try {
    const totalAmountMinor = plan.totalAmountMinor || 35000000;
    const downPaymentMinor = plan.downPaymentMinor !== undefined 
      ? plan.downPaymentMinor 
      : Math.round(totalAmountMinor * 0.2);
    const numMonths = plan.numMonths || 6;
    const startDate = plan.startDate && dayjs(plan.startDate).isValid()
      ? dayjs(plan.startDate).format('YYYY-MM-DD')
      : dayjs().format('YYYY-MM-DD');

    const createRes = await apiClient.post<ApiResponse<PaymentPlan>>('/payment-plans', {
      customerId,
      totalAmountMinor,
      downPaymentMinor,
      planBasis: 'months',
      numMonths,
      startDate,
    });
    const created = unwrapData(createRes) || (createRes?.data as any)?.data || createRes?.data;
    if (created?.id && UUID_REGEX.test(created.id)) {
      return created.id;
    }
  } catch (createErr: any) {
    console.warn('[resolveOrCreateBackendPlan] Creation response:', createErr?.response?.data || createErr);
    // In case creation failed because one already exists, check error response or retry fetch with pageSize 100
    const errData = createErr?.response?.data;
    const errPlanId = errData?.plan?.id || errData?.data?.id || errData?.planId || errData?.id;
    if (errPlanId && UUID_REGEX.test(errPlanId)) {
      return errPlanId;
    }

    try {
      const listRes = await apiClient.get<ApiResponse<PaymentPlan[]>>('/payment-plans', {
        params: { pageSize: 100 },
      });
      const items = unwrapList(listRes).items;
      const existing = items.find((p: any) => p.customerId === customerId);
      if (existing?.id && UUID_REGEX.test(existing.id)) {
        return existing.id;
      }
    } catch {
      // ignore
    }
  }

  return plan.id;
}

export interface RecordPaymentResult {
  success: boolean;
  persistedToBackend: boolean;
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
 * 1. Resolves/creates real backend payment plan UUID
 * 2. Permanently persists payment to backend database (POST /payment-plans/{planId}/payments)
 *    Strictly throws error if backend reject, ensuring data is never silently dropped
 * 3. Saves locally for instantaneous 0ms UI reactivity with dynamic amortization recalculation
 * 4. Automatically dispatches customer receipt SMS prompting them of payment via contact number
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

  // 1. Resolve real backend plan ID and persist to backend database first
  const realPlanId = await resolveOrCreateBackendPlan(plan);
  const isRealBackendId = Boolean(realPlanId && UUID_REGEX.test(realPlanId));

  const validMethods: PaymentMethod[] = ['cash', 'bank_transfer', 'mobile_money', 'cheque', 'other'];
  const cleanMethod: PaymentMethod = validMethods.includes(method as any)
    ? (method as PaymentMethod)
    : 'bank_transfer';

  const formattedPaidOn = dayjs(paidOnDate).isValid()
    ? dayjs(paidOnDate).format('YYYY-MM-DD')
    : dayjs().format('YYYY-MM-DD');

  const cleanAmountMinor = Math.round(payment.amountMinor);
  const cleanRef = (reference || `REC-${Date.now().toString().slice(-6)}`).trim();

  // If plan is not linked to a verified backend UUID (e.g. offline or demo synthetic plan), record to local ledger & dispatch SMS
  if (!isRealBackendId) {
    console.warn(
      `[recordPlanPaymentWithBackend] Storing payment in local ledger for plan ${plan.id} (not a backend database UUID)`
    );

    recordLocalInstallmentPayment(
      plan.id,
      sequence,
      cleanAmountMinor,
      cleanMethod,
      cleanRef,
      paidOnDate,
      dynamicNote,
      customerInfo?.recordedBy,
      ledgerMeta
    );

    const updatedSchedule = buildPaymentPlanSchedule(plan);
    const targetRow = updatedSchedule.rows.find((r: any) => r.sequence === sequence);
    const isPartialPayment = Boolean(targetRow?.isPartiallyPaid) || isUnder;
    const deficitRolledOverMinor = targetRow?.deficitMinor || deficitMinor;
    const surplusAppliedMinor = surplusMinor;
    const isOverpayment = surplusMinor > 0;
    const newBalanceMinor = updatedSchedule.currentBalanceMinor;

    let targetPhone = customerInfo?.phone?.trim();
    let targetName = customerInfo?.name?.trim();

    try {
      await dispatchPaymentReceiptSMS({
        customerPhone: targetPhone,
        customerName: targetName,
        amountMinor: cleanAmountMinor,
        remainingBalanceMinor: newBalanceMinor,
        propertyName: customerInfo?.propertyName,
        reference: cleanRef,
        method: String(cleanMethod),
        installmentOrdinal: ordinal,
        recordedBy: customerInfo?.recordedBy,
      });
    } catch (smsErr) {
      console.warn('[recordPlanPaymentWithBackend] SMS dispatch error:', smsErr);
    }

    return {
      success: true,
      persistedToBackend: false,
      realPlanId: plan.id,
      receiptNumber: cleanRef,
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

  let result: any = null;

  try {
    const res = await apiClient.post<ApiResponse<any>>(`/payment-plans/${realPlanId}/payments`, {
      amountMinor: cleanAmountMinor,
      paidOn: formattedPaidOn,
      method: cleanMethod,
      reference: cleanRef,
    });
    result = unwrapData(res);
  } catch (apiErr: any) {
    const backendMsg =
      apiErr?.response?.data?.error?.message ||
      apiErr?.response?.data?.message ||
      (Array.isArray(apiErr?.response?.data?.error?.details) 
        ? apiErr.response.data.error.details.map((d: any) => d.message).join(', ') 
        : null) ||
      apiErr?.message ||
      'Backend database rejected payment recording';
    console.error('[recordPlanPaymentWithBackend] Backend save failed:', backendMsg, apiErr);
    throw new Error(`Database save failed: ${backendMsg}`);
  }

  // 2. Database write succeeded! Save locally for instant UI update and dynamic amortization
  recordLocalInstallmentPayment(
    plan.id,
    sequence,
    cleanAmountMinor,
    cleanMethod,
    cleanRef,
    paidOnDate,
    dynamicNote,
    customerInfo?.recordedBy,
    ledgerMeta
  );

  if (realPlanId !== plan.id) {
    recordLocalInstallmentPayment(
      realPlanId,
      sequence,
      cleanAmountMinor,
      cleanMethod,
      cleanRef,
      paidOnDate,
      dynamicNote,
      customerInfo?.recordedBy,
      ledgerMeta
    );
  }

  // 3. Recalculate updated schedule to obtain new balance & amortization adjustments
  const updatedSchedule = buildPaymentPlanSchedule(plan);
  const targetRow = updatedSchedule.rows.find((r: any) => r.sequence === sequence);

  const isPartialPayment = Boolean(targetRow?.isPartiallyPaid) || isUnder;
  const deficitRolledOverMinor = targetRow?.deficitMinor || deficitMinor;
  const surplusAppliedMinor = surplusMinor;
  const isOverpayment = surplusMinor > 0;
  const newBalanceMinor = result?.balanceMinor !== undefined 
    ? result.balanceMinor 
    : updatedSchedule.currentBalanceMinor;

  // 4. Resolve customer contact number if missing and dispatch automated SMS receipt
  let targetPhone = customerInfo?.phone?.trim();
  let targetName = customerInfo?.name?.trim();

  if ((!targetPhone || !targetName) && (plan.customerId || plan.id)) {
    const custLookupId = plan.customerId || plan.id.replace(/^plan-/, '');
    try {
      const custRes = await apiClient.get<ApiResponse<any>>(`/customers/${custLookupId}`);
      const custData = unwrapData(custRes);
      if (!targetPhone && custData?.phoneNumber) {
        targetPhone = custData.phoneNumber;
      }
      if ((!targetName || targetName === 'Valued Customer') && custData?.firstName) {
        targetName = `${custData.firstName} ${custData.lastName || ''}`.trim();
      }
    } catch {
      // ignore auxiliary lookup failure
    }
  }

  try {
    await dispatchPaymentReceiptSMS({
      customerPhone: targetPhone,
      customerName: targetName,
      amountMinor: cleanAmountMinor,
      remainingBalanceMinor: newBalanceMinor,
      propertyName: customerInfo?.propertyName,
      reference: cleanRef,
      method: String(cleanMethod),
      installmentOrdinal: ordinal,
      recordedBy: customerInfo?.recordedBy,
    });
  } catch (smsErr) {
    console.warn('[recordPlanPaymentWithBackend] SMS dispatch error:', smsErr);
  }

  return {
    success: true,
    persistedToBackend: true,
    realPlanId,
    result,
    receiptNumber: cleanRef,
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
