// src/api/attendance.ts
//
// React Query API hooks for Staff Attendance System
// Integrated with backend API endpoints at /api/v1/attendance

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapData, unwrapList } from '@/api/client';
import type { ApiResponse } from '@/types';

export type AttendanceStatus =
  | 'ON_TIME'
  | 'LATE'
  | 'HALF_DAY'
  | 'EARLY_DEPARTURE'
  | 'OVERTIME'
  | 'ABSENT'
  | 'ON_LEAVE'
  | 'HOLIDAY';

export interface AttendanceRecord {
  id: string;
  userId: string;
  staffName?: string;
  staffEmail?: string;
  staffRole?: string;
  branchId: string;
  branchName?: string;
  date: string; // YYYY-MM-DD
  clockInTime?: string; // HH:mm:ss or ISO
  clockOutTime?: string;
  clockInCoordinates?: { latitude: number; longitude: number };
  clockOutCoordinates?: { latitude: number; longitude: number };
  clockInAddress?: string;
  clockOutAddress?: string;
  status: AttendanceStatus;
  workDurationMinutes?: number;
  lateMinutes?: number;
  isLate?: boolean;
  latenessMinutes?: number;
  isEarlyLeave?: boolean;
  earlyLeaveMinutes?: number;
  isOvertime?: boolean;
  overtimeMinutes?: number;
  isWithinGeofence?: boolean;
  distanceFromBranchMeters?: number;
  deviceId?: string;
  deviceFingerprint?: string;
  isMockLocationDetected?: boolean;
  verificationMethod?: 'GPS_GEOFENCE' | 'MANUAL_SUPERVISOR' | 'SYSTEM_CRON';
  verifiedByUserId?: string;
  verifiedByUserName?: string;
  qrCodeScanned?: boolean;
  clockInGps?: any;
  clockOutGps?: any;
  supervisorOverride?: any;
  correctionRequest?: any;
  correctionRequested?: boolean;
  correctionReason?: string;
  correctionStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  correctionApprovedBy?: string;
  correctionApprovedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClockInPayload {
  userId?: string;
  staffId?: string;
  staffName?: string;
  staffRole?: string;
  branchId?: string;
  branchName?: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  deviceId?: string;
  deviceFingerprint?: string;
  isMockLocation?: boolean;
  isMockGps?: boolean;
  timestamp?: string;
  [key: string]: any;
}

export interface ClockOutPayload {
  userId?: string;
  staffId?: string;
  attendanceId?: string;
  branchId?: string;
  latitude?: number;
  longitude?: number;
  deviceId?: string;
  gps?: any;
  summaryOfWork?: string;
  timestamp?: string;
  [key: string]: any;
}

export interface DeviceBinding {
  userId: string;
  staffName: string;
  deviceId: string;
  deviceName: string;
  role?: string;
  boundAt: string;
  lastUsedAt: string;
  isActive: boolean;
  [key: string]: any;
}

export interface AttendanceAuditLog {
  id: string;
  attendanceId: string;
  userId: string;
  staffName: string;
  staffRole?: string;
  action: string;
  changedBy: string;
  actorName?: string;
  branchName?: string;
  deviceId?: string;
  status?: string;
  severity?: 'info' | 'warn' | 'error' | 'critical' | string;
  details: string;
  timestamp: string;
  [key: string]: any;
}

export interface DailyAttendanceClosure {
  id: string;
  branchId: string;
  branchName?: string;
  date: string;
  closedAt: string;
  closedByUserId: string;
  closedByUserName: string;
  closedBy?: string;
  isClosed?: boolean;
  totalScheduled: number;
  totalPresent: number;
  totalLate: number;
  totalHalfDay: number;
  totalAbsent: number;
  totalOnLeave: number;
  isReopened?: boolean;
  reopenedAt?: string;
  reopenedByUserId?: string;
  reopenedByUserName?: string;
  reopenReason?: string;
  [key: string]: any;
}

export interface RepeatedOffenderRecord {
  userId: string;
  staffName: string;
  staffRole?: string;
  branchName?: string;
  latePunchesCount?: number;
  daysLate?: number;
  totalLateMinutes?: number;
  totalLatenessMinutes?: number;
  unexcusedAbsencesCount?: number;
  daysAbsent?: number;
  severityLevel?: 'MILD' | 'MODERATE' | 'SEVERE' | string;
  riskLevel?: 'MILD' | 'MODERATE' | 'SEVERE' | 'LOW' | 'HIGH' | string;
  [key: string]: any;
}

export interface BranchAttendanceSummary {
  branchId: string;
  branchName: string;
  totalStaff: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  onLeaveCount: number;
  punctualityRate: number;
  attendanceRate: number;
  [key: string]: any;
}

export interface AttendanceDashboardAnalytics {
  totalStaffCount?: number;
  todayPresentCount?: number;
  todayOnTimeCount?: number;
  todayLateCount?: number;
  todayHalfDayCount?: number;
  todayAbsentCount?: number;
  todayOnLeaveCount?: number;
  todayGeofenceViolationsCount?: number;
  todayRegisterClosed?: boolean;
  todayRegisterClosureDetails?: DailyAttendanceClosure;
  monthlyAveragePunctualityRate?: number;
  monthlyAverageAttendanceRate?: number;
  totalOvertimeHoursThisMonth?: number;
  branchAttendanceRates?: Array<{
    branchId: string;
    branchName: string;
    totalStaff: number;
    presentToday: number;
    onTimeRate: number;
    attendanceRate: number;
  }>;
  absentees?: number;
  absenteeRate?: number;
  staffOnLeave?: number;
  activeLeavesList?: any[];
  totalWorkingDays?: number;
  totalActualHoursWorked?: number;
  totalExpectedHours?: number;
  overallAttendanceRate?: number;
  overallPunctualityRate?: number;
  punctualityTier?: string;
  punctualityBonusEligibleCount?: number;
  dailyTrends?: any[];
  dayOfWeekPatterns?: any[];
  repeatedOffenders?: RepeatedOffenderRecord[];
  branchSummaries?: BranchAttendanceSummary[] | any[];
  todayPresentRoster?: any[];
  todayLateRoster?: any[];
  todayAbsentRoster?: any[];
  [key: string]: any;
}

export interface AttendanceAutomationConfig {
  analytics?: any;
  geofencing: {
    enabled: boolean;
    radiusMeters: number;
    strictMockLocationBlock: boolean;
    autoGeoResyncIntervalMinutes?: number;
    [key: string]: any;
  };
  shiftRules: {
    enabled?: boolean;
    standardShiftStart: string;
    standardShiftEnd: string;
    gracePeriodMinutes: number;
    halfDayThresholdMinutes: number;
    autoCloseRegisterHour: number;
    earlyDepartureThresholdTime?: string;
    autoCloseTime?: string;
    autoCloseDailyRegister?: boolean;
    [key: string]: any;
  };
  reminders: {
    morningReminderEnabled: boolean;
    morningReminderTime: string;
    eveningReminderEnabled: boolean;
    eveningReminderTime: string;
    sendSmsNotification: boolean;
    sendInAppAlert: boolean;
    morningPreShiftReminder?: boolean;
    eveningCheckOutReminder?: boolean;
    managerUnpunchedStaffAlert?: boolean;
    managerAlertTime?: string;
    stalePendingRequestsAlert?: boolean;
    staleThresholdHours?: number;
    [key: string]: any;
  };
  bonusPool: {
    punctualityBonusRateGHS: number;
    minimumAttendanceRatePct: number;
    qualificationThresholdDays: number;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface AutomationExecutionLog {
  id: string;
  timestamp: string;
  ruleName: string;
  domain: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR';
  details: string;
  affectedCount: number;
}

export function getClientDeviceId(): string {
  let id = localStorage.getItem('omark_client_device_id');
  if (!id) {
    id = `DEV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    localStorage.setItem('omark_client_device_id', id);
  }
  return id;
}

// --- Query Keys ---
export const attendanceKeys = {
  all: ['attendance'] as const,
  list: (filters?: any) => ['attendance', 'list', filters] as const,
  today: (branchId?: string) => ['attendance', 'today', branchId] as const,
  history: (filters?: any) => ['attendance', 'history', filters] as const,
  stats: (userId?: string, month?: string) => ['attendance', 'stats', userId, month] as const,
  trends: (branchId?: string, period?: string) => ['attendance', 'trends', branchId, period] as const,
  corrections: () => ['attendance', 'corrections'] as const,
  geofences: () => ['attendance', 'geofences'] as const,
  automations: () => ['attendance', 'automations'] as const,
  logs: () => ['attendance', 'logs'] as const,
};

// --- Attendance Query Hooks ---

export function useAttendanceQuery(params?: { branchId?: string; date?: string; userId?: string; month?: string; status?: string }) {
  return useQuery({
    queryKey: attendanceKeys.list(params),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<AttendanceRecord[]>>('/attendance/history', { params });
        const list = unwrapList(res);
        return Array.isArray(list) ? list : (list as any)?.items || [];
      } catch {
        return [];
      }
    },
  });
}

export function useAttendanceTodayQuery(branchId?: string) {
  return useQuery({
    queryKey: attendanceKeys.today(branchId),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<AttendanceRecord[]>>('/attendance/today', { params: { branchId } });
        const list = unwrapList(res);
        return Array.isArray(list) ? list : (list as any)?.items || [];
      } catch {
        return [];
      }
    },
  });
}

export function useAttendanceHistoryQuery(params?: any) {
  return useQuery({
    queryKey: attendanceKeys.history(params),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<AttendanceRecord[]>>('/attendance/history', { params });
        const list = unwrapList(res);
        return Array.isArray(list) ? list : (list as any)?.items || [];
      } catch {
        return [];
      }
    },
  });
}

export function useAttendanceStatsQuery(params?: { userId?: string; branchId?: string; month?: string; year?: number }) {
  return useQuery({
    queryKey: attendanceKeys.stats(params?.userId, params?.month),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<any>>('/attendance/stats', { params });
        return unwrapData(res);
      } catch {
        return {
          totalScheduledDays: 0,
          presentDays: 0,
          onTimeDays: 0,
          lateDays: 0,
          halfDays: 0,
          absentDays: 0,
          onLeaveDays: 0,
          onTimeRate: 100,
          attendanceRate: 100,
          totalWorkMinutes: 0,
          totalOvertimeMinutes: 0,
        };
      }
    },
  });
}

export function useStaffAttendanceStatsQuery(userId?: string, month?: string) {
  return useAttendanceStatsQuery({ userId, month });
}

export function useAttendanceTrendsQuery(branchId?: string, period?: string) {
  return useQuery({
    queryKey: attendanceKeys.trends(branchId, period),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<any>>('/attendance/trends', { params: { branchId, period } });
        return unwrapData(res);
      } catch {
        return [];
      }
    },
  });
}

export function useAttendanceAnalyticsQuery(branchId?: string) {
  return useQuery({
    queryKey: ['attendance', 'analytics', branchId],
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<AttendanceDashboardAnalytics>>('/attendance/stats', { params: { branchId } });
        return unwrapData(res);
      } catch {
        return null;
      }
    },
  });
}

export function useBranchGeofencesQuery() {
  return useQuery({
    queryKey: attendanceKeys.geofences(),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<any[]>>('/attendance/geofences');
        const list = unwrapList(res);
        return Array.isArray(list) ? list : [];
      } catch {
        return [];
      }
    },
  });
}

export function useAttendanceAutomationsConfigQuery() {
  return useQuery({
    queryKey: attendanceKeys.automations(),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<AttendanceAutomationConfig>>('/attendance/automations/rules');
        return unwrapData(res);
      } catch {
        return null;
      }
    },
  });
}

export function useAutomationLogsQuery() {
  return useQuery({
    queryKey: attendanceKeys.logs(),
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<AutomationExecutionLog[]>>('/attendance/automations/logs');
        const list = unwrapList(res);
        return Array.isArray(list) ? list : [];
      } catch {
        return [];
      }
    },
  });
}

// --- Attendance Mutation Hooks ---

export function useClockInMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ClockInPayload) => {
      const res = await apiClient.post<ApiResponse<AttendanceRecord>>('/attendance/clock-in', payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useClockOutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ClockOutPayload) => {
      const res = await apiClient.post<ApiResponse<AttendanceRecord>>('/attendance/clock-out', payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useCloseAttendanceRegisterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { branchId: string; date: string; closedByUserId?: string; notes?: string; branchName?: string }) => {
      const res = await apiClient.post<ApiResponse<DailyAttendanceClosure>>('/attendance/register/close', payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useReopenAttendanceRegisterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { branchId: string; date: string; reopenedByUserId?: string; reason: string; branchName?: string }) => {
      const res = await apiClient.post<ApiResponse<DailyAttendanceClosure>>('/attendance/register/reopen', payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useSubmitAttendanceCorrectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { attendanceId?: string; userId?: string; staffName?: string; date: string; requestedPunchIn?: string; requestedPunchOut?: string; reason: string; [key: string]: any }) => {
      const res = await apiClient.post<ApiResponse<any>>('/attendance/correction', payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useReviewAttendanceCorrectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, reviewerNotes }: { id: string; status: 'APPROVED' | 'REJECTED'; reviewerNotes?: string }) => {
      const res = await apiClient.patch<ApiResponse<any>>(`/attendance/correction/${id}`, { status, reviewerNotes });
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useUpdateBranchGeofenceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ branchId, payload }: { branchId: string; payload: any }) => {
      const res = await apiClient.put<ApiResponse<any>>(`/attendance/geofences/${branchId}`, payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.geofences() });
    },
  });
}

export function useUpdateAttendanceAutomationsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AttendanceAutomationConfig>) => {
      const res = await apiClient.put<ApiResponse<AttendanceAutomationConfig>>('/attendance/automations/rules', payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.automations() });
    },
  });
}

export function useTriggerAttendanceAutomationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload?: { branchId?: string; jobType?: string; domain?: string; ruleId?: string; [key: string]: any }) => {
      const res = await apiClient.post<ApiResponse<any>>('/attendance/automations/trigger', payload ?? {});
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useTodayAttendanceQuery(branchId?: string) {
  return useAttendanceQuery({ branchId, date: new Date().toISOString().split('T')[0] });
}

export function useAttendanceDashboardAnalyticsQuery(params?: { branchId?: string; date?: string; month?: string; userId?: string; [key: string]: any }) {
  return useQuery({
    queryKey: ['attendance', 'dashboard-analytics', params],
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<AttendanceDashboardAnalytics>>('/attendance/analytics/dashboard', { params });
        return unwrapData(res);
      } catch {
        return null;
      }
    },
  });
}

export function useAttendanceCorrectionsQuery(branchId?: string) {
  return useQuery({
    queryKey: ['attendance', 'corrections', branchId],
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<any[]>>('/attendance/corrections', { params: { branchId } });
        return unwrapList(res);
      } catch {
        return [];
      }
    },
  });
}

export function useApproveCorrectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id?: string; recordId?: string; reviewerNotes?: string; reviewerUserId?: string; reviewerName?: string }) => {
      const targetId = (payload.id || payload.recordId)!;
      const res = await apiClient.patch<ApiResponse<any>>(`/attendance/correction/${targetId}`, {
        status: 'APPROVED',
        reviewerNotes: payload.reviewerNotes || payload.reviewerName,
      });
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useRejectCorrectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id?: string; recordId?: string; reviewerNotes?: string; reviewerUserId?: string; reviewerName?: string; reason?: string }) => {
      const targetId = (payload.id || payload.recordId)!;
      const res = await apiClient.patch<ApiResponse<any>>(`/attendance/correction/${targetId}`, {
        status: 'REJECTED',
        reviewerNotes: payload.reviewerNotes || payload.reason || payload.reviewerName,
      });
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useUpdateAttendanceStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id?: string; recordId?: string; status: AttendanceStatus; notes?: string; reason?: string }) => {
      const targetId = (payload.id || payload.recordId)!;
      const res = await apiClient.patch<ApiResponse<AttendanceRecord>>(`/attendance/${targetId}/status`, {
        status: payload.status,
        notes: payload.notes || payload.reason,
      });
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useCreateManualAttendanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      userId: string;
      staffName?: string;
      date: string;
      status: AttendanceStatus;
      clockInTime?: string;
      clockOutTime?: string;
      notes?: string;
      reason?: string;
      branchId?: string;
    }) => {
      const res = await apiClient.post<ApiResponse<AttendanceRecord>>('/attendance/manual', payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useAttendanceAuditLogsQuery(params?: any) {
  return useQuery({
    queryKey: ['attendance', 'audit-logs', params],
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<AttendanceAuditLog[]>>('/attendance/audit-logs', { params });
        const data = res.data?.data;
        return Array.isArray(data) ? data : (data as any)?.items || [];
      } catch {
        return [];
      }
    },
  });
}

export function useDeviceBindingsQuery(branchId?: string) {
  return useQuery({
    queryKey: ['attendance', 'device-bindings', branchId],
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<DeviceBinding[]>>('/attendance/device-bindings', { params: { branchId } });
        const data = res.data?.data;
        return Array.isArray(data) ? data : (data as any)?.items || [];
      } catch {
        return [];
      }
    },
  });
}

export function useBindDeviceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { userId: string; deviceId: string; deviceName: string; staffName?: string; role?: string; boundBy?: string }) => {
      const res = await apiClient.post<ApiResponse<DeviceBinding>>('/attendance/device-bindings', payload);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useResetDeviceBindingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string | { userId: string; resetBy?: string }) => {
      const targetId = typeof userId === 'string' ? userId : userId.userId;
      const res = await apiClient.delete<ApiResponse<any>>(`/attendance/device-bindings/${targetId}`);
      return unwrapData(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useDailyAttendanceClosureQuery(date?: string, branchId?: string) {
  return useQuery({
    queryKey: ['attendance', 'closure', date, branchId],
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<DailyAttendanceClosure>>('/attendance/register/closure', {
          params: { date, branchId },
        });
        return unwrapData(res);
      } catch {
        return null;
      }
    },
  });
}

// Backward compatibility alias exports
export const useCloseDailyAttendanceMutation = useCloseAttendanceRegisterMutation;
export const useReopenDailyAttendanceMutation = useReopenAttendanceRegisterMutation;
export const useRequestCorrectionMutation = useSubmitAttendanceCorrectionMutation;
export const useAttendanceAutomationConfigQuery = useAttendanceAutomationsConfigQuery;
export const useUpdateAttendanceAutomationConfigMutation = useUpdateAttendanceAutomationsMutation;
export const useAutomationExecutionLogsQuery = useAutomationLogsQuery;
export const useTriggerAutomationJobMutation = useTriggerAttendanceAutomationMutation;
export const useTriggerAutomationRuleMutation = useTriggerAttendanceAutomationMutation;

