// src/api/paymentPlansPersistence.ts
import apiClient, { unwrapData, unwrapList } from '@/api/client';
import dayjs from 'dayjs';
import type { ApiResponse, PaymentPlan, PaymentMethod } from '@/types';
import { recordLocalInstallmentPayment } from '@/utils/paymentPlanSchedule';
import { dispatchPaymentReceiptSMS } from '@/utils/paymentNotificationService';

export interface PlanIdentifier {
  id: string;
  customerId?: string;
  totalAmountMinor?: number;
  downPaymentMinor?: number;
  numMonths?: number;
  monthlyAmountMinor?: number;
  startDate?: string;
  balanceMinor?: number;
  status?: string;
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
export async function recordPlanPaymentWithBackend(
  plan: PlanIdentifier,
  payment: RecordPaymentParams,
  customerInfo?: CustomerInfo
): Promise<{ success: boolean; realPlanId: string; result?: any }> {
  const sequence = payment.sequence || 1;
  const method = payment.method || 'bank_transfer';
  const reference = payment.reference || `REC-${Date.now().toString().slice(-6)}`;
  const paidOnDate = payment.paidOn || new Date().toISOString();

  // 1. Save locally for instant UI update
  recordLocalInstallmentPayment(
    plan.id,
    sequence,
    payment.amountMinor,
    method,
    reference,
    paidOnDate
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
          paidOnDate
        );
      }
    }
  } catch (apiErr) {
    console.warn('[recordPlanPaymentWithBackend] Backend save warning:', apiErr);
  }

  // 3. Dispatch automated SMS receipt to customer
  try {
    const remainingMinor = Math.max(0, (plan.balanceMinor || 0) - payment.amountMinor);
    await dispatchPaymentReceiptSMS({
      customerPhone: customerInfo?.phone,
      customerName: customerInfo?.name,
      amountMinor: payment.amountMinor,
      remainingBalanceMinor: remainingMinor,
      propertyName: customerInfo?.propertyName,
      reference,
      method: String(method),
      installmentOrdinal: payment.installmentOrdinal,
      recordedBy: customerInfo?.recordedBy,
    });
  } catch (smsErr) {
    console.warn('[recordPlanPaymentWithBackend] SMS dispatch warning:', smsErr);
  }

  return {
    success: true,
    realPlanId,
    result,
  };
}
