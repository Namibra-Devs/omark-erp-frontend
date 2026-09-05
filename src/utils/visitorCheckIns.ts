// src/utils/visitorCheckIns.ts
//
// Front-Desk Client & Visitor Check-Ins System
import { useState, useEffect, useMemo } from 'react';
import { getBranchCanonicalKey } from '@/utils/branchIsolation';

const STORAGE_KEY = 'omark_check_ins_storage';

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

const SEED_CHECK_INS: CheckInRecord[] = [];

export function getCheckIns(): CheckInRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Failed to load check-ins:', err);
  }
  return SEED_CHECK_INS;
}

export function saveCheckIns(records: CheckInRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new Event('omark-checkins-changed'));
  } catch (err) {
    console.error('Failed to save check-ins:', err);
  }
}

export function addCheckIn(record: Omit<CheckInRecord, 'id' | 'code' | 'createdAt' | 'updatedAt'>): CheckInRecord {
  const all = getCheckIns();
  const branchKey = (record.branchId || 'ACC').slice(0, 3).toUpperCase();
  const year = new Date().getFullYear();
  const seq = String(all.length + 1).padStart(3, '0');
  const code = `${branchKey}-CHK-${year}-${seq}`;

  const newRecord: CheckInRecord = {
    ...record,
    id: `chk-${Date.now()}`,
    code,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveCheckIns([newRecord, ...all]);
  return newRecord;
}

export function updateCheckIn(id: string, updates: Partial<CheckInRecord>): CheckInRecord {
  const all = getCheckIns();
  const index = all.findIndex((r) => r.id === id);
  if (index === -1) throw new Error('Check-in record not found');

  const updated: CheckInRecord = {
    ...all[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  all[index] = updated;
  saveCheckIns([...all]);
  return updated;
}

export function checkOutVisitor(id: string, notes?: string): CheckInRecord {
  return updateCheckIn(id, {
    status: 'completed',
    checkOutTime: new Date().toISOString(),
    ...(notes ? { notes } : {}),
  });
}

export function deleteCheckIn(id: string): void {
  const all = getCheckIns();
  const updated = all.filter((r) => r.id !== id);
  saveCheckIns(updated);
}

export function useCheckIns(branchId?: string) {
  const [records, setRecords] = useState<CheckInRecord[]>(() => getCheckIns());

  useEffect(() => {
    const refresh = () => setRecords(getCheckIns());
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

  return {
    records: filteredRecords,
    allRecords: records,
    addCheckIn,
    updateCheckIn,
    checkOutVisitor,
    deleteCheckIn,
  };
}
