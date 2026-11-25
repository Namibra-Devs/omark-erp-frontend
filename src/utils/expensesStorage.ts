// src/utils/expensesStorage.ts
import dayjs from 'dayjs';

// Pluggable settings API handlers to enable server database persistence while remaining pure in Node tests
let fetchSettingsFn: (() => Promise<any>) | null = null;
let updateSettingsFn: ((payload: any) => Promise<any>) | null = null;

export function setSettingsApiHandlers(
  fetchFn: () => Promise<any>,
  updateFn: (payload: any) => Promise<any>
) {
  fetchSettingsFn = fetchFn;
  updateSettingsFn = updateFn;
}

export interface ExpenseEntity {
  id: string;
  code?: string;
  category: string;
  type: 'internal' | 'external';
  amountMinor: number;
  incurredOn: string;
  branchId?: string;
  branchName?: string;
  department?: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  recordedByUserId?: string;
  recordedByUserName?: string;
  recordedByUserRole?: string;
  decisionNote?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const EXPENSES_STORAGE_KEY = 'omark_expenses_records_store';
export const DELETED_EXPENSES_STORAGE_KEY = 'omark_deleted_expense_ids';
export const IDB_DB_NAME = 'omark_erp_expenses_db';
export const IDB_STORE_NAME = 'expenses_data';
export const EXPENSES_CHANGE_EVENT = 'omark-expenses-changed';

export function isDummyFuelExpense(expense: any): boolean {
  if (!expense) return false;
  const code = String(expense.code || '').toUpperCase();
  const desc = String(expense.description || '').trim().toUpperCase();
  const name = String(expense.recordedByUserName || '').trim().toLowerCase();

  // Filter out repeated placeholder ATM-EXP-* FUEL records with generic "Staff Member"
  if (
    code.startsWith('ATM-EXP-') &&
    (desc === 'FUEL' || desc === '') &&
    (!expense.recordedByUserId || name === 'staff member' || name === '')
  ) {
    return true;
  }
  return false;
}

export const DEFAULT_ROLE_OPERATIONAL_EXPENSES: ExpenseEntity[] = [];

export function normalizeExpenseEntity(raw: any): ExpenseEntity {
  if (!raw) return raw;
  const id = String(raw.id || raw._id || `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

  // Handle amountMinor vs amount
  let amountMinor = 0;
  if (typeof raw.amountMinor === 'number' && !isNaN(raw.amountMinor)) {
    amountMinor = raw.amountMinor;
  } else if (raw.amountMinor != null && !isNaN(Number(raw.amountMinor))) {
    amountMinor = Number(raw.amountMinor);
  } else if (raw.amount != null && !isNaN(Number(raw.amount))) {
    amountMinor = Math.round(Number(raw.amount) * 100);
  } else if (raw.amountPesewas != null && !isNaN(Number(raw.amountPesewas))) {
    amountMinor = Number(raw.amountPesewas);
  }

  // Handle incurredOn
  const incurredOn =
    raw.incurredOn ||
    raw.incurredDate ||
    raw.date ||
    raw.createdAt ||
    new Date().toISOString();

  // Handle status casing
  let status: 'pending' | 'approved' | 'rejected' = 'pending';
  const rawStatus = String(raw.status || '').toLowerCase().trim();
  if (rawStatus === 'approved' || rawStatus === 'authorized') {
    status = 'approved';
  } else if (rawStatus === 'rejected' || rawStatus === 'declined') {
    status = 'rejected';
  } else {
    status = 'pending';
  }

  // Handle code
  const code = raw.code || raw.voucherNo || raw.reference || `EXP-${id.slice(-4).toUpperCase()}`;

  const type: 'internal' | 'external' =
    String(raw.type || '').toLowerCase() === 'external' ? 'external' : 'internal';

  return {
    id,
    code,
    category: raw.category || 'General Operations',
    type,
    amountMinor,
    incurredOn: dayjs(incurredOn).isValid() ? dayjs(incurredOn).format('YYYY-MM-DD') : incurredOn,
    branchId: raw.branchId || (typeof raw.branch === 'object' ? raw.branch?.id : raw.branch) || undefined,
    branchName: raw.branchName || (typeof raw.branch === 'object' ? raw.branch?.name : undefined) || undefined,
    department: raw.department || undefined,
    description: raw.description || raw.notes || raw.title || undefined,
    status,
    recordedByUserId:
      raw.recordedByUserId ||
      raw.userId ||
      raw.createdById ||
      raw.createdByUserId ||
      (typeof raw.createdBy === 'object' ? raw.createdBy?.id : (typeof raw.createdBy === 'string' ? raw.createdBy : undefined)) ||
      (typeof raw.user === 'object' ? raw.user?.id : undefined) ||
      undefined,
    recordedByUserName:
      raw.recordedByUserName ||
      raw.userName ||
      raw.createdByName ||
      (typeof raw.createdBy === 'object' ? (raw.createdBy?.name || `${raw.createdBy?.firstName || ''} ${raw.createdBy?.lastName || ''}`.trim()) : undefined) ||
      (typeof raw.user === 'object' ? (raw.user?.name || `${raw.user?.firstName || ''} ${raw.user?.lastName || ''}`.trim()) : undefined) ||
      undefined,
    recordedByUserRole:
      raw.recordedByUserRole ||
      raw.userRole ||
      raw.role ||
      (typeof raw.createdBy === 'object' ? raw.createdBy?.role : undefined) ||
      (typeof raw.user === 'object' ? raw.user?.role : undefined) ||
      undefined,
    decisionNote: raw.decisionNote || raw.rejectionNote || undefined,
    decidedAt: raw.decidedAt || undefined,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

// ── IndexedDB Engine for Durable Browser Persistence ─────────────────────────
function openExpensesDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(IDB_DB_NAME, 1);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('[Expenses IDB] Failed to open IndexedDB:', request.error);
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

export async function getIndexedDBExpenses(): Promise<ExpenseEntity[] | null> {
  try {
    const db = await openExpensesDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(EXPENSES_STORAGE_KEY);
      req.onsuccess = () => {
        const res = req.result;
        resolve(Array.isArray(res) ? (res as ExpenseEntity[]) : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setIndexedDBExpenses(expenses: ExpenseEntity[]): Promise<void> {
  try {
    const db = await openExpensesDB();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.put(expenses, EXPENSES_STORAGE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Fail silently
  }
}

// ── Deleted Expense Tracking ─────────────────────────────────────────────────
export function getDeletedExpenseIds(): Set<string> {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(DELETED_EXPENSES_STORAGE_KEY) : null;
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    return new Set<string>(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

export function recordDeletedExpenseId(id: string): void {
  try {
    const current = getDeletedExpenseIds();
    current.add(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(DELETED_EXPENSES_STORAGE_KEY, JSON.stringify(Array.from(current)));
    }
  } catch {}
}

// ── Background Debounced Push to Server Database (/settings) ──────────────────
let expenseSyncTimer: any = null;

export async function syncExpensesToBackend(expenses: ExpenseEntity[]): Promise<void> {
  // Always update IndexedDB immediately for instant offline resilience
  await setIndexedDBExpenses(expenses);

  // Sync to backend settings API (persists in PostgreSQL database on server)
  if (expenseSyncTimer) clearTimeout(expenseSyncTimer);
  expenseSyncTimer = setTimeout(async () => {
    try {
      if (updateSettingsFn) {
        await updateSettingsFn({
          expensesStore: expenses,
          deletedExpenseIds: Array.from(getDeletedExpenseIds()),
        });
      }
    } catch (err) {
      console.warn('[Expenses Storage] Error syncing to backend settings:', err);
    }
  }, 250);
}

// ── Deduplicated Merging Engine ──────────────────────────────────────────────
export function mergeExpenses(
  primaryList: ExpenseEntity[],
  fallbackList: ExpenseEntity[] = DEFAULT_ROLE_OPERATIONAL_EXPENSES
): ExpenseEntity[] {
  const map = new Map<string, ExpenseEntity>();
  const deletedIds = getDeletedExpenseIds();

  // 1. Seed fallback list first (if not deleted and not dummy)
  if (Array.isArray(fallbackList)) {
    for (const item of fallbackList) {
      if (item && item.id && !deletedIds.has(item.id) && !isDummyFuelExpense(item)) {
        map.set(item.id, normalizeExpenseEntity(item));
      }
    }
  }

  // 2. Overlay primary list (server records or stored items take priority)
  if (Array.isArray(primaryList)) {
    for (const item of primaryList) {
      if (item && item.id && !deletedIds.has(item.id) && !isDummyFuelExpense(item)) {
        map.set(item.id, normalizeExpenseEntity(item));
      }
    }
  }

  // 3. Overlay any existing unsynced records from localStorage if present
  try {
    const rawLocal = typeof window !== 'undefined' ? localStorage.getItem(EXPENSES_STORAGE_KEY) : null;
    if (rawLocal) {
      const localList: ExpenseEntity[] = JSON.parse(rawLocal);
      if (Array.isArray(localList)) {
        for (const lt of localList) {
          if (lt && lt.id && !deletedIds.has(lt.id) && !isDummyFuelExpense(lt) && !map.has(lt.id)) {
            map.set(lt.id, normalizeExpenseEntity(lt));
          }
        }
      }
    }
  } catch {}

  return Array.from(map.values());
}

// ── Read Synchronously from LocalStorage with Resilient Baseline Seeding ──────
export function getStoredExpenses(): ExpenseEntity[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(EXPENSES_STORAGE_KEY) : null;
    const deletedIds = getDeletedExpenseIds();

    if (!raw) {
      // In case localStorage was just cleared (e.g. cookies/site data deleted):
      // Check IndexedDB asynchronously in background to restore user's saved records
      if (typeof window !== 'undefined') {
        getIndexedDBExpenses().then((idb) => {
          if (Array.isArray(idb) && idb.length > 0) {
            const cleanIdb = idb.filter((e) => !isDummyFuelExpense(e) && !deletedIds.has(e.id));
            if (cleanIdb.length > 0) {
              const merged = mergeExpenses(cleanIdb, []);
              localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(merged));
              window.dispatchEvent(new Event(EXPENSES_CHANGE_EVENT));
            }
          }
        }).catch(() => {});
      }

      return [];
    }

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Clean out dummy fuel records and deleted items
      const clean = parsed.filter((item: any) => {
        if (!item || !item.id) return false;
        if (deletedIds.has(item.id)) return false;
        if (isDummyFuelExpense(item)) return false;
        return true;
      });

      return clean;
    }

    return [];
  } catch (err) {
    console.warn('[Omark Expenses] Failed to read stored expenses:', err);
    return [];
  }
}

// ── Save Stored Expense Locally and Synchronize Everywhere ───────────────────
export function saveStoredExpense(expense: ExpenseEntity): void {
  try {
    const normalized = normalizeExpenseEntity(expense);
    const list = getStoredExpenses();
    const existingIndex = list.findIndex((e) => e.id === normalized.id);
    let next: ExpenseEntity[];
    if (existingIndex >= 0) {
      next = [...list];
      next[existingIndex] = {
        ...next[existingIndex],
        ...normalized,
        updatedAt: new Date().toISOString(),
      };
    } else {
      next = [normalized, ...list];
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EXPENSES_CHANGE_EVENT));
    }
    // Sync to IndexedDB and server database settings
    syncExpensesToBackend(next).catch(() => {});
  } catch (err) {
    console.warn('[Omark Expenses] Failed to save expense locally:', err);
  }
}

export async function saveStoredExpenses(expenses: ExpenseEntity[]): Promise<void> {
  try {
    const deletedIds = getDeletedExpenseIds();
    const clean = expenses.filter((e) => !deletedIds.has(e.id) && !isDummyFuelExpense(e));
    if (typeof window !== 'undefined') {
      localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(clean));
      window.dispatchEvent(new Event(EXPENSES_CHANGE_EVENT));
    }
    await syncExpensesToBackend(clean);
  } catch (err) {
    console.warn('[Omark Expenses] Failed to bulk save stored expenses:', err);
  }
}

// ── Delete Stored Expense ────────────────────────────────────────────────────
export function deleteStoredExpense(id: string): void {
  try {
    recordDeletedExpenseId(id);
    const list = getStoredExpenses().filter((e) => e.id !== id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new Event(EXPENSES_CHANGE_EVENT));
    }
    syncExpensesToBackend(list).catch(() => {});
  } catch (err) {
    console.warn('[Omark Expenses] Failed to delete expense locally:', err);
  }
}

// ── Universal Rehydration from Server Database & IndexedDB ───────────────────
export async function rehydrateAllExpensesData(): Promise<ExpenseEntity[]> {
  const deletedIds = getDeletedExpenseIds();

  // Tier 1: Authoritative Cloud / Backend Database Store via /settings
  try {
    if (fetchSettingsFn) {
      const settings = await fetchSettingsFn();
      if (settings) {
        if (Array.isArray(settings.deletedExpenseIds)) {
          settings.deletedExpenseIds.forEach((id: string) => recordDeletedExpenseId(id));
        }
        if (Array.isArray(settings.expensesStore) && settings.expensesStore.length > 0) {
          const merged = mergeExpenses(settings.expensesStore, []);
          if (typeof window !== 'undefined') {
            localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(merged));
            window.dispatchEvent(new Event(EXPENSES_CHANGE_EVENT));
          }
          await setIndexedDBExpenses(merged);
          return merged;
        }
      }
    }
  } catch (err) {
    console.warn('[Expenses Rehydration] Server settings fetch warning:', err);
  }

  // Tier 2: IndexedDB (survives cookie deletion in many browsers)
  try {
    const idbExpenses = await getIndexedDBExpenses();
    if (Array.isArray(idbExpenses) && idbExpenses.length > 0) {
      const merged = mergeExpenses(idbExpenses, []);
      if (typeof window !== 'undefined') {
        localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(merged));
        window.dispatchEvent(new Event(EXPENSES_CHANGE_EVENT));
      }
      // Background push to server settings
      if (updateSettingsFn) {
        updateSettingsFn({
          expensesStore: merged,
          deletedExpenseIds: Array.from(deletedIds),
        }).catch(() => {});
      }
      return merged;
    }
  } catch (err) {
    console.warn('[Expenses Rehydration] IndexedDB fetch warning:', err);
  }

  // Tier 3: Fallback to LocalStorage or Baseline
  const current = getStoredExpenses();
  setIndexedDBExpenses(current).catch(() => {});
  if (updateSettingsFn) {
    updateSettingsFn({
      expensesStore: current,
      deletedExpenseIds: Array.from(deletedIds),
    }).catch(() => {});
  }
  return current;
}
