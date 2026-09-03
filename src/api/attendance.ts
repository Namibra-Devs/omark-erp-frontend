// src/api/attendance.ts
//
// React Query API hooks for Staff Attendance System
// Synchronized with local persistent storage (omark_mock_attendance) and live event updates.

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type AttendanceRecord,
  type AttendanceStatus,
  type ClockInPayload,
  type ClockOutPayload,
  loadStoredAttendance,
  clockInStaff,
  clockOutStaff,
  requestAttendanceCorrection,
  approveAttendanceCorrection,
  rejectAttendanceCorrection,
  calculateStaffAttendanceSummary,
  updateStaffAttendanceStatus,
  createManualAttendanceRecord,
  getClientDeviceId,
  getDeviceBindings,
  bindStaffDevice,
  resetStaffDeviceBinding,
  getAttendanceAuditLogs,
  getDailyAttendanceClosure,
  getDailyAttendanceClosures,
  closeDailyAttendance,
  reopenDailyAttendance,
  getStaffLeaveRequests,
  submitStaffLeaveRequest,
  approveStaffLeaveRequest,
  rejectStaffLeaveRequest,
  type DeviceBinding,
  type AttendanceAuditLog,
  type DailyAttendanceClosure,
  type StaffLeaveRequest,
  type LeaveType,
  type AttendanceDashboardAnalytics,
  type RepeatedOffenderRecord,
  type DayOfWeekPattern,
  type DailyAttendanceTrendPoint,
  type BranchAttendanceSummary,
  type AttendanceAutomationConfig,
  type AutomationExecutionLog,
  getAttendanceDashboardAnalytics,
  getAttendanceAutomationConfig,
  updateAttendanceAutomationConfig,
  getAutomationExecutionLogs,
  triggerAttendanceAutomationJob,
} from '@/mock/staffAttendance';

export {
  type AttendanceRecord,
  type AttendanceStatus,
  type ClockInPayload,
  type ClockOutPayload,
  type DeviceBinding,
  type AttendanceAuditLog,
  type DailyAttendanceClosure,
  type StaffLeaveRequest,
  type LeaveType,
  type AttendanceDashboardAnalytics,
  type RepeatedOffenderRecord,
  type DayOfWeekPattern,
  type DailyAttendanceTrendPoint,
  type BranchAttendanceSummary,
  type AttendanceAutomationConfig,
  type AutomationExecutionLog,
  getClientDeviceId,
};
import dayjs from 'dayjs';

export const attendanceKeys = {
  all: ['attendance'] as const,
  list: (filters?: { branchId?: string; date?: string; userId?: string; month?: string }) =>
    ['attendance', 'list', filters] as const,
  today: (userId?: string) => ['attendance', 'today', userId] as const,
  stats: (userId?: string, month?: string) => ['attendance', 'stats', userId, month] as const,
  corrections: () => ['attendance', 'corrections'] as const,
};

export interface AttendanceListParams {
  branchId?: string;
  date?: string; // YYYY-MM-DD
  userId?: string;
  month?: string; // YYYY-MM
  status?: AttendanceStatus;
}

/**
 * Hook to query attendance records with multi-criteria filtering.
 */
export function useAttendanceQuery(params?: AttendanceListParams) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleStorageChange = () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    };
    window.addEventListener('omark-attendance-changed', handleStorageChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('omark-attendance-changed', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: attendanceKeys.list(params),
    queryFn: async (): Promise<AttendanceRecord[]> => {
      let records = loadStoredAttendance();

      if (params?.userId) {
        records = records.filter((r) => r.userId === params.userId);
      }
      if (params?.branchId) {
        records = records.filter(
          (r) => r.branchId === params.branchId || r.branchId.includes(params.branchId || '')
        );
      }
      if (params?.date) {
        records = records.filter((r) => r.date === params.date);
      }
      if (params?.month) {
        records = records.filter((r) => r.date.startsWith(params.month || ''));
      }
      if (params?.status) {
        records = records.filter((r) => r.status === params.status);
      }

      // Sort newest first
      return records.sort((a, b) => (b.clockInTime || b.createdAt).localeCompare(a.clockInTime || a.createdAt));
    },
  });
}

/**
 * Hook to query today's attendance record for the current user.
 */
export function useTodayAttendanceQuery(userId: string | undefined) {
  const queryClient = useQueryClient();
  const today = dayjs().format('YYYY-MM-DD');

  useEffect(() => {
    const handleStorageChange = () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.today(userId) });
    };
    window.addEventListener('omark-attendance-changed', handleStorageChange);
    return () => {
      window.removeEventListener('omark-attendance-changed', handleStorageChange);
    };
  }, [queryClient, userId]);

  return useQuery({
    queryKey: attendanceKeys.today(userId),
    queryFn: async (): Promise<AttendanceRecord | null> => {
      if (!userId) return null;
      const records = loadStoredAttendance();
      const todayRecord = records.find((r) => r.userId === userId && r.date === today);
      return todayRecord || null;
    },
    enabled: Boolean(userId),
  });
}

/**
 * Hook to calculate a staff member's monthly attendance and punctuality metrics.
 */
export function useStaffAttendanceStatsQuery(userId: string | undefined, month?: string) {
  const activeMonth = month || dayjs().format('YYYY-MM');

  return useQuery({
    queryKey: attendanceKeys.stats(userId, activeMonth),
    queryFn: async () => {
      if (!userId) return null;
      return calculateStaffAttendanceSummary(userId, activeMonth);
    },
    enabled: Boolean(userId),
  });
}

/**
 * Hook to query all pending correction requests for supervisor/manager review.
 */
export function useAttendanceCorrectionsQuery(branchId?: string) {
  return useQuery({
    queryKey: attendanceKeys.corrections(),
    queryFn: async (): Promise<AttendanceRecord[]> => {
      const records = loadStoredAttendance();
      return records.filter(
        (r) =>
          r.status === 'correction_requested' ||
          r.correctionRequest?.status === 'pending'
      );
    },
  });
}

/**
 * Mutation for Clock In.
 */
export function useClockInMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ClockInPayload): Promise<AttendanceRecord> => {
      return clockInStaff(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

/**
 * Mutation for Clock Out.
 */
export function useClockOutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ClockOutPayload): Promise<AttendanceRecord> => {
      return clockOutStaff(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

/**
 * Mutation to submit a correction request.
 */
export function useRequestCorrectionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      attendanceId?: string;
      userId: string;
      staffName: string;
      branchId: string;
      date: string;
      proposedClockIn: string;
      proposedClockOut: string;
      reason: string;
    }): Promise<AttendanceRecord> => {
      return requestAttendanceCorrection(
        params.attendanceId,
        params.userId,
        params.staffName,
        params.branchId,
        params.date,
        params.proposedClockIn,
        params.proposedClockOut,
        params.reason
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

/**
 * Mutation to approve a correction request.
 */
export function useApproveCorrectionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      recordId: string;
      reviewerName: string;
      reviewNote?: string;
    }): Promise<AttendanceRecord> => {
      return approveAttendanceCorrection(params.recordId, params.reviewerName, params.reviewNote);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

/**
 * Mutation to reject a correction request.
 */
export function useRejectCorrectionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      recordId: string;
      reviewerName: string;
      reason: string;
    }): Promise<AttendanceRecord> => {
      return rejectAttendanceCorrection(params.recordId, params.reviewerName, params.reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

/**
 * Mutation to update an attendance record status directly (for HR/Supervisor).
 */
export function useUpdateAttendanceStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      recordId: string;
      newStatus: AttendanceStatus;
      reason?: string;
      updatedBy?: string;
    }): Promise<AttendanceRecord> => {
      return updateStaffAttendanceStatus(params.recordId, params.newStatus, params.reason, params.updatedBy);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

/**
 * Mutation to manually log an attendance record (e.g. On Leave, Approved Exception, Absent).
 */
export function useCreateManualAttendanceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
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
    }): Promise<AttendanceRecord> => {
      return createManualAttendanceRecord(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

/**
 * Hook to query security and fraud audit logs.
 */
export function useAttendanceAuditLogsQuery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleStorageChange = () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'auditLogs'] });
    };
    window.addEventListener('omark-attendance-changed', handleStorageChange);
    return () => {
      window.removeEventListener('omark-attendance-changed', handleStorageChange);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['attendance', 'auditLogs'],
    queryFn: async (): Promise<AttendanceAuditLog[]> => {
      return getAttendanceAuditLogs();
    },
  });
}

/**
 * Hook to query hardware device bindings for sensitive staff roles.
 */
export function useDeviceBindingsQuery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleStorageChange = () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'deviceBindings'] });
    };
    window.addEventListener('omark-attendance-changed', handleStorageChange);
    return () => {
      window.removeEventListener('omark-attendance-changed', handleStorageChange);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['attendance', 'deviceBindings'],
    queryFn: async (): Promise<DeviceBinding[]> => {
      return getDeviceBindings();
    },
  });
}

/**
 * Mutation to bind a hardware device to a staff member.
 */
export function useBindDeviceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      userId: string;
      staffName: string;
      role: string;
      deviceId: string;
      deviceName: string;
      boundBy?: string;
    }): Promise<DeviceBinding> => {
      return bindStaffDevice(
        params.userId,
        params.staffName,
        params.role,
        params.deviceId,
        params.deviceName,
        params.boundBy
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'deviceBindings'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'auditLogs'] });
    },
  });
}

/**
 * Mutation to reset device binding for a staff member.
 */
export function useResetDeviceBindingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { userId: string; resetBy?: string }): Promise<void> => {
      return resetStaffDeviceBinding(params.userId, params.resetBy);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'deviceBindings'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'auditLogs'] });
    },
  });
}

/**
 * Hook to query daily attendance closure state for a branch.
 */
export function useDailyAttendanceClosureQuery(branchId?: string, date?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleStorageChange = () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'closure'] });
    };
    window.addEventListener('omark-attendance-changed', handleStorageChange);
    return () => {
      window.removeEventListener('omark-attendance-changed', handleStorageChange);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['attendance', 'closure', branchId, date],
    queryFn: async (): Promise<DailyAttendanceClosure | null> => {
      if (!branchId || !date) return null;
      return getDailyAttendanceClosure(branchId, date);
    },
    enabled: Boolean(branchId && date),
  });
}

/**
 * Mutation to close daily attendance register for a branch and date.
 */
export function useCloseDailyAttendanceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      branchId: string;
      branchName: string;
      date: string;
      closedBy: string;
      notes?: string;
    }): Promise<DailyAttendanceClosure> => {
      return closeDailyAttendance(
        params.branchId,
        params.branchName,
        params.date,
        params.closedBy,
        params.notes
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'closure'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'auditLogs'] });
    },
  });
}

/**
 * Mutation to reopen daily attendance register.
 */
export function useReopenDailyAttendanceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      branchId: string;
      branchName: string;
      date: string;
      reopenedBy: string;
    }): Promise<DailyAttendanceClosure> => {
      return reopenDailyAttendance(
        params.branchId,
        params.branchName,
        params.date,
        params.reopenedBy
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'closure'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'auditLogs'] });
    },
  });
}

/**
 * Hook to query staff leave requests.
 */
export function useStaffLeaveRequestsQuery(branchId?: string, userId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleStorageChange = () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'leaves'] });
    };
    window.addEventListener('omark-attendance-changed', handleStorageChange);
    return () => {
      window.removeEventListener('omark-attendance-changed', handleStorageChange);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['attendance', 'leaves', branchId, userId],
    queryFn: async (): Promise<StaffLeaveRequest[]> => {
      return getStaffLeaveRequests(branchId, userId);
    },
  });
}

/**
 * Mutation to submit a new leave application.
 */
export function useSubmitLeaveRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      userId: string;
      staffName: string;
      staffRole?: string;
      branchId: string;
      branchName?: string;
      leaveType: LeaveType;
      startDate: string;
      endDate: string;
      reason: string;
    }): Promise<StaffLeaveRequest> => {
      return submitStaffLeaveRequest(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'leaves'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'auditLogs'] });
    },
  });
}

/**
 * Mutation to approve a staff leave request.
 */
export function useApproveLeaveRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      leaveId: string;
      approvedBy: string;
      note?: string;
    }): Promise<StaffLeaveRequest> => {
      return approveStaffLeaveRequest(params.leaveId, params.approvedBy, params.note);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'leaves'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'auditLogs'] });
    },
  });
}

/**
 * Mutation to reject a staff leave request.
 */
export function useRejectLeaveRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      leaveId: string;
      rejectedBy: string;
      reason: string;
    }): Promise<StaffLeaveRequest> => {
      return rejectStaffLeaveRequest(params.leaveId, params.rejectedBy, params.reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'leaves'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'auditLogs'] });
    },
  });
}

/**
 * Hook to fetch comprehensive executive attendance dashboard analytics.
 */
export function useAttendanceDashboardAnalyticsQuery(filters?: {
  branchId?: string;
  month?: string;
  date?: string;
  userId?: string;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleStorageChange = () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'dashboard-analytics'] });
    };
    window.addEventListener('omark-attendance-changed', handleStorageChange);
    return () => {
      window.removeEventListener('omark-attendance-changed', handleStorageChange);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['attendance', 'dashboard-analytics', filters?.branchId, filters?.month, filters?.date, filters?.userId],
    queryFn: async (): Promise<AttendanceDashboardAnalytics> => {
      return getAttendanceDashboardAnalytics(filters);
    },
  });
}

/**
 * Hook to query attendance automation configuration.
 */
export function useAttendanceAutomationConfigQuery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleStorageChange = () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'automation-config'] });
    };
    window.addEventListener('omark-attendance-changed', handleStorageChange);
    return () => {
      window.removeEventListener('omark-attendance-changed', handleStorageChange);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['attendance', 'automation-config'],
    queryFn: async (): Promise<AttendanceAutomationConfig> => {
      return getAttendanceAutomationConfig();
    },
  });
}

/**
 * Mutation to update attendance automation configuration.
 */
export function useUpdateAttendanceAutomationConfigMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<AttendanceAutomationConfig>): Promise<AttendanceAutomationConfig> => {
      return updateAttendanceAutomationConfig(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'automation-config'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'automation-logs'] });
    },
  });
}

/**
 * Hook to query automation execution logs.
 */
export function useAutomationExecutionLogsQuery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleStorageChange = () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'automation-logs'] });
    };
    window.addEventListener('omark-attendance-changed', handleStorageChange);
    return () => {
      window.removeEventListener('omark-attendance-changed', handleStorageChange);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['attendance', 'automation-logs'],
    queryFn: async (): Promise<AutomationExecutionLog[]> => {
      return getAutomationExecutionLogs();
    },
  });
}

/**
 * Mutation to manually trigger an attendance automation job.
 */
export function useTriggerAutomationJobMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      jobType: 'geofencing' | 'reminders' | 'shift_rules' | 'analytics' | 'all';
      triggeredBy?: string;
    }): Promise<AutomationExecutionLog> => {
      return triggerAttendanceAutomationJob(params.jobType, params.triggeredBy);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'automation-logs'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'dashboard-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'closure'] });
    },
  });
}


