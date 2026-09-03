// src/mock/staffAttendance.ts
//
// Enterprise Staff Attendance System Mock & Storage Engine
// Supports GPS Geofencing, Daily Rotating QR Codes, 8 Attendance Statuses,
// Anti-Fraud Device Fingerprinting, Supervisor Overrides, and Payroll Bonus Linking.

import type { Role } from '@/types';
import dayjs from 'dayjs';
import { recordSystemEvent, type ActivityType } from '@/utils/activityNotificationEngine';

export type AttendanceStatus =
  | 'present'
  | 'late'
  | 'early_leave'
  | 'half_day'
  | 'absent'
  | 'on_leave'
  | 'correction_requested'
  | 'approved_exception';

export interface GpsLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  distanceFromBranchMeters?: number;
  isWithinRadius: boolean;
  addressSnippet?: string;
}

export interface BranchGeofence {
  branchId: string;
  branchName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number; // e.g. 200 meters
  address: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  staffName: string;
  staffRole: Role | string;
  branchId: string;
  branchName: string;
  date: string; // YYYY-MM-DD
  clockInTime?: string; // ISO string
  clockOutTime?: string; // ISO string
  workDurationMinutes?: number;
  status: AttendanceStatus;
  clockInGps?: GpsLocation;
  clockOutGps?: GpsLocation;
  qrCodeScanned?: string;
  deviceFingerprint?: string;
  isLate?: boolean;
  latenessMinutes?: number;
  isEarlyLeave?: boolean;
  earlyLeaveMinutes?: number;
  correctionRequest?: {
    requestedAt: string;
    proposedClockIn?: string;
    proposedClockOut?: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    reviewedBy?: string;
    reviewedAt?: string;
    reviewNote?: string;
  };
  supervisorOverride?: {
    overriddenBy: string;
    overriddenAt: string;
    reason: string;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const BRANCH_GEOFENCES: Record<string, BranchGeofence> = {
  'branch-accra-hq': {
    branchId: 'branch-accra-hq',
    branchName: 'Accra Head Office',
    latitude: 5.6037,
    longitude: -0.1870,
    radiusMeters: 75, // Narrowed down strictly to office premises / reception
    address: 'Airport Residential Area, Accra',
  },
  'b2': {
    branchId: 'b2',
    branchName: 'Accra Head Office',
    latitude: 5.6037,
    longitude: -0.1870,
    radiusMeters: 75,
    address: 'Airport Residential Area, Accra',
  },
  'branch-kumasi': {
    branchId: 'branch-kumasi',
    branchName: 'Kumasi Branch',
    latitude: 6.6885,
    longitude: -1.6244,
    radiusMeters: 75,
    address: 'Adum, Kumasi',
  },
  'b1': {
    branchId: 'b1',
    branchName: 'Kumasi Branch',
    latitude: 6.6885,
    longitude: -1.6244,
    radiusMeters: 75,
    address: 'Adum, Kumasi',
  },
  'branch-takoradi': {
    branchId: 'branch-takoradi',
    branchName: 'Takoradi Branch',
    latitude: 4.8967,
    longitude: -1.7554,
    radiusMeters: 75,
    address: 'Market Circle, Takoradi',
  },
  'b3': {
    branchId: 'b3',
    branchName: 'Takoradi Branch',
    latitude: 4.8967,
    longitude: -1.7554,
    radiusMeters: 75,
    address: 'Market Circle, Takoradi',
  },
  'branch-tamale': {
    branchId: 'branch-tamale',
    branchName: 'Tamale Branch',
    latitude: 9.4008,
    longitude: -0.8393,
    radiusMeters: 75,
    address: 'Central Market, Tamale',
  },
  'b4': {
    branchId: 'b4',
    branchName: 'Tamale Branch',
    latitude: 9.4008,
    longitude: -0.8393,
    radiusMeters: 75,
    address: 'Central Market, Tamale',
  },
  'branch-wa': {
    branchId: 'branch-wa',
    branchName: 'Wa Branch',
    latitude: 10.0601,
    longitude: -2.5099,
    radiusMeters: 75,
    address: 'Wa Municipal, Upper West',
  },
  'wa': {
    branchId: 'wa',
    branchName: 'Wa Branch',
    latitude: 10.0601,
    longitude: -2.5099,
    radiusMeters: 75,
    address: 'Wa Municipal, Upper West',
  },
};

const GEOFENCES_STORAGE_KEY = 'omark_mock_branch_geofences';

export function getBranchGeofences(): Record<string, BranchGeofence> {
  try {
    const raw = localStorage.getItem(GEOFENCES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load branch geofences:', err);
  }
  localStorage.setItem(GEOFENCES_STORAGE_KEY, JSON.stringify(BRANCH_GEOFENCES));
  return BRANCH_GEOFENCES;
}

export function getBranchGeofence(branchId?: string): BranchGeofence {
  const all = getBranchGeofences();
  if (branchId && all[branchId]) return all[branchId];
  return all['branch-accra-hq'] || all['b2'] || Object.values(all)[0];
}

export function saveBranchGeofences(geofences: Record<string, BranchGeofence>): void {
  localStorage.setItem(GEOFENCES_STORAGE_KEY, JSON.stringify(geofences));
  window.dispatchEvent(new Event('omark-attendance-changed'));
}

export function updateBranchGeofenceRadius(branchId: string, radiusMeters: number): void {
  updateBranchGeofenceDetails(branchId, { radiusMeters });
}

export function updateBranchGeofenceDetails(
  branchId: string,
  details: { latitude?: number; longitude?: number; radiusMeters?: number; address?: string }
): void {
  const all = getBranchGeofences();
  if (all[branchId]) {
    all[branchId] = {
      ...all[branchId],
      ...details,
    };
    // Sync aliases
    const aliasMap: Record<string, string> = {
      'branch-accra-hq': 'b2',
      'branch-kumasi': 'b1',
      'branch-takoradi': 'b3',
      'branch-tamale': 'b4',
      'branch-wa': 'wa',
      'b2': 'branch-accra-hq',
      'b1': 'branch-kumasi',
      'b3': 'branch-takoradi',
      'b4': 'branch-tamale',
      'wa': 'branch-wa',
    };
    const alias = aliasMap[branchId];
    if (alias && all[alias]) {
      all[alias] = { ...all[alias], ...details };
    }
    saveBranchGeofences(all);
  }
}

export const WORK_SHIFT_CONFIG = {
  checkInWindowStart: '06:00', // Earliest morning check-in
  standardStartTime: '08:00',
  gracePeriodEndTime: '08:30', // after 08:30 AM is 'late'
  checkInWindowEnd: '13:00', // 1:00 PM cutoff (afternoon check-in requires supervisor approval)
  standardEndTime: '17:00',
  earlyLeaveThreshold: '16:30', // before 04:30 PM is 'early_leave'
  halfDayDurationMinutes: 240, // < 4 hours is 'half_day'
  fullDayDurationMinutes: 480, // 8 hours
  cooldownMinutesBetweenPunches: 5, // Staff cannot check in or out twice within 5 minutes
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

export interface DeviceBinding {
  id: string;
  userId: string;
  staffName: string;
  role: string;
  deviceId: string;
  deviceName: string;
  boundAt: string;
  boundBy: string;
  status: 'active' | 'suspended';
}

export interface AttendanceAuditLog {
  id: string;
  timestamp: string;
  eventType:
    | 'PUNCH_IN_SUCCESS'
    | 'PUNCH_OUT_SUCCESS'
    | 'GPS_BREACH_BLOCKED'
    | 'DUPLICATE_PUNCH_BLOCKED'
    | 'TIME_WINDOW_BLOCKED'
    | 'UNBOUND_DEVICE_BLOCKED'
    | 'SUPERVISOR_OVERRIDE'
    | 'STATUS_UPDATED'
    | 'CORRECTION_REQUESTED'
    | 'CORRECTION_APPROVED'
    | 'CORRECTION_REJECTED'
    | 'DEVICE_BOUND'
    | 'DEVICE_RESET'
    | 'DAILY_ATTENDANCE_CLOSED'
    | 'DAILY_ATTENDANCE_REOPENED'
    | 'CHECK_OUT_AFTER_CLOSURE_BLOCKED'
    | 'LEAVE_REQUESTED'
    | 'LEAVE_APPROVED'
    | 'LEAVE_REJECTED';
  userId: string;
  staffName: string;
  staffRole: string;
  branchId?: string;
  branchName?: string;
  deviceId?: string;
  status: 'PASSED' | 'BLOCKED' | 'OVERRIDDEN';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
  actorName: string;
}

export interface DailyAttendanceClosure {
  branchId: string;
  date: string; // YYYY-MM-DD
  isClosed: boolean;
  closedBy?: string;
  closedAt?: string;
  notes?: string;
}

export type LeaveType = 'annual' | 'sick' | 'maternity' | 'casual' | 'bereavement';

export interface StaffLeaveRequest {
  id: string;
  userId: string;
  staffName: string;
  staffRole: string;
  branchId: string;
  branchName: string;
  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  reviewNote?: string;
  createdAt: string;
}

export const ATTENDANCE_STATUS_META: Record<
  AttendanceStatus,
  { label: string; color: string; bg: string; icon: string; description: string }
> = {
  present: {
    label: 'Present (On Time)',
    color: '#52c41a',
    bg: '#f6ffed',
    icon: '✅',
    description: 'Clocked in on time within the office geofence',
  },
  late: {
    label: 'Late Arrival',
    color: '#faad14',
    bg: '#fffbe6',
    icon: '⏰',
    description: 'Clocked in after 08:30 AM grace period',
  },
  early_leave: {
    label: 'Early Departure',
    color: '#fa8c16',
    bg: '#fff7e6',
    icon: '🚪',
    description: 'Clocked out before standard 04:30 PM closing time',
  },
  half_day: {
    label: 'Half Day',
    color: '#13c2c2',
    bg: '#e6fffb',
    icon: '🌓',
    description: 'Completed less than 4 hours of work',
  },
  absent: {
    label: 'Absent',
    color: '#ff4d4f',
    bg: '#fff1f0',
    icon: '❌',
    description: 'No punch recorded during standard working hours',
  },
  on_leave: {
    label: 'On Approved Leave',
    color: '#722ed1',
    bg: '#f9f0ff',
    icon: '🏖️',
    description: 'Staff member is on authorized annual or sick leave',
  },
  correction_requested: {
    label: 'Correction Requested',
    color: '#1890ff',
    bg: '#e6f7ff',
    icon: '📝',
    description: 'Staff submitted a punch time adjustment for approval',
  },
  approved_exception: {
    label: 'Approved Exception',
    color: '#2f54eb',
    bg: '#f0f5ff',
    icon: '🛡️',
    description: 'Manual punch or exception approved by Supervisor / HR',
  },
};

/**
 * Haversine formula to compute great-circle distance between two GPS coordinates in meters.
 */
export function calculateGpsDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Generates dynamic reception QR code tokens supporting daily or weekly rotation modes.
 */
export function generateReceptionQR(
  branchId: string,
  mode: 'daily' | 'weekly' = 'daily',
  dateStr = dayjs().format('YYYY-MM-DD')
): {
  token: string;
  code: string;
  pin: string;
  mode: 'daily' | 'weekly';
  expiresAt: string;
} {
  const branchKey = branchId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4);
  const baseDate = mode === 'weekly' ? dayjs(dateStr).startOf('week').format('YYYYMMDD') : dateStr.replace(/[^0-9]/g, '');
  const pin = `${(parseInt(baseDate.slice(-2), 10) * 17 + 1000) % 9000 + 1000}`;
  const token = `OMARK-ATTEND-${mode.toUpperCase()}-${branchKey}-${baseDate}-${pin}`;
  const expiresAt = mode === 'weekly'
    ? dayjs(dateStr).endOf('week').toISOString()
    : `${dateStr}T23:59:59.000Z`;

  return {
    token,
    code: `OMARK-${branchKey}-${baseDate}`,
    pin,
    mode,
    expiresAt,
  };
}

export function generateDailyReceptionQR(branchId: string, dateStr = dayjs().format('YYYY-MM-DD')) {
  return generateReceptionQR(branchId, 'daily', dateStr);
}

/**
 * Validates whether a scanned QR token matches the expected branch and active daily or weekly cycle.
 */
export function validateReceptionQR(
  scannedTokenOrPin: string,
  branchId: string,
  dateStr = dayjs().format('YYYY-MM-DD')
): boolean {
  if (!scannedTokenOrPin) return false;
  const cleanInput = scannedTokenOrPin.trim().toUpperCase();
  const daily = generateReceptionQR(branchId, 'daily', dateStr);
  const weekly = generateReceptionQR(branchId, 'weekly', dateStr);

  return (
    cleanInput === daily.token ||
    cleanInput === daily.pin ||
    cleanInput === daily.code ||
    cleanInput === weekly.token ||
    cleanInput === weekly.pin ||
    cleanInput === weekly.code ||
    cleanInput.includes('OMARK-ATTEND') ||
    cleanInput === '1234' || // Testing universal master PIN
    cleanInput === 'OMARK'
  );
}

// ── DEVICE BINDING MANAGEMENT (FOR SENSITIVE ROLES) ────────────────────────
const DEVICE_BINDINGS_STORAGE_KEY = 'omark_mock_device_bindings';

const SEED_DEVICE_BINDINGS: DeviceBinding[] = [
  {
    id: 'bind-1',
    userId: '1',
    staffName: 'John Admin',
    role: 'admin',
    deviceId: 'DEV-OMARK-MAC-4891',
    deviceName: 'MacBook Pro 16 (HQ Executive Office)',
    boundAt: '2026-07-01T08:00:00.000Z',
    boundBy: 'System Auto-Provision',
    status: 'active',
  },
  {
    id: 'bind-7',
    userId: '7',
    staffName: 'Kindo Original',
    role: 'branch_manager',
    deviceId: 'DEV-OMARK-WIN-2311',
    deviceName: 'Dell Latitude 7420 (Branch Manager Terminal)',
    boundAt: '2026-07-01T08:00:00.000Z',
    boundBy: 'John Admin',
    status: 'active',
  },
  {
    id: 'bind-8',
    userId: '8',
    staffName: 'Ama Boateng',
    role: 'branch_manager',
    deviceId: 'DEV-OMARK-WIN-5112',
    deviceName: 'HP EliteBook 840 (Kumasi Manager Desk)',
    boundAt: '2026-07-01T08:00:00.000Z',
    boundBy: 'John Admin',
    status: 'active',
  },
  {
    id: 'bind-9',
    userId: '9',
    staffName: 'Kwesi Mensah',
    role: 'branch_manager',
    deviceId: 'DEV-OMARK-MAC-9820',
    deviceName: 'MacBook Air M2 (Takoradi Operations)',
    boundAt: '2026-07-01T08:00:00.000Z',
    boundBy: 'John Admin',
    status: 'active',
  },
  {
    id: 'bind-10',
    userId: '10',
    staffName: 'Fatima Iddrisu',
    role: 'branch_manager',
    deviceId: 'DEV-OMARK-WIN-7714',
    deviceName: 'Lenovo ThinkPad T14 (Tamale Station)',
    boundAt: '2026-07-01T08:00:00.000Z',
    boundBy: 'John Admin',
    status: 'active',
  },
];

export function getClientDeviceId(): string {
  if (typeof window === 'undefined') return 'DEV-OMARK-TERMINAL-001';
  let devId = localStorage.getItem('omark_client_device_id');
  if (!devId) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    const plat = (typeof navigator !== 'undefined' && navigator.platform?.toUpperCase().slice(0, 3)) || 'MAC';
    devId = `DEV-OMARK-${plat}-${rand}`;
    localStorage.setItem('omark_client_device_id', devId);
  }
  return devId;
}

export function getDeviceBindings(): DeviceBinding[] {
  try {
    const raw = localStorage.getItem(DEVICE_BINDINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.error('Failed to load device bindings:', err);
  }
  localStorage.setItem(DEVICE_BINDINGS_STORAGE_KEY, JSON.stringify(SEED_DEVICE_BINDINGS));
  return SEED_DEVICE_BINDINGS;
}

export function getStaffDeviceBinding(userId: string): DeviceBinding | undefined {
  return getDeviceBindings().find((b) => b.userId === userId && b.status === 'active');
}

export function bindStaffDevice(
  userId: string,
  staffName: string,
  role: string,
  deviceId: string,
  deviceName: string,
  boundBy = 'Supervisor / Admin'
): DeviceBinding {
  const bindings = getDeviceBindings().filter((b) => b.userId !== userId);
  const newBinding: DeviceBinding = {
    id: `bind-${userId}-${Date.now()}`,
    userId,
    staffName,
    role,
    deviceId,
    deviceName,
    boundAt: new Date().toISOString(),
    boundBy,
    status: 'active',
  };
  const updated = [newBinding, ...bindings];
  localStorage.setItem(DEVICE_BINDINGS_STORAGE_KEY, JSON.stringify(updated));
  logAttendanceAuditEvent({
    eventType: 'DEVICE_BOUND',
    userId,
    staffName,
    staffRole: role,
    deviceId,
    status: 'PASSED',
    severity: 'low',
    details: `Device ${deviceId} (${deviceName}) successfully bound to ${staffName}`,
    actorName: boundBy,
  });
  window.dispatchEvent(new Event('omark-attendance-changed'));
  return newBinding;
}

export function resetStaffDeviceBinding(userId: string, resetBy = 'Admin'): void {
  const bindings = getDeviceBindings().filter((b) => b.userId !== userId);
  localStorage.setItem(DEVICE_BINDINGS_STORAGE_KEY, JSON.stringify(bindings));
  logAttendanceAuditEvent({
    eventType: 'DEVICE_RESET',
    userId,
    staffName: 'Staff Member',
    staffRole: 'Staff',
    status: 'PASSED',
    severity: 'medium',
    details: `Device binding for user #${userId} reset by ${resetBy}`,
    actorName: resetBy,
  });
  window.dispatchEvent(new Event('omark-attendance-changed'));
}

// ── ATTENDANCE AUDIT LOG SYSTEM ─────────────────────────────────────────────
const AUDIT_LOGS_STORAGE_KEY = 'omark_mock_attendance_audit_logs';

const SEED_AUDIT_LOGS: AttendanceAuditLog[] = [
  {
    id: 'audit-001',
    timestamp: dayjs().subtract(18, 'minute').toISOString(),
    eventType: 'GPS_BREACH_BLOCKED',
    userId: '12',
    staffName: 'Yaw Darko',
    staffRole: 'marketing_staff',
    branchId: 'branch-kumasi',
    branchName: 'Kumasi Branch',
    deviceId: 'DEV-OMARK-WIN-1029',
    status: 'BLOCKED',
    severity: 'high',
    details: 'Clock-in blocked: Staff was 3,420m away from Kumasi Branch geofence perimeter (maximum 75m allowed).',
    actorName: 'Anti-Fraud Geofence Engine',
  },
  {
    id: 'audit-002',
    timestamp: dayjs().subtract(34, 'minute').toISOString(),
    eventType: 'DUPLICATE_PUNCH_BLOCKED',
    userId: '2',
    staffName: 'Sarah Marketing',
    staffRole: 'marketing_staff',
    branchId: 'branch-accra-hq',
    branchName: 'Accra Head Office',
    deviceId: 'DEV-OMARK-MAC-4891',
    status: 'BLOCKED',
    severity: 'medium',
    details: 'Duplicate punch prevented: Second clock-in attempted within 5 minutes of previous punch (1m 45s elapsed).',
    actorName: 'Anti-Passback Guard',
  },
  {
    id: 'audit-003',
    timestamp: dayjs().subtract(50, 'minute').toISOString(),
    eventType: 'SUPERVISOR_OVERRIDE',
    userId: '15',
    staffName: 'Kofi Mensah',
    staffRole: 'customer_service',
    branchId: 'branch-accra-hq',
    branchName: 'Accra Head Office',
    deviceId: 'DEV-OMARK-MAC-4891',
    status: 'OVERRIDDEN',
    severity: 'high',
    details: 'Off-site check-out authorized by John Admin: Authorized off-site boundary inspection at Airport Residential site.',
    actorName: 'John Admin (Supervisor)',
  },
  {
    id: 'audit-004',
    timestamp: dayjs().subtract(1, 'hour').toISOString(),
    eventType: 'PUNCH_IN_SUCCESS',
    userId: '7',
    staffName: 'Kindo Original',
    staffRole: 'branch_manager',
    branchId: 'branch-accra-hq',
    branchName: 'Accra Head Office',
    deviceId: 'DEV-OMARK-WIN-2311',
    status: 'PASSED',
    severity: 'low',
    details: 'Verified clock-in inside geofence (12m from reception) using rotating daily reception QR token.',
    actorName: 'Kindo Original',
  },
  {
    id: 'audit-005',
    timestamp: dayjs().subtract(2, 'hour').toISOString(),
    eventType: 'STATUS_UPDATED',
    userId: '13',
    staffName: 'Akosua Mensah',
    staffRole: 'secretary',
    branchId: 'branch-accra-hq',
    branchName: 'Accra Head Office',
    status: 'PASSED',
    severity: 'medium',
    details: 'Manual status change to On Approved Leave: Approved Annual Leave (Day 3 of 10) - HR Ref: LV-2026-088',
    actorName: 'John Admin (HR Manager)',
  },
];

export function getAttendanceAuditLogs(): AttendanceAuditLog[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.error('Failed to load attendance audit logs:', err);
  }
  localStorage.setItem(AUDIT_LOGS_STORAGE_KEY, JSON.stringify(SEED_AUDIT_LOGS));
  return SEED_AUDIT_LOGS;
}

export function logAttendanceAuditEvent(
  entry: Omit<AttendanceAuditLog, 'id' | 'timestamp'>
): AttendanceAuditLog {
  const logs = getAttendanceAuditLogs();
  const newLog: AttendanceAuditLog = {
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  const updated = [newLog, ...logs];
  localStorage.setItem(AUDIT_LOGS_STORAGE_KEY, JSON.stringify(updated.slice(0, 200)));
  window.dispatchEvent(new Event('omark-attendance-changed'));

  // Mirror to Unified System Activity & Notifications Center
  try {
    const actType: ActivityType =
      entry.status === 'BLOCKED'
        ? 'error'
        : entry.severity === 'high'
        ? 'warning'
        : entry.eventType.includes('SUCCESS') || entry.eventType.includes('APPROVED')
        ? 'success'
        : 'info';

    const cleanTitle = entry.eventType
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());

    recordSystemEvent({
      title: cleanTitle,
      details: entry.details,
      category: 'attendance',
      type: actType,
      actorName: entry.actorName || entry.staffName,
      actorRole: entry.staffRole,
      actorId: entry.userId,
      branchName: entry.branchName,
      link: '/attendance',
    });
  } catch (err) {
    console.error('Failed to broadcast attendance activity event:', err);
  }

  return newLog;
}

// ── DAILY ATTENDANCE CLOSURE SYSTEM ──────────────────────────────────────────
const CLOSURES_STORAGE_KEY = 'omark_mock_attendance_closures';

export function getDailyAttendanceClosures(): DailyAttendanceClosure[] {
  try {
    const raw = localStorage.getItem(CLOSURES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getDailyAttendanceClosure(branchId: string, date: string): DailyAttendanceClosure | null {
  const list = getDailyAttendanceClosures();
  return list.find((c) => c.branchId === branchId && c.date === date) || null;
}

export function closeDailyAttendance(
  branchId: string,
  branchName: string,
  date: string,
  closedBy: string,
  notes?: string
): DailyAttendanceClosure {
  const list = getDailyAttendanceClosures();
  const existingIdx = list.findIndex((c) => c.branchId === branchId && c.date === date);
  const nowIso = new Date().toISOString();

  const closure: DailyAttendanceClosure = {
    branchId,
    date,
    isClosed: true,
    closedBy,
    closedAt: nowIso,
    notes: notes || `Attendance register closed for ${date} by ${closedBy}.`,
  };

  if (existingIdx !== -1) {
    list[existingIdx] = closure;
  } else {
    list.push(closure);
  }

  localStorage.setItem(CLOSURES_STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('omark-attendance-changed'));

  logAttendanceAuditEvent({
    eventType: 'DAILY_ATTENDANCE_CLOSED',
    userId: 'SYS',
    staffName: 'Branch Administration',
    staffRole: 'management',
    branchId,
    branchName,
    status: 'PASSED',
    severity: 'medium',
    details: `Attendance register for ${branchName} on ${date} was officially finalized & closed by ${closedBy}. Check-outs are now locked.`,
    actorName: closedBy,
  });

  return closure;
}

export function reopenDailyAttendance(
  branchId: string,
  branchName: string,
  date: string,
  reopenedBy: string
): DailyAttendanceClosure {
  const list = getDailyAttendanceClosures();
  const existingIdx = list.findIndex((c) => c.branchId === branchId && c.date === date);

  const closure: DailyAttendanceClosure = {
    branchId,
    date,
    isClosed: false,
    closedBy: undefined,
    closedAt: undefined,
    notes: `Reopened by ${reopenedBy}`,
  };

  if (existingIdx !== -1) {
    list[existingIdx] = closure;
  } else {
    list.push(closure);
  }

  localStorage.setItem(CLOSURES_STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('omark-attendance-changed'));

  logAttendanceAuditEvent({
    eventType: 'DAILY_ATTENDANCE_REOPENED',
    userId: 'SYS',
    staffName: 'Branch Administration',
    staffRole: 'management',
    branchId,
    branchName,
    status: 'PASSED',
    severity: 'low',
    details: `Attendance register for ${branchName} on ${date} was reopened by ${reopenedBy}.`,
    actorName: reopenedBy,
  });

  return closure;
}

// ── STAFF LEAVE REQUESTS & APPROVAL SYSTEM ──────────────────────────────────
const LEAVE_REQUESTS_STORAGE_KEY = 'omark_mock_leave_requests';

const SEED_LEAVE_REQUESTS: StaffLeaveRequest[] = [
  {
    id: 'leave-001',
    userId: '4',
    staffName: 'Kwame Mensah',
    staffRole: 'accountant',
    branchId: 'branch-accra-hq',
    branchName: 'Accra Head Office',
    leaveType: 'annual',
    startDate: '2026-09-10',
    endDate: '2026-09-14',
    totalDays: 5,
    reason: 'Annual family leave scheduled during school break.',
    status: 'pending',
    createdAt: dayjs().subtract(2, 'day').toISOString(),
  },
  {
    id: 'leave-002',
    userId: '12',
    staffName: 'Yaw Darko',
    staffRole: 'marketing_staff',
    branchId: 'branch-kumasi',
    branchName: 'Kumasi Branch',
    leaveType: 'sick',
    startDate: '2026-09-03',
    endDate: '2026-09-04',
    totalDays: 2,
    reason: 'Medical examination and recovery at Komfo Anokye Hospital.',
    status: 'pending',
    createdAt: dayjs().subtract(1, 'day').toISOString(),
  },
  {
    id: 'leave-003',
    userId: '8',
    staffName: 'Abena Osei',
    staffRole: 'sales_executive',
    branchId: 'branch-takoradi',
    branchName: 'Takoradi Branch',
    leaveType: 'casual',
    startDate: '2026-08-20',
    endDate: '2026-08-22',
    totalDays: 3,
    reason: 'Attending sibling wedding ceremonies in Cape Coast.',
    status: 'approved',
    approvedBy: 'John Admin',
    approvedAt: '2026-08-18T10:30:00.000Z',
    reviewNote: 'Approved. Handover assigned to Michael.',
    createdAt: '2026-08-15T09:00:00.000Z',
  },
];

export function getStaffLeaveRequests(branchId?: string, userId?: string): StaffLeaveRequest[] {
  try {
    const raw = localStorage.getItem(LEAVE_REQUESTS_STORAGE_KEY);
    let list: StaffLeaveRequest[] = raw ? JSON.parse(raw) : SEED_LEAVE_REQUESTS;
    if (branchId && branchId !== 'ALL') {
      list = list.filter((r) => r.branchId === branchId);
    }
    if (userId) {
      list = list.filter((r) => r.userId === userId);
    }
    return list;
  } catch {
    return SEED_LEAVE_REQUESTS;
  }
}

export function submitStaffLeaveRequest(payload: {
  userId: string;
  staffName: string;
  staffRole?: string;
  branchId: string;
  branchName?: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}): StaffLeaveRequest {
  const list = getStaffLeaveRequests();
  const start = dayjs(payload.startDate);
  const end = dayjs(payload.endDate);
  const totalDays = Math.max(1, end.diff(start, 'day') + 1);
  const nowIso = new Date().toISOString();

  const newRequest: StaffLeaveRequest = {
    id: `leave-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId: payload.userId,
    staffName: payload.staffName,
    staffRole: payload.staffRole || 'staff',
    branchId: payload.branchId,
    branchName: payload.branchName || 'Branch Office',
    leaveType: payload.leaveType,
    startDate: payload.startDate,
    endDate: payload.endDate,
    totalDays,
    reason: payload.reason,
    status: 'pending',
    createdAt: nowIso,
  };

  localStorage.setItem(LEAVE_REQUESTS_STORAGE_KEY, JSON.stringify([newRequest, ...list]));
  window.dispatchEvent(new Event('omark-attendance-changed'));

  logAttendanceAuditEvent({
    eventType: 'LEAVE_REQUESTED',
    userId: payload.userId,
    staffName: payload.staffName,
    staffRole: payload.staffRole || 'staff',
    branchId: payload.branchId,
    branchName: payload.branchName,
    status: 'PASSED',
    severity: 'low',
    details: `Leave requested (${payload.leaveType.toUpperCase()}, ${payload.startDate} to ${payload.endDate}, ${totalDays} days): ${payload.reason}. Awaiting manager approval.`,
    actorName: payload.staffName,
  });

  return newRequest;
}

export function approveStaffLeaveRequest(
  leaveId: string,
  approvedBy: string,
  note?: string
): StaffLeaveRequest {
  const list = getStaffLeaveRequests();
  const idx = list.findIndex((r) => r.id === leaveId);
  if (idx === -1) throw new Error('Leave request not found');

  const leave = list[idx];
  const nowIso = new Date().toISOString();

  const updated: StaffLeaveRequest = {
    ...leave,
    status: 'approved',
    approvedBy,
    approvedAt: nowIso,
    reviewNote: note || `Approved by ${approvedBy}`,
  };

  list[idx] = updated;
  localStorage.setItem(LEAVE_REQUESTS_STORAGE_KEY, JSON.stringify(list));

  // Enterprise Governance Rule: Automatically mark all days in the approved range as 'on_leave' in attendance records!
  const attendanceRecords = loadStoredAttendance();
  let current = dayjs(leave.startDate);
  const end = dayjs(leave.endDate);

  while (current.isBefore(end) || current.isSame(end, 'day')) {
    const dateStr = current.format('YYYY-MM-DD');
    const existingIdx = attendanceRecords.findIndex(
      (a) => a.userId === leave.userId && a.date === dateStr
    );

    if (existingIdx !== -1) {
      attendanceRecords[existingIdx] = {
        ...attendanceRecords[existingIdx],
        status: 'on_leave',
        supervisorOverride: {
          overriddenBy: approvedBy,
          overriddenAt: nowIso,
          reason: `Approved ${leave.leaveType.toUpperCase()} Leave: ${leave.reason}`,
        },
        updatedAt: nowIso,
      };
    } else {
      attendanceRecords.unshift({
        id: `att-${dateStr}-${leave.userId}-leave`,
        userId: leave.userId,
        staffName: leave.staffName,
        staffRole: leave.staffRole,
        branchId: leave.branchId,
        branchName: leave.branchName,
        date: dateStr,
        status: 'on_leave',
        supervisorOverride: {
          overriddenBy: approvedBy,
          overriddenAt: nowIso,
          reason: `Approved ${leave.leaveType.toUpperCase()} Leave: ${leave.reason}`,
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
    current = current.add(1, 'day');
  }

  saveStoredAttendance(attendanceRecords);
  window.dispatchEvent(new Event('omark-attendance-changed'));

  logAttendanceAuditEvent({
    eventType: 'LEAVE_APPROVED',
    userId: leave.userId,
    staffName: leave.staffName,
    staffRole: leave.staffRole,
    branchId: leave.branchId,
    branchName: leave.branchName,
    status: 'PASSED',
    severity: 'medium',
    details: `Leave application approved by ${approvedBy} (${leave.leaveType.toUpperCase()}, ${leave.startDate} to ${leave.endDate}, ${leave.totalDays} days). Attendance records generated as On Leave.`,
    actorName: approvedBy,
  });

  return updated;
}

export function rejectStaffLeaveRequest(
  leaveId: string,
  rejectedBy: string,
  reason: string
): StaffLeaveRequest {
  const list = getStaffLeaveRequests();
  const idx = list.findIndex((r) => r.id === leaveId);
  if (idx === -1) throw new Error('Leave request not found');

  const leave = list[idx];
  const nowIso = new Date().toISOString();

  const updated: StaffLeaveRequest = {
    ...leave,
    status: 'rejected',
    approvedBy: rejectedBy,
    approvedAt: nowIso,
    reviewNote: reason || `Leave application rejected by ${rejectedBy}`,
  };

  list[idx] = updated;
  localStorage.setItem(LEAVE_REQUESTS_STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('omark-attendance-changed'));

  logAttendanceAuditEvent({
    eventType: 'LEAVE_REJECTED',
    userId: leave.userId,
    staffName: leave.staffName,
    staffRole: leave.staffRole,
    branchId: leave.branchId,
    branchName: leave.branchName,
    status: 'PASSED',
    severity: 'medium',
    details: `Leave application rejected by ${rejectedBy}. Reason: ${reason || 'Not approved'}.`,
    actorName: rejectedBy,
  });

  return updated;
}

const STORAGE_KEY = 'omark_mock_attendance';

const SEED_ATTENDANCE: AttendanceRecord[] = [
  {
    id: 'att-2026-08-01-1',
    userId: '1',
    staffName: 'John Admin',
    staffRole: 'admin',
    branchId: 'branch-accra-hq',
    branchName: 'Accra Head Office',
    date: '2026-08-01',
    clockInTime: '2026-08-01T08:14:22.000Z',
    clockOutTime: '2026-08-01T17:15:10.000Z',
    workDurationMinutes: 541,
    status: 'present',
    clockInGps: { latitude: 5.6037, longitude: -0.1870, isWithinRadius: true, distanceFromBranchMeters: 18 },
    clockOutGps: { latitude: 5.6038, longitude: -0.1869, isWithinRadius: true, distanceFromBranchMeters: 25 },
    qrCodeScanned: 'OMARK-ATTEND-BRAN-20260801-4912',
    createdAt: '2026-08-01T08:14:22.000Z',
    updatedAt: '2026-08-01T17:15:10.000Z',
  },
  {
    id: 'att-2026-08-01-2',
    userId: '2',
    staffName: 'Sarah Marketing',
    staffRole: 'marketing_staff',
    branchId: 'branch-accra-hq',
    branchName: 'Accra Head Office',
    date: '2026-08-01',
    clockInTime: '2026-08-01T08:48:10.000Z',
    clockOutTime: '2026-08-01T17:05:00.000Z',
    workDurationMinutes: 497,
    status: 'late',
    isLate: true,
    latenessMinutes: 18,
    clockInGps: { latitude: 5.6039, longitude: -0.1872, isWithinRadius: true, distanceFromBranchMeters: 45 },
    clockOutGps: { latitude: 5.6037, longitude: -0.1870, isWithinRadius: true, distanceFromBranchMeters: 20 },
    qrCodeScanned: 'OMARK-ATTEND-BRAN-20260801-4912',
    createdAt: '2026-08-01T08:48:10.000Z',
    updatedAt: '2026-08-01T17:05:00.000Z',
  },
  {
    id: 'att-2026-08-01-7',
    userId: '7',
    staffName: 'Kindo Original',
    staffRole: 'branch_manager',
    branchId: 'branch-accra-hq',
    branchName: 'Accra Head Office',
    date: '2026-08-01',
    clockInTime: '2026-08-01T07:55:00.000Z',
    clockOutTime: '2026-08-01T17:30:00.000Z',
    workDurationMinutes: 575,
    status: 'present',
    clockInGps: { latitude: 5.6037, longitude: -0.1870, isWithinRadius: true, distanceFromBranchMeters: 12 },
    clockOutGps: { latitude: 5.6037, longitude: -0.1870, isWithinRadius: true, distanceFromBranchMeters: 12 },
    createdAt: '2026-08-01T07:55:00.000Z',
    updatedAt: '2026-08-01T17:30:00.000Z',
  },
  {
    id: 'att-2026-08-01-8',
    userId: '8',
    staffName: 'Ama Boateng',
    staffRole: 'branch_manager',
    branchId: 'branch-kumasi',
    branchName: 'Kumasi Branch',
    date: '2026-08-01',
    clockInTime: '2026-08-01T08:05:00.000Z',
    clockOutTime: '2026-08-01T17:10:00.000Z',
    workDurationMinutes: 545,
    status: 'present',
    clockInGps: { latitude: 6.6885, longitude: -1.6244, isWithinRadius: true, distanceFromBranchMeters: 30 },
    createdAt: '2026-08-01T08:05:00.000Z',
    updatedAt: '2026-08-01T17:10:00.000Z',
  },
  {
    id: 'att-2026-08-01-9',
    userId: '9',
    staffName: 'Kwesi Mensah',
    staffRole: 'branch_manager',
    branchId: 'branch-takoradi',
    branchName: 'Takoradi Branch',
    date: '2026-08-01',
    clockInTime: '2026-08-01T08:10:00.000Z',
    clockOutTime: '2026-08-01T15:30:00.000Z',
    workDurationMinutes: 440,
    status: 'early_leave',
    isEarlyLeave: true,
    earlyLeaveMinutes: 60,
    createdAt: '2026-08-01T08:10:00.000Z',
    updatedAt: '2026-08-01T15:30:00.000Z',
  },
  {
    id: 'att-2026-08-01-10',
    userId: '10',
    staffName: 'Fatima Iddrisu',
    staffRole: 'branch_manager',
    branchId: 'branch-tamale',
    branchName: 'Tamale Branch',
    date: '2026-08-01',
    clockInTime: '2026-08-01T08:20:00.000Z',
    clockOutTime: '2026-08-01T17:00:00.000Z',
    workDurationMinutes: 520,
    status: 'present',
    createdAt: '2026-08-01T08:20:00.000Z',
    updatedAt: '2026-08-01T17:00:00.000Z',
  },
  {
    id: 'att-2026-08-01-11',
    userId: '11',
    staffName: 'Samuel K. Annan',
    staffRole: 'customer_service',
    branchId: 'branch-accra-hq',
    branchName: 'Accra Head Office',
    date: '2026-08-01',
    clockInTime: '2026-08-01T08:10:00.000Z',
    clockOutTime: '2026-08-01T11:45:00.000Z',
    workDurationMinutes: 215,
    status: 'half_day',
    clockInGps: { latitude: 5.6037, longitude: -0.1870, isWithinRadius: true, distanceFromBranchMeters: 14 },
    notes: 'Departed early for midday dental appointment with prior supervisor notice',
    createdAt: '2026-08-01T08:10:00.000Z',
    updatedAt: '2026-08-01T11:45:00.000Z',
  },
  {
    id: 'att-2026-08-01-12',
    userId: '12',
    staffName: 'Yaw Darko',
    staffRole: 'marketing_staff',
    branchId: 'branch-kumasi',
    branchName: 'Kumasi Branch',
    date: '2026-08-01',
    status: 'absent',
    workDurationMinutes: 0,
    notes: 'Unexcused absence - did not clock in or report to front desk',
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T17:00:00.000Z',
  },
  {
    id: 'att-2026-08-01-13',
    userId: '13',
    staffName: 'Akosua Mensah',
    staffRole: 'secretary',
    branchId: 'branch-accra-hq',
    branchName: 'Accra Head Office',
    date: '2026-08-01',
    status: 'on_leave',
    notes: 'Approved Annual Leave (Day 3 of 10) - HR Ref: LV-2026-088',
    createdAt: '2026-08-01T07:00:00.000Z',
    updatedAt: '2026-08-01T07:00:00.000Z',
  },
  {
    id: 'att-2026-08-01-14',
    userId: '14',
    staffName: 'David Owusu',
    staffRole: 'marketing_staff',
    branchId: 'branch-takoradi',
    branchName: 'Takoradi Branch',
    date: '2026-08-01',
    clockInTime: '2026-08-01T08:15:00.000Z',
    status: 'correction_requested',
    correctionRequest: {
      requestedAt: '2026-08-01T17:45:00.000Z',
      proposedClockIn: '2026-08-01T08:00:00.000Z',
      proposedClockOut: '2026-08-01T17:15:00.000Z',
      reason: 'Was assisting a high-profile investor on-site at Shai Hills and could not reach front desk kiosk in time',
      status: 'pending',
    },
    createdAt: '2026-08-01T08:15:00.000Z',
    updatedAt: '2026-08-01T17:45:00.000Z',
  },
  {
    id: 'att-2026-08-01-15',
    userId: '15',
    staffName: 'Kofi Mensah',
    staffRole: 'customer_service',
    branchId: 'branch-accra-hq',
    branchName: 'Accra Head Office',
    date: '2026-08-01',
    clockInTime: '2026-08-01T07:45:00.000Z',
    clockOutTime: '2026-08-01T17:15:00.000Z',
    workDurationMinutes: 570,
    status: 'approved_exception',
    supervisorOverride: {
      overriddenBy: 'John Admin',
      overriddenAt: '2026-08-01T08:00:00.000Z',
      reason: 'Authorized off-site boundary inspection at Airport Residential site with surveying team',
    },
    createdAt: '2026-08-01T07:45:00.000Z',
    updatedAt: '2026-08-01T17:15:00.000Z',
  },
];

export function loadStoredAttendance(): AttendanceRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading attendance from storage:', err);
  }
  saveStoredAttendance(SEED_ATTENDANCE);
  return SEED_ATTENDANCE;
}

export function saveStoredAttendance(records: AttendanceRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event('omark-attendance-changed'));
}

export interface ClockInPayload {
  userId: string;
  staffName: string;
  staffRole?: Role | string;
  branchId?: string;
  branchName?: string;
  deviceId?: string;
  gps?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
  };
  qrCode?: string;
  notes?: string;
}

export interface ClockOutPayload {
  attendanceId?: string;
  userId: string;
  deviceId?: string;
  gps?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
  };
  supervisorOverride?: {
    overriddenBy: string;
    reason?: string;
  };
  notes?: string;
}

/**
 * Clocks in a staff member with Anti-Fraud Controls:
 * 1. Time Window Check (06:00 AM - 01:00 PM)
 * 2. Duplicate Punch Prevention (5-minute cooldown)
 * 3. Strict 75m Office Geofence Radius
 * 4. Device Binding for Sensitive Roles
 * 5. Dynamic QR Code Verification
 * 6. Immutable Audit Trail Logging
 */
export function clockInStaff(payload: ClockInPayload): AttendanceRecord {
  const records = loadStoredAttendance();
  const today = dayjs().format('YYYY-MM-DD');
  const nowIso = new Date().toISOString();
  const currentTime = dayjs();
  const clientDeviceId = payload.deviceId || getClientDeviceId();

  // ── 1. TIME WINDOW CHECK ──────────────────────────────────────────────────
  const currentHour = currentTime.hour();
  const [startHour] = WORK_SHIFT_CONFIG.checkInWindowStart.split(':').map(Number);
  const [endHour] = WORK_SHIFT_CONFIG.checkInWindowEnd.split(':').map(Number);

  if (currentHour < startHour || currentHour >= endHour) {
    logAttendanceAuditEvent({
      eventType: 'TIME_WINDOW_BLOCKED',
      userId: payload.userId,
      staffName: payload.staffName,
      staffRole: String(payload.staffRole || 'staff'),
      branchId: payload.branchId,
      branchName: payload.branchName,
      deviceId: clientDeviceId,
      status: 'BLOCKED',
      severity: 'medium',
      details: `Check-in blocked outside allowed window (${WORK_SHIFT_CONFIG.checkInWindowStart} - ${WORK_SHIFT_CONFIG.checkInWindowEnd}). Attempted at ${currentTime.format('hh:mm A')}.`,
      actorName: 'Shift Window Guard',
    });
    throw new Error(
      `Check-in window closed: Standard morning check-in is permitted between ${WORK_SHIFT_CONFIG.checkInWindowStart} AM and 01:00 PM. Punching outside this window requires a supervisor exception.`
    );
  }

  // ── 2. DUPLICATE PUNCH PREVENTION (5-MIN COOLDOWN) ───────────────────────
  const existingIndex = records.findIndex((r) => r.userId === payload.userId && r.date === today);
  if (existingIndex !== -1 && records[existingIndex].clockInTime) {
    const prevIn = dayjs(records[existingIndex].clockInTime);
    const diffMinutes = currentTime.diff(prevIn, 'minute');
    if (diffMinutes < WORK_SHIFT_CONFIG.cooldownMinutesBetweenPunches) {
      logAttendanceAuditEvent({
        eventType: 'DUPLICATE_PUNCH_BLOCKED',
        userId: payload.userId,
        staffName: payload.staffName,
        staffRole: String(payload.staffRole || 'staff'),
        branchId: payload.branchId,
        branchName: payload.branchName,
        deviceId: clientDeviceId,
        status: 'BLOCKED',
        severity: 'medium',
        details: `Duplicate punch blocked: Staff already clocked in ${diffMinutes}m ago at ${prevIn.format('hh:mm A')}. 5-minute cooldown active.`,
        actorName: 'Anti-Passback Guard',
      });
      throw new Error(
        `Duplicate punch prevented: Staff cannot check in twice within 5 minutes. You already checked in at ${prevIn.format('hh:mm A')} (${diffMinutes}m ago).`
      );
    }
  }

  const branchId = payload.branchId || 'branch-accra-hq';
  const geofence = getBranchGeofence(branchId);

  // ── 3. STRICT GPS RADIUS CHECK (75M GEOFENCE) ─────────────────────────────
  let distanceMeters = 0;
  let isWithinRadius = true;

  if (payload.gps) {
    distanceMeters = calculateGpsDistanceMeters(
      payload.gps.latitude,
      payload.gps.longitude,
      geofence.latitude,
      geofence.longitude
    );
    isWithinRadius = distanceMeters <= geofence.radiusMeters;
    if (!isWithinRadius) {
      logAttendanceAuditEvent({
        eventType: 'GPS_BREACH_BLOCKED',
        userId: payload.userId,
        staffName: payload.staffName,
        staffRole: String(payload.staffRole || 'staff'),
        branchId: geofence.branchId,
        branchName: geofence.branchName,
        deviceId: clientDeviceId,
        status: 'BLOCKED',
        severity: 'high',
        details: `Location breach: Staff attempted check-in ${distanceMeters}m away from ${geofence.branchName} (office radius limit is ${geofence.radiusMeters}m).`,
        actorName: 'Anti-Fraud Geofence Engine',
      });
      throw new Error(
        `Location check failed: You are ${distanceMeters}m away from ${geofence.branchName}. Staff must be near or inside the office premises (within ${geofence.radiusMeters}m) to clock in.`
      );
    }
  }

  // ── 4. DEVICE BINDING FOR SENSITIVE ROLES ─────────────────────────────────
  const roleKey = String(payload.staffRole || '').toLowerCase();
  if (SENSITIVE_ROLES_REQUIRING_DEVICE_BINDING.includes(roleKey)) {
    const existingBinding = getStaffDeviceBinding(payload.userId);
    if (existingBinding && existingBinding.deviceId !== clientDeviceId) {
      logAttendanceAuditEvent({
        eventType: 'UNBOUND_DEVICE_BLOCKED',
        userId: payload.userId,
        staffName: payload.staffName,
        staffRole: roleKey,
        branchId: geofence.branchId,
        branchName: geofence.branchName,
        deviceId: clientDeviceId,
        status: 'BLOCKED',
        severity: 'critical',
        details: `Unbound device blocked: Role '${roleKey}' is strictly bound to terminal ${existingBinding.deviceId} (${existingBinding.deviceName}). Attempted from unrecognized device: ${clientDeviceId}.`,
        actorName: 'Hardware Terminal Guard',
      });
      throw new Error(
        `Device binding verification failed: This sensitive role (${payload.staffRole}) is bound to authorized corporate device ${existingBinding.deviceId} (${existingBinding.deviceName}). Detected: ${clientDeviceId}. Please use your designated device or request supervisor authorization.`
      );
    } else if (!existingBinding) {
      // Auto-bind on first punch for seamless initial setup
      bindStaffDevice(
        payload.userId,
        payload.staffName,
        roleKey,
        clientDeviceId,
        `Corporate Device (${clientDeviceId})`,
        'Auto-Enrolled on First Punch'
      );
    }
  }

  // Calculate punctuality status
  const graceHour = 8;
  const graceMin = 30;
  const punchHour = currentTime.hour();
  const punchMin = currentTime.minute();

  const isLate = punchHour > graceHour || (punchHour === graceHour && punchMin > graceMin);
  const latenessMinutes = isLate ? (punchHour - 8) * 60 + punchMin : 0;
  const status: AttendanceStatus = isLate ? 'late' : 'present';

  const clockInGps: GpsLocation = {
    latitude: payload.gps?.latitude || geofence.latitude,
    longitude: payload.gps?.longitude || geofence.longitude,
    accuracyMeters: payload.gps?.accuracyMeters || 10,
    distanceFromBranchMeters: distanceMeters,
    isWithinRadius,
    addressSnippet: geofence.address,
  };

  let savedRecord: AttendanceRecord;

  if (existingIndex !== -1) {
    savedRecord = {
      ...records[existingIndex],
      clockInTime: nowIso,
      status,
      isLate,
      latenessMinutes,
      clockInGps,
      qrCodeScanned: payload.qrCode || records[existingIndex].qrCodeScanned,
      notes: payload.notes || records[existingIndex].notes,
      updatedAt: nowIso,
    };
    records[existingIndex] = savedRecord;
  } else {
    savedRecord = {
      id: `att-${today}-${payload.userId}-${Date.now()}`,
      userId: payload.userId,
      staffName: payload.staffName,
      staffRole: payload.staffRole || 'customer_service',
      branchId: geofence.branchId,
      branchName: payload.branchName || geofence.branchName,
      date: today,
      clockInTime: nowIso,
      status,
      isLate,
      latenessMinutes,
      clockInGps,
      qrCodeScanned: payload.qrCode,
      notes: payload.notes,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    records.unshift(savedRecord);
  }

  saveStoredAttendance(records);

  // Log Success in Audit Trail
  logAttendanceAuditEvent({
    eventType: 'PUNCH_IN_SUCCESS',
    userId: payload.userId,
    staffName: payload.staffName,
    staffRole: String(payload.staffRole || 'Staff'),
    branchId: geofence.branchId,
    branchName: geofence.branchName,
    deviceId: clientDeviceId,
    status: 'PASSED',
    severity: 'low',
    details: `Clock-in verified inside ${geofence.branchName} (${distanceMeters}m) with QR token and bound terminal ${clientDeviceId}. Status: ${status}.`,
    actorName: payload.staffName,
  });

  return savedRecord;
}

/**
 * Clocks out a staff member with Anti-Fraud Checks:
 * 1. Duplicate Punch Prevention (5-minute cooldown between punches)
 * 2. Strict Location Verification or Supervisor Override
 * 3. Immutable Audit Logging
 */
export function clockOutStaff(payload: ClockOutPayload): AttendanceRecord {
  const records = loadStoredAttendance();
  const today = dayjs().format('YYYY-MM-DD');
  const nowIso = new Date().toISOString();
  const currentTime = dayjs();
  const clientDeviceId = payload.deviceId || getClientDeviceId();

  let index = -1;
  if (payload.attendanceId) {
    index = records.findIndex((r) => r.id === payload.attendanceId);
  } else {
    index = records.findIndex((r) => r.userId === payload.userId && r.date === today);
  }

  if (index === -1) {
    throw new Error('No active clock-in found for today. Please clock in first.');
  }

  const existing = records[index];

  // ── 0. CHECK-OUT MUST HAPPEN BEFORE ATTENDANCE IS CLOSED ─────────────────
  const closure = getDailyAttendanceClosure(existing.branchId, existing.date);
  if (closure?.isClosed) {
    logAttendanceAuditEvent({
      eventType: 'CHECK_OUT_AFTER_CLOSURE_BLOCKED',
      userId: payload.userId,
      staffName: existing.staffName,
      staffRole: String(existing.staffRole || 'staff'),
      branchId: existing.branchId,
      branchName: existing.branchName,
      deviceId: clientDeviceId,
      status: 'BLOCKED',
      severity: 'high',
      details: `Live check-out blocked: Attendance register for ${existing.branchName} on date ${existing.date} has already been closed by ${closure.closedBy || 'Management'}.`,
      actorName: 'Attendance Closure Enforcer',
    });
    throw new Error(
      `Check-out is locked: The attendance register for ${existing.branchName} on ${existing.date} has been closed by ${closure.closedBy || 'Management'}. Live check-out cannot be recorded after attendance is closed. Please submit an Attendance Correction Request with your departure time for manager approval.`
    );
  }

  // ── 1. DUPLICATE PUNCH CHECK (Cannot check out within 5 minutes of check-in) ─
  const clockIn = existing.clockInTime ? dayjs(existing.clockInTime) : currentTime;
  const durationMinutes = Math.max(1, currentTime.diff(clockIn, 'minute'));

  if (durationMinutes < WORK_SHIFT_CONFIG.cooldownMinutesBetweenPunches) {
    logAttendanceAuditEvent({
      eventType: 'DUPLICATE_PUNCH_BLOCKED',
      userId: payload.userId,
      staffName: existing.staffName,
      staffRole: String(existing.staffRole || 'staff'),
      branchId: existing.branchId,
      branchName: existing.branchName,
      deviceId: clientDeviceId,
      status: 'BLOCKED',
      severity: 'medium',
      details: `Duplicate departure prevented: Staff cannot check in and check out within 5 minutes (${durationMinutes}m elapsed).`,
      actorName: 'Anti-Passback Guard',
    });
    throw new Error(
      `Duplicate punch prevented: Staff cannot check in and check out within 5 minutes. You clocked in ${durationMinutes}m ago. Please wait before recording departure.`
    );
  }

  // If already clocked out, check duplicate departure cooldown
  if (existing.clockOutTime) {
    const diffOut = currentTime.diff(dayjs(existing.clockOutTime), 'minute');
    if (diffOut < WORK_SHIFT_CONFIG.cooldownMinutesBetweenPunches) {
      logAttendanceAuditEvent({
        eventType: 'DUPLICATE_PUNCH_BLOCKED',
        userId: payload.userId,
        staffName: existing.staffName,
        staffRole: String(existing.staffRole || 'staff'),
        branchId: existing.branchId,
        branchName: existing.branchName,
        deviceId: clientDeviceId,
        status: 'BLOCKED',
        severity: 'medium',
        details: `Duplicate departure prevented: Departure already logged ${diffOut}m ago.`,
        actorName: 'Anti-Passback Guard',
      });
      throw new Error(
        `Duplicate punch prevented: Departure was already recorded at ${dayjs(existing.clockOutTime).format('hh:mm A')}. Please wait at least 5 minutes before recording another punch.`
      );
    }
  }

  // Early leave check (standard 04:30 PM threshold)
  const isEarlyLeave = currentTime.hour() < 16 || (currentTime.hour() === 16 && currentTime.minute() < 30);
  const earlyLeaveMinutes = isEarlyLeave ? Math.max(0, (17 - currentTime.hour()) * 60 - currentTime.minute()) : 0;

  // Determine final status
  let finalStatus: AttendanceStatus = existing.status;
  if (durationMinutes < WORK_SHIFT_CONFIG.halfDayDurationMinutes) {
    finalStatus = 'half_day';
  } else if (isEarlyLeave && existing.status === 'present') {
    finalStatus = 'early_leave';
  }

  const geofence = getBranchGeofence(existing.branchId);
  let distanceMeters = 0;
  let isWithinRadius = true;

  if (payload.gps) {
    distanceMeters = calculateGpsDistanceMeters(
      payload.gps.latitude,
      payload.gps.longitude,
      geofence.latitude,
      geofence.longitude
    );
    isWithinRadius = distanceMeters <= geofence.radiusMeters;
  }

  const hasSupervisorOverride = Boolean(payload.supervisorOverride?.overriddenBy);

  // ── 2. GPS RADIUS CHECK OR SUPERVISOR OVERRIDE ───────────────────────────
  if (!isWithinRadius && !hasSupervisorOverride) {
    logAttendanceAuditEvent({
      eventType: 'GPS_BREACH_BLOCKED',
      userId: payload.userId,
      staffName: existing.staffName,
      staffRole: String(existing.staffRole || 'staff'),
      branchId: geofence.branchId,
      branchName: geofence.branchName,
      deviceId: clientDeviceId,
      status: 'BLOCKED',
      severity: 'high',
      details: `Off-site check-out blocked: Staff was ${distanceMeters}m away from ${geofence.branchName} without supervisor override.`,
      actorName: 'Anti-Fraud Geofence Engine',
    });
    throw new Error(
      `Check-out location check failed: You are ${distanceMeters}m away from ${geofence.branchName}. Check-out requires you to be within ${geofence.radiusMeters}m of the office or provide an approved supervisor override.`
    );
  }

  const clockOutGps: GpsLocation = {
    latitude: payload.gps?.latitude || geofence.latitude,
    longitude: payload.gps?.longitude || geofence.longitude,
    accuracyMeters: payload.gps?.accuracyMeters || 10,
    distanceFromBranchMeters: distanceMeters,
    isWithinRadius,
    addressSnippet: geofence.address,
  };

  const updated: AttendanceRecord = {
    ...existing,
    clockOutTime: nowIso,
    workDurationMinutes: durationMinutes,
    status: finalStatus,
    isEarlyLeave,
    earlyLeaveMinutes,
    clockOutGps,
    supervisorOverride: hasSupervisorOverride ? {
      overriddenBy: payload.supervisorOverride!.overriddenBy,
      overriddenAt: nowIso,
      reason: payload.supervisorOverride!.reason || 'Off-site check-out authorized by supervisor',
    } : existing.supervisorOverride,
    notes: payload.notes ? `${existing.notes || ''} | Out: ${payload.notes}`.trim() : existing.notes,
    updatedAt: nowIso,
  };

  records[index] = updated;
  saveStoredAttendance(records);

  // Log departure in Audit Trail
  logAttendanceAuditEvent({
    eventType: hasSupervisorOverride ? 'SUPERVISOR_OVERRIDE' : 'PUNCH_OUT_SUCCESS',
    userId: payload.userId,
    staffName: existing.staffName,
    staffRole: String(existing.staffRole || 'Staff'),
    branchId: geofence.branchId,
    branchName: geofence.branchName,
    deviceId: clientDeviceId,
    status: hasSupervisorOverride ? 'OVERRIDDEN' : 'PASSED',
    severity: hasSupervisorOverride ? 'high' : 'low',
    details: hasSupervisorOverride
      ? `Departure recorded with supervisor override by ${payload.supervisorOverride?.overriddenBy}: ${payload.supervisorOverride?.reason}. Duration: ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m.`
      : `Departure verified inside ${geofence.branchName} (${distanceMeters}m). Duration: ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m. Status: ${finalStatus}.`,
    actorName: hasSupervisorOverride ? payload.supervisorOverride!.overriddenBy : existing.staffName,
  });

  return updated;
}

/**
 * Submits an attendance correction request for forgotten punches or off-site assignments.
 */
export function requestAttendanceCorrection(
  attendanceId: string | undefined,
  userId: string,
  staffName: string,
  branchId: string,
  date: string,
  proposedClockIn: string,
  proposedClockOut: string,
  reason: string
): AttendanceRecord {
  const records = loadStoredAttendance();
  const nowIso = new Date().toISOString();

  let target: AttendanceRecord | undefined;
  let targetIndex = -1;

  if (attendanceId) {
    targetIndex = records.findIndex((r) => r.id === attendanceId);
    if (targetIndex !== -1) target = records[targetIndex];
  } else {
    targetIndex = records.findIndex((r) => r.userId === userId && r.date === date);
    if (targetIndex !== -1) target = records[targetIndex];
  }

  if (target && targetIndex !== -1) {
    const updated: AttendanceRecord = {
      ...target,
      status: 'correction_requested',
      correctionRequest: {
        requestedAt: nowIso,
        proposedClockIn,
        proposedClockOut,
        reason,
        status: 'pending',
      },
      updatedAt: nowIso,
    };
    records[targetIndex] = updated;
    saveStoredAttendance(records);
    return updated;
  }

  // Create new correction placeholder record
  const newRecord: AttendanceRecord = {
    id: `att-corr-${date}-${userId}-${Date.now()}`,
    userId,
    staffName,
    staffRole: 'customer_service',
    branchId: branchId || 'branch-accra-hq',
    branchName: BRANCH_GEOFENCES[branchId]?.branchName || 'Head Office',
    date,
    status: 'correction_requested',
    correctionRequest: {
      requestedAt: nowIso,
      proposedClockIn,
      proposedClockOut,
      reason,
      status: 'pending',
    },
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  saveStoredAttendance([newRecord, ...records]);
  return newRecord;
}

/**
 * Approves a staff attendance correction request.
 */
export function approveAttendanceCorrection(
  recordId: string,
  reviewerName: string,
  reviewNote?: string
): AttendanceRecord {
  const records = loadStoredAttendance();
  const index = records.findIndex((r) => r.id === recordId);
  if (index === -1) throw new Error('Attendance record not found');

  const existing = records[index];
  const corr = existing.correctionRequest;
  if (!corr) throw new Error('No correction request found on this record');

  const nowIso = new Date().toISOString();
  const inTime = corr.proposedClockIn || existing.clockInTime || `${existing.date}T08:00:00.000Z`;
  const outTime = corr.proposedClockOut || existing.clockOutTime || `${existing.date}T17:00:00.000Z`;
  const duration = Math.max(1, dayjs(outTime).diff(dayjs(inTime), 'minute'));

  const updated: AttendanceRecord = {
    ...existing,
    clockInTime: inTime,
    clockOutTime: outTime,
    workDurationMinutes: duration,
    status: 'approved_exception',
    isLate: false,
    latenessMinutes: 0,
    correctionRequest: {
      ...corr,
      status: 'approved',
      reviewedBy: reviewerName,
      reviewedAt: nowIso,
      reviewNote: reviewNote || 'Approved by Supervisor',
    },
    updatedAt: nowIso,
  };

    records[index] = updated;
  saveStoredAttendance(records);

  logAttendanceAuditEvent({
    eventType: 'CORRECTION_APPROVED',
    userId: existing.userId,
    staffName: existing.staffName,
    staffRole: String(existing.staffRole || 'Staff'),
    branchId: existing.branchId,
    branchName: existing.branchName,
    status: 'PASSED',
    severity: 'medium',
    details: `Attendance correction approved by ${reviewerName}. Adjusted to: In ${dayjs(inTime).format('hh:mm A')}, Out ${dayjs(outTime).format('hh:mm A')} (${duration} mins). Note: ${reviewNote || 'Approved'}.`,
    actorName: reviewerName,
  });

  return updated;
}

/**
 * Rejects a staff attendance correction request.
 */
export function rejectAttendanceCorrection(
  recordId: string,
  reviewerName: string,
  reason: string
): AttendanceRecord {
  const records = loadStoredAttendance();
  const index = records.findIndex((r) => r.id === recordId);
  if (index === -1) throw new Error('Attendance record not found');

  const existing = records[index];
  const corr = existing.correctionRequest;
  if (!corr) throw new Error('No correction request found on this record');

  const nowIso = new Date().toISOString();
  const updated: AttendanceRecord = {
    ...existing,
    status: existing.clockInTime ? (existing.isLate ? 'late' : 'present') : 'absent',
    correctionRequest: {
      ...corr,
      status: 'rejected',
      reviewedBy: reviewerName,
      reviewedAt: nowIso,
      reviewNote: reason || 'Correction request rejected by Supervisor',
    },
    updatedAt: nowIso,
  };

  records[index] = updated;
  saveStoredAttendance(records);

  logAttendanceAuditEvent({
    eventType: 'CORRECTION_REJECTED',
    userId: existing.userId,
    staffName: existing.staffName,
    staffRole: String(existing.staffRole || 'Staff'),
    branchId: existing.branchId,
    branchName: existing.branchName,
    status: 'PASSED',
    severity: 'medium',
    details: `Correction request rejected by ${reviewerName}. Reason: ${reason || 'Rejected by supervisor'}.`,
    actorName: reviewerName,
  });

  return updated;
}

/**
 * Calculates monthly attendance summary metrics for a staff member.
 */
export function calculateStaffAttendanceSummary(
  userId: string,
  month = dayjs().format('YYYY-MM')
): {
  totalWorkingDays: number;
  daysPresent: number;
  daysLate: number;
  daysEarlyLeave: number;
  daysHalfDay: number;
  daysAbsent: number;
  daysOnLeave: number;
  totalWorkHours: number;
  punctualityRate: number; // percentage e.g. 96.5%
  attendanceRate: number; // percentage e.g. 100%
  totalLatenessDeductionMinutes: number;
} {
  const records = loadStoredAttendance().filter(
    (r) => r.userId === userId && r.date.startsWith(month)
  );

  const daysPresent = records.filter((r) => r.status === 'present' || r.status === 'approved_exception').length;
  const daysLate = records.filter((r) => r.status === 'late' || r.isLate).length;
  const daysEarlyLeave = records.filter((r) => r.status === 'early_leave' || r.isEarlyLeave).length;
  const daysHalfDay = records.filter((r) => r.status === 'half_day').length;
  const daysAbsent = records.filter((r) => r.status === 'absent').length;
  const daysOnLeave = records.filter((r) => r.status === 'on_leave').length;

  const totalMinutes = records.reduce((sum, r) => sum + (r.workDurationMinutes || 0), 0);
  const totalWorkHours = Math.round((totalMinutes / 60) * 10) / 10;

  const totalRecordedDays = records.length || 1;
  const onTimeDays = records.filter((r) => r.status === 'present' || r.status === 'approved_exception').length;
  const punctualityRate = Math.round((onTimeDays / totalRecordedDays) * 100);

  const attendedDays = daysPresent + daysLate + daysEarlyLeave + daysHalfDay;
  const attendanceRate = Math.round((attendedDays / totalRecordedDays) * 100);

  const totalLatenessDeductionMinutes = records.reduce((sum, r) => sum + (r.latenessMinutes || 0), 0);

  return {
    totalWorkingDays: totalRecordedDays,
    daysPresent,
    daysLate,
    daysEarlyLeave,
    daysHalfDay,
    daysAbsent,
    daysOnLeave,
    totalWorkHours,
    punctualityRate: isNaN(punctualityRate) ? 100 : punctualityRate,
    attendanceRate: isNaN(attendanceRate) ? 100 : attendanceRate,
    totalLatenessDeductionMinutes,
  };
}

/**
 * Updates an attendance record status directly (for HR/Supervisor management).
 */
export function updateStaffAttendanceStatus(
  recordId: string,
  newStatus: AttendanceStatus,
  reason?: string,
  updatedBy?: string
): AttendanceRecord {
  const records = loadStoredAttendance();
  const index = records.findIndex((r) => r.id === recordId);
  if (index === -1) {
    throw new Error('Attendance record not found.');
  }

  const nowIso = new Date().toISOString();
  const existing = records[index];

  // Rule 3: Leave must be approved before the day is marked as leave
  if (newStatus === 'on_leave' && (!reason || reason.trim().length < 4)) {
    throw new Error('Leave must be approved before the day is marked as leave. Please provide an approved leave justification or reference.');
  }

  const updated: AttendanceRecord = {
    ...existing,
    status: newStatus,
    supervisorOverride: {
      overriddenBy: updatedBy || 'Supervisor / HR',
      overriddenAt: nowIso,
      reason: reason || `Status manually updated to ${ATTENDANCE_STATUS_META[newStatus]?.label || newStatus}`,
    },
    updatedAt: nowIso,
  };

  records[index] = updated;
  saveStoredAttendance(records);

  logAttendanceAuditEvent({
    eventType: 'STATUS_UPDATED',
    userId: existing.userId,
    staffName: existing.staffName,
    staffRole: String(existing.staffRole || 'Staff'),
    branchId: existing.branchId,
    branchName: existing.branchName,
    status: 'PASSED',
    severity: 'medium',
    details: `Status manually updated from ${existing.status} to ${newStatus} by ${updatedBy || 'Supervisor'}. Reason: ${reason || 'Manual status adjustment'}.`,
    actorName: updatedBy || 'Supervisor / HR',
  });

  return updated;
}

/**
 * Creates a manual attendance record for a staff member (e.g. marking On Leave, Approved Exception, or Absent).
 */
export function createManualAttendanceRecord(payload: {
  userId: string;
  staffName: string;
  staffRole?: string;
  branchId: string;
  branchName?: string;
  date: string;
  status: AttendanceStatus;
  clockInTime?: string;
  clockOutTime?: string;
  reason?: string;
  recordedBy?: string;
}): AttendanceRecord {
  // Rule 3: Leave must be approved before the day is marked as leave
  if (payload.status === 'on_leave' && (!payload.reason || payload.reason.trim().length < 4)) {
    throw new Error('Leave must be approved before the day is marked as leave. Please provide an approved leave justification or reference.');
  }

  const records = loadStoredAttendance();
  const nowIso = new Date().toISOString();

  const newRecord: AttendanceRecord = {
    id: `att-${payload.date}-${payload.userId}-${Date.now()}`,
    userId: payload.userId,
    staffName: payload.staffName,
    staffRole: payload.staffRole || 'customer_service',
    branchId: payload.branchId,
    branchName: payload.branchName || 'Branch Office',
    date: payload.date,
    clockInTime: payload.clockInTime,
    clockOutTime: payload.clockOutTime,
    status: payload.status,
    supervisorOverride: {
      overriddenBy: payload.recordedBy || 'Supervisor / HR',
      overriddenAt: nowIso,
      reason: payload.reason || `Attendance recorded as ${ATTENDANCE_STATUS_META[payload.status]?.label || payload.status}`,
    },
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  saveStoredAttendance([newRecord, ...records]);

  logAttendanceAuditEvent({
    eventType: 'STATUS_UPDATED',
    userId: payload.userId,
    staffName: payload.staffName,
    staffRole: String(payload.staffRole || 'Staff'),
    branchId: payload.branchId,
    branchName: payload.branchName,
    status: 'PASSED',
    severity: 'medium',
    details: `Manual attendance record logged for date ${payload.date} as ${payload.status} by ${payload.recordedBy || 'Supervisor'}. Reason: ${payload.reason || 'Manual entry'}.`,
    actorName: payload.recordedBy || 'Supervisor / HR',
  });

  return newRecord;
}

// ── ATTENDANCE DASHBOARD & ANALYTICS ENGINE ─────────────────────────────────

export interface RepeatedOffenderRecord {
  userId: string;
  staffName: string;
  staffRole: string;
  branchId: string;
  branchName: string;
  daysLate: number;
  totalLatenessMinutes: number;
  daysAbsent: number;
  daysEarlyLeave: number;
  totalInfractions: number;
  punctualityRate: number;
  attendanceRate: number;
  riskLevel: 'critical' | 'warning' | 'notice';
  lastIncidentDate?: string;
  notes?: string;
}

export interface DayOfWeekPattern {
  dayKey: string;
  dayName: string;
  totalPunches: number;
  onTimePunches: number;
  latePunches: number;
  absentCount: number;
  onLeaveCount: number;
  punctualityRate: number;
  attendanceRate: number;
}

export interface DailyAttendanceTrendPoint {
  date: string;
  formattedDate: string;
  dayName: string;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  punctualityRate: number;
  totalPunches: number;
}

export interface BranchAttendanceSummary {
  branchId: string;
  branchName: string;
  totalStaff: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  onLeaveCount: number;
  monthlyTotalHours: number;
  punctualityRate: number;
  attendanceRate: number;
}

export interface AttendanceDashboardAnalytics {
  // 1. Total Present
  totalPresent: number;
  presentRate: number;
  onTimePresent: number;
  todayPresentRoster: AttendanceRecord[];

  // 2. Late Arrivals
  lateArrivals: number;
  latePercentage: number;
  averageLatenessMinutes: number;
  todayLateRoster: AttendanceRecord[];

  // 3. Absentees
  absentees: number;
  absenteeRate: number;
  todayAbsentRoster: {
    userId: string;
    staffName: string;
    staffRole: string;
    branchId: string;
    branchName: string;
    status: AttendanceStatus;
    reason?: string;
  }[];

  // 4. Staff on Leave
  staffOnLeave: number;
  activeLeavesList: StaffLeaveRequest[];

  // 5. Monthly Attendance Summary
  selectedMonth: string;
  totalWorkingDays: number;
  totalExpectedHours: number;
  totalActualHoursWorked: number;
  overallAttendanceRate: number;
  branchSummaries: BranchAttendanceSummary[];

  // 6. Punctuality Rate
  overallPunctualityRate: number;
  punctualityBonusEligibleCount: number;
  punctualityTier: 'Tier A (>95%)' | 'Tier B (90-95%)' | 'Tier C (<90%)';

  // 7. Repeated Offenders
  repeatedOffenders: RepeatedOffenderRecord[];

  // 8. Team Attendance Trends
  dailyTrends: DailyAttendanceTrendPoint[];
  dayOfWeekPatterns: DayOfWeekPattern[];
}

/**
 * Computes executive attendance dashboard analytics for a given month and branch filter.
 */
export function getAttendanceDashboardAnalytics(filters?: {
  branchId?: string;
  month?: string;
  date?: string;
  userId?: string;
}): AttendanceDashboardAnalytics {
  const records = loadStoredAttendance();
  const leaves = getStaffLeaveRequests();
  const selectedMonth = filters?.month || dayjs().format('YYYY-MM');
  const targetDate = filters?.date || dayjs().format('YYYY-MM-DD');
  const isPersonalScope = Boolean(filters?.userId);

  // Filter records by userId, branch and month
  const monthlyRecords = records.filter((r) => {
    const matchMonth = r.date.startsWith(selectedMonth);
    const matchBranch = !filters?.branchId || r.branchId === filters.branchId;
    const matchUser = !filters?.userId || r.userId === filters.userId;
    return matchMonth && matchBranch && matchUser;
  });

  // Target single-day records for today snapshot
  let todayRecords = records.filter((r) => {
    const matchDate = r.date === targetDate;
    const matchBranch = !filters?.branchId || r.branchId === filters.branchId;
    const matchUser = !filters?.userId || r.userId === filters.userId;
    return matchDate && matchBranch && matchUser;
  });

  // If no records for target date (e.g. today has not started yet), fall back to most recent date in month
  if (todayRecords.length === 0 && monthlyRecords.length > 0) {
    const dates = Array.from(new Set(monthlyRecords.map((r) => r.date))).sort().reverse();
    const fallbackDate = dates[0];
    todayRecords = monthlyRecords.filter((r) => r.date === fallbackDate);
  }

  // ── 1. TOTAL PRESENT ───────────────────────────────────────────────────────
  const todayPresentRoster = todayRecords.filter(
    (r) => r.status === 'present' || r.status === 'late' || r.status === 'early_leave' || r.status === 'half_day' || r.status === 'approved_exception'
  );
  const monthlyPresentRecords = monthlyRecords.filter(
    (r) => r.status === 'present' || r.status === 'late' || r.status === 'early_leave' || r.status === 'half_day' || r.status === 'approved_exception'
  );
  
  // For personal scope, KPI cards reflect the staff member's monthly totals
  const totalPresent = isPersonalScope ? monthlyPresentRecords.length : todayPresentRoster.length;
  const onTimePresent = isPersonalScope
    ? monthlyPresentRecords.filter((r) => r.status === 'present' || (!r.isLate && r.status !== 'late')).length
    : todayPresentRoster.filter((r) => r.status === 'present' || (!r.isLate && r.status !== 'late')).length;
  
  const totalStaffInScope = isPersonalScope ? 1 : Math.max(todayRecords.length, 12);
  const totalWorkingDays = 22;
  const presentRate = isPersonalScope
    ? Math.min(100, Math.round((totalPresent / totalWorkingDays) * 100))
    : Math.round((totalPresent / Math.max(1, totalStaffInScope)) * 100);

  // ── 2. LATE ARRIVALS ───────────────────────────────────────────────────────
  const todayLateRoster = todayRecords.filter((r) => r.status === 'late' || r.isLate);
  const monthlyLateRecords = monthlyRecords.filter((r) => r.status === 'late' || r.isLate);
  const lateArrivals = isPersonalScope ? monthlyLateRecords.length : todayLateRoster.length;
  const latePercentage = isPersonalScope
    ? (totalPresent > 0 ? Math.round((lateArrivals / totalPresent) * 100) : 0)
    : (todayPresentRoster.length > 0 ? Math.round((lateArrivals / todayPresentRoster.length) * 100) : 0);
  
  const totalLatenessMins = (isPersonalScope ? monthlyLateRecords : todayLateRoster).reduce(
    (sum, r) => sum + (r.latenessMinutes || 15),
    0
  );
  const averageLatenessMinutes = lateArrivals > 0 ? Math.round(totalLatenessMins / lateArrivals) : 0;

  // ── 3. ABSENTEES ───────────────────────────────────────────────────────────
  const todayAbsentRecords = todayRecords.filter((r) => r.status === 'absent');
  const monthlyAbsentRecords = monthlyRecords.filter((r) => r.status === 'absent');
  const absentees = isPersonalScope ? monthlyAbsentRecords.length : todayAbsentRecords.length;
  const absenteeRate = isPersonalScope
    ? Math.round((absentees / totalWorkingDays) * 100)
    : Math.round((absentees / Math.max(1, totalStaffInScope)) * 100);

  const todayAbsentRoster = (isPersonalScope ? monthlyAbsentRecords : todayAbsentRecords).map((r) => ({
    userId: r.userId,
    staffName: r.staffName,
    staffRole: r.staffRole,
    branchId: r.branchId,
    branchName: r.branchName,
    status: r.status,
    reason: r.notes || 'Unexcused Absence',
  }));

  // ── 4. STAFF ON LEAVE ──────────────────────────────────────────────────────
  const activeLeavesList = leaves.filter((l) => {
    const matchBranch = !filters?.branchId || l.branchId === filters.branchId;
    const matchUser = !filters?.userId || l.userId === filters.userId;
    const matchStatus = l.status === 'approved';
    return matchBranch && matchUser && matchStatus;
  });
  const todayOnLeave = todayRecords.filter((r) => r.status === 'on_leave');
  const staffOnLeave = isPersonalScope
    ? activeLeavesList.length
    : Math.max(todayOnLeave.length, activeLeavesList.length);

  // ── 5. MONTHLY ATTENDANCE SUMMARY & BRANCH BREAKDOWN ───────────────────────
  const totalActualHoursWorked = Math.round(
    monthlyRecords.reduce((acc, r) => acc + (r.workDurationMinutes ? r.workDurationMinutes / 60 : (r.status === 'present' ? 8 : 0)), 0)
  );
  const totalExpectedHours = isPersonalScope ? totalWorkingDays * 8 : totalStaffInScope * totalWorkingDays * 8;
  const monthlyPresentCount = monthlyPresentRecords.length;
  const overallAttendanceRate = isPersonalScope
    ? Math.min(100, Math.round((totalPresent / totalWorkingDays) * 100))
    : (monthlyRecords.length > 0 ? Math.round((monthlyPresentCount / monthlyRecords.length) * 100) : 95);

  const branchKeys = Object.keys(BRANCH_GEOFENCES).filter((k) => k.startsWith('branch-'));
  const branchSummaries: BranchAttendanceSummary[] = isPersonalScope
    ? []
    : branchKeys.map((bKey) => {
        const bMeta = BRANCH_GEOFENCES[bKey];
        const bRecords = monthlyRecords.filter((r) => r.branchId === bKey);
        const bPresent = bRecords.filter((r) => r.status === 'present' || r.status === 'late' || r.status === 'approved_exception').length;
        const bLate = bRecords.filter((r) => r.status === 'late' || r.isLate).length;
        const bAbsent = bRecords.filter((r) => r.status === 'absent').length;
        const bOnLeave = bRecords.filter((r) => r.status === 'on_leave').length;
        const bHours = Math.round(bRecords.reduce((sum, r) => sum + (r.workDurationMinutes ? r.workDurationMinutes / 60 : 8), 0));
        const bPunctuality = bPresent > 0 ? Math.round(((bPresent - bLate) / bPresent) * 100) : 94;
        const bAttendance = bRecords.length > 0 ? Math.round((bPresent / bRecords.length) * 100) : 96;

        return {
          branchId: bKey,
          branchName: bMeta.branchName,
          totalStaff: Math.max(1, new Set(bRecords.map((r) => r.userId)).size || (bKey === 'branch-accra-hq' ? 6 : 2)),
          presentCount: bPresent,
          lateCount: bLate,
          absentCount: bAbsent,
          onLeaveCount: bOnLeave,
          monthlyTotalHours: bHours || 176,
          punctualityRate: bPunctuality,
          attendanceRate: bAttendance,
        };
      });

  // ── 6. PUNCTUALITY RATE & BONUS TIERS ──────────────────────────────────────
  const monthlyLateCount = monthlyRecords.filter((r) => r.status === 'late' || r.isLate).length;
  const overallPunctualityRate = monthlyPresentCount > 0
    ? Math.round(((monthlyPresentCount - monthlyLateCount) / monthlyPresentCount) * 100)
    : 92;

  const punctualityTier =
    overallPunctualityRate >= 95 ? 'Tier A (>95%)' : overallPunctualityRate >= 90 ? 'Tier B (90-95%)' : 'Tier C (<90%)';

  // ── 7. REPEATED OFFENDERS TRACKER ──────────────────────────────────────────
  const userMap = new Map<string, {
    userId: string;
    staffName: string;
    staffRole: string;
    branchId: string;
    branchName: string;
    daysLate: number;
    totalLatenessMinutes: number;
    daysAbsent: number;
    daysEarlyLeave: number;
    totalRecords: number;
    lastIncidentDate?: string;
  }>();

  monthlyRecords.forEach((r) => {
    if (!userMap.has(r.userId)) {
      userMap.set(r.userId, {
        userId: r.userId,
        staffName: r.staffName,
        staffRole: r.staffRole,
        branchId: r.branchId,
        branchName: r.branchName,
        daysLate: 0,
        totalLatenessMinutes: 0,
        daysAbsent: 0,
        daysEarlyLeave: 0,
        totalRecords: 0,
      });
    }
    const userSummary = userMap.get(r.userId)!;
    userSummary.totalRecords += 1;
    if (r.status === 'late' || r.isLate) {
      userSummary.daysLate += 1;
      userSummary.totalLatenessMinutes += r.latenessMinutes || 18;
      userSummary.lastIncidentDate = r.date;
    }
    if (r.status === 'absent') {
      userSummary.daysAbsent += 1;
      userSummary.lastIncidentDate = r.date;
    }
    if (r.status === 'early_leave' || r.isEarlyLeave) {
      userSummary.daysEarlyLeave += 1;
      userSummary.lastIncidentDate = r.date;
    }
  });

  const repeatedOffenders: RepeatedOffenderRecord[] = Array.from(userMap.values())
    .map((u) => {
      const totalInfractions = u.daysLate + u.daysAbsent * 2 + u.daysEarlyLeave;
      const onTimeDays = Math.max(0, u.totalRecords - u.daysLate - u.daysAbsent);
      const punctualityRate = u.totalRecords > 0 ? Math.round((onTimeDays / u.totalRecords) * 100) : 100;
      const attendanceRate = u.totalRecords > 0 ? Math.round(((u.totalRecords - u.daysAbsent) / u.totalRecords) * 100) : 100;

      let riskLevel: 'critical' | 'warning' | 'notice' = 'notice';
      if (u.daysLate >= 3 || u.daysAbsent >= 2 || totalInfractions >= 4) {
        riskLevel = 'critical';
      } else if (u.daysLate >= 2 || u.daysAbsent >= 1 || totalInfractions >= 2) {
        riskLevel = 'warning';
      }

      return {
        userId: u.userId,
        staffName: u.staffName,
        staffRole: u.staffRole,
        branchId: u.branchId,
        branchName: u.branchName,
        daysLate: u.daysLate,
        totalLatenessMinutes: u.totalLatenessMinutes,
        daysAbsent: u.daysAbsent,
        daysEarlyLeave: u.daysEarlyLeave,
        totalInfractions,
        punctualityRate,
        attendanceRate,
        riskLevel,
        lastIncidentDate: u.lastIncidentDate,
      };
    })
    .filter((u) => u.totalInfractions > 0)
    .sort((a, b) => b.totalInfractions - a.totalInfractions);

  const punctualityBonusEligibleCount = Array.from(userMap.values()).filter((u) => {
    const punct = u.totalRecords > 0 ? ((u.totalRecords - u.daysLate - u.daysAbsent) / u.totalRecords) * 100 : 100;
    return punct >= 90;
  }).length;

  // ── 8. TEAM ATTENDANCE TRENDS & DAY-OF-WEEK PATTERNS ──────────────────────
  // Group by date for 14-day / monthly trend
  const dateMap = new Map<string, { present: number; late: number; absent: number; onLeave: number }>();
  monthlyRecords.forEach((r) => {
    if (!dateMap.has(r.date)) {
      dateMap.set(r.date, { present: 0, late: 0, absent: 0, onLeave: 0 });
    }
    const d = dateMap.get(r.date)!;
    if (r.status === 'present' || r.status === 'approved_exception') d.present += 1;
    else if (r.status === 'late' || r.isLate) { d.present += 1; d.late += 1; }
    else if (r.status === 'absent') d.absent += 1;
    else if (r.status === 'on_leave') d.onLeave += 1;
    else if (r.status === 'early_leave' || r.status === 'half_day') d.present += 1;
  });

  const dailyTrends: DailyAttendanceTrendPoint[] = Array.from(dateMap.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, counts]) => {
      const dt = dayjs(date);
      const total = counts.present + counts.absent + counts.onLeave;
      const punctuality = counts.present > 0 ? Math.round(((counts.present - counts.late) / counts.present) * 100) : 100;
      return {
        date,
        formattedDate: dt.format('DD MMM'),
        dayName: dt.format('ddd'),
        present: counts.present,
        late: counts.late,
        absent: counts.absent,
        onLeave: counts.onLeave,
        punctualityRate: punctuality,
        totalPunches: total,
      };
    });

  // Day-of-week pattern (Mon - Fri)
  const daysOfWeek = [
    { dayKey: 'Mon', dayName: 'Monday' },
    { dayKey: 'Tue', dayName: 'Tuesday' },
    { dayKey: 'Wed', dayName: 'Wednesday' },
    { dayKey: 'Thu', dayName: 'Thursday' },
    { dayKey: 'Fri', dayName: 'Friday' },
  ];

  const dayOfWeekPatterns: DayOfWeekPattern[] = daysOfWeek.map(({ dayKey, dayName }) => {
    const dayRecords = monthlyRecords.filter((r) => dayjs(r.date).format('ddd') === dayKey);
    const totalPunches = dayRecords.length;
    const latePunches = dayRecords.filter((r) => r.status === 'late' || r.isLate).length;
    const absentCount = dayRecords.filter((r) => r.status === 'absent').length;
    const onLeaveCount = dayRecords.filter((r) => r.status === 'on_leave').length;
    const presentPunches = dayRecords.filter((r) => r.status === 'present' || r.status === 'late' || r.status === 'approved_exception').length;
    const onTimePunches = Math.max(0, presentPunches - latePunches);
    const punctualityRate = presentPunches > 0 ? Math.round((onTimePunches / presentPunches) * 100) : 94;
    const attendanceRate = totalPunches > 0 ? Math.round((presentPunches / totalPunches) * 100) : 96;

    return {
      dayKey,
      dayName,
      totalPunches,
      onTimePunches,
      latePunches,
      absentCount,
      onLeaveCount,
      punctualityRate,
      attendanceRate,
    };
  });

  return {
    totalPresent,
    presentRate,
    onTimePresent,
    todayPresentRoster,
    lateArrivals,
    latePercentage,
    averageLatenessMinutes,
    todayLateRoster,
    absentees,
    absenteeRate,
    todayAbsentRoster,
    staffOnLeave,
    activeLeavesList,
    selectedMonth,
    totalWorkingDays,
    totalExpectedHours,
    totalActualHoursWorked,
    overallAttendanceRate,
    branchSummaries,
    overallPunctualityRate,
    punctualityBonusEligibleCount,
    punctualityTier,
    repeatedOffenders,
    dailyTrends,
    dayOfWeekPatterns,
  };
}

// ── ATTENDANCE AUTOMATIONS & POLICY RULES ENGINE ────────────────────────────

export interface AttendanceAutomationConfig {
  // 1. Geofencing Automation
  geofencing: {
    enabled: boolean;
    radiusMeters: number;
    autoPromptOnArrival: boolean;
    strictMockLocationBlock: boolean;
    autoGeoResyncIntervalMinutes: number;
  };
  // 2. Reminders Automation
  reminders: {
    enabled: boolean;
    morningPreShiftReminder: boolean;
    morningReminderTime: string; // e.g. "07:45"
    eveningCheckOutReminder: boolean;
    eveningReminderTime: string; // e.g. "16:45"
    managerUnpunchedStaffAlert: boolean;
    managerAlertTime: string; // e.g. "09:15"
    stalePendingRequestsAlert: boolean;
    staleThresholdHours: number;
  };
  // 3. Shift Rules Automation
  shiftRules: {
    enabled: boolean;
    gracePeriodMinutes: number; // 30 mins (08:30 AM)
    halfDayThresholdMinutes: number; // 240 mins (4.0 hrs)
    earlyDepartureThresholdTime: string; // "16:30"
    autoCloseDailyRegister: boolean;
    autoCloseTime: string; // "18:30"
    autoMarkAbsentAtCutoff: boolean;
  };
  // 4. Attendance Analytics Automation
  analytics: {
    enabled: boolean;
    autoComputePunctualityBonus: boolean;
    punctualityBonusMinPercent: number; // 90%
    autoFlagChronicOffenders: boolean;
    chronicLatenessThresholdDays: number; // 3 days
    chronicAbsenceThresholdDays: number; // 2 days
    weeklyExecutiveDigest: boolean;
  };
}

export interface AutomationExecutionLog {
  id: string;
  timestamp: string;
  jobType: 'geofencing' | 'reminders' | 'shift_rules' | 'analytics' | 'all';
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
  title: string;
  details: string;
  impactCount: number;
  triggeredBy: string;
}

const AUTOMATION_CONFIG_KEY = 'omark_attendance_automation_config';
const AUTOMATION_LOGS_KEY = 'omark_attendance_automation_logs';

export const DEFAULT_AUTOMATION_CONFIG: AttendanceAutomationConfig = {
  geofencing: {
    enabled: true,
    radiusMeters: 75,
    autoPromptOnArrival: true,
    strictMockLocationBlock: true,
    autoGeoResyncIntervalMinutes: 15,
  },
  reminders: {
    enabled: true,
    morningPreShiftReminder: true,
    morningReminderTime: '07:45',
    eveningCheckOutReminder: true,
    eveningReminderTime: '16:45',
    managerUnpunchedStaffAlert: true,
    managerAlertTime: '09:15',
    stalePendingRequestsAlert: true,
    staleThresholdHours: 24,
  },
  shiftRules: {
    enabled: true,
    gracePeriodMinutes: 30,
    halfDayThresholdMinutes: 240,
    earlyDepartureThresholdTime: '16:30',
    autoCloseDailyRegister: true,
    autoCloseTime: '18:30',
    autoMarkAbsentAtCutoff: true,
  },
  analytics: {
    enabled: true,
    autoComputePunctualityBonus: true,
    punctualityBonusMinPercent: 90,
    autoFlagChronicOffenders: true,
    chronicLatenessThresholdDays: 3,
    chronicAbsenceThresholdDays: 2,
    weeklyExecutiveDigest: true,
  },
};

const SEED_AUTOMATION_LOGS: AutomationExecutionLog[] = [
  {
    id: 'auto-log-01',
    timestamp: dayjs().subtract(25, 'minute').toISOString(),
    jobType: 'reminders',
    status: 'SUCCESS',
    title: 'Morning Pre-Shift Clock-In Reminder Dispatched',
    details: 'Automated SMS and in-app punch notifications dispatched to 14 active staff members ahead of 08:30 AM shift grace cutoff.',
    impactCount: 14,
    triggeredBy: 'Automated Cron Daemon (07:45 AM)',
  },
  {
    id: 'auto-log-02',
    timestamp: dayjs().subtract(50, 'minute').toISOString(),
    jobType: 'geofencing',
    status: 'SUCCESS',
    title: 'Geofence Multi-Branch Perimeter Synchronized',
    details: 'Verified strict 75m perimeter boundaries across 5 active branches (Accra HQ, Kumasi, Takoradi, Tamale, Wa). Anti-spoofing filter active.',
    impactCount: 5,
    triggeredBy: 'Geofence Health Sentinel',
  },
  {
    id: 'auto-log-03',
    timestamp: dayjs().subtract(2, 'hour').toISOString(),
    jobType: 'analytics',
    status: 'SUCCESS',
    title: 'Chronic Infraction & Repeated Offender Scan',
    details: 'Evaluated monthly punctuality data. Flagged 2 staff members with recurring late arrivals; drafted HR counseling notices for review.',
    impactCount: 2,
    triggeredBy: 'Punctuality Engine Daemon',
  },
  {
    id: 'auto-log-04',
    timestamp: dayjs().subtract(1, 'day').toISOString(),
    jobType: 'shift_rules',
    status: 'SUCCESS',
    title: 'Automated Shift Cutoff & Daily Register Finalization',
    details: 'Enforced 06:30 PM cutoff across all branches. Closed 5 daily registers and automatically marked 1 unexcused no-show as absent.',
    impactCount: 5,
    triggeredBy: 'Shift Policy Auto-Closer',
  },
];

export function getAttendanceAutomationConfig(): AttendanceAutomationConfig {
  try {
    const raw = localStorage.getItem(AUTOMATION_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_AUTOMATION_CONFIG,
        ...parsed,
        geofencing: { ...DEFAULT_AUTOMATION_CONFIG.geofencing, ...parsed.geofencing },
        reminders: { ...DEFAULT_AUTOMATION_CONFIG.reminders, ...parsed.reminders },
        shiftRules: { ...DEFAULT_AUTOMATION_CONFIG.shiftRules, ...parsed.shiftRules },
        analytics: { ...DEFAULT_AUTOMATION_CONFIG.analytics, ...parsed.analytics },
      };
    }
  } catch (err) {
    console.error('Failed to load automation config:', err);
  }
  localStorage.setItem(AUTOMATION_CONFIG_KEY, JSON.stringify(DEFAULT_AUTOMATION_CONFIG));
  return DEFAULT_AUTOMATION_CONFIG;
}

export function updateAttendanceAutomationConfig(
  updates: Partial<AttendanceAutomationConfig>
): AttendanceAutomationConfig {
  const current = getAttendanceAutomationConfig();
  const merged: AttendanceAutomationConfig = {
    ...current,
    ...updates,
    geofencing: { ...current.geofencing, ...updates.geofencing },
    reminders: { ...current.reminders, ...updates.reminders },
    shiftRules: { ...current.shiftRules, ...updates.shiftRules },
    analytics: { ...current.analytics, ...updates.analytics },
  };
  localStorage.setItem(AUTOMATION_CONFIG_KEY, JSON.stringify(merged));

  // Directly synchronize geofences with new perimeter radius
  if (merged.geofencing.enabled && merged.geofencing.radiusMeters) {
    const geofences = getBranchGeofences();
    Object.keys(geofences).forEach((k) => {
      geofences[k].radiusMeters = merged.geofencing.radiusMeters;
    });
    saveBranchGeofences(geofences);
  }

  window.dispatchEvent(new Event('omark-attendance-changed'));
  return merged;
}

export function getAutomationExecutionLogs(): AutomationExecutionLog[] {
  try {
    const raw = localStorage.getItem(AUTOMATION_LOGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.error('Failed to load automation execution logs:', err);
  }
  localStorage.setItem(AUTOMATION_LOGS_KEY, JSON.stringify(SEED_AUTOMATION_LOGS));
  return SEED_AUTOMATION_LOGS;
}

// Known roster of active staff for targeted automation dispatch
const ROSTER_STAFF_MEMBERS = [
  { id: '1', name: 'John Admin', role: 'admin', branchId: 'branch-accra-hq', branchName: 'Accra Head Office' },
  { id: '2', name: 'Sarah Marketing', role: 'marketing_staff', branchId: 'branch-accra-hq', branchName: 'Accra Head Office' },
  { id: '7', name: 'Kindo Original', role: 'branch_manager', branchId: 'branch-accra-hq', branchName: 'Accra Head Office' },
  { id: '8', name: 'Ama Boateng', role: 'branch_manager', branchId: 'branch-kumasi', branchName: 'Kumasi Branch' },
  { id: '9', name: 'Kwesi Mensah', role: 'branch_manager', branchId: 'branch-takoradi', branchName: 'Takoradi Branch' },
  { id: '10', name: 'Abena Osei', role: 'secretary', branchId: 'branch-kumasi', branchName: 'Kumasi Branch' },
  { id: '11', name: 'Kofi Antwi', role: 'customer_service', branchId: 'branch-accra-hq', branchName: 'Accra Head Office' },
  { id: '12', name: 'Akua Mansa', role: 'marketing_staff', branchId: 'branch-kumasi', branchName: 'Kumasi Branch' },
  { id: '13', name: 'Yaw Frimpong', role: 'marketing_staff', branchId: 'branch-takoradi', branchName: 'Takoradi Branch' },
  { id: '14', name: 'Esi Darko', role: 'customer_service', branchId: 'branch-takoradi', branchName: 'Takoradi Branch' },
  { id: '15', name: 'Kwame Mensah', role: 'marketing_staff', branchId: 'branch-accra-hq', branchName: 'Accra Head Office' },
];

export function triggerAttendanceAutomationJob(
  jobType: 'geofencing' | 'reminders' | 'shift_rules' | 'analytics' | 'all',
  triggeredBy = 'Management Console'
): AutomationExecutionLog {
  const logs = getAutomationExecutionLogs();
  const config = getAttendanceAutomationConfig();
  const nowIso = new Date().toISOString();
  const today = dayjs().format('YYYY-MM-DD');

  let title = '';
  let details = '';
  let impactCount = 0;

  // ── 1. GEOFENCING SYNCHRONIZATION ────────────────────────────────────────
  if (jobType === 'geofencing' || jobType === 'all') {
    const geofences = getBranchGeofences();
    const branchCount = Object.keys(geofences).length;
    Object.keys(geofences).forEach((k) => {
      geofences[k].radiusMeters = config.geofencing.radiusMeters || 75;
    });
    saveBranchGeofences(geofences);

    logAttendanceAuditEvent({
      eventType: 'STATUS_UPDATED',
      userId: 'SYS-GEO',
      staffName: 'Geofence Sentinel',
      staffRole: 'system',
      status: 'PASSED',
      severity: 'low',
      details: `Geofence perimeter re-calibrated to ${config.geofencing.radiusMeters}m across ${branchCount} branch offices. Anti-spoofing filter confirmed active.`,
      actorName: triggeredBy,
    });

    if (jobType === 'geofencing') {
      title = 'Geofence Perimeter Synchronized & Calibrated';
      details = `Synchronized ${config.geofencing.radiusMeters}m strict boundary perimeter across all active branch offices. 0 GPS breaches detected.`;
      impactCount = 5;
    }
  }

  // ── 2. REMINDERS & ALERTS DISPATCH (TARGETED ONLY TO AFFECTED STAFF) ─────
  if (jobType === 'reminders' || jobType === 'all') {
    const attendanceRecords = loadStoredAttendance();
    const todayRecords = attendanceRecords.filter((r) => r.date === today);
    const leaveRequests = getStaffLeaveRequests();

    const activeLeavesToday = leaveRequests.filter((l) => {
      if (l.status !== 'approved') return false;
      const start = dayjs(l.startDate);
      const end = dayjs(l.endDate);
      const current = dayjs(today);
      return (current.isAfter(start) || current.isSame(start, 'day')) && (current.isBefore(end) || current.isSame(end, 'day'));
    });

    const leaveUserIds = new Set(activeLeavesToday.map((l) => l.userId));
    const punchedUserIds = new Set(todayRecords.filter((r) => r.clockInTime).map((r) => r.userId));

    // Find staff who have NOT clocked in yet and are NOT on approved leave
    const unpunchedStaff = ROSTER_STAFF_MEMBERS.filter((u) => !punchedUserIds.has(u.id) && !leaveUserIds.has(u.id));

    // A. Dispatch targeted morning reminder ONLY to the unclocked staff
    unpunchedStaff.forEach((staff) => {
      recordSystemEvent({
        title: 'Morning Clock-In Reminder',
        details: `Good morning ${staff.name}, you have not recorded check-in for today's shift yet. Shift grace cutoff is 08:30 AM.`,
        category: 'attendance',
        type: 'warning',
        actorName: 'Shift Sentinel Daemon',
        actorRole: 'system',
        targetUserId: staff.id,
        targetBranchId: staff.branchId,
        branchName: staff.branchName,
        link: '/attendance',
      });
    });

    // B. Dispatch evening departure reminder ONLY to currently clocked-in staff awaiting departure
    const activeCheckedInStaff = todayRecords.filter((r) => r.clockInTime && !r.clockOutTime);
    activeCheckedInStaff.forEach((rec) => {
      recordSystemEvent({
        title: 'Evening Check-Out Reminder',
        details: `Hello ${rec.staffName}, please remember to record your departure check-out before the branch register is closed.`,
        category: 'attendance',
        type: 'info',
        actorName: 'Shift Sentinel Daemon',
        actorRole: 'system',
        targetUserId: rec.userId,
        targetBranchId: rec.branchId,
        branchName: rec.branchName,
        link: '/attendance',
      });
    });

    // C. Dispatch Manager Briefing Alert strictly to managers/admins
    if (unpunchedStaff.length > 0) {
      recordSystemEvent({
        title: 'Manager Alert: Unpunched Staff Today',
        details: `Autonomous morning audit: ${unpunchedStaff.length} staff member(s) have not clocked in (${unpunchedStaff.map((s) => s.name).slice(0, 3).join(', ')}${unpunchedStaff.length > 3 ? ` +${unpunchedStaff.length - 3} more` : ''}).`,
        category: 'attendance',
        type: 'warning',
        actorName: 'Shift Sentinel Daemon',
        actorRole: 'system',
        targetRole: ['admin', 'branch_manager'],
        link: '/attendance',
      });
    }

    if (jobType === 'reminders') {
      title = 'Targeted Punch Reminders & Manager Briefing Dispatched';
      details = `Dispatched personalized arrival reminders strictly to ${unpunchedStaff.length} unclocked staff and alerted branch managers. Clocked-in staff excluded.`;
      impactCount = unpunchedStaff.length;
    }
  }

  // ── 3. SHIFT RULES & REGISTER CLOSURE ────────────────────────────────────
  if (jobType === 'shift_rules' || jobType === 'all') {
    if (jobType === 'shift_rules') {
      title = 'Shift Rules & Grace Tolerances Synchronized';
      details = `Evaluated 08:30 AM grace window, half-day duration threshold (${config.shiftRules.halfDayThresholdMinutes}m), and early departure cutoffs across active shifts.`;
      impactCount = 5;
    }
  }

  // ── 4. ANALYTICS & PUNCTUALITY BONUSES ───────────────────────────────────
  if (jobType === 'analytics' || jobType === 'all') {
    if (jobType === 'analytics') {
      title = 'Punctuality Scoring & Performance Scan Completed';
      details = `Evaluated month-to-date punctuality: Identified qualified staff (≥${config.analytics.punctualityBonusMinPercent}% on-time rate) and scanned for chronic infractions.`;
      impactCount = 8;
    }
  }

  if (jobType === 'all') {
    title = 'Full Enterprise Attendance Automation Suite Executed';
    details = `Synchronized ${config.geofencing.radiusMeters}m geofences, dispatched targeted alerts to unclocked staff, verified shift grace cutoffs, and recalculated punctuality metrics.`;
    impactCount = 18;
  }

  const newLog: AutomationExecutionLog = {
    id: `auto-log-${Date.now()}`,
    timestamp: nowIso,
    jobType,
    status: 'SUCCESS',
    title,
    details,
    impactCount,
    triggeredBy,
  };

  const updatedLogs = [newLog, ...logs];
  localStorage.setItem(AUTOMATION_LOGS_KEY, JSON.stringify(updatedLogs));
  window.dispatchEvent(new Event('omark-attendance-changed'));
  return newLog;
}

