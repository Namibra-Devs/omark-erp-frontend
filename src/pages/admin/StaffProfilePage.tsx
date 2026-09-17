// src/pages/admin/StaffProfilePage.tsx
import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card, Row, Col, Typography, Tag, Button, Space, Tabs, Table,
  Descriptions, Avatar, Badge, Statistic, List, Tooltip, Popconfirm,
  Modal, Form, Input, Select, InputNumber, Divider, Empty, Spin, message, Alert, Drawer
} from 'antd';
import {
  ArrowLeftOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  IdcardOutlined,
  DollarOutlined,
  TrophyOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  EditOutlined,
  PlusOutlined,
  SettingOutlined,
  LockOutlined,
  UnlockOutlined,
  DeleteOutlined,
  TeamOutlined,
  AuditOutlined,
  EnvironmentOutlined,
  ReloadOutlined,
  CrownOutlined,
  ExportOutlined,
  FileTextOutlined,
  CreditCardOutlined,
  PercentageOutlined,
  ThunderboltOutlined,
  SearchOutlined,
  FileDoneOutlined,
  EyeOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { PhotoUpload } from '@/components/shared/PhotoUpload';
import { PayslipModal } from '@/components/payroll/PayslipModal';
import { CompensationModal } from '@/components/payroll/CompensationModal';
import { useUsersQuery, useUpdateUserMutation, useUserAssignmentQuery, useUpdateUserAssignmentMutation, getUserFullName, getUserPhone, getRoleLabel, getRoleColor, getRoleIcon } from '@/api/users';
import { getStoredUserAssignment, setStoredUserAssignment, resolveDefaultDepartment } from '@/utils/userAssignmentStorage';
import { recordEntityBranch } from '@/utils/branchIsolation';
import { useBonusesQuery, useAwardBonusMutation, bonusTypeLabels, type StaffBonusRecord, type BonusType } from '@/api/bonuses';
import {
  useStaffCompensationQuery,
  useUpdateStaffCompensationMutation,
  salaryTypeLabels,
  paymentMethodLabels,
  payFrequencyLabels,
  type StaffCompensationProfile,
  type SalaryType
} from '@/api/compensation';
import { usePayrollQuery, useCreatePayrollMutation, useUpdatePayrollMutation, type PayrollRecord } from '@/api/payroll';
import { useAttendanceQuery, useStaffAttendanceStatsQuery, type AttendanceRecord, type AttendanceStatus } from '@/api/attendance';
import { ATTENDANCE_STATUS_META } from '@/constants/attendance';
import { useStaffLeaveRequestsQuery } from '@/api/leaves';
import { useProspectsQuery } from '@/api/prospects';
import { useAppointmentsQuery } from '@/api/appointments';
import { useDeedsQuery } from '@/api/deeds';
import { useBranchesQuery } from '@/api/branches';
import { roleLabels } from '@/constants/enums';
import { tokens } from '@/constants/tokens';
import type { Role } from '@/types';
import { ProspectInteractionsTimeline } from '@/components/dashboard/ProspectInteractionsTimeline';

const deptLabels: Record<string, string> = {
  'dept-admin': 'Administration',
  'dept-finance': 'Accounts & Finance',
  'dept-marketing': 'Marketing & Sales',
  'dept-cs': 'Customer Service',
  'dept-ops': 'Branch Operations',
};

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export const StaffProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser, hasRole } = useAuth();
  const isAdmin = hasRole(['admin']);
  const isManager = hasRole(['admin', 'branch_manager']);

  // Queries
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useUsersQuery();
  const { data: branches = [] } = useBranchesQuery();
  const updateUserMutation = useUpdateUserMutation();
  const updateUserAssignmentMutation = useUpdateUserAssignmentMutation();

  const allUsers = usersData?.items ?? [];
  const staffMember = allUsers.find((u) => u.id === id);

  // Assignment
  const { data: assignment } = useUserAssignmentQuery(id);
  const storedAssignment = getStoredUserAssignment(id);
  const effectiveBranchId = assignment?.branchId || storedAssignment?.branchId || (staffMember as any)?.branchId;
  const assignedBranch = branches.find((b: any) => b.id === effectiveBranchId || b.branchCode === effectiveBranchId || b.name === effectiveBranchId);
  const effectiveDeptId = assignment?.departmentId || storedAssignment?.departmentId;
  const effectiveDeptName = assignment?.departmentName || storedAssignment?.departmentName || storedAssignment?.department || (effectiveDeptId ? (deptLabels[effectiveDeptId] || effectiveDeptId) : null) || resolveDefaultDepartment(staffMember?.role);

  // Compensation Profile
  const { data: compProfile } = useStaffCompensationQuery(id);
  const updateCompensationMutation = useUpdateStaffCompensationMutation();

  // Live Staff Bonuses
  const { data: bonuses = [] } = useBonusesQuery({ userId: id });
  const awardBonusMutation = useAwardBonusMutation();
  const totalBonusMinor = bonuses.reduce((sum: number, b: any) => sum + (b.amountMinor || (b.amountGHS ? b.amountGHS * 100 : 0)), 0);
  const totalBonusGHS = totalBonusMinor / 100;

  // Live Payroll Records
  const { data: payrollData, isLoading: payrollLoading, refetch: refetchPayroll } = usePayrollQuery({ staffUserId: id });
  const payrollRecords = payrollData?.items ?? [];
  const createPayrollMutation = useCreatePayrollMutation();
  const updatePayrollMutation = useUpdatePayrollMutation();

  // Related Activity & Records
  const { data: prospectsData, isLoading: prospectsLoading } = useProspectsQuery({ assignedUserId: id, pageSize: 500 });
  const { data: allProspectsData } = useProspectsQuery({ pageSize: 500 });
  const { data: appointmentsData, isLoading: appointmentsLoading } = useAppointmentsQuery({ pageSize: 500 });
  const { data: deedsData, isLoading: deedsLoading } = useDeedsQuery({ pageSize: 500 });

  // Merge and deduplicate prospects assigned to or added by this staff member
  const staffProspects = useMemo(() => {
    const direct = prospectsData?.items ?? [];
    const list = allProspectsData?.items ?? [];
    const combined = [...direct];
    list.forEach((p) => {
      const isStaffProspect =
        p.assignedUserId === id ||
        (p as any).assignedStaffId === id ||
        p.createdByUserId === id ||
        (p as any).creatorId === id;
      if (isStaffProspect && !combined.some((c) => c.id === p.id)) {
        combined.push(p);
      }
    });
    return combined;
  }, [allProspectsData, prospectsData, id]);

  const staffAppointments = useMemo(() => {
    return (appointmentsData?.items ?? []).filter(
      (a) => a.createdByUserId === id || (a as any).assignedStaffId === id || (a as any).userId === id
    );
  }, [appointmentsData, id]);

  const staffDeeds = useMemo(() => {
    return (deedsData?.items ?? []).filter((d) => d.generatedByUserId === id);
  }, [deedsData, id]);

  // Attendance & Time Tracking
  const { data: rawStaffAttendance = [], isLoading: attendanceLoading } = useAttendanceQuery({ userId: id });
  const staffAttendance = useMemo(() => Array.isArray(rawStaffAttendance) ? rawStaffAttendance : [], [rawStaffAttendance]);
  const { data: attendanceStats } = useStaffAttendanceStatsQuery(id);

  // Leave Requests
  const { data: rawStaffLeaves = [] } = useStaffLeaveRequestsQuery({ userId: id });
  const staffLeaves = useMemo(() => Array.isArray(rawStaffLeaves) ? rawStaffLeaves : [], [rawStaffLeaves]);

  // ── UI States ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('overview');
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [addBonusModal, setAddBonusModal] = useState(false);
  const [addPayrollModal, setAddPayrollModal] = useState(false);
  const [editPayrollModal, setEditPayrollModal] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRecord | null>(null);
  
  const [compensationModalOpen, setCompensationModalOpen] = useState(false);
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const [payslipRecord, setPayslipRecord] = useState<PayrollRecord | null>(null);

  // Dedicated Prospects & Interaction History Drawer State
  const [prospectsDrawerOpen, setProspectsDrawerOpen] = useState(false);
  const [drawerActiveTab, setDrawerActiveTab] = useState<'prospects' | 'interactions'>('prospects');
  const [prospectSearchText, setProspectSearchText] = useState('');
  const [prospectStatusFilter, setProspectStatusFilter] = useState<string>('all');
  const [prospectSourceFilter, setProspectSourceFilter] = useState<string>('all');

  const filteredStaffProspects = useMemo(() => {
    return staffProspects.filter((p) => {
      if (prospectStatusFilter !== 'all' && p.status !== prospectStatusFilter) return false;
      if (prospectSourceFilter !== 'all' && p.source !== prospectSourceFilter) return false;
      if (prospectSearchText.trim()) {
        const q = prospectSearchText.trim().toLowerCase();
        const matches =
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
          p.phoneNumber?.toLowerCase().includes(q) ||
          p.address?.toLowerCase().includes(q) ||
          p.reasonForContact?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [staffProspects, prospectStatusFilter, prospectSourceFilter, prospectSearchText]);

  // Quick Operational Summary Drill-Down Modal State
  const [summaryModalType, setSummaryModalType] = useState<
    'prospects' | 'appointments' | 'attendance' | 'leaves' | 'bonuses' | 'payroll' | null
  >(null);
  const [modalSearch, setModalSearch] = useState('');

  const [form] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [bonusForm] = Form.useForm();
  const [payrollForm] = Form.useForm();
  const [editPayrollForm] = Form.useForm();

  // Filtered dataset for Quick Operational Summary drill-down modal
  const filteredModalData = useMemo(() => {
    const q = modalSearch.trim().toLowerCase();
    switch (summaryModalType) {
      case 'prospects':
        return staffProspects.filter((p) => {
          if (!q) return true;
          return (
            `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
            p.phoneNumber?.toLowerCase().includes(q) ||
            p.address?.toLowerCase().includes(q) ||
            p.status?.toLowerCase().includes(q) ||
            p.source?.toLowerCase().includes(q)
          );
        });
      case 'appointments':
        return staffAppointments.filter((a) => {
          if (!q) return true;
          return (
            a.reason?.toLowerCase().includes(q) ||
            a.status?.toLowerCase().includes(q) ||
            a.source?.toLowerCase().includes(q) ||
            dayjs(a.scheduledFor).format('DD MMM YYYY').toLowerCase().includes(q)
          );
        });
      case 'attendance':
        return staffAttendance.filter((att) => {
          if (!q) return true;
          return (
            att.date?.toLowerCase().includes(q) ||
            att.status?.toLowerCase().includes(q) ||
            att.branchName?.toLowerCase().includes(q)
          );
        });
      case 'leaves':
        return staffLeaves.filter((lv) => {
          if (!q) return true;
          return (
            lv.leaveType?.toLowerCase().includes(q) ||
            lv.status?.toLowerCase().includes(q) ||
            lv.reason?.toLowerCase().includes(q)
          );
        });
      case 'bonuses':
        return bonuses.filter((b) => {
          if (!q) return true;
          return (
            b.reason?.toLowerCase().includes(q) ||
            b.ruleName?.toLowerCase().includes(q) ||
            b.status?.toLowerCase().includes(q)
          );
        });
      case 'payroll':
        return payrollRecords.filter((p) => {
          if (!q) return true;
          return p.month?.toLowerCase().includes(q) || p.status?.toLowerCase().includes(q);
        });
      default:
        return [];
    }
  }, [summaryModalType, modalSearch, staffProspects, staffAppointments, staffAttendance, staffLeaves, bonuses, payrollRecords]);

  // Activity stream combining prospects, appointments, deeds, attendance, leaves, and bonuses
  const activityList = useMemo(() => {
    const list: any[] = [];

    staffProspects.forEach((p) => {
      list.push({
        id: `prospect-${p.id}`,
        type: 'Prospect Registered',
        icon: <UserOutlined style={{ color: '#1890ff' }} />,
        title: `Registered Prospect: ${p.firstName} ${p.lastName}`,
        detail: `Status: ${p.status?.replace('_', ' ').toUpperCase()} | Source: ${p.source}`,
        date: p.createdAt,
      });
    });

    staffAppointments.forEach((a) => {
      list.push({
        id: `app-${a.id}`,
        type: 'Appointment Logged',
        icon: <CalendarOutlined style={{ color: '#faad14' }} />,
        title: `Scheduled Meeting with Client`,
        detail: `Date: ${dayjs(a.scheduledFor).format('MMM D, YYYY h:mm A')} | Status: ${a.status}`,
        date: a.createdAt,
      });
    });

    staffLeaves.forEach((lv) => {
      list.push({
        id: `leave-${lv.id}`,
        type: 'Leave Application',
        icon: <FileDoneOutlined style={{ color: '#ea580c' }} />,
        title: `Leave: ${lv.leaveType.toUpperCase()} (${lv.totalDays} Days)`,
        detail: `${lv.startDate} to ${lv.endDate} — Reason: ${lv.reason}`,
        date: lv.createdAt,
      });
    });

    staffDeeds.forEach((d) => {
      list.push({
        id: `deed-${d.id}`,
        type: 'Deed Generated',
        icon: <FileTextOutlined style={{ color: '#52c41a' }} />,
        title: `Generated Deed of Assignment`,
        detail: `Deed ID: ${(d.id || '').slice(0, 8)}`,
        date: d.createdAt,
      });
    });

    bonuses.forEach((b: any) => {
      list.push({
        id: `bonus-${b.id}`,
        type: 'Incentive Earned',
        icon: <TrophyOutlined style={{ color: '#faad14' }} />,
        title: `Earned Bonus: GH₵ ${b.amountGHS.toFixed(2)} (${bonusTypeLabels[b.bonusType as BonusType] || 'Bonus'})`,
        detail: b.reason || b.ruleName,
        date: b.earnedAt,
      });
    });

    return list.sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix());
  }, [staffProspects, staffAppointments, staffLeaves, staffDeeds, bonuses]);

  if (usersLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="Loading staff profile..." />
      </div>
    );
  }

  if (!staffMember) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          message="Staff Member Not Found"
          description="The requested staff profile does not exist or has been deleted."
          action={<Button type="primary" onClick={() => navigate('/admin/users')}>Back to User Management</Button>}
        />
      </div>
    );
  }

  const fullName = getUserFullName(staffMember);
  const phone = getUserPhone(staffMember);
  const roleName = roleLabels[staffMember.role as keyof typeof roleLabels] || staffMember.role;
  const branchTitle = assignedBranch ? assignedBranch.name : 'Head Office';

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleEditProfile = async (values: any) => {
    try {
      await updateUserMutation.mutateAsync({
        id: staffMember.id,
        payload: values,
      });
      message.success('Staff profile updated successfully');
      setEditProfileModal(false);
      refetchUsers();
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Failed to update profile');
    }
  };

  const handleAssignBranchDept = async (values: any) => {
    try {
      const branchObj = branches.find((b: any) => b.id === values.branchId);
      const deptName = deptLabels[values.departmentId] || values.departmentId;
      setStoredUserAssignment(staffMember.id, {
        branchId: values.branchId,
        branchName: branchObj?.name,
        departmentId: values.departmentId,
        departmentName: deptName,
        department: deptName,
        role: staffMember.role,
      });
      if (values.branchId) {
        recordEntityBranch('staff', staffMember.id, values.branchId);
      }
      await updateUserAssignmentMutation.mutateAsync({
        userId: staffMember.id,
        payload: {
          branchId: values.branchId,
          branchName: branchObj?.name,
          departmentId: values.departmentId,
          departmentName: deptName,
          department: deptName,
        },
      });
      message.success('Branch & Department assignment updated');
      setAssignModal(false);
    } catch (err: any) {
      message.error('Failed to update assignment');
    }
  };

  const handleManualBonus = async (values: any) => {
    try {
      const amountGHS = Number(values.amountGHS) || 0;
      await awardBonusMutation.mutateAsync({
        userId: staffMember.id,
        staffUserId: staffMember.id,
        staffName: fullName,
        branchId: assignedBranch?.id,
        amountGHS,
        amountMinor: Math.round(amountGHS * 100),
        bonusType: values.bonusType || 'custom_award',
        reason: values.reason,
      });
      message.success(`Bonus of GH₵ ${amountGHS.toFixed(2)} awarded to ${fullName}!`);
      setAddBonusModal(false);
      bonusForm.resetFields();
    } catch (err: any) {
      message.error(err?.message || 'Failed to award bonus');
    }
  };

  const handleCreatePayroll = async (values: any) => {
    try {
      await createPayrollMutation.mutateAsync({
        staffUserId: staffMember.id,
        month: values.month,
        baseSalaryMinor: Math.round(values.basePayGHS * 100),
        bonusMinor: Math.round((values.bonusGHS || 0) * 100),
        deductionsMinor: Math.round((values.deductionsGHS || 0) * 100),
        notes: values.notes,
      });
      message.success('Payroll record created successfully');
      setAddPayrollModal(false);
      payrollForm.resetFields();
      refetchPayroll();
    } catch (err: any) {
      message.error('Failed to create payroll');
    }
  };

  const handleEditPayroll = async (values: any) => {
    if (!selectedPayroll) return;
    try {
      await updatePayrollMutation.mutateAsync({
        id: selectedPayroll.id,
        payload: {
          baseSalaryMinor: Math.round(values.basePayGHS * 100),
          bonusMinor: Math.round((values.bonusGHS || 0) * 100),
          deductionsMinor: Math.round((values.deductionsGHS || 0) * 100),
          notes: values.notes,
          status: values.status,
        },
      });
      message.success('Payroll record updated');
      setEditPayrollModal(false);
      setSelectedPayroll(null);
      refetchPayroll();
    } catch (err: any) {
      message.error('Failed to update payroll');
    }
  };

  const handleApprovePayroll = async (record: PayrollRecord) => {
    try {
      await updatePayrollMutation.mutateAsync({
        id: record.id,
        payload: { status: 'approved' },
      });
      message.success(`Payroll for ${record.month} approved by Administrator.`);
      refetchPayroll();
    } catch (err: any) {
      message.error('Failed to approve payroll');
    }
  };

  const payrollColumns = [
    { title: 'Month', dataIndex: 'month', key: 'month', render: (v: string) => <Tag color="blue">{v}</Tag> },
    {
      title: 'Base Salary',
      key: 'base',
      render: (_: any, r: PayrollRecord) => `GH₵ ${(r.baseSalaryMinor / 100).toLocaleString()}`,
    },
    {
      title: 'Bonus / Commission',
      key: 'bonus',
      render: (_: any, r: PayrollRecord) => (
        <Tag color="green" style={{ fontWeight: 600 }}>
          + GH₵ {((r.bonusMinor || 0) / 100).toLocaleString()}
        </Tag>
      ),
    },
    {
      title: 'Deductions',
      key: 'deductions',
      render: (_: any, r: PayrollRecord) => (
        <span style={{ color: '#cf1322' }}>
          - GH₵ {(((r.deductionsMinor || 0)) / 100).toLocaleString()}
        </span>
      ),
    },
    {
      title: 'Net Salary',
      key: 'net',
      render: (_: any, r: PayrollRecord) => (
        <strong style={{ color: tokens.primary, fontSize: 14 }}>
          GH₵ {(r.netSalaryMinor / 100).toLocaleString()}
        </strong>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, r: PayrollRecord) => {
        if (r.status === 'pending') {
          return <Tag color="gold">⏳ Pending Admin Approval</Tag>;
        }
        if (r.status === 'approved') {
          return <Tag color="blue">✅ Approved (Ready to Pay)</Tag>;
        }
        return <Tag color="green">💳 Paid & Disbursed</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: PayrollRecord) => (
        <Space size="small">
          <Button
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => {
              setPayslipRecord(r);
              setPayslipModalOpen(true);
            }}
          >
            Payslip
          </Button>

          {isAdmin && r.status === 'pending' && (
            <Button
              type="primary"
              size="small"
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
              onClick={() => handleApprovePayroll(r)}
            >
              Approve
            </Button>
          )}

          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedPayroll(r);
              editPayrollForm.setFieldsValue({
                basePayGHS: r.baseSalaryMinor / 100,
                bonusGHS: (r.bonusMinor || 0) / 100,
                deductionsGHS: (r.deductionsMinor || 0) / 100,
                notes: r.notes || '',
                status: r.status,
              });
              setEditPayrollModal(true);
            }}
          >
            Edit
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden', padding: '0 4px' }}>
      <PageHeader
        title={`${fullName} — Staff Profile`}
        actions={[
          {
            label: 'Back to Staff Directory',
            onClick: () => navigate('/admin/users'),
            icon: <ArrowLeftOutlined />,
            type: 'default',
          },
          {
            label: 'View Prospects & Interactions',
            onClick: () => {
              setDrawerActiveTab('prospects');
              setProspectsDrawerOpen(true);
            },
            icon: <TeamOutlined />,
            type: 'primary',
          },
          ...(isManager
            ? [
                {
                  label: 'Compensation Setup',
                  onClick: () => setCompensationModalOpen(true),
                  icon: <DollarOutlined />,
                },
              ]
            : []),
          {
            label: 'Edit Profile',
            onClick: () => {
              form.setFieldsValue({
                firstName: staffMember.firstName,
                lastName: staffMember.lastName,
                email: staffMember.email,
                phoneNumber: phone,
                role: staffMember.role,
              });
              setEditProfileModal(true);
            },
            icon: <EditOutlined />,
          },
          {
            label: 'Assign Branch/Dept',
            onClick: () => {
              assignForm.setFieldsValue({
                branchId: effectiveBranchId,
                departmentId: effectiveDeptId,
              });
              setAssignModal(true);
            },
            icon: <EnvironmentOutlined />,
          },
          {
            label: 'Award Bonus',
            onClick: () => {
              bonusForm.resetFields();
              setAddBonusModal(true);
            },
            icon: <TrophyOutlined />,
          },
        ]}
      />

      {/* ── PROFILE HEADER HERO CARD ────────────────────────────────────── */}
      <Card style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} sm={6} md={4} style={{ textAlign: 'center' }}>
            <PhotoUpload entityType="staff" entityId={staffMember.id} size={100} />
          </Col>
          <Col xs={24} sm={18} md={12}>
            <Space direction="vertical" size={4}>
              <Space align="center">
                <Title level={3} style={{ margin: 0 }}>{fullName}</Title>
                <Badge
                  status={staffMember.isActive ? 'success' : 'error'}
                  text={staffMember.isActive ? 'Active Staff' : 'Inactive'}
                />
              </Space>
              <Space wrap size={[6, 6]}>
                <Tag color={getRoleColor(staffMember.role as Role)} icon={<span>{getRoleIcon(staffMember.role as Role)}</span>} style={{ fontSize: 13, padding: '3px 10px', borderRadius: 12 }}>
                  {roleName}
                </Tag>
                <Tag color="cyan" icon={<EnvironmentOutlined />} style={{ fontSize: 13, padding: '3px 10px', borderRadius: 12 }}>
                  {branchTitle}
                </Tag>
                {effectiveDeptName && (
                  <Tag color="purple" style={{ fontSize: 13, padding: '3px 10px', borderRadius: 12 }}>
                    {effectiveDeptName}
                  </Tag>
                )}
                {compProfile && (
                  <Tag color="blue" style={{ fontSize: 13, padding: '3px 10px', borderRadius: 12 }}>
                    {salaryTypeLabels[compProfile.salaryType] || 'Fixed Salary'}
                  </Tag>
                )}
              </Space>
              <Space size={16} style={{ marginTop: 8 }} wrap>
                <Text><MailOutlined /> <a href={`mailto:${staffMember.email}`}>{staffMember.email}</a></Text>
                <Text><PhoneOutlined /> <a href={`tel:${phone}`}>{phone || 'N/A'}</a></Text>
              </Space>
            </Space>
          </Col>
          <Col xs={24} md={8}>
            <Card size="small" style={{ background: '#f8fafc', borderRadius: 8, borderColor: '#e2e8f0' }}>
              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <Statistic
                    title="Total Bonuses"
                    value={totalBonusGHS}
                    prefix="GH₵"
                    precision={2}
                    valueStyle={{ color: '#52c41a', fontWeight: 600, fontSize: 18 }}
                  />
                </Col>
                <Col span={12}>
                  <Card
                    size="small"
                    hoverable
                    onClick={() => {
                      setDrawerActiveTab('prospects');
                      setProspectsDrawerOpen(true);
                    }}
                    style={{
                      background: '#f0f5ff',
                      borderColor: '#adc6ff',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <Statistic
                      title={
                        <Space>
                          <Text strong style={{ color: '#1d39c4' }}>Total Prospects</Text>
                          <EyeOutlined style={{ color: '#2f54eb' }} />
                        </Space>
                      }
                      value={staffProspects.length}
                      prefix={<TeamOutlined style={{ color: '#1890ff' }} />}
                      valueStyle={{ color: '#1890ff', fontWeight: 600, fontSize: 18 }}
                      suffix={
                        <Button
                          size="small"
                          type="link"
                          icon={<EyeOutlined />}
                          style={{ padding: '0 0 0 6px', fontSize: 12, fontWeight: 600 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDrawerActiveTab('prospects');
                            setProspectsDrawerOpen(true);
                          }}
                        >
                          View
                        </Button>
                      }
                    />
                  </Card>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* ── TABS NAVIGATION ──────────────────────────────────────────────── */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        size="middle"
        items={[
          {
            key: 'overview',
            label: <span><UserOutlined /> Overview & Info</span>,
            children: (
              <Row gutter={[16, 16]}>
                {/* ── Top: Full-Width Personal & Employment Details ── */}
                <Col xs={24}>
                  <Card title="Personal & Employment Details" style={{ borderRadius: 8 }}>
                    <Descriptions
                      column={{ xs: 1, sm: 2, md: 2, lg: 3 }}
                      bordered
                      size="middle"
                      labelStyle={{ fontWeight: 600, width: '160px', minWidth: 120, wordBreak: 'break-word' }}
                      contentStyle={{ wordBreak: 'break-word' }}
                    >
                      <Descriptions.Item label="Staff ID">
                        <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{staffMember.id}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="Full Name">{fullName}</Descriptions.Item>
                      <Descriptions.Item label="Email Address">
                        <a href={`mailto:${staffMember.email}`} style={{ wordBreak: 'break-all' }}>{staffMember.email}</a>
                      </Descriptions.Item>
                      <Descriptions.Item label="Phone Number">{phone || '—'}</Descriptions.Item>
                      <Descriptions.Item label="Primary Role">
                        <Tag color={getRoleColor(staffMember.role as Role)}>{roleName}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Assigned Branch">{branchTitle}</Descriptions.Item>
                      <Descriptions.Item label="Department">
                        {effectiveDeptName || 'General Operations'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Salary Structure">
                        <Tag color="blue">
                          {salaryTypeLabels[compProfile?.salaryType || 'monthly'] || 'Monthly'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Base Pay">
                        <strong>GH₵ {(compProfile?.baseSalaryGHS || 0).toLocaleString()}</strong> / {compProfile?.payFrequency || 'month'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Disbursement">
                        <span>{paymentMethodLabels[compProfile?.paymentMethod || 'bank_transfer'] || 'Bank Transfer'}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="Account Status">
                        {staffMember.isActive ? <Tag color="green">Active Account</Tag> : <Tag color="red">Suspended / Inactive</Tag>}
                      </Descriptions.Item>
                      <Descriptions.Item label="Member Since">
                        {dayjs(staffMember.createdAt).format('MMMM D, YYYY')}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>

                {/* ── Bottom: Quick Operational Summary ── */}
                <Col xs={24}>
                  <Card
                    title={
                      <Space>
                        <ThunderboltOutlined style={{ fontSize: 18, color: '#f59e0b' }} />
                        <div>
                          <Text strong style={{ fontSize: 16 }}>Quick Operational Summary</Text>
                          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>
                            Live operational performance metrics for {fullName}. Click any card to inspect full records.
                          </div>
                        </div>
                      </Space>
                    }
                    style={{ borderRadius: 12 }}
                  >
                    <Row gutter={[16, 16]}>
                      {/* 1. Prospects */}
                      <Col xs={12} sm={8} md={4}>
                        <Card
                          hoverable
                          size="small"
                          onClick={() => {
                            setModalSearch('');
                            setSummaryModalType('prospects');
                          }}
                          style={{
                            cursor: 'pointer',
                            borderRadius: 8,
                            border: '1px solid #bbf7d0',
                            background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)',
                            textAlign: 'center',
                            transition: 'all 0.2s',
                          }}
                        >
                          <UserOutlined style={{ fontSize: 24, color: '#16a34a', marginBottom: 8 }} />
                          <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
                            {staffProspects.length}
                          </div>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                            Assigned Prospects
                          </Text>
                          <Tag color="green" style={{ marginTop: 6, fontSize: 10, borderRadius: 4 }}>
                            View List &rarr;
                          </Tag>
                        </Card>
                      </Col>

                      {/* 2. Appointments */}
                      <Col xs={12} sm={8} md={4}>
                        <Card
                          hoverable
                          size="small"
                          onClick={() => {
                            setModalSearch('');
                            setSummaryModalType('appointments');
                          }}
                          style={{
                            cursor: 'pointer',
                            borderRadius: 8,
                            border: '1px solid #ddd6fe',
                            background: 'linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%)',
                            textAlign: 'center',
                            transition: 'all 0.2s',
                          }}
                        >
                          <CalendarOutlined style={{ fontSize: 24, color: '#722ed1', marginBottom: 8 }} />
                          <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
                            {staffAppointments.length}
                          </div>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                            Appointments
                          </Text>
                          <Tag color="purple" style={{ marginTop: 6, fontSize: 10, borderRadius: 4 }}>
                            View List &rarr;
                          </Tag>
                        </Card>
                      </Col>

                      {/* 3. Attendance */}
                      <Col xs={12} sm={8} md={4}>
                        <Card
                          hoverable
                          size="small"
                          onClick={() => {
                            setModalSearch('');
                            setSummaryModalType('attendance');
                          }}
                          style={{
                            cursor: 'pointer',
                            borderRadius: 8,
                            border: '1px solid #99f6e4',
                            background: 'linear-gradient(180deg, #f0fdfa 0%, #ffffff 100%)',
                            textAlign: 'center',
                            transition: 'all 0.2s',
                          }}
                        >
                          <ClockCircleOutlined style={{ fontSize: 24, color: '#0d9488', marginBottom: 8 }} />
                          <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
                            {staffAttendance.length}
                          </div>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                            Verified Shifts
                          </Text>
                          <Tag color="cyan" style={{ marginTop: 6, fontSize: 10, borderRadius: 4 }}>
                            View List &rarr;
                          </Tag>
                        </Card>
                      </Col>

                      {/* 4. Leaves */}
                      <Col xs={12} sm={8} md={4}>
                        <Card
                          hoverable
                          size="small"
                          onClick={() => {
                            setModalSearch('');
                            setSummaryModalType('leaves');
                          }}
                          style={{
                            cursor: 'pointer',
                            borderRadius: 8,
                            border: '1px solid #fed7aa',
                            background: 'linear-gradient(180deg, #fff7ed 0%, #ffffff 100%)',
                            textAlign: 'center',
                            transition: 'all 0.2s',
                          }}
                        >
                          <FileDoneOutlined style={{ fontSize: 24, color: '#ea580c', marginBottom: 8 }} />
                          <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
                            {staffLeaves.length}
                          </div>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                            Leave Requests
                          </Text>
                          <Tag color="orange" style={{ marginTop: 6, fontSize: 10, borderRadius: 4 }}>
                            View List &rarr;
                          </Tag>
                        </Card>
                      </Col>

                      {/* 5. Bonuses */}
                      <Col xs={12} sm={8} md={4}>
                        <Card
                          hoverable
                          size="small"
                          onClick={() => {
                            setModalSearch('');
                            setSummaryModalType('bonuses');
                          }}
                          style={{
                            cursor: 'pointer',
                            borderRadius: 8,
                            border: '1px solid #bbf7d0',
                            background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)',
                            textAlign: 'center',
                            transition: 'all 0.2s',
                          }}
                        >
                          <TrophyOutlined style={{ fontSize: 24, color: '#16a34a', marginBottom: 8 }} />
                          <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
                            {bonuses.length}
                          </div>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                            Bonuses ({bonuses.length})
                          </Text>
                          <Tag color="green" style={{ marginTop: 6, fontSize: 10, borderRadius: 4 }}>
                            View List &rarr;
                          </Tag>
                        </Card>
                      </Col>

                      {/* 6. Payroll */}
                      <Col xs={12} sm={8} md={4}>
                        <Card
                          hoverable
                          size="small"
                          onClick={() => {
                            setModalSearch('');
                            setSummaryModalType('payroll');
                          }}
                          style={{
                            cursor: 'pointer',
                            borderRadius: 8,
                            border: '1px solid #bfdbfe',
                            background: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)',
                            textAlign: 'center',
                            transition: 'all 0.2s',
                          }}
                        >
                          <DollarOutlined style={{ fontSize: 24, color: '#2563eb', marginBottom: 8 }} />
                          <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
                            {payrollRecords.length}
                          </div>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                            Payroll Runs
                          </Text>
                          <Tag color="blue" style={{ marginTop: 6, fontSize: 10, borderRadius: 4 }}>
                            View List &rarr;
                          </Tag>
                        </Card>
                      </Col>
                    </Row>
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'compensation',
            label: <span><CreditCardOutlined /> Compensation & Benefits</span>,
            children: (
              <Card
                title="Staff Compensation Package & Allowances"
                extra={
                  <Button type="primary" icon={<EditOutlined />} onClick={() => setCompensationModalOpen(true)}>
                    Edit Compensation Package
                  </Button>
                }
              >
                <Row gutter={[24, 24]}>
                  <Col xs={24} md={12}>
                    <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, height: '100%' }}>
                      <Text strong style={{ fontSize: 14, color: '#1e293b', display: 'block', marginBottom: 12 }}>
                        💼 Salary Structure & Base Pay
                      </Text>
                      <Descriptions column={1} size="small" bordered>
                        <Descriptions.Item label="Structure Type">
                          <Tag color="blue">
                            {salaryTypeLabels[compProfile?.salaryType || 'monthly'] || 'Fixed Monthly Salary'}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Base Salary">
                          <strong>GH₵ {(compProfile?.baseSalaryGHS || 0).toLocaleString()}</strong> ({compProfile?.payFrequency || 'monthly'})
                        </Descriptions.Item>
                        <Descriptions.Item label="Sales Commission">
                          {(compProfile?.commissionRatePct || 0) > 0 ? `${compProfile?.commissionRatePct}% per closed sale` : 'None configured'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Disbursement Method">
                          <span>{paymentMethodLabels[compProfile?.paymentMethod || 'bank_transfer'] || 'Bank Transfer'}</span>
                          {compProfile?.bankAccountNumber && (
                            <div><Text type="secondary">Acct: {compProfile.bankAccountNumber} ({compProfile.bankName || 'Bank'})</Text></div>
                          )}
                          {compProfile?.momoNumber && (
                            <div><Text type="secondary">MoMo: {compProfile.momoNumber} ({compProfile.momoNetwork})</Text></div>
                          )}
                        </Descriptions.Item>
                      </Descriptions>
                    </div>
                  </Col>

                  <Col xs={24} md={12}>
                    <div style={{ background: '#f6ffed', padding: 16, borderRadius: 8, height: '100%', border: '1px solid #b7eb8f' }}>
                      <Text strong style={{ fontSize: 14, color: '#237804', display: 'block', marginBottom: 12 }}>
                        ➕ Monthly Allowances & Fixed Deductions
                      </Text>
                      <Descriptions column={1} size="small" bordered>
                        <Descriptions.Item label="Recurring Allowances">
                          {compProfile?.recurringAllowances && compProfile.recurringAllowances.length > 0
                            ? compProfile.recurringAllowances.map(a => `${a.name}: GH₵ ${a.amountGHS}`).join(', ')
                            : 'None'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Recurring Deductions">
                          {compProfile?.recurringDeductions && compProfile.recurringDeductions.length > 0
                            ? compProfile.recurringDeductions.map(d => `${d.name}: GH₵ ${d.amountGHS}`).join(', ')
                            : 'None'}
                        </Descriptions.Item>
                        <Descriptions.Item label="SSNIT / TIN">
                          {compProfile?.ssnitNumber || compProfile?.tinNumber ? `SSNIT: ${compProfile?.ssnitNumber || '—'} / TIN: ${compProfile?.tinNumber || '—'}` : 'Not recorded'}
                        </Descriptions.Item>
                      </Descriptions>
                    </div>
                  </Col>
                </Row>
              </Card>
            ),
          },
          {
            key: 'bonuses',
            label: <span><TrophyOutlined /> Bonuses & Commission ({bonuses.length})</span>,
            children: (
              <Card
                title="Staff Commission & Bonus Log"
                extra={
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddBonusModal(true)}>
                    Award Direct Bonus
                  </Button>
                }
              >
                {bonuses.length > 0 ? (
                  <List
                    itemLayout="horizontal"
                    dataSource={bonuses}
                    renderItem={(b: StaffBonusRecord) => {
                      const typeInfo = bonusTypeLabels[b.bonusType] || b.bonusType;
                      return (
                        <List.Item
                          extra={
                            <div style={{ textAlign: 'right' }}>
                              <Tag color="green" style={{ fontSize: 14, fontWeight: 700, padding: '4px 12px' }}>
                                + GH₵ {b.amountGHS.toFixed(2)}
                              </Tag>
                              <div>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {dayjs(b.earnedAt).format('MMM D, YYYY h:mm A')}
                                </Text>
                              </div>
                            </div>
                          }
                        >
                          <List.Item.Meta
                            avatar={<Avatar icon={<TrophyOutlined />} style={{ backgroundColor: '#f6ffed', color: '#52c41a' }} />}
                            title={
                              <Space>
                                <Text strong style={{ fontSize: 14 }}>{b.ruleName || 'Performance Bonus'}</Text>
                                <Tag color="blue">{typeInfo}</Tag>
                              </Space>
                            }
                            description={b.reason || 'Qualifying staff incentive event.'}
                          />
                        </List.Item>
                      );
                    }}
                  />
                ) : (
                  <Empty description="No bonus transactions awarded to this staff member yet." />
                )}
              </Card>
            ),
          },
          {
            key: 'payroll',
            label: <span><DollarOutlined /> Payroll & Salary ({payrollRecords.length})</span>,
            children: (
              <Card
                title="Payroll & Compensation Statements"
                extra={
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddPayrollModal(true)}>
                    Add Payroll Record
                  </Button>
                }
              >
                <Table
                  columns={payrollColumns}
                  dataSource={payrollRecords}
                  rowKey="id"
                  loading={payrollLoading}
                  pagination={false}
                  size="middle"
                  scroll={{ x: 800 }}
                />
              </Card>
            ),
          },
          {
            key: 'activity',
            label: <span><AuditOutlined /> Activity & Audit Log ({activityList.length})</span>,
            children: (
              <Card title="Activity Timeline">
                {activityList.length > 0 ? (
                  <List
                    dataSource={activityList}
                    renderItem={(item) => (
                      <List.Item
                        extra={<Text type="secondary" style={{ fontSize: 12 }}>{dayjs(item.date).format('MMM D, YYYY h:mm A')}</Text>}
                      >
                        <List.Item.Meta
                          avatar={<Avatar style={{ background: '#f0f2f5' }}>{item.icon}</Avatar>}
                          title={<Text strong>{item.title}</Text>}
                          description={item.detail}
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="No logged activities found for this staff member." />
                )}
              </Card>
            ),
          },
          {
            key: 'prospects',
            label: <span><TeamOutlined /> Prospects & Interactions ({staffProspects.length})</span>,
            children: (
              <div>
                <Card
                  title={
                    <Space>
                      <TeamOutlined style={{ color: tokens.primary }} />
                      <span>{fullName} — Prospects Portfolio ({staffProspects.length})</span>
                    </Space>
                  }
                  extra={
                    <Space>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => navigate('/marketing/prospects')}
                      >
                        Add Prospect
                      </Button>
                      <Button
                        icon={<EyeOutlined />}
                        onClick={() => {
                          setDrawerActiveTab('interactions');
                          setProspectsDrawerOpen(true);
                        }}
                      >
                        View Interactions
                      </Button>
                    </Space>
                  }
                >
                  {staffProspects.length > 0 ? (
                    <Table
                      columns={[
                        {
                          title: 'Prospect Name',
                          key: 'name',
                          render: (_: any, p: any) => (
                            <Space>
                              <PhotoUpload entityType="prospect" entityId={p.id} size={28} editable={false} />
                              <a onClick={() => navigate(p.source === 'customer_service' ? '/cs/prospects' : `/marketing/prospects/${p.id}`)}>
                                {p.firstName} {p.lastName}
                              </a>
                            </Space>
                          ),
                        },
                        { title: 'Phone', dataIndex: 'phoneNumber', key: 'phone' },
                        {
                          title: 'Source',
                          dataIndex: 'source',
                          key: 'source',
                          render: (s: string) => (
                            <Tag color={s === 'customer_service' ? 'green' : 'blue'}>
                              {s === 'customer_service' ? 'Customer Service' : 'Marketing'}
                            </Tag>
                          ),
                        },
                        {
                          title: 'Status',
                          dataIndex: 'status',
                          key: 'status',
                          render: (v: string) => (
                            <Tag color={v === 'purchased' ? 'green' : v === 'meeting_scheduled' ? 'purple' : v === 'postponed' ? 'gold' : 'blue'}>
                              {(v || 'NEW').replace('_', ' ').toUpperCase()}
                            </Tag>
                          ),
                        },
                        {
                          title: 'Role / Relation',
                          key: 'relation',
                          render: (_: any, p: any) => {
                            const isCreator = p.createdByUserId === id || (p as any).creatorId === id;
                            return (
                              <Tag color={isCreator ? 'cyan' : 'geekblue'}>
                                {isCreator ? 'Added by Staff' : 'Assigned to Staff'}
                              </Tag>
                            );
                          },
                        },
                        { title: 'Date Registered', dataIndex: 'createdAt', key: 'date', render: (v: string) => dayjs(v).format('MMM D, YYYY') },
                        {
                          title: 'Action',
                          key: 'action',
                          render: (_: any, p: any) => (
                            <Button
                              size="small"
                              icon={<EyeOutlined />}
                              onClick={() => navigate(p.source === 'customer_service' ? '/cs/prospects' : `/marketing/prospects/${p.id}`)}
                            >
                              View Details
                            </Button>
                          ),
                        },
                      ]}
                      dataSource={staffProspects}
                      rowKey="id"
                      pagination={{ pageSize: 5 }}
                      size="small"
                      scroll={{ x: 700 }}
                    />
                  ) : (
                    <Empty description="No prospects assigned to or added by this staff member." />
                  )}
                </Card>

                {/* Inline Interaction History Timeline Section */}
                <div style={{ marginTop: 24 }}>
                  <ProspectInteractionsTimeline
                    defaultStaffId={id}
                    title={`Interaction History Timeline — ${fullName}`}
                  />
                </div>
              </div>
            ),
          },
          {
            key: 'attendance',
            label: <span><ClockCircleOutlined /> Attendance & Shifts ({staffAttendance.length})</span>,
            children: (
              <div>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #52c41a' }}>
                      <Statistic
                        title="Monthly Attendance Rate"
                        value={attendanceStats?.attendanceRate ?? 100}
                        suffix="%"
                        valueStyle={{ color: '#52c41a', fontWeight: 700 }}
                      />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {attendanceStats?.daysPresent ?? 0} days present
                      </Text>
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #faad14' }}>
                      <Statistic
                        title="Punctuality Score"
                        value={attendanceStats?.punctualityRate ?? 100}
                        suffix="%"
                        valueStyle={{ color: (attendanceStats?.punctualityRate ?? 100) >= 90 ? '#52c41a' : '#faad14', fontWeight: 700 }}
                      />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {attendanceStats?.daysLate ?? 0} late arrivals
                      </Text>
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #2E5E8C' }}>
                      <Statistic
                        title="Total Hours Logged"
                        value={attendanceStats?.totalWorkHours ?? 0}
                        suffix="hrs"
                        valueStyle={{ color: '#2E5E8C', fontWeight: 700 }}
                      />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Standard 8.0 hrs/day shift basis
                      </Text>
                    </Card>
                  </Col>
                </Row>

                <Card title="Attendance Punch Records">
                  {staffAttendance.length > 0 ? (
                    <Table
                      columns={[
                        {
                          title: 'Date',
                          dataIndex: 'date',
                          key: 'date',
                          render: (d: string) => dayjs(d).format('DD MMM YYYY'),
                        },
                        {
                          title: 'Clock In',
                          dataIndex: 'clockInTime',
                          key: 'clockInTime',
                          render: (t: string, r: AttendanceRecord) => (
                            t ? (
                              <span>
                                {dayjs(t).format('hh:mm A')}
                                {r.isLate && <Tag color="warning" style={{ marginLeft: 4 }}>Late</Tag>}
                              </span>
                            ) : '—'
                          ),
                        },
                        {
                          title: 'Clock Out',
                          dataIndex: 'clockOutTime',
                          key: 'clockOutTime',
                          render: (t: string) => (t ? dayjs(t).format('hh:mm A') : '—'),
                        },
                        {
                          title: 'Duration',
                          dataIndex: 'workDurationMinutes',
                          key: 'workDurationMinutes',
                          render: (m: number) => (m ? `${Math.floor(m / 60)}h ${m % 60}m` : '—'),
                        },
                        {
                          title: 'Status',
                          dataIndex: 'status',
                          key: 'status',
                          render: (st: AttendanceStatus) => {
                            const meta = ATTENDANCE_STATUS_META[st] || ATTENDANCE_STATUS_META.present;
                            return <Tag color={meta.color}>{meta.icon} {meta.label}</Tag>;
                          },
                        },
                        {
                          title: 'GPS Verification',
                          key: 'gps',
                          render: (_: any, r: AttendanceRecord) => (
                            r.clockInGps ? <span>📍 {r.clockInGps.distanceFromBranchMeters}m from office</span> : <Text type="secondary">—</Text>
                          ),
                        },
                      ]}
                      dataSource={staffAttendance}
                      rowKey="id"
                      pagination={{ pageSize: 5 }}
                      size="small"
                    />
                  ) : (
                    <Empty description="No attendance punches logged yet." />
                  )}
                </Card>
              </div>
            ),
          },
        ]}
      />

      {/* ── EDIT PROFILE MODAL ────────────────────────────────────────────── */}
      <Modal
        title="Edit Staff Member Details"
        open={editProfileModal}
        onCancel={() => setEditProfileModal(false)}
        footer={null}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleEditProfile}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="firstName" label="First Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="lastName" label="Last Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="email" label="Email Address" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phoneNumber" label="Phone Number">
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select>
              <Option value="admin">Administrator</Option>
              <Option value="branch_manager">Branch Manager</Option>
              <Option value="marketing_staff">Marketing Staff</Option>
              <Option value="marketing_director">Marketing Director</Option>
              <Option value="customer_service">Customer Service</Option>
              <Option value="secretary">Secretary</Option>
              <Option value="accounts">Accounts</Option>
            </Select>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setEditProfileModal(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={updateUserMutation.isPending}>Save Changes</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── ASSIGN BRANCH & DEPT MODAL ────────────────────────────────────── */}
      <Modal
        title="Assign Branch & Department"
        open={assignModal}
        onCancel={() => setAssignModal(false)}
        footer={null}
        width={480}
      >
        <Form form={assignForm} layout="vertical" onFinish={handleAssignBranchDept}>
          <Form.Item name="branchId" label="Assigned Branch" rules={[{ required: true }]}>
            <Select>
              {branches.map((b: any) => (
                <Option key={b.id} value={b.id}>
                  🏢 {b.name} ({b.code})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="departmentId" label="Department" rules={[{ required: true }]}>
            <Select>
              {Object.entries(deptLabels).map(([id, name]) => (
                <Option key={id} value={id}>
                  {name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAssignModal(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Save Assignment</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── AWARD BONUS MODAL ────────────────────────────────────────────── */}
      <Modal
        title={`Award Bonus / Incentive to ${fullName}`}
        open={addBonusModal}
        onCancel={() => setAddBonusModal(false)}
        footer={null}
        width={500}
      >
        <Form form={bonusForm} layout="vertical" onFinish={handleManualBonus}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="bonusType" label="Bonus Category" rules={[{ required: true }]} initialValue="sales_bonus">
                <Select>
                  {Object.entries(bonusTypeLabels).map(([k, v]) => (
                    <Option key={k} value={k}>{v}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="amountGHS" label="Amount (GH₵)" rules={[{ required: true }]} initialValue={300}>
                <InputNumber min={0} prefix="GH₵" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reason" label="Award Reason / Target Achieved" rules={[{ required: true }]}>
            <TextArea rows={2} placeholder="e.g. Executed plot sales contract or met monthly attendance quota..." />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAddBonusModal(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Award Incentive
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── ADD PAYROLL RECORD MODAL ──────────────────────────────────────── */}
      <Modal
        title={`Create Payroll Record — ${fullName}`}
        open={addPayrollModal}
        onCancel={() => setAddPayrollModal(false)}
        footer={null}
        width={520}
      >
        <Form form={payrollForm} layout="vertical" onFinish={handleCreatePayroll}>
          <Form.Item name="month" label="Month (YYYY-MM)" rules={[{ required: true }]} initialValue={dayjs().format('YYYY-MM')}>
            <Input placeholder="e.g. 2026-09" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="basePayGHS" label="Base Salary (GH₵)" rules={[{ required: true }]} initialValue={compProfile?.baseSalaryGHS || 3500}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="bonusGHS" label="Bonus (GH₵)" initialValue={totalBonusGHS}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="deductionsGHS" label="Deductions (GH₵)" initialValue={0}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAddPayrollModal(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={createPayrollMutation.isPending}>
                Submit Payroll
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── EDIT PAYROLL MODAL ────────────────────────────────────────────── */}
      <Modal
        title="Edit Payroll Record"
        open={editPayrollModal}
        onCancel={() => setEditPayrollModal(false)}
        footer={null}
        width={520}
      >
        <Form form={editPayrollForm} layout="vertical" onFinish={handleEditPayroll}>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="basePayGHS" label="Base Salary (GH₵)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="bonusGHS" label="Bonus (GH₵)">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="deductionsGHS" label="Deductions (GH₵)">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="status" label="Approval Status">
            <Select>
              <Option value="pending">⏳ Pending Admin Approval</Option>
              <Option value="approved">✅ Approved</Option>
              <Option value="paid">💳 Paid & Disbursed</Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setEditPayrollModal(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={updatePayrollMutation.isPending}>
                Save Changes
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── QUICK OPERATIONAL SUMMARY DETAIL MODAL ───────────────────────── */}
      <Modal
        title={
          <Space>
            {summaryModalType === 'prospects' && <UserOutlined style={{ color: '#16a34a' }} />}
            {summaryModalType === 'appointments' && <CalendarOutlined style={{ color: '#722ed1' }} />}
            {summaryModalType === 'attendance' && <ClockCircleOutlined style={{ color: '#0d9488' }} />}
            {summaryModalType === 'leaves' && <FileDoneOutlined style={{ color: '#ea580c' }} />}
            {summaryModalType === 'bonuses' && <TrophyOutlined style={{ color: '#16a34a' }} />}
            {summaryModalType === 'payroll' && <DollarOutlined style={{ color: '#2563eb' }} />}
            <span style={{ textTransform: 'capitalize' }}>
              {summaryModalType === 'prospects' && 'Assigned Prospects & Leads'}
              {summaryModalType === 'appointments' && 'Scheduled Appointments & Meetings'}
              {summaryModalType === 'attendance' && 'Verified Shifts & Attendance Punches'}
              {summaryModalType === 'leaves' && 'Staff Leave Applications'}
              {summaryModalType === 'bonuses' && 'Commissions & Bonuses Earned'}
              {summaryModalType === 'payroll' && 'Salary Slips & Payroll Records'}
              {' '}({filteredModalData.length})
            </span>
          </Space>
        }
        open={summaryModalType !== null}
        onCancel={() => {
          setSummaryModalType(null);
          setModalSearch('');
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Showing {filteredModalData.length} records for {fullName}
            </Text>
            <Space>
              {summaryModalType === 'prospects' && (
                <Button
                  onClick={() => {
                    setActiveTab('prospects');
                    setSummaryModalType(null);
                  }}
                >
                  Open in Prospects Tab &rarr;
                </Button>
              )}
              {summaryModalType === 'attendance' && (
                <Button
                  onClick={() => {
                    setActiveTab('attendance');
                    setSummaryModalType(null);
                  }}
                >
                  Open in Attendance Tab &rarr;
                </Button>
              )}
              {summaryModalType === 'bonuses' && (
                <Button
                  onClick={() => {
                    setActiveTab('bonuses');
                    setSummaryModalType(null);
                  }}
                >
                  Open in Bonuses Tab &rarr;
                </Button>
              )}
              {summaryModalType === 'payroll' && (
                <Button
                  onClick={() => {
                    setActiveTab('payroll');
                    setSummaryModalType(null);
                  }}
                >
                  Open in Payroll Tab &rarr;
                </Button>
              )}
              <Button type="primary" onClick={() => setSummaryModalType(null)}>Close</Button>
            </Space>
          </div>
        }
        width={900}
        destroyOnClose
      >
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Search records by keyword, name, contact, reason, or status..."
          value={modalSearch}
          onChange={(e) => setModalSearch(e.target.value)}
          allowClear
          style={{ marginBottom: 16 }}
        />

        {/* Prospects Table */}
        {summaryModalType === 'prospects' && (
          <Table
            size="small"
            dataSource={filteredModalData}
            rowKey="id"
            pagination={{ pageSize: 8 }}
            columns={[
              {
                title: 'Prospect Name',
                key: 'name',
                render: (_: any, r: any) => <strong>{r.firstName} {r.lastName}</strong>,
              },
              {
                title: 'Contact',
                key: 'contact',
                render: (_: any, r: any) => (
                  <div>
                    <div>{r.phoneNumber || '—'}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{r.address || ''}</div>
                  </div>
                ),
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                render: (v: string) => (
                  <Tag color={v === 'purchased' ? 'green' : v === 'meeting_scheduled' ? 'purple' : 'blue'}>
                    {(v || 'NEW').replace('_', ' ').toUpperCase()}
                  </Tag>
                ),
              },
              {
                title: 'Source',
                dataIndex: 'source',
                key: 'source',
                render: (v: string) => <Tag>{v || 'Direct'}</Tag>,
              },
              {
                title: 'Reason / Interest',
                dataIndex: 'reasonForContact',
                key: 'reasonForContact',
                render: (v: string) => v || '—',
              },
              {
                title: 'Assigned / Created',
                key: 'date',
                render: (_: any, r: any) => dayjs(r.createdAt).format('DD MMM YYYY'),
              },
            ]}
          />
        )}

        {/* Appointments Table */}
        {summaryModalType === 'appointments' && (
          <Table
            size="small"
            dataSource={filteredModalData}
            rowKey="id"
            pagination={{ pageSize: 8 }}
            columns={[
              {
                title: 'Title / Agenda',
                key: 'title',
                render: (_: any, r: any) => <strong>{r.reason || 'Client Appointment'}</strong>,
              },
              {
                title: 'Scheduled Date & Time',
                key: 'scheduledFor',
                render: (_: any, r: any) => dayjs(r.scheduledFor).format('DD MMM YYYY, hh:mm A'),
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                render: (v: string) => (
                  <Tag color={v === 'completed' ? 'green' : v === 'postponed' ? 'orange' : v === 'canceled' || v === 'cancelled' ? 'red' : v === 'no_show' ? 'gold' : 'blue'}>
                    {(v || 'SCHEDULED').toUpperCase()}
                  </Tag>
                ),
              },
              {
                title: 'Source',
                dataIndex: 'source',
                key: 'source',
                render: (v: string) => <Tag>{v || 'General'}</Tag>,
              },
            ]}
          />
        )}

        {/* Attendance Table */}
        {summaryModalType === 'attendance' && (
          <Table
            size="small"
            dataSource={filteredModalData}
            rowKey="id"
            pagination={{ pageSize: 8 }}
            columns={[
              {
                title: 'Date',
                key: 'date',
                render: (_: any, r: any) => dayjs(r.clockInTime || r.date).format('DD MMM YYYY'),
              },
              {
                title: 'Clock In',
                key: 'clockIn',
                render: (_: any, r: any) => r.clockInTime ? dayjs(r.clockInTime).format('hh:mm A') : '—',
              },
              {
                title: 'Clock Out',
                key: 'clockOut',
                render: (_: any, r: any) => r.clockOutTime ? dayjs(r.clockOutTime).format('hh:mm A') : <Tag color="processing">Active</Tag>,
              },
              {
                title: 'Branch',
                dataIndex: 'branchName',
                key: 'branch',
                render: (v: string) => v || 'Head Office',
              },
              {
                title: 'Punctuality Status',
                key: 'status',
                render: (_: any, r: any) => (
                  <Tag color={r.isLate ? 'volcano' : 'green'}>
                    {r.isLate ? `Late (${r.latenessMinutes} mins)` : 'On Time'}
                  </Tag>
                ),
              },
            ]}
          />
        )}

        {/* Leaves Table */}
        {summaryModalType === 'leaves' && (
          <Table
            size="small"
            dataSource={filteredModalData}
            rowKey="id"
            pagination={{ pageSize: 8 }}
            columns={[
              {
                title: 'Leave Type',
                dataIndex: 'leaveType',
                key: 'leaveType',
                render: (v: string) => <Tag color="blue">{(v || 'Annual').toUpperCase()}</Tag>,
              },
              {
                title: 'Duration',
                key: 'duration',
                render: (_: any, r: any) => (
                  <span>
                    <strong>{r.totalDays} Days</strong> ({dayjs(r.startDate).format('DD MMM')} – {dayjs(r.endDate).format('DD MMM YYYY')})
                  </span>
                ),
              },
              {
                title: 'Reason',
                dataIndex: 'reason',
                key: 'reason',
                render: (v: string) => v || '—',
              },
              {
                title: 'Approval Status',
                dataIndex: 'status',
                key: 'status',
                render: (v: string) => (
                  <Tag color={v === 'approved' ? 'green' : v === 'rejected' ? 'red' : 'gold'}>
                    {(v || 'PENDING').toUpperCase()}
                  </Tag>
                ),
              },
            ]}
          />
        )}

        {/* Bonuses Table */}
        {summaryModalType === 'bonuses' && (
          <Table
            size="small"
            dataSource={filteredModalData}
            rowKey="id"
            pagination={{ pageSize: 8 }}
            columns={[
              {
                title: 'Reason / Target',
                key: 'reason',
                render: (_: any, r: any) => <strong>{r.reason || r.ruleName}</strong>,
              },
              {
                title: 'Bonus Category',
                dataIndex: 'bonusType',
                key: 'bonusType',
                render: (v: string) => <Tag color="gold">{bonusTypeLabels[v as BonusType] || v || 'Bonus'}</Tag>,
              },
              {
                title: 'Award Amount',
                key: 'amount',
                render: (_: any, r: any) => (
                  <Tag color="green" style={{ fontWeight: 600, fontSize: 13 }}>
                    + GH₵ {r.amountGHS?.toLocaleString() || ((r.amountMinor || 0) / 100).toLocaleString()}
                  </Tag>
                ),
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                render: (v: string) => <Tag color="green">{(v || 'APPROVED').toUpperCase()}</Tag>,
              },
              {
                title: 'Date Awarded',
                key: 'date',
                render: (_: any, r: any) => dayjs(r.earnedAt).format('DD MMM YYYY, hh:mm A'),
              },
            ]}
          />
        )}

        {/* Payroll Table */}
        {summaryModalType === 'payroll' && (
          <Table
            size="small"
            dataSource={filteredModalData}
            rowKey="id"
            pagination={{ pageSize: 8 }}
            columns={payrollColumns}
          />
        )}
      </Modal>

      {/* ── PAYSLIP MODAL ────────────────────────────────────────────────── */}
      <PayslipModal
        open={payslipModalOpen}
        onClose={() => {
          setPayslipModalOpen(false);
          setPayslipRecord(null);
        }}
        record={payslipRecord}
      />

      {/* ── COMPENSATION CONFIGURATION MODAL ─────────────────────────────── */}
      <CompensationModal
        open={compensationModalOpen}
        onClose={() => setCompensationModalOpen(false)}
        profile={compProfile || null}
        onSave={async (updated) => {
          if (id) {
            await updateCompensationMutation.mutateAsync({ userId: id, payload: updated });
            message.success('Staff compensation package updated successfully');
          }
        }}
      />
      {/* ── DEDICATED PROSPECTS & INTERACTION HISTORY DRAWER ──────────────── */}
      <Drawer
        title={
          <Space align="center">
            <TeamOutlined style={{ color: tokens.primary, fontSize: 22 }} />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {fullName} — Prospects & Interaction History
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {roleName} • {branchTitle} • {staffProspects.length} Total Prospects
              </Text>
            </div>
          </Space>
        }
        placement="right"
        width={900}
        open={prospectsDrawerOpen}
        onClose={() => setProspectsDrawerOpen(false)}
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setProspectsDrawerOpen(false);
                navigate('/marketing/prospects');
              }}
            >
              Add Prospect
            </Button>
          </Space>
        }
      >
        <Tabs
          activeKey={drawerActiveTab}
          onChange={(k) => setDrawerActiveTab(k as 'prospects' | 'interactions')}
          items={[
            {
              key: 'prospects',
              label: <span><TeamOutlined /> Prospect Portfolio ({staffProspects.length})</span>,
              children: (
                <div>
                  <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                    <Col xs={24} sm={12}>
                      <Input
                        prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                        placeholder="Search prospect by name, phone, address..."
                        value={prospectSearchText}
                        onChange={(e) => setProspectSearchText(e.target.value)}
                        allowClear
                      />
                    </Col>
                    <Col xs={12} sm={6}>
                      <Select
                        value={prospectStatusFilter}
                        onChange={setProspectStatusFilter}
                        style={{ width: '100%' }}
                      >
                        <Option value="all">All Statuses</Option>
                        <Option value="new">New</Option>
                        <Option value="meeting_scheduled">Meeting Scheduled</Option>
                        <Option value="meeting_completed">Meeting Completed</Option>
                        <Option value="postponed">Postponed</Option>
                        <Option value="purchased">Purchased</Option>
                        <Option value="suspended">Suspended</Option>
                      </Select>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Select
                        value={prospectSourceFilter}
                        onChange={setProspectSourceFilter}
                        style={{ width: '100%' }}
                      >
                        <Option value="all">All Sources</Option>
                        <Option value="marketing">Marketing</Option>
                        <Option value="customer_service">Customer Service</Option>
                      </Select>
                    </Col>
                  </Row>
                  <Table
                    dataSource={filteredStaffProspects}
                    rowKey="id"
                    pagination={{ pageSize: 8 }}
                    size="middle"
                    columns={[
                      {
                        title: 'Prospect',
                        key: 'prospect',
                        render: (_: any, record: any) => (
                          <Space>
                            <PhotoUpload entityType="prospect" entityId={record.id} size={36} editable={false} />
                            <div>
                              <a
                                style={{ fontWeight: 600, color: tokens.primary }}
                                onClick={() => {
                                  setProspectsDrawerOpen(false);
                                  navigate(record.source === 'customer_service' ? '/cs/prospects' : `/marketing/prospects/${record.id}`);
                                }}
                              >
                                {record.firstName} {record.lastName}
                              </a>
                              <div style={{ fontSize: 12, color: '#64748b' }}>
                                <PhoneOutlined /> {record.phoneNumber || '—'}
                              </div>
                            </div>
                          </Space>
                        ),
                      },
                      {
                        title: 'Source',
                        dataIndex: 'source',
                        key: 'source',
                        width: 140,
                        render: (source: string) => (
                          <Tag color={source === 'customer_service' ? 'green' : 'blue'}>
                            {source === 'customer_service' ? 'Customer Service' : 'Marketing'}
                          </Tag>
                        ),
                      },
                      {
                        title: 'Status',
                        dataIndex: 'status',
                        key: 'status',
                        width: 140,
                        render: (v: string) => (
                          <Tag color={v === 'purchased' ? 'green' : v === 'meeting_scheduled' ? 'purple' : v === 'postponed' ? 'gold' : 'blue'}>
                            {(v || 'NEW').replace('_', ' ').toUpperCase()}
                          </Tag>
                        ),
                      },
                      {
                        title: 'Added / Assigned',
                        key: 'relation',
                        width: 150,
                        render: (_: any, r: any) => {
                          const isCreator = r.createdByUserId === id || (r as any).creatorId === id;
                          return (
                            <div>
                              <Tag color={isCreator ? 'cyan' : 'geekblue'} style={{ fontSize: 11 }}>
                                {isCreator ? 'Added by Staff' : 'Assigned Staff'}
                              </Tag>
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                {dayjs(r.createdAt).format('MMM D, YYYY')}
                              </div>
                            </div>
                          );
                        },
                      },
                      {
                        title: 'Action',
                        key: 'action',
                        width: 120,
                        render: (_: any, r: any) => (
                          <Button
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => {
                              setProspectsDrawerOpen(false);
                              navigate(r.source === 'customer_service' ? '/cs/prospects' : `/marketing/prospects/${r.id}`);
                            }}
                          >
                            Details
                          </Button>
                        ),
                      },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'interactions',
              label: <span><ClockCircleOutlined /> Interaction History</span>,
              children: (
                <div style={{ marginTop: 8 }}>
                  <ProspectInteractionsTimeline
                    defaultStaffId={id}
                    title={`Communication & Interaction History — ${fullName}`}
                  />
                </div>
              ),
            },
          ]}
        />
      </Drawer>
    </div>
  );
};
