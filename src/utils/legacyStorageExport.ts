/**
 * Read-Only Export Utility for Legacy Payment Plans Local Storage & IndexedDB.
 * 
 * IMPORTANT: This utility performs strictly read-only operations. It NEVER deletes,
 * clears, or mutates localStorage or IndexedDB records.
 */

import {
  PLANS_STORAGE_KEY,
  OVERRIDES_STORAGE_KEY,
  CUSTOMER_PLANS_STORAGE_KEY,
  IDB_DB_NAME,
} from './paymentPlansStorage';

export interface LegacyStoreExport {
  exportedAt: string;
  version: string;
  source: string;
  localStorage: {
    paymentPlans: any[];
    overrides: Record<string, any>;
    customerPlans: Record<string, any>;
    additionalOmarkKeys: Record<string, any>;
  };
  indexedDB: {
    dbName: string;
    exists: boolean;
    stores: Record<string, any[]>;
    error?: string;
  };
  summary: {
    totalPaymentPlansCount: number;
    totalOverridesCount: number;
    totalCustomerPlansCount: number;
    indexedDBStoresCount: number;
    totalIndexedDBRecordsCount: number;
  };
}

/**
 * Reads all data from an IndexedDB database without modifying anything.
 */
async function readIndexedDBReadOnly(dbName: string): Promise<{
  exists: boolean;
  stores: Record<string, any[]>;
  error?: string;
}> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return { exists: false, stores: {}, error: 'IndexedDB not available in current environment' };
  }

  return new Promise((resolve) => {
    try {
      // Check if DB exists by opening with current version (or version 1)
      const openReq = window.indexedDB.open(dbName);

      openReq.onerror = () => {
        resolve({
          exists: false,
          stores: {},
          error: openReq.error?.message || 'Failed to open database',
        });
      };

      openReq.onsuccess = async () => {
        const db = openReq.result;
        const storeNames = Array.from(db.objectStoreNames);

        if (storeNames.length === 0) {
          db.close();
          resolve({ exists: true, stores: {} });
          return;
        }

        const resultStores: Record<string, any[]> = {};
        let completed = 0;
        let hasError = false;

        storeNames.forEach((storeName) => {
          try {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const getAllReq = store.getAll();

            getAllReq.onsuccess = () => {
              resultStores[storeName] = getAllReq.result || [];
              completed++;
              if (completed === storeNames.length) {
                db.close();
                resolve({ exists: true, stores: resultStores });
              }
            };

            getAllReq.onerror = () => {
              resultStores[storeName] = [];
              completed++;
              if (completed === storeNames.length) {
                db.close();
                resolve({ exists: true, stores: resultStores });
              }
            };
          } catch (err: any) {
            hasError = true;
            resultStores[storeName] = [];
            completed++;
            if (completed === storeNames.length) {
              db.close();
              resolve({
                exists: true,
                stores: resultStores,
                error: err?.message || 'Error reading object stores',
              });
            }
          }
        });
      };
    } catch (err: any) {
      resolve({ exists: false, stores: {}, error: err?.message });
    }
  });
}

/**
 * Performs a complete, non-destructive read-only export of all local payment plan stores.
 */
export async function exportLegacyLocalStoreData(): Promise<LegacyStoreExport> {
  const exportedAt = new Date().toISOString();

  // 1. Read LocalStorage keys safely
  let plans: any[] = [];
  let overrides: Record<string, any> = {};
  let customerPlans: Record<string, any> = {};
  const additionalOmarkKeys: Record<string, any> = {};

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const rawPlans = localStorage.getItem(PLANS_STORAGE_KEY);
      if (rawPlans) plans = JSON.parse(rawPlans);
    } catch {
      plans = [];
    }

    try {
      const rawOverrides = localStorage.getItem(OVERRIDES_STORAGE_KEY);
      if (rawOverrides) overrides = JSON.parse(rawOverrides);
    } catch {
      overrides = {};
    }

    try {
      const rawCustPlans = localStorage.getItem(CUSTOMER_PLANS_STORAGE_KEY);
      if (rawCustPlans) customerPlans = JSON.parse(rawCustPlans);
    } catch {
      customerPlans = {};
    }

    // Inspect all other keys starting with 'omark_'
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          key.startsWith('omark_') &&
          key !== PLANS_STORAGE_KEY &&
          key !== OVERRIDES_STORAGE_KEY &&
          key !== CUSTOMER_PLANS_STORAGE_KEY
        ) {
          try {
            const rawVal = localStorage.getItem(key);
            additionalOmarkKeys[key] = rawVal ? JSON.parse(rawVal) : null;
          } catch {
            additionalOmarkKeys[key] = localStorage.getItem(key);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Read IndexedDB in readonly mode
  const idbData = await readIndexedDBReadOnly(IDB_DB_NAME);

  let totalIdbRecords = 0;
  Object.values(idbData.stores).forEach((records) => {
    totalIdbRecords += Array.isArray(records) ? records.length : 0;
  });

  const exportResult: LegacyStoreExport = {
    exportedAt,
    version: '1.0.0',
    source: 'omark-erp-frontend-legacy-local-store',
    localStorage: {
      paymentPlans: plans,
      overrides,
      customerPlans,
      additionalOmarkKeys,
    },
    indexedDB: {
      dbName: IDB_DB_NAME,
      exists: idbData.exists,
      stores: idbData.stores,
      error: idbData.error,
    },
    summary: {
      totalPaymentPlansCount: plans.length,
      totalOverridesCount: Object.keys(overrides).length,
      totalCustomerPlansCount: Object.keys(customerPlans).length,
      indexedDBStoresCount: Object.keys(idbData.stores).length,
      totalIndexedDBRecordsCount: totalIdbRecords,
    },
  };

  return exportResult;
}

/**
 * Generates and triggers a browser file download of the read-only legacy local store export.
 */
export async function downloadLegacyStoreExportFile(customFilename?: string): Promise<{
  success: boolean;
  filename: string;
  summary: LegacyStoreExport['summary'];
}> {
  const data = await exportLegacyLocalStoreData();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = customFilename || `omark-legacy-payment-store-export-${timestamp}.json`;

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    success: true,
    filename,
    summary: data.summary,
  };
}
