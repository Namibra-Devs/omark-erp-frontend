// src/mock/checkIns.ts
//
// Front-Desk Client & Visitor Check-Ins System
// Records incoming clients, walk-ins, and visitors with branch isolation.
import { useState, useEffect, useMemo } from 'react';
import { generateRecordCode, mockBranches } from '@/mock/branches';
import { getBranchCanonicalKey } from '@/utils/branchIsolation';

const STORAGE_KEY = 'omark_mock_check_ins';

export type CheckInStatus = 'waiting' | 'in_premises' | 'completed' | 'canceled';
export type VisitorCategory = 'customer' | 'prospect' | 'contractor' | 'legal_survey' | 'inquiry' | 'vip' | 'other';

export interface CheckInRecord {
  id: string;
  code: string;
  branchId: string;
  visitorName: string;
  phoneNumber: string;
  email?: string;
  category: VisitorCategory;
  purpose: string;
  hostStaffId?: string;
  hostStaffName?: string;
  hostDepartment?: string;
  checkInTime: string;
  checkOutTime?: string;
  status: CheckInStatus;
  badgeNumber?: string;
  notes?: string;
  handledByUserId?: string;
  handledByName?: string;
  createdAt: string;
  updatedAt: string;
}

export const visitorCategoryLabels: Record<VisitorCategory, { label: string; color: string }> = {
  customer: { label: 'Existing Customer', color: 'blue' },
  prospect: { label: 'Prospective Client', color: 'purple' },
  inquiry: { label: 'General Inquiry', color: 'cyan' },
  contractor: { label: 'Vendor / Contractor', color: 'orange' },
  legal_survey: { label: 'Legal / Surveyor', color: 'geekblue' },
  vip: { label: 'VIP Guest', color: 'gold' },
  other: { label: 'Other Visitor', color: 'default' },
};

export const checkInStatusLabels: Record<CheckInStatus, { label: string; color: string }> = {
  waiting: { label: 'Waiting in Lobby', color: 'orange' },
  in_premises: { label: 'On Premises', color: 'green' },
  completed: { label: 'Checked Out', color: 'blue' },
  canceled: { label: 'Canceled / Left', color: 'default' },
};

const SEED_CHECK_INS: CheckInRecord[] = [
  {
    id: 'chk-1',
    code: 'ACC-CHK-2026-001',
    branchId: 'b2', // Accra Main
    visitorName: 'Kwesi Appiah',
    phoneNumber: '+233 24 456 7890',
    email: 'kwesi.appiah@gmail.com',
    category: 'customer',
    purpose: 'Deed of Assignment Documentation & Signatures',
    hostStaffName: 'Ama Boateng (Secretary)',
    hostDepartment: 'Administration',
    checkInTime: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    status: 'in_premises',
    badgeNumber: 'VIS-012',
    notes: 'Came to finalize signatures for plot at Oyarifa scheme.',
    handledByName: 'Sarah Mensah',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'chk-2',
    code: 'ACC-CHK-2026-002',
    branchId: 'b2',
    visitorName: 'Dr. Michael Antwi',
    phoneNumber: '+233 50 123 4567',
    email: 'm.antwi@korlebu.edu.gh',
    category: 'vip',
    purpose: 'Meeting with Marketing Director on Executive Plots',
    hostStaffName: 'Director Overview',
    hostDepartment: 'Marketing',
    checkInTime: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    checkOutTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    status: 'completed',
    badgeNumber: 'VIS-008',
    notes: 'Discussed prime waterfront plots. Follow-up meeting scheduled for next Tuesday.',
    handledByName: 'Sarah Mensah',
    createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'chk-3',
    code: 'ACC-CHK-2026-003',
    branchId: 'b2',
    visitorName: 'Ebenezer Quaye',
    phoneNumber: '+233 27 890 1234',
    category: 'inquiry',
    purpose: 'Payment Plan schedule inquiry and brochure collection',
    hostStaffName: 'Accounts Officer',
    hostDepartment: 'Accounts & Finance',
    checkInTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    status: 'waiting',
    badgeNumber: 'VIS-015',
    notes: 'Waiting in reception for Accounts Rep.',
    handledByName: 'Sarah Mensah',
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'chk-4',
    code: 'KMA-CHK-2026-001',
    branchId: 'b1', // Kumasi Main
    visitorName: 'Akosua Serwaa',
    phoneNumber: '+233 54 998 8776',
    category: 'customer',
    purpose: 'Receipt verification and payment plan statement',
    hostStaffName: 'Accounts Officer',
    hostDepartment: 'Accounts & Finance',
    checkInTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: 'in_premises',
    badgeNumber: 'KMA-003',
    notes: 'Making instalment deposit via direct transfer.',
    handledByName: 'Kumasi CS Desk',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'chk-5',
    code: 'WA-CHK-2026-001',
    branchId: 'wa', // Wa Branch
    visitorName: 'Alhassan Musah',
    phoneNumber: '+233 20 555 4433',
    category: 'prospect',
    purpose: 'Site visit scheduling for Wa West residential plots',
    hostStaffName: 'Wa Marketing Rep',
    hostDepartment: 'Marketing',
    checkInTime: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    status: 'in_premises',
    badgeNumber: 'WA-001',
    notes: 'Walk-in prospect asking about 70x100ft plots.',
    handledByName: 'Wa Customer Service',
    createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
  {
    id: 'chk-6',
    code: 'TAF-CHK-2026-001',
    branchId: 'tafo', // Tafo Branch
    visitorName: 'Osei Bonsu',
    phoneNumber: '+233 24 111 2233',
    category: 'contractor',
    purpose: 'Road grading bill of quantities submission',
    hostStaffName: 'Tafo Branch Manager',
    hostDepartment: 'Operations',
    checkInTime: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    checkOutTime: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    status: 'completed',
    badgeNumber: 'TAF-004',
    notes: 'Submitted road construction quotation for Tafo site.',
    handledByName: 'Tafo CS Desk',
    createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
];

const loadCheckIns = (): CheckInRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  saveCheckIns(SEED_CHECK_INS);
  return SEED_CHECK_INS;
};

export const saveCheckIns = (records: CheckInRecord[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event('omark-checkins-changed'));
};

export const getCheckIns = (): CheckInRecord[] => loadCheckIns();

export const addCheckIn = (input: Omit<CheckInRecord, 'id' | 'code' | 'createdAt' | 'updatedAt'>): CheckInRecord => {
  const records = loadCheckIns();
  const branchKey = getBranchCanonicalKey(input.branchId || 'accra').toUpperCase();
  const year = new Date().getFullYear();
  const countForBranchThisYear = records.filter((r) => r.branchId === input.branchId && r.code?.includes(`-${year}-`)).length;
  const prefix = branchKey.slice(0, 3);
  const code = generateRecordCode(prefix, 'CHK', countForBranchThisYear + 1, year);

  const now = new Date().toISOString();
  const newRecord: CheckInRecord = {
    id: `chk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    code,
    ...input,
    createdAt: now,
    updatedAt: now,
  };

  saveCheckIns([newRecord, ...records]);
  return newRecord;
};

export const updateCheckIn = (id: string, updates: Partial<CheckInRecord>): CheckInRecord => {
  const records = loadCheckIns();
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error('Check-in record not found');

  const updated: CheckInRecord = {
    ...records[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  records[idx] = updated;
  saveCheckIns(records);
  return updated;
};

export const checkOutVisitor = (id: string, notes?: string): CheckInRecord => {
  return updateCheckIn(id, {
    status: 'completed',
    checkOutTime: new Date().toISOString(),
    ...(notes ? { notes } : {}),
  });
};

export const deleteCheckIn = (id: string) => {
  const records = loadCheckIns();
  const filtered = records.filter((r) => r.id !== id);
  saveCheckIns(filtered);
};

export const useCheckIns = (branchId?: string) => {
  const [records, setRecords] = useState<CheckInRecord[]>(() => loadCheckIns());

  useEffect(() => {
    const refresh = () => setRecords(loadCheckIns());
    window.addEventListener('omark-checkins-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('omark-checkins-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const filteredRecords = useMemo(() => {
    if (!branchId || branchId === 'all') return records;
    const targetKey = getBranchCanonicalKey(branchId);
    return records.filter((r) => getBranchCanonicalKey(r.branchId) === targetKey);
  }, [records, branchId]);

  const activeCount = useMemo(() => {
    return filteredRecords.filter((r) => r.status === 'in_premises' || r.status === 'waiting').length;
  }, [filteredRecords]);

  return {
    records: filteredRecords,
    allRecords: records,
    activeCount,
    addCheckIn,
    updateCheckIn,
    checkOutVisitor,
    deleteCheckIn,
  };
};
