// src/pages/attendance/AttendancePage.tsx
//
// Enterprise Staff Attendance & Time Tracking Hub
// Multi-Tab UI: Personal Attendance Calendar, Branch Register, Correction Queue, and Reception QR Station.

import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Tabs,
  Table,
  Tag,
  Button,
  DatePicker,
  Select,
  Space,
  Statistic,
  Progress,
  Badge,
  Tooltip,
  Modal,
  Form,
  Input,
  Popconfirm,
  message,
  Divider,
  Alert,
  Avatar
} from 'antd';
import {
  ClockCircleOutlined,
  CalendarOutlined,
  TeamOutlined,
  QrcodeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  EnvironmentOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  FilterOutlined,
  ReloadOutlined,
  FileProtectOutlined,
  CompassOutlined,
  UserOutlined,
  ShopOutlined,
  FieldTimeOutlined,
  SafetyCertificateOutlined,
  LockOutlined,
  UnlockOutlined,
  DashboardOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useUsersQuery, getUserFullName } from '@/api/users';
import { useBranchesQuery } from '@/api/branches';
import {
  useAttendanceQuery,
  useTodayAttendanceQuery,
  useStaffAttendanceStatsQuery,
  useClockInMutation,
  useClockOutMutation,
  useAttendanceCorrectionsQuery,
  useApproveCorrectionMutation,
  useRejectCorrectionMutation,
  useUpdateAttendanceStatusMutation,
  useCreateManualAttendanceMutation,
  useAttendanceAuditLogsQuery,
  useDeviceBindingsQuery,
  useBindDeviceMutation,
  useResetDeviceBindingMutation,
  useDailyAttendanceClosureQuery,
  useCloseDailyAttendanceMutation,
  useReopenDailyAttendanceMutation,
  useStaffLeaveRequestsQuery,
  useApproveLeaveRequestMutation,
  useRejectLeaveRequestMutation,
  useRequestCorrectionMutation,
  getClientDeviceId,
  type AttendanceAuditLog,
  type DeviceBinding,
  type DailyAttendanceClosure,
  type StaffLeaveRequest,
  type AttendanceListParams
} from '@/api/attendance';
import {
  type AttendanceRecord,
  type AttendanceStatus,
  ATTENDANCE_STATUS_META,
  BRANCH_GEOFENCES
} from '@/mock/staffAttendance';
import { StaffClockWidget } from '@/components/attendance/StaffClockWidget';
import { ClockInOutModal } from '@/components/attendance/ClockInOutModal';
import { ReceptionQRModal } from '@/components/attendance/ReceptionQRModal';
import { AttendanceCorrectionModal } from '@/components/attendance/AttendanceCorrectionModal';
import { StaffLeaveRequestModal } from '@/components/attendance/StaffLeaveRequestModal';
import { AttendanceDashboardView } from '@/components/attendance/AttendanceDashboardView';
import { AttendanceAutomationsView } from '@/components/attendance/AttendanceAutomationsView';
import { getStaffAssignment } from '@/mock/staffAssignments';
import { getBranchCanonicalKey } from '@/utils/branchIsolation';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export const AttendancePage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole(['admin']);
  const isManager = hasRole(['admin', 'branch_manager']);

  // Filters & State
  const [activeTab, setActiveTab] = useState(isManager ? 'attendance-dashboard' : 'attendance-dashboard');
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [selectedBranch, setSelectedBranch] = useState<string | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);

  // Modals
  const [clockModalOpen, setClockModalOpen] = useState(false);
  const [receptionModalOpen, setReceptionModalOpen] = useState(false);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [selectedRecordForCorrection, setSelectedRecordForCorrection] = useState<AttendanceRecord | null>(null);

  // Manager Status Edit State
  const [editStatusModalOpen, setEditStatusModalOpen] = useState(false);
  const [selectedRecordForStatusEdit, setSelectedRecordForStatusEdit] = useState<AttendanceRecord | null>(null);
  const [newStatusValue, setNewStatusValue] = useState<AttendanceStatus>('present');
  const [statusEditReason, setStatusEditReason] = useState('');

  // Manual Attendance Record State
  const [manualRecordModalOpen, setManualRecordModalOpen] = useState(false);
  const [manualUserId, setManualUserId] = useState<string>('');
  const [manualStatus, setManualStatus] = useState<AttendanceStatus>('on_leave');
  const [manualDate, setManualDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [manualReason, setManualReason] = useState('');

  // Queries
  const { data: branches = [] } = useBranchesQuery();
  const { data: usersResponse } = useUsersQuery();
  const staffUsers = usersResponse?.items ?? [];

  const { data: todayRecord, refetch: refetchToday } = useTodayAttendanceQuery(user?.id);
  const { data: staffStats, isLoading: statsLoading } = useStaffAttendanceStatsQuery(user?.id, selectedMonth);

  const {
    data: attendanceList = [],
    isLoading: listLoading,
    refetch: refetchList
  } = useAttendanceQuery({
    branchId: selectedBranch,
    status: selectedStatus,
    date: selectedDate,
    month: selectedDate ? undefined : selectedMonth,
  });

  const { data: correctionsList = [], refetch: refetchCorrections } = useAttendanceCorrectionsQuery(selectedBranch);
  const approveMutation = useApproveCorrectionMutation();
  const rejectMutation = useRejectCorrectionMutation();
  const updateStatusMutation = useUpdateAttendanceStatusMutation();
  const createManualMutation = useCreateManualAttendanceMutation();

  // Audit Logs & Device Binding Queries & State
  const { data: auditLogs = [], refetch: refetchAuditLogs } = useAttendanceAuditLogsQuery();
  const { data: deviceBindings = [], refetch: refetchDeviceBindings } = useDeviceBindingsQuery();
  const bindDeviceMutation = useBindDeviceMutation();
  const resetDeviceMutation = useResetDeviceBindingMutation();

  const [selectedAuditFilter, setSelectedAuditFilter] = useState<string>('ALL');
  const [bindDeviceModalOpen, setBindDeviceModalOpen] = useState(false);
  const [bindUserId, setBindUserId] = useState('');
  const [bindDeviceIdInput, setBindDeviceIdInput] = useState('');
  const [bindDeviceNameInput, setBindDeviceNameInput] = useState('');

  const filteredAuditLogs = auditLogs.filter((log) => {
    if (selectedAuditFilter === 'ALL') return true;
    if (selectedAuditFilter === 'BLOCKED') return log.status === 'BLOCKED';
    if (selectedAuditFilter === 'OVERRIDDEN') return log.status === 'OVERRIDDEN';
    if (selectedAuditFilter === 'GPS') return log.eventType === 'GPS_BREACH_BLOCKED';
    if (selectedAuditFilter === 'DUPLICATE') return log.eventType === 'DUPLICATE_PUNCH_BLOCKED';
    if (selectedAuditFilter === 'DEVICE') return log.eventType === 'UNBOUND_DEVICE_BLOCKED' || log.eventType === 'DEVICE_BOUND';
    return true;
  });

  const handleBindDeviceSubmit = async () => {
    if (!bindUserId || !bindDeviceIdInput) {
      message.warning('Please select staff and enter a device ID');
      return;
    }
    const staff = staffUsers.find((u) => u.id === bindUserId);
    try {
      await bindDeviceMutation.mutateAsync({
        userId: bindUserId,
        staffName: staff ? getUserFullName(staff) : 'Staff Member',
        role: staff?.role || 'staff',
        deviceId: bindDeviceIdInput.trim(),
        deviceName: bindDeviceNameInput.trim() || 'Assigned Corporate Terminal',
        boundBy: user?.name || 'Administrator',
      });
      message.success(`Device ${bindDeviceIdInput} bound to ${staff ? getUserFullName(staff) : 'Staff Member'}`);
      setBindDeviceModalOpen(false);
      refetchDeviceBindings();
      refetchAuditLogs();
    } catch (err: any) {
      message.error(err?.message || 'Failed to bind device');
    }
  };

  const handleResetDevice = async (targetUserId: string, staffName: string) => {
    try {
      await resetDeviceMutation.mutateAsync({
        userId: targetUserId,
        resetBy: user?.name || 'Administrator',
      });
      message.success(`Device binding reset for ${staffName}. Staff may now bind a new authorized terminal.`);
      refetchDeviceBindings();
      refetchAuditLogs();
    } catch (err: any) {
      message.error(err?.message || 'Failed to reset device');
    }
  };

  // Attendance Closure Query & Mutations (Rule 1: Check-out must happen before attendance is closed)
  const effectiveBranchId = selectedBranch || 'branch-accra-hq';
  const effectiveDate = selectedDate || dayjs().format('YYYY-MM-DD');
  const { data: dailyClosure, refetch: refetchClosure } = useDailyAttendanceClosureQuery(effectiveBranchId, effectiveDate);
  const closeAttendanceMutation = useCloseDailyAttendanceMutation();
  const reopenAttendanceMutation = useReopenDailyAttendanceMutation();

  // Leave Requests Query & Mutations (Rule 3: Leave must be approved before day is marked as leave)
  const { data: leaveRequests = [], refetch: refetchLeaves } = useStaffLeaveRequestsQuery(selectedBranch);
  const approveLeaveMutation = useApproveLeaveRequestMutation();
  const rejectLeaveMutation = useRejectLeaveRequestMutation();
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveRejectModalOpen, setLeaveRejectModalOpen] = useState(false);
  const [selectedLeaveForAction, setSelectedLeaveForAction] = useState<StaffLeaveRequest | null>(null);
  const [leaveRejectionReason, setLeaveRejectionReason] = useState('');

  const pendingLeaves = leaveRequests.filter((l) => l.status === 'pending');

  const handleCloseAttendanceRegister = async () => {
    try {
      const branchMeta = BRANCH_GEOFENCES[effectiveBranchId] || BRANCH_GEOFENCES['branch-accra-hq'];
      await closeAttendanceMutation.mutateAsync({
        branchId: effectiveBranchId,
        branchName: branchMeta.branchName,
        date: effectiveDate,
        closedBy: user?.name || 'Branch Manager',
      });
      message.success(`Attendance register for ${branchMeta.branchName} on ${effectiveDate} is now closed. Check-outs are locked.`);
      refetchClosure();
      refetchList();
    } catch (err: any) {
      message.error(err?.message || 'Failed to close attendance');
    }
  };

  const handleReopenAttendanceRegister = async () => {
    try {
      const branchMeta = BRANCH_GEOFENCES[effectiveBranchId] || BRANCH_GEOFENCES['branch-accra-hq'];
      await reopenAttendanceMutation.mutateAsync({
        branchId: effectiveBranchId,
        branchName: branchMeta.branchName,
        date: effectiveDate,
        reopenedBy: user?.name || 'Branch Manager',
      });
      message.success(`Attendance register for ${branchMeta.branchName} on ${effectiveDate} reopened.`);
      refetchClosure();
      refetchList();
    } catch (err: any) {
      message.error(err?.message || 'Failed to reopen attendance');
    }
  };

  const handleApproveLeave = async (leave: StaffLeaveRequest) => {
    try {
      await approveLeaveMutation.mutateAsync({
        leaveId: leave.id,
        approvedBy: user?.name || 'Branch Manager',
        note: `Approved by ${user?.name || 'Branch Manager'} on ${dayjs().format('DD MMM YYYY')}`,
      });
      message.success(`Leave approved for ${leave.staffName}! Attendance records marked as 'On Leave' from ${leave.startDate} to ${leave.endDate}.`);
      refetchLeaves();
      refetchList();
    } catch (err: any) {
      message.error(err?.message || 'Failed to approve leave');
    }
  };

  const handleRejectLeave = async () => {
    if (!selectedLeaveForAction) return;
    try {
      await rejectLeaveMutation.mutateAsync({
        leaveId: selectedLeaveForAction.id,
        rejectedBy: user?.name || 'Branch Manager',
        reason: leaveRejectionReason.trim() || 'Leave request declined by management.',
      });
      message.info(`Leave application for ${selectedLeaveForAction.staffName} rejected.`);
      setLeaveRejectModalOpen(false);
      setSelectedLeaveForAction(null);
      setLeaveRejectionReason('');
      refetchLeaves();
    } catch (err: any) {
      message.error(err?.message || 'Failed to reject leave');
    }
  };

  // Status counts for interactive 8-status KPI ribbon
  const statusCounts: Record<AttendanceStatus, number> = {
    present: attendanceList.filter((r) => r.status === 'present').length,
    late: attendanceList.filter((r) => r.status === 'late').length,
    early_leave: attendanceList.filter((r) => r.status === 'early_leave').length,
    half_day: attendanceList.filter((r) => r.status === 'half_day').length,
    absent: attendanceList.filter((r) => r.status === 'absent').length,
    on_leave: attendanceList.filter((r) => r.status === 'on_leave').length,
    correction_requested: attendanceList.filter((r) => r.status === 'correction_requested').length,
    approved_exception: attendanceList.filter((r) => r.status === 'approved_exception').length,
  };

  // Filter personal records
  const myAttendanceRecords = attendanceList.filter((r) => r.userId === user?.id);

  // Handle Approve Correction
  const handleApproveCorrection = async (record: AttendanceRecord) => {
    try {
      await approveMutation.mutateAsync({
        recordId: record.id,
        reviewerName: user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Supervisor',
      });
      message.success(`Correction request for ${record.staffName} approved.`);
      refetchCorrections();
      refetchList();
    } catch (err: any) {
      message.error(err?.message || 'Failed to approve correction');
    }
  };

  // Handle Reject Correction
  const handleRejectCorrection = async (record: AttendanceRecord) => {
    try {
      await rejectMutation.mutateAsync({
        recordId: record.id,
        reviewerName: user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Supervisor',
        reason: 'Correction rejected by supervisor',
      });
      message.success(`Correction request for ${record.staffName} rejected.`);
      refetchCorrections();
      refetchList();
    } catch (err: any) {
      message.error(err?.message || 'Failed to reject correction');
    }
  };

  // Handle Save Status Edit
  const handleSaveStatusEdit = async () => {
    if (!selectedRecordForStatusEdit) return;
    try {
      await updateStatusMutation.mutateAsync({
        recordId: selectedRecordForStatusEdit.id,
        newStatus: newStatusValue,
        reason: statusEditReason,
        updatedBy: user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Supervisor',
      });
      message.success(`Status for ${selectedRecordForStatusEdit.staffName} updated to ${ATTENDANCE_STATUS_META[newStatusValue]?.label || newStatusValue}`);
      setEditStatusModalOpen(false);
      refetchList();
    } catch (err: any) {
      message.error(err?.message || 'Failed to update status');
    }
  };

  // Handle Save Manual Record
  const handleSaveManualRecord = async () => {
    if (!manualUserId) {
      message.warning('Please select a staff member');
      return;
    }
    const staff = staffUsers.find((u) => u.id === manualUserId);
    const branch = branches.find((b: any) => b.id === (selectedBranch || (staff as any)?.branchId || 'branch-accra-hq'));
    try {
      await createManualMutation.mutateAsync({
        userId: manualUserId,
        staffName: staff ? getUserFullName(staff) : 'Staff Member',
        staffRole: staff?.role || 'customer_service',
        branchId: branch?.id || 'branch-accra-hq',
        branchName: branch?.name || 'Accra Head Office',
        date: manualDate,
        status: manualStatus,
        reason: manualReason,
        recordedBy: user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Supervisor / HR',
      });
      message.success(`Attendance record created for ${staff ? getUserFullName(staff) : 'Staff Member'} as ${ATTENDANCE_STATUS_META[manualStatus]?.label || manualStatus}`);
      setManualRecordModalOpen(false);
      setManualReason('');
      refetchList();
    } catch (err: any) {
      message.error(err?.message || 'Failed to create record');
    }
  };

  // ── Columns for Personal Attendance Table ─────────────────────────────────
  const myAttendanceColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 130,
      render: (date: string) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ color: '#1e293b' }}>{dayjs(date).format('DD MMM YYYY')}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(date).format('dddd')}</Text>
        </Space>
      ),
    },
    {
      title: 'Clock In',
      dataIndex: 'clockInTime',
      key: 'clockInTime',
      width: 140,
      render: (val: string, r: AttendanceRecord) => (
        val ? (
          <div>
            <Text strong style={{ color: r.isLate ? '#d46b08' : '#237804' }}>
              {dayjs(val).format('hh:mm A')}
            </Text>
            {r.isLate && (
              <Tag color="warning" style={{ fontSize: 10, marginLeft: 4, padding: '0 4px' }}>
                +{r.latenessMinutes}m late
              </Tag>
            )}
            {r.clockInGps && (
              <div style={{ fontSize: 11, color: '#64748b' }}>
                📍 {r.clockInGps.distanceFromBranchMeters}m from office
              </div>
            )}
          </div>
        ) : (
          <Text type="secondary">—</Text>
        )
      ),
    },
    {
      title: 'Clock Out',
      dataIndex: 'clockOutTime',
      key: 'clockOutTime',
      width: 140,
      render: (val: string, r: AttendanceRecord) => (
        val ? (
          <div>
            <Text strong style={{ color: r.isEarlyLeave ? '#fa8c16' : '#1e293b' }}>
              {dayjs(val).format('hh:mm A')}
            </Text>
            {r.isEarlyLeave && (
              <Tag color="orange" style={{ fontSize: 10, marginLeft: 4, padding: '0 4px' }}>
                Early ({r.earlyLeaveMinutes}m)
              </Tag>
            )}
          </div>
        ) : (
          <Text type="secondary">—</Text>
        )
      ),
    },
    {
      title: 'Duration',
      dataIndex: 'workDurationMinutes',
      key: 'workDurationMinutes',
      width: 110,
      render: (mins: number) => (
        mins ? (
          <Text strong style={{ color: '#2E5E8C' }}>
            {Math.floor(mins / 60)}h {mins % 60}m
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        )
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (st: AttendanceStatus) => {
        const meta = ATTENDANCE_STATUS_META[st] || ATTENDANCE_STATUS_META.present;
        return (
          <Tag color={meta.color} style={{ fontWeight: 600, padding: '3px 8px', borderRadius: 6 }}>
            {meta.icon} {meta.label}
          </Tag>
        );
      },
    },
    {
      title: 'Proof & Verification',
      key: 'proof',
      render: (_: any, r: AttendanceRecord) => (
        <Space size="small">
          {r.qrCodeScanned && (
            <Tooltip title={`Scanned Reception Token: ${r.qrCodeScanned}`}>
              <Tag icon={<QrcodeOutlined />} color="cyan">QR Verified</Tag>
            </Tooltip>
          )}
          {r.clockInGps?.isWithinRadius && (
            <Tooltip title={`GPS Geofence: ${r.clockInGps.distanceFromBranchMeters}m from ${r.branchName}`}>
              <Tag icon={<CompassOutlined />} color="green">GPS Verified</Tag>
            </Tooltip>
          )}
          {r.supervisorOverride && (
            <Tooltip title={`Override by: ${r.supervisorOverride.overriddenBy} (${r.supervisorOverride.reason})`}>
              <Tag icon={<FileProtectOutlined />} color="purple">Supervisor Override</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, r: AttendanceRecord) => (
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => {
            setSelectedRecordForCorrection(r);
            setCorrectionModalOpen(true);
          }}
        >
          Correct
        </Button>
      ),
    },
  ];

  // ── Columns for Branch Register Table (Admin/Manager) ─────────────────────
  const branchRegisterColumns = [
    {
      title: 'Staff Member',
      key: 'staffName',
      width: 230,
      fixed: 'left' as const,
      render: (_: any, r: AttendanceRecord) => (
        <Space align="center" size="middle">
          <Avatar style={{ backgroundColor: '#2E5E8C', color: '#ffffff', fontWeight: 700 }}>
            {(r.staffName || 'S').charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <Text strong style={{ color: '#1e293b', display: 'block', lineHeight: 1.2 }}>
              {r.staffName || 'Staff Member'}
            </Text>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
              <Tag color="geekblue" style={{ fontSize: 10, padding: '0 4px', margin: 0, textTransform: 'capitalize' }}>
                {(r.staffRole || 'Staff').replace(/_/g, ' ')}
              </Tag>
              <span style={{ marginLeft: 6 }}>ID: {r.userId}</span>
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Branch',
      dataIndex: 'branchName',
      key: 'branchName',
      width: 150,
      render: (val: string) => (
        <Tag color="blue" style={{ fontWeight: 600, padding: '2px 8px' }}>
          {val || 'Head Office'}
        </Tag>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 140,
      render: (val: string) => (
        <div>
          <Text strong style={{ color: '#1e293b' }}>{dayjs(val).format('DD MMM YYYY')}</Text>
          <div style={{ fontSize: 11, color: '#64748b' }}>{dayjs(val).format('dddd')}</div>
        </div>
      ),
    },
    {
      title: 'Clock In',
      dataIndex: 'clockInTime',
      key: 'clockInTime',
      width: 140,
      render: (val: string, r: AttendanceRecord) => (
        val ? (
          <div>
            <Text strong style={{ color: r.isLate ? '#d46b08' : '#237804', fontSize: 13 }}>
              {dayjs(val).format('hh:mm A')}
            </Text>
            {r.isLate && (
              <Tag color="warning" style={{ fontSize: 10, marginLeft: 4, padding: '0 4px' }}>
                +{r.latenessMinutes}m Late
              </Tag>
            )}
          </div>
        ) : (
          <Tag color="default">Not Clocked</Tag>
        )
      ),
    },
    {
      title: 'Clock Out',
      dataIndex: 'clockOutTime',
      key: 'clockOutTime',
      width: 140,
      render: (val: string, r: AttendanceRecord) => (
        val ? (
          <div>
            <Text strong style={{ color: '#1e293b', fontSize: 13 }}>
              {dayjs(val).format('hh:mm A')}
            </Text>
            {r.isEarlyLeave && (
              <Tag color="orange" style={{ fontSize: 10, marginLeft: 4, padding: '0 4px' }}>
                Early ({r.earlyLeaveMinutes}m)
              </Tag>
            )}
          </div>
        ) : (
          <Text type="secondary">—</Text>
        )
      ),
    },
    {
      title: 'Hours Worked',
      dataIndex: 'workDurationMinutes',
      key: 'workDurationMinutes',
      width: 130,
      render: (mins: number) => (
        mins ? (
          <Tag color="cyan" style={{ fontWeight: 700, fontSize: 12, padding: '3px 8px' }}>
            {Math.floor(mins / 60)}h {mins % 60}m
          </Tag>
        ) : (
          <Text type="secondary">—</Text>
        )
      ),
    },
    {
      title: 'Attendance Status',
      dataIndex: 'status',
      key: 'status',
      width: 180,
      render: (st: AttendanceStatus) => {
        const meta = ATTENDANCE_STATUS_META[st] || ATTENDANCE_STATUS_META.present;
        return (
          <Tag color={meta.color} style={{ fontWeight: 600, padding: '4px 10px', borderRadius: 6 }}>
            {meta.icon} {meta.label}
          </Tag>
        );
      },
    },
    {
      title: 'Location & Geofence',
      key: 'locationProof',
      width: 210,
      render: (_: any, r: AttendanceRecord) => (
        <div>
          {r.clockInGps ? (
            <Tag color={r.clockInGps.isWithinRadius ? 'green' : 'red'} style={{ fontSize: 11, padding: '2px 6px' }}>
              📍 {r.clockInGps.distanceFromBranchMeters}m from office
            </Tag>
          ) : (
            <Tag color="default" style={{ fontSize: 11 }}>No GPS Tag</Tag>
          )}
          {r.qrCodeScanned && (
            <Tag color="cyan" style={{ fontSize: 10, marginTop: 4 }}>
              QR Verified
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Terminal / Device',
      dataIndex: 'deviceId',
      key: 'deviceId',
      width: 170,
      render: (devId: string) => (
        devId ? (
          <Tag color="purple" style={{ fontFamily: 'monospace', fontSize: 11 }}>
            💻 {devId}
          </Tag>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
        )
      ),
    },
    {
      title: 'Notes & Exceptions',
      key: 'notes',
      width: 240,
      render: (_: any, r: AttendanceRecord) => (
        <div>
          {r.supervisorOverride ? (
            <Tooltip title={`Override Reason: ${r.supervisorOverride.reason} · Approved by ${r.supervisorOverride.overriddenBy}`}>
              <div style={{ fontSize: 11, color: '#722ed1', fontWeight: 600 }}>
                🛡️ {r.supervisorOverride.reason}
              </div>
              <div style={{ fontSize: 10, color: '#64748b' }}>
                By: {r.supervisorOverride.overriddenBy}
              </div>
            </Tooltip>
          ) : r.notes ? (
            <Text type="secondary" style={{ fontSize: 11 }}>{r.notes}</Text>
          ) : (
            <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
          )}
        </div>
      ),
    },
    ...(isManager
      ? [
          {
            title: 'Actions',
            key: 'managerActions',
            width: 140,
            fixed: 'right' as const,
            render: (_: any, r: AttendanceRecord) => (
              <Button
                size="small"
                type="primary"
                ghost
                icon={<EditOutlined />}
                onClick={() => {
                  setSelectedRecordForStatusEdit(r);
                  setNewStatusValue(r.status);
                  setStatusEditReason(r.supervisorOverride?.reason || '');
                  setEditStatusModalOpen(true);
                }}
              >
                Change Status
              </Button>
            ),
          },
        ]
      : []),
  ];

  // ── Columns for Correction Requests Table ─────────────────────────────────
  const correctionColumns = [
    {
      title: 'Staff Member',
      key: 'staff',
      width: 180,
      render: (_: any, r: AttendanceRecord) => (
        <div>
          <Text strong style={{ color: '#1e293b' }}>{r.staffName}</Text>
          <div style={{ fontSize: 11, color: '#64748b' }}>{r.branchName}</div>
        </div>
      ),
    },
    {
      title: 'Attendance Date',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (val: string) => dayjs(val).format('DD MMM YYYY'),
    },
    {
      title: 'Proposed Times',
      key: 'times',
      width: 180,
      render: (_: any, r: AttendanceRecord) => (
        <div>
          <div>In: <strong>{dayjs(r.correctionRequest?.proposedClockIn).format('hh:mm A')}</strong></div>
          <div>Out: <strong>{dayjs(r.correctionRequest?.proposedClockOut).format('hh:mm A')}</strong></div>
        </div>
      ),
    },
    {
      title: 'Reason / Justification',
      key: 'reason',
      render: (_: any, r: AttendanceRecord) => (
        <div>
          <Paragraph ellipsis={{ rows: 2, expandable: true }} style={{ margin: 0, fontSize: 12 }}>
            "{r.correctionRequest?.reason}"
          </Paragraph>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Requested {dayjs(r.correctionRequest?.requestedAt).format('DD MMM, hh:mm A')}
          </Text>
        </div>
      ),
    },
    {
      title: 'Action',
      key: 'actions',
      width: 170,
      render: (_: any, r: AttendanceRecord) => {
        const isSelf = r.userId === user?.id;
        return (
          <Space size="small">
            <Popconfirm
              title="Approve Attendance Correction"
              description={`Approve adjusted punch times for ${r.staffName}?`}
              onConfirm={() => handleApproveCorrection(r)}
              okText="Approve"
              disabled={isSelf}
            >
              <Tooltip title={isSelf ? 'Rule: Staff cannot self-approve their own correction requests' : undefined}>
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckOutlined />}
                  style={{
                    background: isSelf ? undefined : '#52c41a',
                    borderColor: isSelf ? undefined : '#52c41a',
                  }}
                  disabled={isSelf}
                  loading={approveMutation.isPending}
                >
                  Approve
                </Button>
              </Tooltip>
            </Popconfirm>
            <Popconfirm
              title="Reject Correction Request"
              description={`Reject adjustment request for ${r.staffName}?`}
              onConfirm={() => handleRejectCorrection(r)}
              okText="Reject"
              okType="danger"
              disabled={isSelf}
            >
              <Button
                size="small"
                danger
                icon={<CloseOutlined />}
                disabled={isSelf}
                loading={rejectMutation.isPending}
              >
                Reject
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Hero Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: 16,
          padding: '24px 32px',
          marginBottom: 24,
          color: '#fff',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} md={14}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26,
                  color: '#38bdf8',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                <ClockCircleOutlined />
              </div>
              <div>
                <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 800, letterSpacing: -0.5 }}>
                  Staff Attendance & Time Tracking
                </Title>
                <Text style={{ color: '#94a3b8', fontSize: 14 }}>
                  GPS Geofenced Clock-In, Front-Desk QR Verification, Punctuality Tracking & Shift Registers
                </Text>
              </div>
            </div>
          </Col>

          <Col xs={24} md={12} style={{ textAlign: 'right' }}>
            <Space size="middle" wrap>
              {/* Live Punch Pill */}
              <StaffClockWidget />

              {/* Automations Engine Launcher */}
              {isManager && (
                <Button
                  type="default"
                  icon={<ThunderboltOutlined style={{ color: '#38bdf8' }} />}
                  style={{
                    borderRadius: 20,
                    background: 'rgba(255,255,255,0.15)',
                    color: '#fff',
                    borderColor: 'rgba(255,255,255,0.25)',
                    fontWeight: 600,
                  }}
                  onClick={() => setActiveTab('automations-engine')}
                >
                  ⚡ Automations & Rules
                </Button>
              )}

              {/* Reception Kiosk Launcher */}
              <Button
                type="default"
                icon={<QrcodeOutlined />}
                style={{
                  borderRadius: 20,
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.25)',
                  fontWeight: 600,
                }}
                onClick={() => setReceptionModalOpen(true)}
              >
                Reception QR Station
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Monthly Personal Scorecard Overview */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #52c41a' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#64748b' }}>Days Present</span>}
              value={staffStats?.daysPresent ?? 0}
              suffix={<span style={{ fontSize: 13, color: '#64748b' }}>/ {staffStats?.totalWorkingDays ?? 22} days</span>}
              valueStyle={{ color: '#52c41a', fontWeight: 800 }}
              prefix={<CheckCircleOutlined />}
            />
            <div style={{ marginTop: 8 }}>
              <Progress percent={staffStats?.attendanceRate ?? 100} size="small" strokeColor="#52c41a" showInfo={false} />
              <Text type="secondary" style={{ fontSize: 11 }}>Attendance Rate: {staffStats?.attendanceRate ?? 100}%</Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #faad14' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#64748b' }}>Punctuality Score</span>}
              value={staffStats?.punctualityRate ?? 100}
              suffix="%"
              valueStyle={{ color: (staffStats?.punctualityRate ?? 100) >= 90 ? '#52c41a' : '#faad14', fontWeight: 800 }}
              prefix={<CompassOutlined />}
            />
            <div style={{ marginTop: 8 }}>
              <Progress percent={staffStats?.punctualityRate ?? 100} size="small" strokeColor="#faad14" showInfo={false} />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {staffStats?.daysLate ?? 0} late punches · Qualifies for Punctuality Bonus
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #2E5E8C' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#64748b' }}>Total Hours Worked</span>}
              value={staffStats?.totalWorkHours ?? 0}
              suffix="hrs"
              valueStyle={{ color: '#2E5E8C', fontWeight: 800 }}
              prefix={<FieldTimeOutlined />}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Standard 8.0 hrs/day shift basis
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #ff4d4f' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#64748b' }}>Absences & Exceptions</span>}
              value={(staffStats?.daysAbsent ?? 0) + (staffStats?.daysEarlyLeave ?? 0)}
              valueStyle={{ color: ((staffStats?.daysAbsent ?? 0) > 0) ? '#ff4d4f' : '#52c41a', fontWeight: 800 }}
              prefix={<WarningOutlined />}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {staffStats?.daysOnLeave ?? 0} days authorized leave
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── 8-ATTENDANCE STATUSES INTERACTIVE KPI RIBBON ──────────────────── */}
      <Card
        size="small"
        style={{
          borderRadius: 12,
          marginBottom: 20,
          background: '#ffffff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <Space align="center">
            <FilterOutlined style={{ color: '#2E5E8C' }} />
            <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
              Attendance Types Filter & Distribution ({attendanceList.length} total records)
            </Text>
          </Space>
          {selectedStatus && (
            <Button
              size="small"
              type="link"
              onClick={() => setSelectedStatus(undefined)}
              style={{ fontWeight: 600, padding: 0 }}
            >
              Clear Filter (Show All Statuses)
            </Button>
          )}
        </div>

        <Row gutter={[10, 10]}>
          {(Object.entries(ATTENDANCE_STATUS_META) as [AttendanceStatus, typeof ATTENDANCE_STATUS_META[AttendanceStatus]][]).map(([key, meta]) => {
            const isSelected = selectedStatus === key;
            const count = statusCounts[key] || 0;
            return (
              <Col xs={12} sm={6} md={3} key={key}>
                <div
                  onClick={() => setSelectedStatus(isSelected ? undefined : key)}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 8,
                    background: isSelected ? meta.bg : '#f8fafc',
                    border: isSelected ? `2px solid ${meta.color}` : '1px solid #e2e8f0',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    textAlign: 'center',
                    boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 2 }}>{meta.icon}</div>
                  <Text
                    strong
                    style={{
                      fontSize: 12,
                      display: 'block',
                      color: isSelected ? meta.color : '#334155',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={meta.label}
                  >
                    {meta.label}
                  </Text>
                  <div style={{ marginTop: 4 }}>
                    <Tag
                      color={isSelected ? meta.color : (count > 0 ? 'default' : '#f1f5f9')}
                      style={{
                        margin: 0,
                        fontWeight: 700,
                        fontSize: 11,
                        borderRadius: 10,
                        color: isSelected ? '#fff' : (count > 0 ? '#334155' : '#94a3b8'),
                      }}
                    >
                      {count} {count === 1 ? 'record' : 'records'}
                    </Tag>
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>
      </Card>

      {/* Main Tabs Container */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        size="large"
        items={[
          {
            key: 'attendance-dashboard',
            label: (
              <span>
                <DashboardOutlined style={{ color: '#2E5E8C' }} /> {isAdmin ? '📊 Attendance Executive Dashboard' : '📊 My Attendance Dashboard'}
              </span>
            ),
            children: (
              <AttendanceDashboardView
                initialBranchId={selectedBranch}
                userId={user?.id}
                isAdmin={isAdmin}
                onNavigateToRegister={(statusFilter) => {
                  if (statusFilter) setSelectedStatus(statusFilter as AttendanceStatus);
                  setActiveTab(isAdmin ? 'branch-register' : 'my-attendance');
                }}
              />
            ),
          },
          {
            key: 'my-attendance',
            label: (
              <span>
                <CalendarOutlined /> My Attendance History ({myAttendanceRecords.length})
              </span>
            ),
            children: (
              <Card
                title={
                  <Space align="center">
                    <span>Personal Attendance Log</span>
                    <DatePicker
                      picker="month"
                      value={dayjs(selectedMonth)}
                      onChange={(date) => setSelectedMonth(date ? date.format('YYYY-MM') : dayjs().format('YYYY-MM'))}
                    />
                  </Space>
                }
                extra={
                  <Space>
                    <Button
                      icon={<CalendarOutlined />}
                      style={{ borderColor: '#722ed1', color: '#722ed1' }}
                      onClick={() => setLeaveModalOpen(true)}
                    >
                      + Apply for Leave
                    </Button>
                    <Button
                      type="primary"
                      icon={<EditOutlined />}
                      onClick={() => {
                        setSelectedRecordForCorrection(null);
                        setCorrectionModalOpen(true);
                      }}
                    >
                      Request Correction
                    </Button>
                  </Space>
                }
              >
                <Table
                  columns={myAttendanceColumns}
                  dataSource={myAttendanceRecords}
                  rowKey="id"
                  loading={listLoading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1000 }}
                  size="middle"
                />
              </Card>
            ),
          },
          ...(isManager
            ? [
                {
                  key: 'branch-register',
                  label: (
                    <span>
                      <TeamOutlined /> Branch Attendance Register ({attendanceList.length})
                    </span>
                  ),
                  children: (
                    <Card
                      title={
                        <Space align="center">
                          <TeamOutlined style={{ color: '#2E5E8C', fontSize: 18 }} />
                          <span style={{ fontWeight: 700, color: '#1e293b' }}>Company & Branch Attendance Register</span>
                          <Tag color="blue" style={{ borderRadius: 10, fontWeight: 700 }}>
                            {attendanceList.length} records
                          </Tag>
                        </Space>
                      }
                      extra={
                        <Space>
                          <Button
                            type="primary"
                            icon={<EditOutlined />}
                            onClick={() => {
                              setManualUserId(staffUsers[0]?.id || '');
                              setManualStatus('on_leave');
                              setManualDate(dayjs().format('YYYY-MM-DD'));
                              setManualReason('');
                              setManualRecordModalOpen(true);
                            }}
                          >
                            + Record Status
                          </Button>
                          <Button icon={<ReloadOutlined />} onClick={() => refetchList()}>
                            Refresh
                          </Button>
                        </Space>
                      }
                    >
                      {/* ── DEDICATED GOVERNANCE & ATTENDANCE CLOSURE BANNER ────── */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 14,
                          padding: '16px 20px',
                          borderRadius: 10,
                          marginBottom: 20,
                          background: dailyClosure?.isClosed
                            ? 'linear-gradient(135deg, #fff2f0 0%, #fff1f0 100%)'
                            : 'linear-gradient(135deg, #f6ffed 0%, #f0fdf4 100%)',
                          border: dailyClosure?.isClosed ? '1px solid #ffccc7' : '1px solid #b7eb8f',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 10,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 20,
                              background: dailyClosure?.isClosed ? '#ff4d4f' : '#52c41a',
                              color: '#ffffff',
                              boxShadow: dailyClosure?.isClosed
                                ? '0 4px 10px rgba(255, 77, 79, 0.3)'
                                : '0 4px 10px rgba(82, 196, 26, 0.3)',
                            }}
                          >
                            {dailyClosure?.isClosed ? <LockOutlined /> : <UnlockOutlined />}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontWeight: 800,
                                  fontSize: 14,
                                  color: dailyClosure?.isClosed ? '#cf1322' : '#237804',
                                  letterSpacing: 0.3,
                                }}
                              >
                                {dailyClosure?.isClosed
                                  ? 'DAILY REGISTER CLOSED'
                                  : 'DAILY REGISTER OPEN · LIVE PUNCHING ACTIVE'}
                              </span>
                              <Tag
                                color={dailyClosure?.isClosed ? 'error' : 'success'}
                                style={{ fontWeight: 700, margin: 0, borderRadius: 10 }}
                              >
                                {BRANCH_GEOFENCES[effectiveBranchId]?.branchName || 'Accra Head Office'}
                              </Tag>
                            </div>
                            <Text
                              style={{
                                fontSize: 12,
                                display: 'block',
                                marginTop: 2,
                                color: dailyClosure?.isClosed ? '#a8071a' : '#389e0d',
                              }}
                            >
                              {dailyClosure?.isClosed
                                ? `Attendance for ${dayjs(effectiveDate).format('DD MMMM YYYY')} has been closed by ${dailyClosure.closedBy || 'Management'}. Live check-outs are locked.`
                                : `Live punching enabled for ${dayjs(effectiveDate).format('DD MMMM YYYY')}. Staff within the 75m geofence can record check-in and check-out.`}
                            </Text>
                          </div>
                        </div>

                        {isManager && (
                          <div>
                            {dailyClosure?.isClosed ? (
                              <Popconfirm
                                title="Reopen Attendance Register?"
                                description={`Allow staff to continue recording live check-ins and check-outs for ${effectiveDate}?`}
                                onConfirm={handleReopenAttendanceRegister}
                                okText="Reopen Register"
                              >
                                <Button
                                  size="middle"
                                  icon={<UnlockOutlined />}
                                  loading={reopenAttendanceMutation.isPending}
                                  style={{
                                    borderColor: '#52c41a',
                                    color: '#52c41a',
                                    fontWeight: 700,
                                    borderRadius: 8,
                                    boxShadow: '0 2px 6px rgba(82, 196, 26, 0.15)',
                                  }}
                                >
                                  Reopen Register
                                </Button>
                              </Popconfirm>
                            ) : (
                              <Popconfirm
                                title="Close Daily Attendance Register?"
                                description={`Closing attendance for ${effectiveDate} will finalize records and lock live check-outs. Staff with forgotten punches must submit correction requests.`}
                                onConfirm={handleCloseAttendanceRegister}
                                okText="Close Register"
                                okType="danger"
                              >
                                <Button
                                  type="primary"
                                  danger
                                  size="middle"
                                  icon={<LockOutlined />}
                                  loading={closeAttendanceMutation.isPending}
                                  style={{
                                    fontWeight: 700,
                                    borderRadius: 8,
                                    boxShadow: '0 2px 6px rgba(255, 77, 79, 0.25)',
                                  }}
                                >
                                  Close Today's Register
                                </Button>
                              </Popconfirm>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── REGISTER SEARCH & FILTER CONTROLS ───────────────── */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 12,
                          marginBottom: 16,
                          padding: '10px 14px',
                          background: '#f8fafc',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <Space wrap size="middle">
                          <Select
                            placeholder="All Branches"
                            value={selectedBranch}
                            onChange={setSelectedBranch}
                            allowClear
                            style={{ width: 175 }}
                          >
                            <Option value="branch-accra-hq">Accra Head Office</Option>
                            <Option value="branch-kumasi">Kumasi Branch</Option>
                            <Option value="branch-takoradi">Takoradi Branch</Option>
                            <Option value="branch-tamale">Tamale Branch</Option>
                            <Option value="branch-wa">Wa Branch</Option>
                          </Select>

                          <Select
                            placeholder="All 8 Attendance Types"
                            value={selectedStatus}
                            onChange={setSelectedStatus}
                            allowClear
                            style={{ width: 190 }}
                          >
                            <Option value="present">✅ Present (On Time)</Option>
                            <Option value="late">⏰ Late Arrival</Option>
                            <Option value="early_leave">🚪 Early Departure</Option>
                            <Option value="half_day">🌓 Half Day</Option>
                            <Option value="absent">❌ Absent</Option>
                            <Option value="on_leave">🏖️ On Leave</Option>
                            <Option value="correction_requested">📝 Correction Requested</Option>
                            <Option value="approved_exception">🛡️ Approved Exception</Option>
                          </Select>

                          <DatePicker
                            placeholder="Specific Date"
                            value={selectedDate ? dayjs(selectedDate) : undefined}
                            onChange={(d) => setSelectedDate(d ? d.format('YYYY-MM-DD') : undefined)}
                            style={{ width: 145 }}
                          />

                          {selectedStatus && (
                            <Button type="link" size="small" onClick={() => setSelectedStatus(undefined)} style={{ padding: 0 }}>
                              Clear Status Filter
                            </Button>
                          )}
                        </Space>

                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Showing <strong>{attendanceList.length}</strong> total attendance records
                        </Text>
                      </div>
                      <Table
                        columns={branchRegisterColumns}
                        dataSource={attendanceList}
                        rowKey="id"
                        loading={listLoading}
                        pagination={{
                          pageSize: 15,
                          showSizeChanger: true,
                          pageSizeOptions: ['10', '15', '25', '50', '100'],
                          showTotal: (total, range) =>
                            `Showing ${range[0]}-${range[1]} of ${total} attendance records`,
                        }}
                        scroll={{ x: 1850 }}
                        size="middle"
                        bordered
                      />
                    </Card>
                  ),
                },
                {
                  key: 'corrections-queue',
                  label: (
                    <span>
                      <Badge count={correctionsList.length} offset={[8, -2]}>
                        <FileProtectOutlined /> Correction Requests
                      </Badge>
                    </span>
                  ),
                  children: (
                    <Card title="Pending Staff Correction & Exception Queue">
                      {correctionsList.length === 0 ? (
                        <Alert
                          type="success"
                          showIcon
                          message="No Pending Correction Requests"
                          description="All staff punch time adjustments and missed punch exceptions have been reviewed."
                        />
                      ) : (
                        <Table
                          columns={correctionColumns}
                          dataSource={correctionsList}
                          rowKey="id"
                          pagination={{ pageSize: 10 }}
                          scroll={{ x: 1000 }}
                          size="middle"
                        />
                      )}
                    </Card>
                  ),
                },
                {
                  key: 'leave-approvals',
                  label: (
                    <span>
                      <Badge count={pendingLeaves.length} offset={[8, -2]}>
                        <CalendarOutlined /> Leave Approvals
                      </Badge>
                    </span>
                  ),
                  children: (
                    <Card
                      title="Staff Leave Applications & Approval Queue"
                      extra={
                        <Button
                          type="primary"
                          icon={<CalendarOutlined />}
                          style={{ background: '#722ed1', borderColor: '#722ed1' }}
                          onClick={() => setLeaveModalOpen(true)}
                        >
                          + Apply for Leave
                        </Button>
                      }
                    >
                      <Alert
                        type="info"
                        showIcon
                        icon={<FileProtectOutlined style={{ color: '#722ed1' }} />}
                        style={{ marginBottom: 16, borderRadius: 8 }}
                        message="Rule: Leave Must Be Approved Before Attendance Is Marked as On Leave"
                        description="Staff applications remain pending without altering attendance records. Once a manager approves the request below, the system automatically schedules and marks attendance as 'On Leave' across all approved dates."
                      />

                      <Table
                        dataSource={leaveRequests}
                        rowKey="id"
                        pagination={{ pageSize: 10 }}
                        scroll={{ x: 1200 }}
                        size="middle"
                        columns={[
                          {
                            title: 'Staff Member',
                            key: 'staff',
                            width: 200,
                            render: (_: any, l: StaffLeaveRequest) => (
                              <Space align="center">
                                <Avatar style={{ backgroundColor: '#722ed1', color: '#fff', fontWeight: 700 }}>
                                  {(l.staffName || 'S').charAt(0).toUpperCase()}
                                </Avatar>
                                <div>
                                  <Text strong style={{ color: '#1e293b' }}>{l.staffName}</Text>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>
                                    {l.staffRole} · {l.branchName}
                                  </div>
                                </div>
                              </Space>
                            ),
                          },
                          {
                            title: 'Leave Category',
                            dataIndex: 'leaveType',
                            key: 'leaveType',
                            width: 150,
                            render: (type: string) => {
                              const colors: Record<string, string> = {
                                annual: 'blue',
                                sick: 'orange',
                                casual: 'purple',
                                maternity: 'magenta',
                                bereavement: 'default',
                              };
                              return (
                                <Tag color={colors[type] || 'blue'} style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                                  {type} Leave
                                </Tag>
                              );
                            },
                          },
                          {
                            title: 'Dates & Duration',
                            key: 'dates',
                            width: 220,
                            render: (_: any, l: StaffLeaveRequest) => (
                              <div>
                                <Text strong style={{ color: '#1e293b' }}>
                                  {dayjs(l.startDate).format('DD MMM YYYY')} → {dayjs(l.endDate).format('DD MMM YYYY')}
                                </Text>
                                <div>
                                  <Tag color="cyan" style={{ fontWeight: 700, fontSize: 11, marginTop: 2 }}>
                                    {l.totalDays} Calendar Day{l.totalDays > 1 ? 's' : ''}
                                  </Tag>
                                </div>
                              </div>
                            ),
                          },
                          {
                            title: 'Reason & Handover Plan',
                            dataIndex: 'reason',
                            key: 'reason',
                            render: (val: string) => (
                              <Paragraph ellipsis={{ rows: 2, expandable: true }} style={{ margin: 0, fontSize: 12 }}>
                                {val}
                              </Paragraph>
                            ),
                          },
                          {
                            title: 'Status',
                            dataIndex: 'status',
                            key: 'status',
                            width: 130,
                            render: (st: string) => (
                              <Tag
                                color={st === 'approved' ? 'success' : st === 'rejected' ? 'error' : 'warning'}
                                style={{ fontWeight: 700, textTransform: 'uppercase' }}
                              >
                                {st === 'approved' ? '✅ Approved' : st === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
                              </Tag>
                            ),
                          },
                          {
                            title: 'Reviewer Notes',
                            key: 'notes',
                            width: 180,
                            render: (_: any, l: StaffLeaveRequest) => (
                              l.approvedBy ? (
                                <div style={{ fontSize: 11 }}>
                                  <div style={{ fontWeight: 600, color: '#1e293b' }}>Reviewed by: {l.approvedBy}</div>
                                  <div style={{ color: '#64748b' }}>{l.reviewNote || 'Approved'}</div>
                                  {l.approvedAt && (
                                    <div style={{ fontSize: 10, color: '#94a3b8' }}>
                                      {dayjs(l.approvedAt).format('DD MMM, hh:mm A')}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <Text type="secondary" style={{ fontSize: 11 }}>Awaiting Review</Text>
                              )
                            ),
                          },
                          {
                            title: 'Actions',
                            key: 'actions',
                            width: 170,
                            fixed: 'right' as const,
                            render: (_: any, l: StaffLeaveRequest) => {
                              const isSelf = l.userId === user?.id;
                              if (l.status !== 'pending') {
                                return <Text type="secondary" style={{ fontSize: 11 }}>Decided</Text>;
                              }
                              return (
                                <Space size="small">
                                  <Popconfirm
                                    title="Approve Staff Leave?"
                                    description={`Approve ${l.totalDays} days of leave for ${l.staffName}? System will generate 'On Leave' records.`}
                                    onConfirm={() => handleApproveLeave(l)}
                                    okText="Approve"
                                    disabled={isSelf}
                                  >
                                    <Tooltip title={isSelf ? 'Rule: Staff cannot approve their own leave' : undefined}>
                                      <Button
                                        size="small"
                                        type="primary"
                                        icon={<CheckOutlined />}
                                        style={{
                                          background: isSelf ? undefined : '#52c41a',
                                          borderColor: isSelf ? undefined : '#52c41a',
                                        }}
                                        disabled={isSelf}
                                        loading={approveLeaveMutation.isPending}
                                      >
                                        Approve
                                      </Button>
                                    </Tooltip>
                                  </Popconfirm>
                                  <Button
                                    size="small"
                                    danger
                                    icon={<CloseOutlined />}
                                    disabled={isSelf}
                                    onClick={() => {
                                      setSelectedLeaveForAction(l);
                                      setLeaveRejectionReason('');
                                      setLeaveRejectModalOpen(true);
                                    }}
                                  >
                                    Reject
                                  </Button>
                                </Space>
                              );
                            },
                          },
                        ]}
                      />
                    </Card>
                  ),
                },
                {
                  key: 'anti-fraud-audit',
                  label: (
                    <span>
                      <SafetyCertificateOutlined style={{ color: '#2E5E8C' }} /> Anti-Fraud & Audit Trail ({auditLogs.length})
                    </span>
                  ),
                  children: (
                    <div>
                      {/* Anti-Fraud KPI Cards */}
                      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                        <Col xs={24} sm={12} md={6}>
                          <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #2E5E8C' }}>
                            <Statistic
                              title={<span style={{ fontSize: 12, color: '#64748b' }}>Total Security Audits</span>}
                              value={auditLogs.length}
                              valueStyle={{ color: '#2E5E8C', fontWeight: 800 }}
                              prefix={<SafetyCertificateOutlined />}
                            />
                            <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                              Immutable security event stream
                            </Text>
                          </Card>
                        </Col>

                        <Col xs={24} sm={12} md={6}>
                          <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #ff4d4f' }}>
                            <Statistic
                              title={<span style={{ fontSize: 12, color: '#64748b' }}>Blocked Fraud Attempts</span>}
                              value={auditLogs.filter((a) => a.status === 'BLOCKED').length}
                              valueStyle={{ color: '#ff4d4f', fontWeight: 800 }}
                              prefix={<CloseCircleOutlined />}
                            />
                            <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                              GPS breaches & 5-min duplicate punches
                            </Text>
                          </Card>
                        </Col>

                        <Col xs={24} sm={12} md={6}>
                          <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #722ed1' }}>
                            <Statistic
                              title={<span style={{ fontSize: 12, color: '#64748b' }}>Bound Hardware Terminals</span>}
                              value={deviceBindings.length}
                              valueStyle={{ color: '#722ed1', fontWeight: 800 }}
                              prefix={<CompassOutlined />}
                            />
                            <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                              Sensitive corporate role bindings
                            </Text>
                          </Card>
                        </Col>

                        <Col xs={24} sm={12} md={6}>
                          <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #faad14' }}>
                            <Statistic
                              title={<span style={{ fontSize: 12, color: '#64748b' }}>Supervisor Overrides</span>}
                              value={auditLogs.filter((a) => a.status === 'OVERRIDDEN').length}
                              valueStyle={{ color: '#d48806', fontWeight: 800 }}
                              prefix={<FileProtectOutlined />}
                            />
                            <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                              Approved manual departure exceptions
                            </Text>
                          </Card>
                        </Col>
                      </Row>

                      {/* Device Binding Management Section */}
                      <Card
                        title={
                          <Space>
                            <CompassOutlined style={{ color: '#722ed1' }} />
                            <span>Device Binding for Sensitive Corporate Roles</span>
                          </Space>
                        }
                        extra={
                          <Button
                            type="primary"
                            icon={<SafetyCertificateOutlined />}
                            style={{ background: '#722ed1', borderColor: '#722ed1' }}
                            onClick={() => {
                              setBindUserId(staffUsers[0]?.id || '');
                              setBindDeviceIdInput(getClientDeviceId());
                              setBindDeviceNameInput('Assigned Corporate Terminal');
                              setBindDeviceModalOpen(true);
                            }}
                          >
                            + Bind Staff Terminal
                          </Button>
                        }
                        style={{ borderRadius: 12, marginBottom: 20 }}
                      >
                        <Paragraph style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                          Staff in sensitive roles (Cashier, Finance Officer, Sales Executive, Branch Manager) are restricted to clocking in exclusively from authorized hardware terminals. Attempts from unbound or unauthorized personal devices are blocked automatically.
                        </Paragraph>

                        <Table
                          size="small"
                          dataSource={deviceBindings}
                          rowKey="id"
                          pagination={false}
                          columns={[
                            {
                              title: 'Staff Member & Role',
                              key: 'staff',
                              render: (_: any, b: DeviceBinding) => (
                                <div>
                                  <Text strong style={{ color: '#1e293b' }}>{b.staffName}</Text>
                                  <Tag color="purple" style={{ fontSize: 10, marginLeft: 6 }}>{b.role}</Tag>
                                </div>
                              ),
                            },
                            {
                              title: 'Bound Terminal Device ID',
                              dataIndex: 'deviceId',
                              key: 'deviceId',
                              render: (devId: string) => (
                                <Tag color="blue" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                  {devId}
                                </Tag>
                              ),
                            },
                            {
                              title: 'Hardware Terminal Name',
                              dataIndex: 'deviceName',
                              key: 'deviceName',
                            },
                            {
                              title: 'Enrolled Date',
                              dataIndex: 'boundAt',
                              key: 'boundAt',
                              render: (val: string) => dayjs(val).format('DD MMM YYYY, hh:mm A'),
                            },
                            {
                              title: 'Binding Status',
                              dataIndex: 'status',
                              key: 'status',
                              render: (st: string) => (
                                <Tag color={st === 'active' ? 'success' : 'default'} style={{ fontWeight: 700 }}>
                                  {st === 'active' ? '● ACTIVE' : 'SUSPENDED'}
                                </Tag>
                              ),
                            },
                            {
                              title: 'Actions',
                              key: 'actions',
                              render: (_: any, b: DeviceBinding) => (
                                <Popconfirm
                                  title="Reset Hardware Terminal Binding"
                                  description={`Allow ${b.staffName} to re-enroll a new device terminal?`}
                                  onConfirm={() => handleResetDevice(b.userId, b.staffName)}
                                  okText="Reset Binding"
                                  okType="danger"
                                >
                                  <Button size="small" danger>
                                    Reset Device
                                  </Button>
                                </Popconfirm>
                              ),
                            },
                          ]}
                        />
                      </Card>

                      {/* Immutable Audit Trail Log Table */}
                      <Card
                        title={
                          <Space>
                            <SafetyCertificateOutlined style={{ color: '#2E5E8C' }} />
                            <span>Immutable Anti-Fraud Audit Trail ({filteredAuditLogs.length} events)</span>
                          </Space>
                        }
                        extra={
                          <Space wrap>
                            <Select
                              value={selectedAuditFilter}
                              onChange={(val) => setSelectedAuditFilter(val)}
                              style={{ width: 200 }}
                            >
                              <Option value="ALL">All Audit Events</Option>
                              <Option value="BLOCKED">🚫 Blocked Breaches Only</Option>
                              <Option value="GPS">📍 GPS Radius Breaches</Option>
                              <Option value="DUPLICATE">⏳ Duplicate Punches</Option>
                              <Option value="DEVICE">💻 Device Binding Events</Option>
                              <Option value="OVERRIDDEN">🛡️ Supervisor Overrides</Option>
                            </Select>
                            <Button icon={<ReloadOutlined />} onClick={() => refetchAuditLogs()}>
                              Refresh Trail
                            </Button>
                          </Space>
                        }
                        style={{ borderRadius: 12 }}
                      >
                        <Table
                          size="middle"
                          dataSource={filteredAuditLogs}
                          rowKey="id"
                          pagination={{ pageSize: 12 }}
                          columns={[
                            {
                              title: 'Timestamp',
                              dataIndex: 'timestamp',
                              key: 'timestamp',
                              width: 170,
                              render: (val: string) => (
                                <div>
                                  <Text strong style={{ fontSize: 12 }}>{dayjs(val).format('DD MMM YYYY')}</Text>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>{dayjs(val).format('hh:mm:ss A')}</div>
                                </div>
                              ),
                            },
                            {
                              title: 'Event Type',
                              dataIndex: 'eventType',
                              key: 'eventType',
                              width: 200,
                              render: (ev: string) => {
                                const isBlocked = ev.includes('BLOCKED');
                                const isOverride = ev.includes('OVERRIDE');
                                const icon = isBlocked ? '🚫' : isOverride ? '🛡️' : '✅';
                                const color = isBlocked ? 'error' : isOverride ? 'warning' : 'success';
                                return (
                                  <Tag color={color} style={{ fontWeight: 600, padding: '2px 8px' }}>
                                    {icon} {ev.replace(/_/g, ' ')}
                                  </Tag>
                                );
                              },
                            },
                            {
                              title: 'Staff Member',
                              key: 'staff',
                              width: 160,
                              render: (_: any, a: AttendanceAuditLog) => (
                                <div>
                                  <Text strong style={{ color: '#1e293b' }}>{a.staffName}</Text>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>{a.staffRole}</div>
                                </div>
                              ),
                            },
                            {
                              title: 'Status & Severity',
                              key: 'statusSeverity',
                              width: 150,
                              render: (_: any, a: AttendanceAuditLog) => (
                                <Space direction="vertical" size={2}>
                                  <Tag color={a.status === 'PASSED' ? 'green' : a.status === 'BLOCKED' ? 'red' : 'purple'} style={{ fontWeight: 700 }}>
                                    {a.status}
                                  </Tag>
                                  <Tag color={a.severity === 'critical' ? 'magenta' : a.severity === 'high' ? 'volcano' : a.severity === 'medium' ? 'orange' : 'blue'} style={{ fontSize: 10 }}>
                                    {a.severity.toUpperCase()} RISK
                                  </Tag>
                                </Space>
                              ),
                            },
                            {
                              title: 'Terminal / Branch',
                              key: 'deviceBranch',
                              width: 160,
                              render: (_: any, a: AttendanceAuditLog) => (
                                <div style={{ fontSize: 12 }}>
                                  <div>{a.branchName || 'Office'}</div>
                                  {a.deviceId && (
                                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#475569' }}>
                                      {a.deviceId}
                                    </div>
                                  )}
                                </div>
                              ),
                            },
                            {
                              title: 'Audit Details & Actor',
                              key: 'details',
                              render: (_: any, a: AttendanceAuditLog) => (
                                <div>
                                  <div style={{ fontSize: 12, color: '#1e293b' }}>{a.details}</div>
                                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                    Logged by: <strong>{a.actorName}</strong>
                                  </div>
                                </div>
                              ),
                            },
                          ]}
                        />
                      </Card>
                    </div>
                  ),
                },
                {
                  key: 'automations-engine',
                  label: (
                    <span>
                      <ThunderboltOutlined style={{ color: '#0284c7' }} /> ⚡ Automations & Rules
                    </span>
                  ),
                  children: <AttendanceAutomationsView />,
                },
              ]
            : []),
        ]}
      />

      {/* Clock In / Out Modal */}
      {clockModalOpen && (
        <ClockInOutModal
          open={clockModalOpen}
          onClose={() => {
            setClockModalOpen(false);
            refetchToday();
            refetchList();
          }}
          todayRecord={todayRecord}
        />
      )}

      {/* Reception QR Kiosk Modal */}
      {receptionModalOpen && (
        <ReceptionQRModal
          open={receptionModalOpen}
          onClose={() => setReceptionModalOpen(false)}
        />
      )}

      {/* Attendance Correction Modal */}
      {correctionModalOpen && (
        <AttendanceCorrectionModal
          open={correctionModalOpen}
          onClose={() => {
            setCorrectionModalOpen(false);
            setSelectedRecordForCorrection(null);
            refetchList();
            refetchCorrections();
          }}
          existingAttendance={selectedRecordForCorrection}
        />
      )}

      {/* ── UPDATE ATTENDANCE STATUS MODAL (For Supervisors / HR) ────────── */}
      <Modal
        title={
          <Space>
            <SafetyCertificateOutlined style={{ color: '#2E5E8C' }} />
            <span>Update Attendance Status: {selectedRecordForStatusEdit?.staffName}</span>
          </Space>
        }
        open={editStatusModalOpen}
        onCancel={() => setEditStatusModalOpen(false)}
        onOk={handleSaveStatusEdit}
        okText="Save Updated Status"
        confirmLoading={updateStatusMutation.isPending}
        width={500}
      >
        <div style={{ padding: '12px 0' }}>
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Staff Member & Branch</Text>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
              {selectedRecordForStatusEdit?.staffName} ({selectedRecordForStatusEdit?.branchName})
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Date: {selectedRecordForStatusEdit?.date ? dayjs(selectedRecordForStatusEdit.date).format('DD MMMM YYYY') : ''}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              Select Attendance Type (All 8 Types Supported):
            </Text>
            <Select
              value={newStatusValue}
              onChange={(val) => setNewStatusValue(val)}
              style={{ width: '100%' }}
              size="large"
            >
              <Option value="present">✅ Present (On Time)</Option>
              <Option value="late">⏰ Late Arrival</Option>
              <Option value="early_leave">🚪 Early Departure</Option>
              <Option value="half_day">🌓 Half Day</Option>
              <Option value="absent">❌ Absent</Option>
              <Option value="on_leave">🏖️ On Approved Leave</Option>
              <Option value="correction_requested">📝 Correction Requested</Option>
              <Option value="approved_exception">🛡️ Approved Exception</Option>
            </Select>
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              Reason / Approval Remarks:
            </Text>
            <Input.TextArea
              rows={3}
              placeholder="E.g. Approved medical leave, official site inspection, authorized exception..."
              value={statusEditReason}
              onChange={(e) => setStatusEditReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ── RECORD STAFF ATTENDANCE MODAL (For Supervisors / HR) ─────────── */}
      <Modal
        title={
          <Space>
            <EditOutlined style={{ color: '#2E5E8C' }} />
            <span>Record Staff Attendance Status</span>
          </Space>
        }
        open={manualRecordModalOpen}
        onCancel={() => setManualRecordModalOpen(false)}
        onOk={handleSaveManualRecord}
        okText="Record Attendance"
        confirmLoading={createManualMutation.isPending}
        width={520}
      >
        <div style={{ padding: '12px 0' }}>
          <div style={{ marginBottom: 14 }}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>Staff Member:</Text>
            <Select
              placeholder="Select staff member"
              value={manualUserId || undefined}
              onChange={(val) => setManualUserId(val)}
              style={{ width: '100%' }}
              showSearch
              filterOption={(input, option) =>
                (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {staffUsers.map((u) => (
                <Option key={u.id} value={u.id}>
                  {getUserFullName(u)} ({u.email})
                </Option>
              ))}
            </Select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>Attendance Date:</Text>
            <DatePicker
              style={{ width: '100%' }}
              value={dayjs(manualDate)}
              onChange={(d) => setManualDate(d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              Attendance Type (All 8 Supported):
            </Text>
            <Select
              value={manualStatus}
              onChange={(val) => setManualStatus(val)}
              style={{ width: '100%' }}
              size="large"
            >
              <Option value="present">✅ Present (On Time)</Option>
              <Option value="late">⏰ Late Arrival</Option>
              <Option value="early_leave">🚪 Early Departure</Option>
              <Option value="half_day">🌓 Half Day</Option>
              <Option value="absent">❌ Absent</Option>
              <Option value="on_leave">🏖️ On Approved Leave</Option>
              <Option value="correction_requested">📝 Correction Requested</Option>
              <Option value="approved_exception">🛡️ Approved Exception</Option>
            </Select>
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>Reason / Remarks:</Text>
            <Input.TextArea
              rows={3}
              placeholder="E.g. Approved compassionate leave, field survey in Shai Hills, hospital excuse duty..."
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ── BIND HARDWARE TERMINAL MODAL (Anti-Fraud) ────────────────────── */}
      <Modal
        title={
          <Space>
            <CompassOutlined style={{ color: '#722ed1' }} />
            <span>Bind Hardware Device Terminal for Sensitive Role</span>
          </Space>
        }
        open={bindDeviceModalOpen}
        onCancel={() => setBindDeviceModalOpen(false)}
        onOk={handleBindDeviceSubmit}
        okText="Authorize & Bind Terminal"
        confirmLoading={bindDeviceMutation.isPending}
        width={500}
      >
        <div style={{ padding: '12px 0' }}>
          <Paragraph style={{ fontSize: 13, color: '#475569' }}>
            Enrolling a corporate device locks this staff member's account to clock in exclusively from this authorized terminal.
          </Paragraph>

          <div style={{ marginBottom: 14 }}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>Staff Member:</Text>
            <Select
              placeholder="Select staff member"
              value={bindUserId || undefined}
              onChange={(val) => setBindUserId(val)}
              style={{ width: '100%' }}
              showSearch
              filterOption={(input, option) =>
                (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {staffUsers.map((u) => (
                <Option key={u.id} value={u.id}>
                  {getUserFullName(u)} ({u.role})
                </Option>
              ))}
            </Select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text strong>Hardware Terminal Device ID:</Text>
              <Button
                size="small"
                type="link"
                style={{ padding: 0 }}
                onClick={() => setBindDeviceIdInput(getClientDeviceId())}
              >
                Use Current Device ({getClientDeviceId()})
              </Button>
            </div>
            <Input
              placeholder="e.g. DEV-OMARK-MAC-4891"
              value={bindDeviceIdInput}
              onChange={(e) => setBindDeviceIdInput(e.target.value)}
            />
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>Device Label / Hardware Name:</Text>
            <Input
              placeholder="e.g. Front Desk iMac 24 / Accra Cashier Terminal"
              value={bindDeviceNameInput}
              onChange={(e) => setBindDeviceNameInput(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ── STAFF LEAVE REQUEST APPLICATION MODAL ─────────────────────────── */}
      <StaffLeaveRequestModal
        open={leaveModalOpen}
        onClose={() => {
          setLeaveModalOpen(false);
          refetchLeaves();
        }}
        branchId={selectedBranch || 'branch-accra-hq'}
        branchName={
          BRANCH_GEOFENCES[selectedBranch || 'branch-accra-hq']?.branchName || 'Accra Head Office'
        }
      />

      {/* ── LEAVE REJECTION REASON MODAL ─────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>Reject Staff Leave Application: {selectedLeaveForAction?.staffName}</span>
          </Space>
        }
        open={leaveRejectModalOpen}
        onCancel={() => {
          setLeaveRejectModalOpen(false);
          setSelectedLeaveForAction(null);
          setLeaveRejectionReason('');
        }}
        onOk={handleRejectLeave}
        okText="Confirm Rejection"
        okType="danger"
        confirmLoading={rejectLeaveMutation.isPending}
        width={480}
      >
        <div style={{ padding: '12px 0' }}>
          <Paragraph style={{ fontSize: 13, color: '#475569' }}>
            Please state the management justification for declining this leave request. The explanation will be provided to the staff member and recorded in the audit trail.
          </Paragraph>
          <Input.TextArea
            rows={3}
            placeholder="E.g. Insufficient coverage during high-volume sales campaign; please reschedule to next month..."
            value={leaveRejectionReason}
            onChange={(e) => setLeaveRejectionReason(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};
