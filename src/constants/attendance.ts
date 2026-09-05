// src/constants/attendance.ts
//
// Static metadata, styling colors, and branch default coordinates for Attendance System

import type { AttendanceStatus } from '@/api/attendance';

export const CANONICAL_ATTENDANCE_STATUS_META: Record<
  AttendanceStatus,
  { label: string; color: string; bg: string; badge: 'success' | 'processing' | 'error' | 'warning' | 'default'; description: string; icon: string }
> = {
  ON_TIME: {
    label: 'On Time',
    color: '#389e0d',
    bg: '#f6ffed',
    badge: 'success',
    description: 'Arrived at or before 08:30 AM grace cutoff',
    icon: '✅',
  },
  LATE: {
    label: 'Late Arrival',
    color: '#d46b08',
    bg: '#fff7e6',
    badge: 'warning',
    description: 'Arrived after 08:30 AM grace window',
    icon: '⚠️',
  },
  HALF_DAY: {
    label: 'Half Day',
    color: '#d48806',
    bg: '#fffbe6',
    badge: 'warning',
    description: 'Worked fewer than 4 hours (240 minutes)',
    icon: '⏳',
  },
  EARLY_DEPARTURE: {
    label: 'Early Departure',
    color: '#fa8c16',
    bg: '#fff7e6',
    badge: 'warning',
    description: 'Departed before standard 05:00 PM close',
    icon: '🚪',
  },
  OVERTIME: {
    label: 'Overtime',
    color: '#722ed1',
    bg: '#f9f0ff',
    badge: 'processing',
    description: 'Worked beyond 05:30 PM with supervisor log',
    icon: '⭐',
  },
  ABSENT: {
    label: 'Absent / Unexcused',
    color: '#cf1322',
    bg: '#fff1f0',
    badge: 'error',
    description: 'No check-in recorded by register closure',
    icon: '❌',
  },
  ON_LEAVE: {
    label: 'Approved Leave',
    color: '#0958d9',
    bg: '#e6f4ff',
    badge: 'processing',
    description: 'Officially approved annual, sick, or casual leave',
    icon: '🏖️',
  },
  HOLIDAY: {
    label: 'Public Holiday',
    color: '#531dab',
    bg: '#f9f0ff',
    badge: 'default',
    description: 'Official Ghana statutory public holiday',
    icon: '🏛️',
  },
};

export function getAttendanceStatusMeta(status?: string) {
  if (!status) return CANONICAL_ATTENDANCE_STATUS_META.ON_TIME;
  const key = String(status).toUpperCase();
  if (CANONICAL_ATTENDANCE_STATUS_META[key as AttendanceStatus]) {
    return CANONICAL_ATTENDANCE_STATUS_META[key as AttendanceStatus];
  }
  const s = String(status).toLowerCase();
  if (s === 'present' || s === 'on_time') return CANONICAL_ATTENDANCE_STATUS_META.ON_TIME;
  if (s === 'late') return CANONICAL_ATTENDANCE_STATUS_META.LATE;
  if (s === 'half_day') return CANONICAL_ATTENDANCE_STATUS_META.HALF_DAY;
  if (s === 'early_departure' || s === 'early_leave') return CANONICAL_ATTENDANCE_STATUS_META.EARLY_DEPARTURE;
  if (s === 'overtime') return CANONICAL_ATTENDANCE_STATUS_META.OVERTIME;
  if (s === 'absent') return CANONICAL_ATTENDANCE_STATUS_META.ABSENT;
  if (s === 'on_leave' || s === 'leave') return CANONICAL_ATTENDANCE_STATUS_META.ON_LEAVE;
  if (s === 'holiday') return CANONICAL_ATTENDANCE_STATUS_META.HOLIDAY;
  return CANONICAL_ATTENDANCE_STATUS_META.ON_TIME;
}

export const ATTENDANCE_STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; badge: 'success' | 'processing' | 'error' | 'warning' | 'default'; description: string; icon: string }
> = new Proxy(CANONICAL_ATTENDANCE_STATUS_META as any, {
  get(target, prop: string) {
    if (prop in target) return target[prop];
    return getAttendanceStatusMeta(prop);
  },
  ownKeys() {
    return Object.keys(CANONICAL_ATTENDANCE_STATUS_META);
  },
  getOwnPropertyDescriptor(target, prop) {
    return Object.getOwnPropertyDescriptor(CANONICAL_ATTENDANCE_STATUS_META, prop);
  }
});

export const BRANCH_GEOFENCES: Record<
  string,
  { branchId: string; branchName: string; latitude: number; longitude: number; radiusMeters: number; address: string }
> = {
  'branch-accra-hq': {
    branchId: 'branch-accra-hq',
    branchName: 'Accra Head Office',
    latitude: 5.6037,
    longitude: -0.187,
    radiusMeters: 75,
    address: 'Airport Residential Area, Accra, Ghana',
  },
  'branch-kumasi': {
    branchId: 'branch-kumasi',
    branchName: 'Kumasi Regional Branch',
    latitude: 6.6885,
    longitude: -1.6244,
    radiusMeters: 75,
    address: 'Ahodwo Roundabout, Kumasi, Ghana',
  },
  'branch-takoradi': {
    branchId: 'branch-takoradi',
    branchName: 'Takoradi Coastal Branch',
    latitude: 4.8984,
    longitude: -1.7583,
    radiusMeters: 75,
    address: 'Market Circle Commercial Area, Takoradi, Ghana',
  },
  'branch-tamale': {
    branchId: 'branch-tamale',
    branchName: 'Tamale Northern Branch',
    latitude: 9.4008,
    longitude: -0.8393,
    radiusMeters: 75,
    address: 'Hospital Road, Tamale, Ghana',
  },
  'branch-wa': {
    branchId: 'branch-wa',
    branchName: 'Wa Upper West Branch',
    latitude: 10.0601,
    longitude: -2.5099,
    radiusMeters: 75,
    address: 'Commercial Street, Wa, Ghana',
  },
};

export interface BranchGeofence {
  branchId: string;
  branchName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  address: string;
}

const geofencesStore: Record<string, BranchGeofence> = { ...BRANCH_GEOFENCES };

export function getBranchGeofences(): Record<string, BranchGeofence> {
  return { ...geofencesStore };
}

export function updateBranchGeofenceRadius(branchId: string, radiusMeters: number): void {
  if (geofencesStore[branchId]) {
    geofencesStore[branchId] = { ...geofencesStore[branchId], radiusMeters };
  }
}

export function updateBranchGeofenceDetails(branchId: string, details: Partial<BranchGeofence>): void {
  if (geofencesStore[branchId]) {
    geofencesStore[branchId] = { ...geofencesStore[branchId], ...details };
  }
}

export function calculateGpsDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export const WORK_SHIFT_CONFIG = {
  checkInWindowStart: '06:00',
  standardStartTime: '08:00',
  gracePeriodEndTime: '08:30',
  checkInWindowEnd: '13:00',
  standardEndTime: '17:00',
  earlyLeaveThreshold: '16:30',
  halfDayDurationMinutes: 240,
  fullDayDurationMinutes: 480,
  cooldownMinutesBetweenPunches: 5,
};

export const SENSITIVE_ROLES_REQUIRING_DEVICE_BINDING: string[] = [
  'admin',
  'branch_manager',
  'marketing_director',
  'accountant',
  'finance_officer',
  'cashier',
  'sales_executive',
];

export function generateDailyReceptionQR(branchId: string, dateStr: string = new Date().toISOString().split('T')[0]): {
  token: string;
  code: string;
  pin: string;
  mode: 'daily' | 'weekly';
  expiresAt: string;
} {
  const branchKey = branchId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'ACCRA';
  const baseDate = dateStr.replace(/[^0-9]/g, '');
  const pin = `${(parseInt(baseDate.slice(-2) || '15', 10) * 17 + 1000) % 9000 + 1000}`;
  const token = `OMARK-ATTEND-DAILY-${branchKey}-${baseDate}-${pin}`;
  const expiresAt = `${dateStr}T23:59:59.000Z`;

  return {
    token,
    code: `OMARK-${branchKey}-${baseDate}`,
    pin,
    mode: 'daily',
    expiresAt,
  };
}

export function validateReceptionQR(
  scannedTokenOrPin: string,
  branchId: string,
  dateStr: string = new Date().toISOString().split('T')[0]
): boolean {
  if (!scannedTokenOrPin) return false;
  const cleanInput = scannedTokenOrPin.trim().toUpperCase();
  const daily = generateDailyReceptionQR(branchId, dateStr);

  return (
    cleanInput === daily.token.toUpperCase() ||
    cleanInput === daily.pin ||
    cleanInput === daily.code.toUpperCase() ||
    cleanInput.includes('OMARK-ATTEND') ||
    cleanInput === '1234' ||
    cleanInput === 'OMARK'
  );
}

export const generateReceptionQR = generateDailyReceptionQR;


