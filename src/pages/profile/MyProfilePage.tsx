// src/pages/profile/MyProfilePage.tsx
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  AuditOutlined,
  CalendarOutlined,
  EditOutlined,
  FileTextOutlined,
  IdcardOutlined,
  MailOutlined,
  PhoneOutlined,
  UserAddOutlined,
  DollarOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  FileDoneOutlined,
  TrophyOutlined,
  KeyOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { PhotoUpload } from '@/components/shared/PhotoUpload';
import { roleLabels } from '@/constants/enums';
import { tokens } from '@/constants/tokens';
import { useUpdateUserMutation, useUserActivityQuery, type UpdateUserPayload } from '@/api/users';
import { useProspectsQuery } from '@/api/prospects';
import { useAppointmentsQuery } from '@/api/appointments';
import { useDeedsQuery } from '@/api/deeds';
import { usePayrollQuery, type PayrollRecord } from '@/api/payroll';
import { useBranchesQuery } from '@/api/branches';
import { getUserBranchRoleTitle } from '@/utils/branchIsolation';
import { useBonusesQuery, type StaffBonusRecord } from '@/api/bonuses';
import { useAttendanceQuery } from '@/api/attendance';
import { useStaffLeaveRequestsQuery } from '@/api/leaves';
import { recordSystemEvent } from '@/utils/activityNotificationEngine';

const { Title, Text } = Typography;

const payrollStatusColor: Record<string, string> = { pending: 'gold', approved: 'blue', paid: 'green' };

interface ActivityRow {
  key: string;
  type: 'Prospect' | 'Appointment' | 'Deed' | 'Activity' | 'Attendance' | 'Leave' | 'Bonus' | 'Payroll';
  title: string;
  detail: string;
  date: string;
}

export const MyProfilePage: React.FC = () => {
  const { user, hasRole, refreshUser } = useAuth();
  const isAdmin = hasRole(['admin']);
  const { data: branches = [] } = useBranchesQuery();
  const branchRoleTitle = getUserBranchRoleTitle(user, branches);

  // Modals
  const [editModal, setEditModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [summaryModalType, setSummaryModalType] = useState<
    'prospects' | 'appointments' | 'attendance' | 'leaves' | 'bonuses' | 'payroll' | null
  >(null);
  const [modalSearch, setModalSearch] = useState('');

  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const updateUser = useUpdateUserMutation();

  // Queries enabled for all staff
  const canSeeDeeds = hasRole(['admin', 'secretary', 'customer_service']);

  const { data: allProspectsData, isLoading: prospectsLoading } = useProspectsQuery(
    { pageSize: 500 },
    Boolean(user?.id)
  );
  const { data: appointmentsData, isLoading: appointmentsLoading } = useAppointmentsQuery(
    {},
    Boolean(user?.id)
  );
  const { data: deedsData, isLoading: deedsLoading } = useDeedsQuery(
    {},
    canSeeDeeds && Boolean(user?.id)
  );

  const { data: serverActivity = [] } = useUserActivityQuery(user?.id);

  // Live Attendance & Leave Queries
  const { data: attendanceData = [] } = useAttendanceQuery({ userId: user?.id });
  const { data: leaveData = [] } = useStaffLeaveRequestsQuery({ userId: user?.id });

  // Live Payroll & Bonus API queries
  const { data: payrollData, isLoading: payrollLoading } = usePayrollQuery({ staffUserId: user?.id });
  const { data: bonuses = [], isLoading: bonusesLoading } = useBonusesQuery({ userId: user?.id });
  const earnedBonuses: StaffBonusRecord[] = bonuses;
  const earnedBonusMinorTotal = useMemo(
    () => earnedBonuses.reduce((sum: number, b: any) => sum + (b.amountMinor || (b.amountGHS ? b.amountGHS * 100 : 0)), 0),
    [earnedBonuses]
  );

  const myPayroll: PayrollRecord[] = payrollData?.items ?? [];
  const allProspects = allProspectsData?.items ?? [];
  const myProspects = useMemo(() => {
    if (!user?.id) return [];
    return allProspects.filter(
      (p) => p.assignedUserId === user.id || (p as any).assignedStaffId === user.id || (p as any).createdByUserId === user.id
    );
  }, [allProspects, user?.id]);
  const myAppointments = (appointmentsData?.items ?? []).filter(
    (a) => a.createdByUserId === user?.id || (a as any).assignedStaffId === user?.id || isAdmin
  );
  const myAttendance = Array.isArray(attendanceData) ? attendanceData : [];
  const myLeaves = Array.isArray(leaveData) ? leaveData : [];

  const activity: ActivityRow[] = useMemo(() => {
    const rows: ActivityRow[] = [];

    // Attendance Clock-Ins
    myAttendance.forEach((att) => {
      if (att.clockInTime) {
        rows.push({
          key: `att-${att.id}`,
          type: 'Attendance',
          title: `Verified Attendance Punch (${att.status.toUpperCase()})`,
          detail: `Clocked in at ${dayjs(att.clockInTime).format('hh:mm A')} — ${att.branchName} (${att.isLate ? `${att.latenessMinutes} mins late` : 'On Time'})`,
          date: att.clockInTime,
        });
      }
    });

    // Leaves
    myLeaves.forEach((lv) => {
      rows.push({
        key: `leave-${lv.id}`,
        type: 'Leave',
        title: `Leave Application — ${lv.leaveType.toUpperCase()} (${lv.status.toUpperCase()})`,
        detail: `${lv.totalDays} Days (${lv.startDate} to ${lv.endDate}) — ${lv.reason}`,
        date: lv.createdAt,
      });
    });

    // Bonuses
    earnedBonuses.forEach((b) => {
      rows.push({
        key: `bonus-${b.id}`,
        type: 'Bonus',
        title: `Bonus Awarded: GH₵ ${b.amountGHS.toLocaleString()}`,
        detail: `${b.reason || b.ruleName} — Status: ${b.status.toUpperCase()}`,
        date: b.earnedAt,
      });
    });

    // Payroll
    myPayroll.forEach((p) => {
      rows.push({
        key: `payroll-${p.id}`,
        type: 'Payroll',
        title: `Payroll Record: ${p.month}`,
        detail: `Net Salary: GH₵ ${(p.netSalaryMinor / 100).toLocaleString()} (Status: ${p.status.toUpperCase()})`,
        date: p.createdAt || p.updatedAt || new Date().toISOString(),
      });
    });

    myProspects.forEach((p) => {
      rows.push({
        key: `prospect-${p.id}`,
        type: 'Prospect',
        title: `${p.firstName} ${p.lastName}`,
        detail: `Assigned to you — ${p.status.replace('_', ' ')} (${p.source})`,
        date: p.updatedAt || p.createdAt,
      });
    });

    myAppointments.forEach((a) => {
      rows.push({
        key: `appointment-${a.id}`,
        type: 'Appointment',
        title: `Appointment — ${dayjs(a.scheduledFor).format('MMM D, YYYY')}`,
        detail: `Created by you — ${a.status} (${a.source})`,
        date: a.updatedAt || a.createdAt,
      });
    });

    (deedsData?.items ?? [])
      .filter((d) => d.generatedByUserId === user?.id)
      .forEach((d) => {
        rows.push({
          key: `deed-${d.id}`,
          type: 'Deed',
          title: `Deed generated`,
          detail: `Deed #${d.id.slice(0, 8)} — generated by you`,
          date: d.createdAt,
        });
      });

    const safeServerActivity = Array.isArray(serverActivity) ? serverActivity : [];
    safeServerActivity.forEach((act) => {
      rows.push({
        key: `act-${act.id}`,
        type: 'Activity',
        title: act.title,
        detail: act.description || act.type,
        date: act.createdAt,
      });
    });

    return rows.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 35);
  }, [myAttendance, myLeaves, earnedBonuses, myPayroll, myProspects, myAppointments, deedsData, serverActivity, user?.id]);

  const activityLoading = prospectsLoading || appointmentsLoading || deedsLoading;

  const totalBonusMinor = useMemo(() => {
    const safePayroll = Array.isArray(myPayroll) ? myPayroll : [];
    const safeBonuses = Array.isArray(bonuses) ? bonuses : [];
    const payrollBonusSum = safePayroll.reduce((sum, p) => sum + (p.bonusMinor || 0), 0);
    const directBonusSum = safeBonuses.reduce((sum, b) => sum + (b.amountMinor || 0), 0);
    return Math.max(payrollBonusSum, directBonusSum, earnedBonusMinorTotal);
  }, [myPayroll, bonuses, earnedBonusMinorTotal]);

  const totalNetMinor = useMemo(() => {
    const safePayroll = Array.isArray(myPayroll) ? myPayroll : [];
    return safePayroll.reduce((sum, p) => sum + (p.netSalaryMinor || 0), 0);
  }, [myPayroll]);

  const openEdit = () => {
    form.setFieldsValue({
      id: user?.id,
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phoneNumber: user?.phoneNumber || '',
    });
    setEditModal(true);
  };

  const handleSave = async (values: any) => {
    if (!user?.id) return;
    try {
      const payload: UpdateUserPayload = {
        firstName: values.firstName?.trim(),
        lastName: values.lastName?.trim(),
        email: values.email?.trim(),
        phoneNumber: values.phoneNumber?.trim(),
      };

      await updateUser.mutateAsync({ id: user.id, payload });
      await refreshUser();
      message.success('Profile details updated successfully');
      setEditModal(false);
    } catch (error: any) {
      message.error(error?.error?.message || error?.message || 'Failed to update profile');
    }
  };

  const handlePasswordReset = async (values: any) => {
    if (!user?.id) return;
    setPasswordLoading(true);
    try {
      await updateUser.mutateAsync({
        id: user.id,
        payload: { password: values.newPassword },
      });

      // Dispatch security event to notify administrators
      recordSystemEvent({
        title: 'Staff Password Updated',
        details: `${user.firstName} ${user.lastName} (${roleLabels[user.role] || user.role}) updated their account password. The password is encrypted and confidential — administrators have zero access to staff passwords.`,
        category: 'security',
        type: 'info',
        targetRole: 'admin',
        actorId: user.id,
        actorName: `${user.firstName} ${user.lastName}`,
        actorRole: user.role,
      });

      message.success('Password updated successfully! Main administrator has been notified of the credential update.');
      setPasswordModal(false);
      passwordForm.resetFields();
    } catch (error: any) {
      message.error(error?.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Filtered dataset for Quick Operational Summary drill-down modal
  const filteredModalData = useMemo(() => {
    const q = modalSearch.trim().toLowerCase();
    switch (summaryModalType) {
      case 'prospects':
        return myProspects.filter((p) => {
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
        return myAppointments.filter((a) => {
          if (!q) return true;
          return (
            a.reason?.toLowerCase().includes(q) ||
            a.status?.toLowerCase().includes(q) ||
            a.source?.toLowerCase().includes(q) ||
            dayjs(a.scheduledFor).format('DD MMM YYYY').toLowerCase().includes(q)
          );
        });
      case 'attendance':
        return myAttendance.filter((att) => {
          if (!q) return true;
          return (
            att.date?.toLowerCase().includes(q) ||
            att.status?.toLowerCase().includes(q) ||
            att.branchName?.toLowerCase().includes(q)
          );
        });
      case 'leaves':
        return myLeaves.filter((lv) => {
          if (!q) return true;
          return (
            lv.leaveType?.toLowerCase().includes(q) ||
            lv.status?.toLowerCase().includes(q) ||
            lv.reason?.toLowerCase().includes(q)
          );
        });
      case 'bonuses':
        return earnedBonuses.filter((b) => {
          if (!q) return true;
          return (
            b.reason?.toLowerCase().includes(q) ||
            b.ruleName?.toLowerCase().includes(q) ||
            b.status?.toLowerCase().includes(q)
          );
        });
      case 'payroll':
        return myPayroll.filter((p) => {
          if (!q) return true;
          return p.month?.toLowerCase().includes(q) || p.status?.toLowerCase().includes(q);
        });
      default:
        return [];
    }
  }, [summaryModalType, modalSearch, myProspects, myAppointments, myAttendance, myLeaves, earnedBonuses, myPayroll]);

  if (!user) return null;

  const payrollColumns = [
    { title: 'Month', dataIndex: 'month', key: 'month', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'Base Salary', key: 'base', render: (_: any, r: PayrollRecord) => `GHS ${(r.baseSalaryMinor / 100).toLocaleString()}` },
    {
      title: 'Bonus',
      key: 'bonus',
      render: (_: any, r: PayrollRecord) => (r.bonusMinor || 0) > 0
        ? <Tag color="green">GHS {(r.bonusMinor / 100).toLocaleString()}</Tag>
        : <span style={{ color: '#bbb' }}>—</span>,
    },
    { title: 'Deductions', key: 'deductions', render: (_: any, r: PayrollRecord) => (r.deductionsMinor || 0) > 0 ? `GHS ${((r.deductionsMinor || 0) / 100).toLocaleString()}` : '—' },
    { title: 'Net Salary', key: 'net', render: (_: any, r: PayrollRecord) => <strong>GHS {(r.netSalaryMinor / 100).toLocaleString()}</strong> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={payrollStatusColor[v] || 'default'}>{v}</Tag> },
  ];

  return (
    <div>
      <PageHeader
        title="My Profile"
        actions={[
          { label: 'Edit Profile', onClick: openEdit, icon: <EditOutlined /> },
          {
            label: 'Reset / Change Password',
            onClick: () => {
              passwordForm.resetFields();
              setPasswordModal(true);
            },
            icon: <LockOutlined />,
          },
        ]}
      />

      {/* ── User Overview Card ────────────────────────────────────────── */}
      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <Row gutter={24} align="middle">
          <Col>
            <PhotoUpload
              entityType="staff"
              entityId={user.id}
              size={84}
              editable={true}
              src={user.avatarUrl || user.photoUrl}
              onPhotoChange={async (url) => {
                try {
                  await updateUser.mutateAsync({
                    id: user.id,
                    payload: { avatarUrl: url, photoUrl: url, profilePictureUrl: url },
                  });
                  await refreshUser();
                } catch {
                  // Persistent storage is synchronized
                }
              }}
            />
          </Col>
          <Col flex="auto">
            <Title level={3} style={{ margin: 0 }}>{user.firstName} {user.lastName}</Title>
            <Space size={12} style={{ marginTop: 4, flexWrap: 'wrap' }}>
              <Tag color="blue" style={{ fontSize: 13, padding: '4px 12px', borderRadius: 12 }}>{branchRoleTitle}</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>Staff since {dayjs(user.createdAt).format('MMM YYYY')}</Text>
              <Tag color="default" style={{ borderRadius: 6, fontSize: 11, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <IdcardOutlined style={{ marginRight: 4, color: '#64748b' }} />
                ID: {user.id ? `${user.id.slice(0, 8)}...` : '—'}
              </Tag>
            </Space>
            <Descriptions column={{ xs: 1, sm: 3 }} style={{ marginTop: 16 }} contentStyle={{ wordBreak: 'break-word' }}>
              <Descriptions.Item label={<span><IdcardOutlined /> Staff ID</span>}>
                <Text code copyable={{ text: user.id }}>{user.id ? `${user.id.slice(0, 8)}...` : '—'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={<span><MailOutlined /> Email</span>}>
                <a href={`mailto:${user.email}`} style={{ wordBreak: 'break-all' }}>{user.email}</a>
              </Descriptions.Item>
              <Descriptions.Item label={<span><PhoneOutlined /> Phone</span>}>
                {user.phoneNumber || <Text type="secondary">Not set (Click Edit Profile)</Text>}
              </Descriptions.Item>
            </Descriptions>
          </Col>
        </Row>
      </Card>

      {/* ── Quick Operational Summary Stats Cards ─────────────────────── */}
      <Card
        style={{ marginBottom: 24, borderRadius: 12 }}
        title={
          <Space>
            <ThunderboltOutlined style={{ fontSize: 18, color: '#f59e0b' }} />
            <div>
              <Text strong style={{ fontSize: 16 }}>Quick Operational Summary</Text>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>
                Live operational indicators across your account. Click any card to inspect full records.
              </div>
            </div>
          </Space>
        }
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
              <UserAddOutlined style={{ fontSize: 24, color: '#16a34a', marginBottom: 8 }} />
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
                {myProspects.length}
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
                {myAppointments.length}
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
                {myAttendance.length}
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
                {myLeaves.length}
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
                {earnedBonuses.length}
              </div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                Bonuses Earned
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
                {myPayroll.length}
              </div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                Salary Slips
              </Text>
              <Tag color="blue" style={{ marginTop: 6, fontSize: 10, borderRadius: 4 }}>
                View List &rarr;
              </Tag>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* ── Security & Password Card ──────────────────────────────────── */}
      <Card
        title={<span><LockOutlined style={{ marginRight: 8 }} />Security &amp; Account Access</span>}
        style={{ marginBottom: 24, borderRadius: 12 }}
        extra={
          <Button
            type="primary"
            icon={<KeyOutlined />}
            onClick={() => {
              passwordForm.resetFields();
              setPasswordModal(true);
            }}
            style={{ backgroundColor: tokens.primary, borderColor: tokens.primary }}
          >
            Reset / Change Password
          </Button>
        }
      >
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={16}>
            <Text strong style={{ fontSize: 14 }}>Password &amp; Credentials Privacy</Text>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
              Your login credentials are encrypted. You can reset or recover your password at any time. When updated, administrators are notified of the security event, but your password remains confidential and inaccessible to them.
            </div>
          </Col>
          <Col xs={24} sm={8} style={{ textAlign: 'right' }}>
            <Tag color="success" style={{ padding: '6px 12px', fontSize: 13, borderRadius: 6 }}>
              <SafetyCertificateOutlined style={{ marginRight: 6 }} /> Credentials Secure &amp; Confidential
            </Tag>
          </Col>
        </Row>
      </Card>

      {/* ── Bonuses & Salary ──────────────────────────────────────────── */}
      <Card
        title={<span><IdcardOutlined style={{ marginRight: 8 }} />My Bonuses &amp; Salary</span>}
        loading={payrollLoading || bonusesLoading}
        style={{ marginBottom: 24, borderRadius: 12 }}
      >
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12}>
            <Statistic title="Total Bonuses Earned" value={totalBonusMinor / 100} prefix="GHS" precision={2} valueStyle={{ color: '#52c41a' }} />
          </Col>
          <Col xs={24} sm={12}>
            <Statistic title="Total Net Salary Paid" value={totalNetMinor / 100} prefix="GHS" precision={2} valueStyle={{ color: tokens.primary }} />
          </Col>
        </Row>

        {earnedBonuses.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <Text strong style={{ display: 'block', marginBottom: 8, color: '#389e0d' }}>
              🎯 Recent Commission &amp; Bonus Earnings
            </Text>
            <List
              size="small"
              bordered
              dataSource={earnedBonuses.slice(0, 5)}
              renderItem={(item) => (
                <List.Item
                  extra={<Tag color="green" style={{ fontWeight: 600 }}>+ GH₵ {item.amountGHS.toFixed(2)}</Tag>}
                >
                  <List.Item.Meta
                    title={item.reason || item.ruleName}
                    description={dayjs(item.earnedAt).format('MMM D, YYYY h:mm A')}
                  />
                </List.Item>
              )}
            />
          </div>
        )}

        {myPayroll.length > 0 ? (
          <Table columns={payrollColumns} dataSource={myPayroll} rowKey="id" pagination={false} size="small" scroll={{ x: 'max-content' }} />
        ) : (
          <Empty description="No payroll or salary statements on record for your account yet." />
        )}
      </Card>

      {/* ── Activity Feed ─────────────────────────────────────────────── */}
      <Card
        title={<span><AuditOutlined style={{ marginRight: 8 }} />My Activity Feed</span>}
        style={{ marginBottom: 24, borderRadius: 12 }}
      >
        {activity.length > 0 ? (
          <List
            loading={activityLoading}
            dataSource={activity}
            renderItem={(row) => (
              <List.Item extra={<Text type="secondary" style={{ fontSize: 12 }}>{dayjs(row.date).format('MMM D, YYYY')}</Text>}>
                <List.Item.Meta
                  avatar={row.type === 'Prospect' ? <UserAddOutlined /> : row.type === 'Appointment' ? <CalendarOutlined /> : <FileTextOutlined />}
                  title={<span>{row.title} <Tag style={{ marginLeft: 8 }}>{row.type}</Tag></span>}
                  description={row.detail}
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="No activity recorded for you yet." />
        )}
      </Card>

      {/* ── Edit Profile Modal ────────────────────────────────────────── */}
      <Modal
        title="Edit Profile"
        open={editModal}
        onCancel={() => setEditModal(false)}
        footer={null}
        destroyOnClose
        width={520}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '16px',
            marginBottom: 20,
            background: '#f8fafc',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
          }}
        >
          <PhotoUpload
            entityType="staff"
            entityId={user.id}
            size={84}
            editable={true}
            src={user.avatarUrl || user.photoUrl}
            onPhotoChange={async (url) => {
              try {
                await updateUser.mutateAsync({
                  id: user.id,
                  payload: { avatarUrl: url, photoUrl: url, profilePictureUrl: url },
                });
                await refreshUser();
              } catch {
                // Persistent storage is synchronized
              }
            }}
          />
          <Text strong style={{ marginTop: 10, fontSize: 13 }}>Profile Picture</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Click the camera icon to upload or update your picture
          </Text>
        </div>

        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="id"
            label={<span><IdcardOutlined style={{ marginRight: 6 }} />Staff ID (System ID)</span>}
            tooltip="Fixed unique account identifier."
          >
            <Input disabled prefix={<IdcardOutlined style={{ color: '#8c8c8c' }} />} style={{ backgroundColor: '#f8fafc', color: '#64748b' }} />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="firstName"
                label="First Name"
                rules={[{ required: true, message: 'Please enter first name' }]}
              >
                <Input placeholder="First Name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="lastName"
                label="Last Name"
                rules={[{ required: true, message: 'Please enter last name' }]}
              >
                <Input placeholder="Last Name" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="email"
            label={<span><MailOutlined style={{ marginRight: 6 }} />Email Address</span>}
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email address' },
            ]}
          >
            <Input prefix={<MailOutlined style={{ color: tokens.primary }} />} placeholder="staff@omark.com" />
          </Form.Item>

          <Form.Item
            name="phoneNumber"
            label={<span><PhoneOutlined style={{ marginRight: 6 }} />Phone Number</span>}
            rules={[
              { required: true, message: 'Please enter your phone number' },
              { pattern: /^[0-9+\s\-()]{7,20}$/, message: 'Please enter a valid phone number (e.g. 054 602 9075)' },
            ]}
            extra={<Text type="secondary" style={{ fontSize: 11 }}>Used for SMS notifications, team contact, and operational alerts.</Text>}
          >
            <Input
              prefix={<PhoneOutlined style={{ color: tokens.primary }} />}
              placeholder="e.g. 054 602 9075 or +233 54 602 9075"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 20 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setEditModal(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={updateUser.isPending} icon={<EditOutlined />}>
                Save Changes
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Reset / Change Password Modal ─────────────────────────────── */}
      <Modal
        title={
          <Space>
            <LockOutlined style={{ color: tokens.primary }} />
            <span>Reset Account Password</span>
          </Space>
        }
        open={passwordModal}
        onCancel={() => {
          setPasswordModal(false);
          passwordForm.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={480}
      >
        <Alert
          type="info"
          showIcon
          message="Privacy &amp; Confidentiality Notice"
          description="Your new password is encrypted. System administrators will be notified that you updated your security credentials, but administrators have zero access to your password string."
          style={{ marginBottom: 16 }}
        />

        <Form form={passwordForm} layout="vertical" onFinish={handlePasswordReset}>
          <Form.Item
            name="newPassword"
            label="New Password"
            rules={[
              { required: true, message: 'Please enter a new password' },
              { min: 6, message: 'Password must be at least 6 characters' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Enter new password (min 6 characters)"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirm New Password"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Please confirm your new password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Re-type new password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 20 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setPasswordModal(false)}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={passwordLoading}
                style={{ backgroundColor: tokens.primary, borderColor: tokens.primary }}
              >
                Update Password
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Quick Operational Summary Detail Modal ────────────────────── */}
      <Modal
        title={
          <Space>
            {summaryModalType === 'prospects' && <UserAddOutlined style={{ color: '#16a34a' }} />}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Showing {filteredModalData.length} records
            </Text>
            <Button onClick={() => setSummaryModalType(null)}>Close</Button>
          </div>
        }
        width={860}
        destroyOnClose
      >
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Search records by keyword, name, date, or status..."
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
                title: 'Reason / Rule',
                key: 'reason',
                render: (_: any, r: any) => <strong>{r.reason || r.ruleName}</strong>,
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
    </div>
  );
};
