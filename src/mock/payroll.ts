// src/mock/payroll.ts
//
// ⚠️ PROTOTYPE — local-only, not backed by a real API. ⚠️
// There is no payroll module anywhere in the real app — no endpoints, no
// payroll or bonus concept at all. This is a localStorage-backed store so
// Accounts can actually run payroll and manage bonuses end to end (add
// entries, adjust status) until a real endpoint exists. Records use the
// same BRANCHCODE-TYPE-YEAR-### coding scheme as the rest of the branch
// prototype (see generateRecordCode in src/mock/branches.ts).
import { useEffect, useState } from 'react';
import { generateRecordCode, mockBranches } from '@/mock/branches';

const STORAGE_KEY = 'omark_mock_payroll';

export type PayrollStatus = 'pending' | 'processed' | 'paid';

export interface PayrollRecord {
  id: string;
  code: string;
  branchId: string;
  staffName: string;
  role: string;
  month: string;
  basePayMinor: number;
  bonusMinor: number;
  deductionsMinor: number;
  netPayMinor: number;
  status: PayrollStatus;
  createdAt: string;
  updatedAt: string;
}

const SEED: PayrollRecord[] = [
  { id: 'pr-hq-1', code: 'HQ-PAYR-2026-001', branchId: 'branch-accra-hq', staffName: 'Kindo Original', role: 'Branch Manager', month: 'July 2026', basePayMinor: 12_000_00 * 100, bonusMinor: 0, deductionsMinor: 1_800_00 * 100, netPayMinor: 10_200_00 * 100, status: 'paid', createdAt: '2026-07-01T09:00:00.000Z', updatedAt: '2026-07-05T09:00:00.000Z' },
  { id: 'pr-hq-2', code: 'HQ-PAYR-2026-002', branchId: 'branch-accra-hq', staffName: 'Sarah Mensah', role: 'Customer Service', month: 'July 2026', basePayMinor: 4_500_00 * 100, bonusMinor: 500_00 * 100, deductionsMinor: 600_00 * 100, netPayMinor: 4_400_00 * 100, status: 'paid', createdAt: '2026-07-01T09:00:00.000Z', updatedAt: '2026-07-05T09:00:00.000Z' },
  { id: 'pr-hq-3', code: 'HQ-PAYR-2026-003', branchId: 'branch-accra-hq', staffName: 'Jawaad Ismael', role: 'Marketing Staff', month: 'July 2026', basePayMinor: 4_000_00 * 100, bonusMinor: 1_000_00 * 100, deductionsMinor: 500_00 * 100, netPayMinor: 4_500_00 * 100, status: 'processed', createdAt: '2026-07-01T09:00:00.000Z', updatedAt: '2026-07-03T09:00:00.000Z' },
  { id: 'pr-kma-1', code: 'KMA-PAYR-2026-001', branchId: 'branch-kumasi', staffName: 'Ama Boateng', role: 'Branch Manager', month: 'July 2026', basePayMinor: 8_500_00 * 100, bonusMinor: 0, deductionsMinor: 1_200_00 * 100, netPayMinor: 7_300_00 * 100, status: 'paid', createdAt: '2026-07-01T09:00:00.000Z', updatedAt: '2026-07-05T09:00:00.000Z' },
  { id: 'pr-kma-2', code: 'KMA-PAYR-2026-002', branchId: 'branch-kumasi', staffName: 'Yaw Boadi', role: 'Customer Service', month: 'July 2026', basePayMinor: 3_500_00 * 100, bonusMinor: 0, deductionsMinor: 450_00 * 100, netPayMinor: 3_050_00 * 100, status: 'pending', createdAt: '2026-07-01T09:00:00.000Z', updatedAt: '2026-07-01T09:00:00.000Z' },
  { id: 'pr-tkd-1', code: 'TKD-PAYR-2026-001', branchId: 'branch-takoradi', staffName: 'Kwesi Mensah', role: 'Branch Manager', month: 'July 2026', basePayMinor: 7_000_00 * 100, bonusMinor: 0, deductionsMinor: 950_00 * 100, netPayMinor: 6_050_00 * 100, status: 'processed', createdAt: '2026-07-01T09:00:00.000Z', updatedAt: '2026-07-03T09:00:00.000Z' },
  { id: 'pr-tkd-2', code: 'TKD-PAYR-2026-002', branchId: 'branch-takoradi', staffName: 'Efua Baiden', role: 'Customer Service', month: 'July 2026', basePayMinor: 3_200_00 * 100, bonusMinor: 0, deductionsMinor: 400_00 * 100, netPayMinor: 2_800_00 * 100, status: 'pending', createdAt: '2026-07-01T09:00:00.000Z', updatedAt: '2026-07-01T09:00:00.000Z' },
  { id: 'pr-tam-1', code: 'TAM-PAYR-2026-001', branchId: 'branch-tamale', staffName: 'Fatima Iddrisu', role: 'Branch Manager', month: 'July 2026', basePayMinor: 6_500_00 * 100, bonusMinor: 0, deductionsMinor: 850_00 * 100, netPayMinor: 5_650_00 * 100, status: 'pending', createdAt: '2026-07-01T09:00:00.000Z', updatedAt: '2026-07-01T09:00:00.000Z' },
];

// Backfills fields added after this store first shipped (createdAt/updatedAt),
// so records already sitting in a user's localStorage from an earlier
// session don't come back missing them and crash downstream consumers.
const normalize = (record: PayrollRecord): PayrollRecord => ({
  ...record,
  bonusMinor: record.bonusMinor ?? 0,
  createdAt: record.createdAt ?? '2026-07-01T09:00:00.000Z',
  updatedAt: record.updatedAt ?? record.createdAt ?? '2026-07-01T09:00:00.000Z',
});

const load = (): PayrollRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return (JSON.parse(raw) as PayrollRecord[]).map(normalize);
  } catch {
    // ignore malformed storage
  }
  save(SEED);
  return SEED;
};

const save = (records: PayrollRecord[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event('omark-payroll-changed'));
};

const nextCodeForBranch = (records: PayrollRecord[], branchId: string) => {
  const branch = mockBranches.find((b) => b.id === branchId);
  const year = new Date().getFullYear();
  const countForBranchThisYear = records.filter((r) => r.branchId === branchId && r.code.includes(`-${year}-`)).length;
  return generateRecordCode(branch?.code ?? branchId, 'PAYR', countForBranchThisYear + 1, year);
};

export const getBranchPayroll = (branchId: string): PayrollRecord[] => load().filter((r) => r.branchId === branchId);

export const getAllBranchPayroll = (): PayrollRecord[] => load();

export const addPayrollRecord = (input: {
  branchId: string;
  staffName: string;
  role: string;
  month: string;
  basePayMinor: number;
  bonusMinor: number;
  deductionsMinor: number;
}): PayrollRecord => {
  const records = load();
  const netPayMinor = input.basePayMinor + input.bonusMinor - input.deductionsMinor;
  const now = new Date().toISOString();
  const record: PayrollRecord = {
    id: `payroll-${Date.now()}`,
    code: nextCodeForBranch(records, input.branchId),
    status: 'pending',
    netPayMinor,
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  save([...records, record]);
  return record;
};

export const updatePayrollStatus = (id: string, status: PayrollStatus) => {
  save(load().map((r) => (r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r)));
};

export const useAllPayroll = () => {
  const [records, setRecords] = useState<PayrollRecord[]>(() => getAllBranchPayroll());

  useEffect(() => {
    const refresh = () => setRecords(getAllBranchPayroll());
    window.addEventListener('omark-payroll-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('omark-payroll-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return records;
};
