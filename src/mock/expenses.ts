// src/mock/expenses.ts
//
// ⚠️ PROTOTYPE — local-only, not backed by a real API. ⚠️
// There is no expense-tracking endpoint anywhere in the real API. This is
// a localStorage-backed store so Accounts can record and review internal
// and external expenses end to end until a real endpoint exists.
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'omark_mock_expenses';

export type ExpenseType = 'internal' | 'external';

export interface Expense {
  id: string;
  code: string;
  category: string;
  description: string;
  amountMinor: number;
  type: ExpenseType;
  date: string;
  recordedBy: string;
  /** When this record was actually created — distinct from `date` (the expense's effective date, which can be backdated). Used for activity-feed ordering. */
  recordedAt: string;
}

const SEED: Expense[] = [
  { id: 'fin-exp-seed-1', code: 'FIN-EXP-2026-001', category: 'Office Supplies', description: 'Stationery and printing supplies for HQ', amountMinor: 1_200_00 * 100, type: 'internal', date: '2026-07-10', recordedBy: 'Accounts', recordedAt: '2026-07-10T09:00:00.000Z' },
  { id: 'fin-exp-seed-2', code: 'FIN-EXP-2026-002', category: 'Staff Transport', description: 'Fuel allowance reimbursements', amountMinor: 850_00 * 100, type: 'internal', date: '2026-07-14', recordedBy: 'Accounts', recordedAt: '2026-07-14T09:00:00.000Z' },
  { id: 'fin-exp-seed-3', code: 'FIN-EXP-2026-003', category: 'Utilities', description: 'Electricity and water — HQ office', amountMinor: 2_300_00 * 100, type: 'internal', date: '2026-07-18', recordedBy: 'Accounts', recordedAt: '2026-07-18T09:00:00.000Z' },
  { id: 'fin-exp-seed-4', code: 'FIN-EXP-2026-004', category: 'Legal & Consultancy', description: 'External legal review of land documentation', amountMinor: 4_500_00 * 100, type: 'external', date: '2026-07-20', recordedBy: 'Accounts', recordedAt: '2026-07-20T09:00:00.000Z' },
];

// Backfills `recordedAt`, added after this store first shipped, so records
// already sitting in a user's localStorage from an earlier session don't
// come back missing it and crash downstream consumers.
const normalize = (expense: Expense): Expense => ({
  ...expense,
  recordedAt: expense.recordedAt ?? `${expense.date}T00:00:00.000Z`,
});

const load = (): Expense[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return (JSON.parse(raw) as Expense[]).map(normalize);
  } catch {
    // ignore malformed storage
  }
  save(SEED);
  return SEED;
};

const save = (expenses: Expense[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  window.dispatchEvent(new Event('omark-expenses-changed'));
};

const nextCode = (expenses: Expense[]) => {
  const year = new Date().getFullYear();
  const countThisYear = expenses.filter((e) => e.code.includes(`-${year}-`)).length;
  return `FIN-EXP-${year}-${String(countThisYear + 1).padStart(3, '0')}`;
};

export const getAllExpenses = (): Expense[] => load().sort((a, b) => b.date.localeCompare(a.date));

export const addExpense = (input: {
  category: string;
  description: string;
  amountMinor: number;
  type: ExpenseType;
  date: string;
  recordedBy: string;
}): Expense => {
  const expenses = load();
  const expense: Expense = { id: `expense-${Date.now()}`, code: nextCode(expenses), recordedAt: new Date().toISOString(), ...input };
  save([...expenses, expense]);
  return expense;
};

export const deleteExpense = (id: string) => {
  save(load().filter((e) => e.id !== id));
};

export const useExpenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>(() => getAllExpenses());

  useEffect(() => {
    const refresh = () => setExpenses(getAllExpenses());
    window.addEventListener('omark-expenses-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('omark-expenses-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return expenses;
};
