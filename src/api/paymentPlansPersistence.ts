// src/api/paymentPlansPersistence.ts
import apiClient, { unwrapData, unwrapList } from '@/api/client';
import dayjs from 'dayjs';
import type { ApiResponse, PaymentPlan, PaymentPlanStatus, PaymentMethod } from '@/types';
import { buildPaymentPlanSchedule, recordLocalInstallmentPayment } from '@/utils/paymentPlanSchedule';
import { dispatchPaymentReceiptSMS } from '@/utils/paymentNotificationService';
import {
  saveStoredPaymentPlan,
  saveCustomerPlanDefinition,
  getStoredPaymentPlans,
  getStoredPaymentOverrides,
  saveStoredPaymentOverrides,
} from '@/utils/paymentPlansStorage';

export function isValidServerId(id: any): boolean {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (
    trimmed.startsWith('plan-') ||
    trimmed.startsWith('synth-') ||
    trimmed.startsWith('mock-') ||
    trimmed.startsWith('temp-') ||
    trimmed.startsWith('local-')
  ) {
    return false;
  }
  // MongoDB 24-character hex ObjectId
  if (/^[0-9a-f]{24}$/i.test(trimmed)) return true;
  // Standard UUID format (hyphenated)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) return true;
  // General server alphanumeric ID of 8+ characters
  if (/^[a-zA-Z0-9_-]{8,}$/.test(trimmed)) return true;
  return false;
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export interface PlanIdentifier {
  id: string;
  customerId?: string;
  propertyId?: string;
  totalAmountMinor?: number;
  downPaymentMinor?: number;
  numMonths?: number;
  monthlyAmountMinor?: number;
  startDate?: string;
  balanceMinor?: number;
  status?: PaymentPlanStatus;
}

export interface CustomerInfo {
  customerId?: string;
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

function extractPlanCustomerId(p: any): string {
  if (!p) return '';
  const raw =
    p.customerId ||
    p.customer_id ||
    (typeof p.customer === 'string' ? p.customer : (p.customer?.id || p.customer?._id)) ||
    p.clientId ||
    p.client_id ||
    (typeof p.client === 'string' ? p.client : (p.client?.id || p.client?._id)) ||
    '';
  return String(raw).trim();
}

function extractPlanPropertyId(p: any): string {
  if (!p) return '';
  const raw =
    p.propertyId ||
    p.property_id ||
    (typeof p.property === 'string' ? p.property : (p.property?.id || p.property?._id)) ||
    '';
  return String(raw).trim();
}

function extractPlanId(p: any): string {
  if (!p) return '';
  return (p.id || p._id || '').toString().trim();
}

/**
 * Queries the backend database to locate any existing payment plan for a customer.
 * Checks customer query endpoint, direct customer detail endpoint, and paginated lists across all statuses.
 * Logs raw responses and field comparisons.
 */
export async function findBackendPlanForCustomer(
  customerId: string,
  propertyId?: string
): Promise<PaymentPlan | null> {
  if (!customerId) return null;
  const cleanCustId = customerId.trim();
  const cleanPropId = propertyId ? propertyId.trim() : '';

  // Candidate evaluator: strictly requires customerId equality. Never matches on property alone.
  const evaluatePlanCandidate = (p: any): boolean => {
    if (!p) return false;
    const candidatePlanId = extractPlanId(p);
    const candidateCustId = extractPlanCustomerId(p);
    const hasValidServerPlanId = isValidServerId(candidatePlanId);

    // Mandatory: customerId must strictly match. Property alone is NEVER accepted.
    const matchesCustomer = Boolean(
      candidateCustId && candidateCustId.toLowerCase() === cleanCustId.toLowerCase()
    );

    return matchesCustomer && hasValidServerPlanId;
  };

  // Helper to prioritize matching propertyId among plans belonging to this customer
  const pickBestPlan = (items: any[]): PaymentPlan | null => {
    const validCustomerPlans = items.filter(evaluatePlanCandidate);
    if (validCustomerPlans.length === 0) return null;

    if (cleanPropId) {
      const propMatch = validCustomerPlans.find((item) => {
        const pId = extractPlanPropertyId(item);
        return pId && pId.toLowerCase() === cleanPropId.toLowerCase();
      });
      if (propMatch) {
        const realId = extractPlanId(propMatch);
        return { ...(propMatch as any), id: realId, customerId: cleanCustId };
      }
    }

    const first = validCustomerPlans[0];
    const realId = extractPlanId(first);
    return { ...(first as any), id: realId, customerId: cleanCustId };
  };

  // 1. Direct query: GET /payment-plans?customerId={cleanCustId}
  try {
    const listByCustRes = await apiClient.get<ApiResponse<any>>('/payment-plans', {
      params: { customerId: cleanCustId },
    });
    const unwrapResult = unwrapList(listByCustRes);
    const items: any[] = unwrapResult.items || (Array.isArray(listByCustRes?.data) ? listByCustRes.data : []);
    const match = pickBestPlan(items);
    if (match) return match;
  } catch {
    // continue to next strategy
  }

  // Fallback query: GET /payment-plans?customer_id={cleanCustId}
  try {
    const listByCustUnderscoreRes = await apiClient.get<ApiResponse<any>>('/payment-plans', {
      params: { customer_id: cleanCustId },
    });
    const items: any[] = unwrapList(listByCustUnderscoreRes).items || [];
    const match = pickBestPlan(items);
    if (match) return match;
  } catch {
    // continue to next strategy
  }

  // 2. Direct customer detail endpoint: GET /customers/{cleanCustId}
  try {
    const custRes = await apiClient.get<ApiResponse<any>>(`/customers/${cleanCustId}`);
    const rawData = unwrapData(custRes) || (custRes?.data as any)?.data || custRes?.data;
    const custData = rawData?.customer || rawData;

    if (custData) {
      // Check custData.plan
      if (custData.plan) {
        if (typeof custData.plan === 'object') {
          const pid = extractPlanId(custData.plan);
          if (isValidServerId(pid)) {
            return { ...custData.plan, id: pid, customerId: cleanCustId };
          }
        } else if (typeof custData.plan === 'string' && isValidServerId(custData.plan)) {
          return { id: custData.plan.trim(), customerId: cleanCustId } as any;
        }
      }

      // Check custData.paymentPlan
      if (custData.paymentPlan) {
        if (typeof custData.paymentPlan === 'object') {
          const pid = extractPlanId(custData.paymentPlan);
          if (isValidServerId(pid)) {
            return { ...custData.paymentPlan, id: pid, customerId: cleanCustId };
          }
        } else if (typeof custData.paymentPlan === 'string' && isValidServerId(custData.paymentPlan)) {
          return { id: custData.paymentPlan.trim(), customerId: cleanCustId } as any;
        }
      }

      // Check custData.payment_plan
      if (custData.payment_plan) {
        if (typeof custData.payment_plan === 'object') {
          const pid = extractPlanId(custData.payment_plan);
          if (isValidServerId(pid)) {
            return { ...custData.payment_plan, id: pid, customerId: cleanCustId };
          }
        } else if (typeof custData.payment_plan === 'string' && isValidServerId(custData.payment_plan)) {
          return { id: custData.payment_plan.trim(), customerId: cleanCustId } as any;
        }
      }

      // Check plain scalar ID fields
      const scalarPlanId = custData.planId || custData.paymentPlanId || custData.plan_id || custData.payment_plan_id;
      if (scalarPlanId && isValidServerId(String(scalarPlanId))) {
        return { id: String(scalarPlanId).trim(), customerId: cleanCustId } as any;
      }

      // Check custData.plans array
      if (Array.isArray(custData.plans)) {
        const match = pickBestPlan(custData.plans);
        if (match) return match;
      }

      // Check custData.paymentPlans array
      if (Array.isArray(custData.paymentPlans)) {
        const match = pickBestPlan(custData.paymentPlans);
        if (match) return match;
      }

      // Check installments array
      if (Array.isArray(custData.installments)) {
        for (const inst of custData.installments) {
          const instPlanId = inst?.planId || inst?.paymentPlanId || inst?.plan_id;
          if (instPlanId && isValidServerId(String(instPlanId))) {
            return { id: String(instPlanId).trim(), customerId: cleanCustId } as any;
          }
        }
      }

      // Check payments array
      if (Array.isArray(custData.payments)) {
        for (const pmt of custData.payments) {
          const pmtPlanId = pmt?.planId || pmt?.paymentPlanId || pmt?.plan_id;
          if (pmtPlanId && isValidServerId(String(pmtPlanId))) {
            return { id: String(pmtPlanId).trim(), customerId: cleanCustId } as any;
          }
        }
      }
    }
  } catch {
    // continue to next strategy
  }

  // 3. Traversal of general /payment-plans pages
  try {
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= 10) {
      const listRes = await apiClient.get<ApiResponse<PaymentPlan[]>>('/payment-plans', {
        params: { page, pageSize: 100 },
      });
      const listData = unwrapList(listRes);
      const items = listData.items || [];
      const match = pickBestPlan(items);
      if (match) return match;

      if (items.length < 100 || (listData.totalPages && page >= listData.totalPages)) {
        hasMore = false;
      } else {
        page++;
      }
    }
  } catch {
    // continue to next strategy
  }

  // 4. Status-filtered lists (defaulted, completed, active, cancelled)
  for (const st of ['defaulted', 'completed', 'active', 'cancelled'] as const) {
    try {
      let page = 1;
      let hasMore = true;
      while (hasMore && page <= 5) {
        const filteredRes = await apiClient.get<ApiResponse<PaymentPlan[]>>('/payment-plans', {
          params: { status: st, page, pageSize: 100 },
        });
        const listData = unwrapList(filteredRes);
        const items = listData.items || [];
        const match = pickBestPlan(items);
        if (match) return match;

        if (items.length < 100 || (listData.totalPages && page >= listData.totalPages)) {
          hasMore = false;
        } else {
          page++;
        }
      }
    } catch {
      // continue
    }
  }

  return null;
}

/**
 * Resolves the real backend payment plan server ID for a given plan object or customer ID.
 * If the plan ID is already a valid server ID, returns it immediately.
 * If it's a synthetic ID ('plan-...'), it searches the backend database for an existing plan for this customer.
 * MUST NEVER call POST /payment-plans. If no plan is found, throws "Could not find this customer's payment plan".
 */
export async function resolveOrCreateBackendPlan(
  plan: PlanIdentifier
): Promise<string> {
  const rawId = (plan.id || '').toString().trim();

  // If already a valid server ID (MongoDB 24-hex or UUID), return immediately
  if (isValidServerId(rawId)) {
    return rawId;
  }

  let customerId = plan.customerId;
  if (!customerId && rawId) {
    const raw = rawId.replace(/^plan-/, '');
    const hexMatch = raw.match(/^([0-9a-f]{24})/i);
    const uuidMatch = raw.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    customerId = hexMatch ? hexMatch[1] : (uuidMatch ? uuidMatch[1] : raw);
  }

  if (!customerId) {
    throw new Error("Could not find this customer's payment plan");
  }

  // Search server database for existing plan for this customer
  const existingPlan = await findBackendPlanForCustomer(customerId, plan.propertyId);
  const foundServerId = existingPlan ? extractPlanId(existingPlan) : null;
  if (foundServerId && isValidServerId(foundServerId)) {
    const realId = foundServerId;
    // Mirror local overrides from synthetic ID to real server plan ID
    const overrides = getStoredPaymentOverrides();
    if (overrides[rawId] && !overrides[realId]) {
      overrides[realId] = { ...overrides[rawId] };
      saveStoredPaymentOverrides(overrides).catch(() => {});
    }
    return realId;
  }

  // MUST NEVER call POST /payment-plans!
  throw new Error("Could not find this customer's payment plan");
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
 * 1. Resolves/verifies real backend payment plan UUID
 * 2. Permanently persists payment to backend database (POST /payment-plans/{planId}/payments)
 *    Strictly throws error if backend rejects, ensuring data is never silently dropped
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

  // 1. Resolve real backend plan ID and require valid server ID
  const realPlanId = await resolveOrCreateBackendPlan(plan);
  if (!realPlanId || !isValidServerId(realPlanId)) {
    throw new Error('Cannot record payment: No valid server payment plan found for this customer.');
  }

  // 1b. Verify plan ownership against customer in the modal before posting
  const expectedCustomerId = (
    customerInfo?.customerId ||
    plan.customerId ||
    extractPlanCustomerId(plan) ||
    ''
  ).trim();

  if (!expectedCustomerId) {
    throw new Error('Cannot record payment: Customer identity is missing. Please select a valid customer.');
  }

  let serverPlanDetail: any = null;
  try {
    const planRes = await apiClient.get<ApiResponse<any>>(`/payment-plans/${realPlanId}`);
    serverPlanDetail = unwrapData(planRes) || (planRes?.data as any)?.data || planRes?.data;
  } catch (fetchErr: any) {
    const errMsg =
      fetchErr?.response?.data?.message ||
      fetchErr?.message ||
      'Failed to fetch plan from server';
    throw new Error(`Cannot record payment: Unable to verify plan ${realPlanId} on server (${errMsg}).`);
  }

  if (!serverPlanDetail) {
    throw new Error(`Cannot record payment: Payment plan ${realPlanId} was not found on server.`);
  }

  const serverPlanCustomerId = extractPlanCustomerId(serverPlanDetail);
  if (!serverPlanCustomerId) {
    throw new Error(
      `Cannot record payment: Server plan ${realPlanId} does not have an associated customer ID on record.`
    );
  }

  if (serverPlanCustomerId.toLowerCase() !== expectedCustomerId.toLowerCase()) {
    throw new Error(
      `Cannot record payment: Customer mismatch! Server plan (${realPlanId}) is owned by customer "${serverPlanCustomerId}", but payment is being recorded for customer "${expectedCustomerId}". Payment aborted.`
    );
  }

  const validMethods: PaymentMethod[] = ['cash', 'bank_transfer', 'mobile_money', 'cheque', 'other'];
  const cleanMethod: PaymentMethod = validMethods.includes(method as any)
    ? (method as PaymentMethod)
    : 'bank_transfer';

  const formattedPaidOn = dayjs(paidOnDate).isValid()
    ? dayjs(paidOnDate).format('YYYY-MM-DD')
    : dayjs().format('YYYY-MM-DD');

  const cleanAmountMinor = Math.round(payment.amountMinor);
  const cleanRef = (reference || `REC-${Date.now().toString().slice(-6)}`).trim();

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
    console.error('[recordPlanPaymentWithBackend] Backend save failed:', backendMsg);
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

  // Update stored plan record to match the backend write
  try {
    const currentStored = getStoredPaymentPlans();
    const storedMatch = currentStored.find((p) => p.id === realPlanId || p.id === plan.id);
    if (storedMatch) {
      saveStoredPaymentPlan({
        ...storedMatch,
        id: realPlanId,
        balanceMinor: newBalanceMinor,
        status: newBalanceMinor === 0 ? 'completed' : storedMatch.status,
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }
  } catch {
    // ignore storage sync failure
  }

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
