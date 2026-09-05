// src/utils/customerPortalCache.ts
import type { Customer, Installment, PaymentPlan, Payment, Property } from '@/types';

const DIRECTORY_KEY = 'omark_portal_customer_cache';

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
    // ignore malformed storage
  }
  return {};
};

const save = (map: CacheMap) => {
  localStorage.setItem(DIRECTORY_KEY, JSON.stringify(map));
};

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
        ? {
            id: property.id,
            houseNumber: property.houseNumber,
            offerNumber: property.offerNumber,
            priceMinor: property.priceMinor,
            currency: property.currency,
          }
        : existing?.property,
      paymentPlan: plan
        ? {
            id: plan.id,
            totalAmountMinor: plan.totalAmountMinor,
            downPaymentMinor: plan.downPaymentMinor,
            balanceMinor: plan.balanceMinor,
            numMonths: plan.numMonths,
            monthlyAmountMinor: plan.monthlyAmountMinor,
            currency: plan.currency,
            status: plan.status,
            progressPercent: plan.progressPercent,
          }
        : existing?.paymentPlan,
      installments: existing?.installments,
      recentPayments: existing?.recentPayments,
      cachedAt: new Date().toISOString(),
    };
  });
  save(map);
};

export const cacheCustomerDetail = (
  customer: Customer,
  property: Property | undefined,
  paymentPlan: PaymentPlan | undefined,
  installments: Installment[],
  payments: Payment[]
) => {
  const map = load();
  map[customer.id] = {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phoneNumber: customer.phoneNumber,
    property: property
      ? {
          id: property.id,
          houseNumber: property.houseNumber,
          offerNumber: property.offerNumber,
          priceMinor: property.priceMinor,
          currency: property.currency,
        }
      : undefined,
    paymentPlan: paymentPlan
      ? {
          id: paymentPlan.id,
          totalAmountMinor: paymentPlan.totalAmountMinor,
          downPaymentMinor: paymentPlan.downPaymentMinor,
          balanceMinor: paymentPlan.balanceMinor,
          numMonths: paymentPlan.numMonths,
          monthlyAmountMinor: paymentPlan.monthlyAmountMinor,
          currency: paymentPlan.currency,
          status: paymentPlan.status,
          progressPercent: paymentPlan.progressPercent,
        }
      : undefined,
    installments,
    recentPayments: payments,
    cachedAt: new Date().toISOString(),
  };
  save(map);
};

export const getCachedCustomer = (customerId: string): CachedCustomerRecord | undefined => {
  return load()[customerId];
};

export const findCachedCustomerByPhone = (phone: string): CachedCustomerRecord | undefined => {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const all = Object.values(load());
  return all.find((c) => c.phoneNumber.replace(/[^0-9]/g, '') === cleanPhone);
};

export const clearCustomerCache = () => {
  localStorage.removeItem(DIRECTORY_KEY);
};

