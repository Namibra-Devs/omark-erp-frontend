// src/utils/visitorCheckIns.ts
//
// Front-Desk Client & Visitor Check-Ins System
import { useState, useEffect, useMemo } from 'react';
import { getBranchCanonicalKey } from '@/utils/branchIsolation';

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

export const DEFAULT_SEEDED_CHECK_INS: CheckInRecord[] = [
  {
    id: 'chk-seed-1',
    code: 'ACC-CHK-2026-001',
    branchId: 'b2',
    visitorName: 'Michael Mensah-Bonsu',
    phoneNumber: '+233 24 412 3456',
    email: 'michael.mensah@gmail.com',
    category: 'customer',
    purpose: 'Deed of Assignment Documentation & Signatures',
    hostStaffName: 'Francis Ofori',
    hostDepartment: 'Customer Service',
    checkInTime: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    status: 'in_premises',
    badgeNumber: 'VIS-012',
    handledByName: 'Front Desk Reception',
    createdAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
  },
  {
    id: 'chk-seed-2',
    code: 'ACC-CHK-2026-002',
    branchId: 'b2',
    visitorName: 'Dr. Evelyn Addo',
    phoneNumber: '+233 20 898 7654',
    category: 'prospect',
    purpose: 'Site Visit / Plot Inspection Inquiries',
    hostStaffName: 'Kojo Antwi',
    hostDepartment: 'Marketing & Sales',
    checkInTime: new Date(Date.now() - 3600000 * 3.2).toISOString(),
    status: 'completed',
    checkOutTime: new Date(Date.now() - 3600000 * 1.8).toISOString(),
    badgeNumber: 'VIS-008',
    notes: 'Inquired about 2 serviced plots at Airport Hills Phase 2.',
    handledByName: 'Front Desk Reception',
    createdAt: new Date(Date.now() - 3600000 * 3.2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 1.8).toISOString(),
  },
  {
    id: 'chk-seed-3',
    code: 'ACC-CHK-2026-003',
    branchId: 'b2',
    visitorName: 'Ing. Richard Quaye',
    phoneNumber: '+233 26 123 9876',
    category: 'contractor',
    purpose: 'Contractor / Construction Bill Submission',
    hostStaffName: 'Patrick Asare',
    hostDepartment: 'Operations',
    checkInTime: new Date(Date.now() - 3600000 * 0.5).toISOString(),
    status: 'waiting',
    badgeNumber: 'VIS-019',
    handledByName: 'Front Desk Reception',
    createdAt: new Date(Date.now() - 3600000 * 0.5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 0.5).toISOString(),
  },
  {
    id: 'chk-seed-4',
    code: 'KMA-CHK-2026-001',
    branchId: 'b1',
    visitorName: 'Nana Yaw Boateng',
    phoneNumber: '+233 54 602 9075',
    category: 'vip',
    purpose: 'Meeting with Branch Manager',
    hostStaffName: 'Kwabena Darko',
    hostDepartment: 'Executive Management',
    checkInTime: new Date(Date.now() - 3600000 * 4).toISOString(),
    status: 'completed',
    checkOutTime: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    badgeNumber: 'VIS-003',
    handledByName: 'Kumasi Reception Desk',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2.5).toISOString(),
  },
];

const STORAGE_KEY = 'omark_check_ins_storage';
const SESSION_BACKUP_KEY = 'omark_check_ins_session_backup';

declare global {
  interface Window {
    __omark_checkins_cache__?: CheckInRecord[];
  }
}

export function getCheckIns(): CheckInRecord[] {
  let records: CheckInRecord[] = [];

  // 1. Try Primary localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        records = parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load check-ins from localStorage:', err);
  }

  // 2. Try Secondary sessionStorage Backup
  try {
    const sessRaw = sessionStorage.getItem(SESSION_BACKUP_KEY);
    if (sessRaw) {
      const sessParsed = JSON.parse(sessRaw);
      if (Array.isArray(sessParsed) && sessParsed.length > 0) {
        if (records.length === 0) {
          records = sessParsed;
        } else {
          // Merge any records in session storage that are missing in localStorage
          const existingIds = new Set(records.map((r) => r.id));
          for (const item of sessParsed) {
            if (!existingIds.has(item.id)) {
              records.unshift(item);
              existingIds.add(item.id);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to load check-ins from sessionStorage:', err);
  }

  // 3. Try In-Memory Cache
  if (typeof window !== 'undefined' && Array.isArray(window.__omark_checkins_cache__) && window.__omark_checkins_cache__.length > 0) {
    if (records.length === 0) {
      records = window.__omark_checkins_cache__;
    } else {
      const existingIds = new Set(records.map((r) => r.id));
      for (const item of window.__omark_checkins_cache__) {
        if (!existingIds.has(item.id)) {
          records.unshift(item);
          existingIds.add(item.id);
        }
      }
    }
  }

  // 4. Default Seed if completely brand new
  if (records.length === 0) {
    records = DEFAULT_SEEDED_CHECK_INS;
  }

  // Sync to all persistence layers
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {}
  try {
    sessionStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify(records));
  } catch (e) {}
  if (typeof window !== 'undefined') {
    window.__omark_checkins_cache__ = records;
  }

  return records;
}

export function saveCheckIns(records: CheckInRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('Failed to save check-ins to localStorage:', err);
  }

  try {
    sessionStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('Failed to save check-ins to sessionStorage:', err);
  }

  if (typeof window !== 'undefined') {
    window.__omark_checkins_cache__ = records;
    window.dispatchEvent(new CustomEvent('omark-checkins-changed', { detail: records }));
  }
}

export function addCheckIn(
  record: Omit<CheckInRecord, 'id' | 'code' | 'createdAt' | 'updatedAt'>,
  branchesList?: any[]
): CheckInRecord {
  const all = getCheckIns();

  let branchPrefix = 'ACC';
  if (record.branchId) {
    const found = branchesList?.find(
      (b) => b.id === record.branchId || b.name === record.branchId || b.branchCode === record.branchId
    );
    if (found?.branchCode) {
      branchPrefix = found.branchCode.toUpperCase();
    } else {
      const canon = getBranchCanonicalKey(record.branchId);
      if (canon === 'kumasi' || canon.includes('kma')) branchPrefix = 'KMA';
      else if (canon === 'takoradi' || canon.includes('tkd')) branchPrefix = 'TKD';
      else if (canon === 'tamale' || canon.includes('tml')) branchPrefix = 'TML';
      else if (canon === 'wa') branchPrefix = 'WA';
      else if (canon === 'tafo') branchPrefix = 'TAF';
      else branchPrefix = (record.branchId || 'ACC').slice(0, 3).toUpperCase();
    }
  }

  const year = new Date().getFullYear();
  const seq = String(all.length + 1).padStart(3, '0');
  const code = `${branchPrefix}-CHK-${year}-${seq}`;

  const newRecord: CheckInRecord = {
    ...record,
    id: `chk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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

export function useCheckIns(branchId?: string, branchesList?: any[]) {
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

  const addCheckInDirect = (record: Omit<CheckInRecord, 'id' | 'code' | 'createdAt' | 'updatedAt'>) => {
    const created = addCheckIn(record, branchesList);
    setRecords((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
    return created;
  };

  const updateCheckInDirect = (id: string, updates: Partial<CheckInRecord>) => {
    const updated = updateCheckIn(id, updates);
    setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  };

  const checkOutVisitorDirect = (id: string, notes?: string) => {
    const updated = checkOutVisitor(id, notes);
    setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  };

  const deleteCheckInDirect = (id: string) => {
    deleteCheckIn(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const filteredRecords = useMemo(() => {
    if (!branchId || branchId === 'all') return records;

    const targetBranch = branchesList?.find(
      (b) => b.id === branchId || b.branchCode === branchId || b.name === branchId
    );

    const matchKeys = new Set<string>();
    matchKeys.add(String(branchId).toLowerCase().trim());
    if (targetBranch) {
      if (targetBranch.id) matchKeys.add(String(targetBranch.id).toLowerCase().trim());
      if (targetBranch.name) matchKeys.add(String(targetBranch.name).toLowerCase().trim());
      if (targetBranch.branchCode) matchKeys.add(String(targetBranch.branchCode).toLowerCase().trim());
      const canon = getBranchCanonicalKey(targetBranch.name || targetBranch.branchCode || targetBranch.id);
      if (canon) matchKeys.add(canon);
    }
    const directCanon = getBranchCanonicalKey(branchId);
    if (directCanon) matchKeys.add(directCanon);

    return records.filter((r) => {
      // If recorded in the last 15 minutes, always keep visible to prevent accidental disappearance
      const ageMinutes = (Date.now() - new Date(r.createdAt || r.checkInTime).getTime()) / 60000;
      if (ageMinutes < 15) return true;

      if (!r.branchId) return true;
      const recBranchId = String(r.branchId).toLowerCase().trim();
      if (matchKeys.has(recBranchId)) return true;
      const recCanon = getBranchCanonicalKey(r.branchId);
      if (recCanon && matchKeys.has(recCanon)) return true;
      return false;
    });
  }, [records, branchId, branchesList]);

  return {
    records: filteredRecords,
    allRecords: records,
    addCheckIn: addCheckInDirect,
    updateCheckIn: updateCheckInDirect,
    checkOutVisitor: checkOutVisitorDirect,
    deleteCheckIn: deleteCheckInDirect,
  };
}
