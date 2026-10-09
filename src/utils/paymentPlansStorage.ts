import dayjs from 'dayjs';
import type { ApiResponse, PaymentPlan } from '@/types';
import apiClient, { unwrapData, unwrapList } from '@/api/client';
import type { LocalPlanOverride } from '@/utils/paymentPlanSchedule';
import { fetchAppSettings, updateAppSettings } from '@/api/settings';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PLANS_STORAGE_KEY = 'omark_payment_plans_store';
export const OVERRIDES_STORAGE_KEY = 'omark_payment_plan_overrides';
export const CUSTOMER_PLANS_STORAGE_KEY = 'omark_customer_plans_store';
export const SCHEDULE_CHANGE_EVENT = 'omark-payment-plan-updated';

// ── Multi-Tier IndexedDB Engine ─────────────────────────────────────────────
const IDB_DB_NAME = 'omark_erp_payment_plans_db';
const IDB_VERSION = 1;
const IDB_STORE_PLANS = 'plans_store';
const IDB_STORE_OVERRIDES = 'overrides_store';
const IDB_STORE_CUSTOMER_PLANS = 'customer_plans_store';

function openPaymentPlansDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(IDB_DB_NAME, IDB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IDB_STORE_PLANS)) {
          db.createObjectStore(IDB_STORE_PLANS);
        }
        if (!db.objectStoreNames.contains(IDB_STORE_OVERRIDES)) {
          db.createObjectStore(IDB_STORE_OVERRIDES);
        }
        if (!db.objectStoreNames.contains(IDB_STORE_CUSTOMER_PLANS)) {
          db.createObjectStore(IDB_STORE_CUSTOMER_PLANS);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('[PaymentPlans IDB] Failed to open IndexedDB:', request.error);
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

async function getIDBItem<T>(storeName: string, key: string): Promise<T | null> {
  try {
    const db = await openPaymentPlansDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setIDBItem<T>(storeName: string, key: string, value: T): Promise<void> {
  try {
    const db = await openPaymentPlansDB();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Fail silently
  }
}

// ── 1. PAYMENT PLANS PERSISTENCE ────────────────────────────────────────────

export function getStoredPaymentPlans(): PaymentPlan[] {
  try {
    const raw = localStorage.getItem(PLANS_STORAGE_KEY);
    if (!raw) {
      // Background check IndexedDB in case localStorage was recently cleared
      getIDBItem<PaymentPlan[]>(IDB_STORE_PLANS, PLANS_STORAGE_KEY).then((idbPlans) => {
        if (Array.isArray(idbPlans) && idbPlans.length > 0) {
          localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(idbPlans));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(SCHEDULE_CHANGE_EVENT));
          }
        }
      });
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[PaymentPlans Storage] Failed to parse stored payment plans:', err);
    return [];
  }
}

export async function saveStoredPaymentPlan(plan: PaymentPlan): Promise<void> {
  try {
    const current = getStoredPaymentPlans();
    const existingIdx = current.findIndex(
      (p) => p.id === plan.id || (plan.customerId && p.customerId === plan.customerId)
    );

    let next: PaymentPlan[];
    if (existingIdx >= 0) {
      next = [...current];
      next[existingIdx] = {
        ...next[existingIdx],
        ...plan,
        updatedAt: new Date().toISOString(),
      };
    } else {
      next = [plan, ...current];
    }

    localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(next));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SCHEDULE_CHANGE_EVENT));
    }

    // Multi-tier backup to IndexedDB & Backend Server Settings
    await setIDBItem(IDB_STORE_PLANS, PLANS_STORAGE_KEY, next);
    updateAppSettings({ paymentPlans: next }).catch(() => {});
  } catch (err) {
    console.warn('[PaymentPlans Storage] Failed to save payment plan:', err);
  }
}

export async function saveStoredPaymentPlans(plans: PaymentPlan[]): Promise<void> {
  try {
    localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(plans));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SCHEDULE_CHANGE_EVENT));
    }
    await setIDBItem(IDB_STORE_PLANS, PLANS_STORAGE_KEY, plans);
    updateAppSettings({ paymentPlans: plans }).catch(() => {});
  } catch (err) {
    console.warn('[PaymentPlans Storage] Failed to batch save payment plans:', err);
  }
}

export async function deleteStoredPaymentPlan(id: string): Promise<void> {
  try {
    const current = getStoredPaymentPlans();
    const next = current.filter((p) => p.id !== id);
    localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(next));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SCHEDULE_CHANGE_EVENT));
    }
    await setIDBItem(IDB_STORE_PLANS, PLANS_STORAGE_KEY, next);
    updateAppSettings({ paymentPlans: next }).catch(() => {});
  } catch (err) {
    console.warn('[PaymentPlans Storage] Failed to delete payment plan:', err);
  }
}

// ── 2. PAYMENT OVERRIDES & TRANSACTIONS LEDGER PERSISTENCE ──────────────────

export type OverridesMap = Record<string, LocalPlanOverride>;

export function getStoredPaymentOverrides(): OverridesMap {
  try {
    const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
    if (!raw) {
      // Background check IndexedDB in case localStorage was cleared
      getIDBItem<OverridesMap>(IDB_STORE_OVERRIDES, OVERRIDES_STORAGE_KEY).then((idbOverrides) => {
        if (idbOverrides && typeof idbOverrides === 'object') {
          localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(idbOverrides));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(SCHEDULE_CHANGE_EVENT));
          }
        }
      });
      return {};
    }
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function saveStoredPaymentOverrides(map: OverridesMap): Promise<void> {
  try {
    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(map));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SCHEDULE_CHANGE_EVENT));
    }

    // Multi-tier backup to IndexedDB & Backend Server Settings
    await setIDBItem(IDB_STORE_OVERRIDES, OVERRIDES_STORAGE_KEY, map);
    updateAppSettings({ paymentPlanOverrides: map }).catch(() => {});
  } catch (err) {
    console.warn('[PaymentPlans Storage] Failed to save overrides:', err);
  }
}

export async function saveStoredPlanOverride(planId: string, override: LocalPlanOverride): Promise<void> {
  const current = getStoredPaymentOverrides();
  current[planId] = override;
  await saveStoredPaymentOverrides(current);
}

// ── 3. CUSTOMER PLANS PERSISTENCE ───────────────────────────────────────────

export function getAllCustomerPlanDefinitions(): Record<string, any> {
  try {
    const raw = localStorage.getItem(CUSTOMER_PLANS_STORAGE_KEY);
    if (!raw) {
      getIDBItem<Record<string, any>>(IDB_STORE_CUSTOMER_PLANS, CUSTOMER_PLANS_STORAGE_KEY).then((idbCust) => {
        if (idbCust && typeof idbCust === 'object') {
          localStorage.setItem(CUSTOMER_PLANS_STORAGE_KEY, JSON.stringify(idbCust));
        }
      });
      return {};
    }
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getCustomerPlanDefinition(customerId: string): any {
  if (!customerId) return null;
  const map = getAllCustomerPlanDefinitions();
  return map[customerId] || null;
}

export async function saveCustomerPlanDefinition(customerId: string, planData: any): Promise<void> {
  if (!customerId || !planData) return;
  try {
    const current = getAllCustomerPlanDefinitions();
    current[customerId] = {
      ...current[customerId],
      ...planData,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(CUSTOMER_PLANS_STORAGE_KEY, JSON.stringify(current));
    await setIDBItem(IDB_STORE_CUSTOMER_PLANS, CUSTOMER_PLANS_STORAGE_KEY, current);
    updateAppSettings({ customerPlans: current }).catch(() => {});
  } catch (err) {
    console.warn('[PaymentPlans Storage] Failed to save customer plan definition:', err);
  }
}

// ── 4. UNIVERSAL REHYDRATION FROM SERVER DATABASE & INDEXEDDB ───────────────

/**
 * Rehydrates all payment plans, overrides, and customer plan attachments:
 * 1. Queries backend server database via GET /settings
 * 2. If present, restores into IndexedDB and LocalStorage
 * 3. If server query fails or is empty, checks IndexedDB
 * 4. Triggers global reactive re-render event
 */
export async function rehydrateAllPaymentPlansData(): Promise<{
  plans: PaymentPlan[];
  overrides: OverridesMap;
  customerPlans: Record<string, any>;
}> {
  let loadedPlans: PaymentPlan[] = [];
  let loadedOverrides: OverridesMap = {};
  let loadedCustomerPlans: Record<string, any> = {};

  // Tier 0: Fetch authoritative payment plans, installments, and payment history directly from server database
  try {
    const listRes = await apiClient.get<ApiResponse<PaymentPlan[]>>('/payment-plans', {
      params: { pageSize: 100 },
    });
    const listData = unwrapList(listRes);
    const apiPlans = listData.items || [];
    if (apiPlans.length > 0) {
      loadedPlans = apiPlans;
      localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(loadedPlans));
      await setIDBItem(IDB_STORE_PLANS, PLANS_STORAGE_KEY, loadedPlans);

      // Identify plans that have recorded payments or are completed
      const plansWithPayments = apiPlans.filter(
        (p) =>
          p.status === 'completed' ||
          (p.balanceMinor !== undefined && p.balanceMinor < ((p.totalAmountMinor || 0) - (p.downPaymentMinor || 0)))
      );

      // Reconstruct overrides and transaction ledger directly from server database records
      await Promise.all(
        plansWithPayments.slice(0, 20).map(async (p) => {
          if (!p.id || !UUID_REGEX.test(p.id)) return;
          try {
            const detailRes = await apiClient.get<ApiResponse<any>>(`/payment-plans/${p.id}`);
            const detail = unwrapData(detailRes) || (detailRes?.data as any)?.data || detailRes?.data;
            if (detail) {
              const paidInst: Record<number, any> = {};
              (detail.installments || []).forEach((inst: any) => {
                if (inst.isPaid) {
                  paidInst[inst.sequence] = {
                    paidAt: inst.paidAt || inst.dueDate,
                    amountMinor: inst.actualAmountMinor || inst.expectedAmountMinor,
                    method: 'bank_transfer',
                    reference: `REC-${inst.sequence}`,
                  };
                }
              });

              const txList: any[] = (detail.recentPayments || detail.payments || []).map((pmt: any, idx: number) => ({
                id: pmt.id || `api-tx-${idx}`,
                sequence: pmt.sequence || idx + 1,
                amountMinor: pmt.amountMinor,
                paidOn: pmt.paidOn || pmt.createdAt,
                method: pmt.method || 'bank_transfer',
                reference: pmt.reference || `REC-${(pmt.id || String(idx)).slice(-6)}`,
                notes: 'Recorded payment',
                balanceAfterMinor: pmt.balanceMinor,
                effect: 'exact',
              }));

              if (Object.keys(paidInst).length > 0 || txList.length > 0) {
                loadedOverrides[p.id] = {
                  paidInstallments: paidInst,
                  transactions: txList,
                  balanceMinor: p.balanceMinor,
                  updatedAt: p.updatedAt || new Date().toISOString(),
                };
              }
            }
          } catch {
            // ignore individual plan detail fetch failure
          }
        })
      );

      if (Object.keys(loadedOverrides).length > 0) {
        localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(loadedOverrides));
        await setIDBItem(IDB_STORE_OVERRIDES, OVERRIDES_STORAGE_KEY, loadedOverrides);
      }
    }
  } catch (err) {
    console.warn('[PaymentPlans Rehydration] Server database fetch warning:', err);
  }

  // Tier 1: Try backend settings database
  try {
    const settings = await fetchAppSettings();
    if (settings) {
      if (Array.isArray(settings.paymentPlans) && settings.paymentPlans.length > 0) {
        loadedPlans = settings.paymentPlans;
        localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(loadedPlans));
        await setIDBItem(IDB_STORE_PLANS, PLANS_STORAGE_KEY, loadedPlans);
      }

      if (settings.paymentPlanOverrides && typeof settings.paymentPlanOverrides === 'object') {
        loadedOverrides = settings.paymentPlanOverrides;
        localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(loadedOverrides));
        await setIDBItem(IDB_STORE_OVERRIDES, OVERRIDES_STORAGE_KEY, loadedOverrides);
      }

      if (settings.customerPlans && typeof settings.customerPlans === 'object') {
        loadedCustomerPlans = settings.customerPlans;
        localStorage.setItem(CUSTOMER_PLANS_STORAGE_KEY, JSON.stringify(loadedCustomerPlans));
        await setIDBItem(IDB_STORE_CUSTOMER_PLANS, CUSTOMER_PLANS_STORAGE_KEY, loadedCustomerPlans);
      }
    }
  } catch (err) {
    console.warn('[PaymentPlans Rehydration] Server settings fetch warning:', err);
  }

  // Tier 2: Check IndexedDB for any items missing from server response
  try {
    if (loadedPlans.length === 0) {
      const idbPlans = await getIDBItem<PaymentPlan[]>(IDB_STORE_PLANS, PLANS_STORAGE_KEY);
      if (Array.isArray(idbPlans) && idbPlans.length > 0) {
        loadedPlans = idbPlans;
        localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(loadedPlans));
      }
    }

    if (Object.keys(loadedOverrides).length === 0) {
      const idbOverrides = await getIDBItem<OverridesMap>(IDB_STORE_OVERRIDES, OVERRIDES_STORAGE_KEY);
      if (idbOverrides && typeof idbOverrides === 'object') {
        loadedOverrides = idbOverrides;
        localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(loadedOverrides));
      }
    }

    if (Object.keys(loadedCustomerPlans).length === 0) {
      const idbCust = await getIDBItem<Record<string, any>>(IDB_STORE_CUSTOMER_PLANS, CUSTOMER_PLANS_STORAGE_KEY);
      if (idbCust && typeof idbCust === 'object') {
        loadedCustomerPlans = idbCust;
        localStorage.setItem(CUSTOMER_PLANS_STORAGE_KEY, JSON.stringify(loadedCustomerPlans));
      }
    }
  } catch (err) {
    console.warn('[PaymentPlans Rehydration] IndexedDB fetch warning:', err);
  }

  // If we have local plans or overrides in memory/localStorage not yet on server, sync up
  const localPlans = getStoredPaymentPlans();
  const localOverrides = getStoredPaymentOverrides();
  const localCustPlans = getAllCustomerPlanDefinitions();

  if (localPlans.length > 0 && loadedPlans.length === 0) {
    updateAppSettings({ paymentPlans: localPlans }).catch(() => {});
  }
  if (Object.keys(localOverrides).length > 0 && Object.keys(loadedOverrides).length === 0) {
    updateAppSettings({ paymentPlanOverrides: localOverrides }).catch(() => {});
  }
  if (Object.keys(localCustPlans).length > 0 && Object.keys(loadedCustomerPlans).length === 0) {
    updateAppSettings({ customerPlans: localCustPlans }).catch(() => {});
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SCHEDULE_CHANGE_EVENT));
  }

  return {
    plans: localPlans,
    overrides: localOverrides,
    customerPlans: localCustPlans,
  };
}
