// src/mock/customerPortalCache.ts
//
// ⚠️ PROTOTYPE — bridges a real technical gap, not just a missing feature.
//
// The customer portal needs to look up a customer by phone number and show
// their property/payment data *without* a staff Bearer token — but every
// endpoint on the real API (including GET /customers) requires staff auth,
// and there is no public customer-lookup or customer-auth endpoint at all.
//
// So this cache is seeded from data staff have already fetched legitimately
// (CustomersPage, CustomerDetailPage) and mirrored here in localStorage.
// It's a real snapshot of real records — not invented data — but it's only
// as fresh as the last time a staff member browsed that customer in this
// browser, and it never leaves this device. Delete this file and have the
// portal call the real API directly once a public customer-auth endpoint
// exists.
import type { Customer, Installment, PaymentPlan, Payment, Property } from '@/types';

const DIRECTORY_KEY = 'omark_mock_portal_customer_cache';

export interface CachedCustomerRecord {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  property?: Pick<Property, 'id' | 'houseNumber' | 'offerNumber' | 'priceMinor' | 'currency'>;
  paymentPlan?: Pick<PaymentPlan, 'id' | 'totalAmountMinor' | 'downPaymentMinor' | 'balanceMinor' | 'numMonths' | 'monthlyAmountMinor' | 'currency' | 'status' | 'progressPercent'>;
  installments?: Installment[];
  recentPayments?: Payment[];
  cachedAt: string;
}

type CacheMap = Record<string, CachedCustomerRecord>;

const load = (): CacheMap => {
  try {
    const raw = localStorage.getItem(DIRECTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore malformed storage, fall back to empty
  }
  return {};
};

const save = (map: CacheMap) => {
  localStorage.setItem(DIRECTORY_KEY, JSON.stringify(map));
};

/** Called from CustomersPage — seeds/refreshes the summary every list is loaded from the real API. */
export const cacheCustomerSummaries = (
  customers: Customer[],
  paymentPlanByCustomerId: Record<string, PaymentPlan>,
  propertyById: Record<string, Property>
) => {
  const map = load();
  customers.forEach((c) => {
    const existing = map[c.id];
    const plan = paymentPlanByCustomerId[c.id];
    const property = propertyById[c.propertyId];
    map[c.id] = {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      phoneNumber: c.phoneNumber,
      property: property
        ? { id: property.id, houseNumber: property.houseNumber, offerNumber: property.offerNumber, priceMinor: property.priceMinor, currency: property.currency }
        : existing?.property,
      paymentPlan: plan
        ? { id: plan.id, totalAmountMinor: plan.totalAmountMinor, downPaymentMinor: plan.downPaymentMinor, balanceMinor: plan.balanceMinor, numMonths: plan.numMonths, monthlyAmountMinor: plan.monthlyAmountMinor, currency: plan.currency, status: plan.status, progressPercent: plan.progressPercent }
        : existing?.paymentPlan,
      installments: existing?.installments,
      recentPayments: existing?.recentPayments,
      cachedAt: new Date().toISOString(),
    };
  });
  save(map);
};

/** Called from CustomerDetailPage — enriches one record with installments/payment history. */
export const cacheCustomerDetail = (
  customerId: string,
  patch: { installments?: Installment[]; recentPayments?: Payment[]; property?: Property; paymentPlan?: PaymentPlan; firstName?: string; lastName?: string; phoneNumber?: string }
) => {
  const map = load();
  const existing = map[customerId];
  map[customerId] = {
    id: customerId,
    firstName: patch.firstName ?? existing?.firstName ?? '',
    lastName: patch.lastName ?? existing?.lastName ?? '',
    phoneNumber: patch.phoneNumber ?? existing?.phoneNumber ?? '',
    property: patch.property
      ? { id: patch.property.id, houseNumber: patch.property.houseNumber, offerNumber: patch.property.offerNumber, priceMinor: patch.property.priceMinor, currency: patch.property.currency }
      : existing?.property,
    paymentPlan: patch.paymentPlan
      ? { id: patch.paymentPlan.id, totalAmountMinor: patch.paymentPlan.totalAmountMinor, downPaymentMinor: patch.paymentPlan.downPaymentMinor, balanceMinor: patch.paymentPlan.balanceMinor, numMonths: patch.paymentPlan.numMonths, monthlyAmountMinor: patch.paymentPlan.monthlyAmountMinor, currency: patch.paymentPlan.currency, status: patch.paymentPlan.status, progressPercent: patch.paymentPlan.progressPercent }
      : existing?.paymentPlan,
    installments: patch.installments ?? existing?.installments,
    recentPayments: patch.recentPayments ?? existing?.recentPayments,
    cachedAt: new Date().toISOString(),
  };
  save(map);
};

export const getCachedCustomer = (customerId: string): CachedCustomerRecord | undefined => load()[customerId];

const normalizePhone = (phone: string) => phone.replace(/[\s()-]/g, '');

export const findCachedCustomerByPhone = (phone: string): CachedCustomerRecord | undefined => {
  const target = normalizePhone(phone);
  return Object.values(load()).find((c) => normalizePhone(c.phoneNumber) === target);
};
