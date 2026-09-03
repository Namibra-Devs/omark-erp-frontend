// src/pages/profile/MyProfilePage.tsx
import React, { useMemo, useState } from 'react';
import { Button, Card, Col, Descriptions, Empty, Form, Input, List, Modal, Row, Space, Statistic, Table, Tag, Typography, message, Spin } from 'antd';
import {
  AuditOutlined, CalendarOutlined, EditOutlined, FileTextOutlined,
  IdcardOutlined, MailOutlined, PhoneOutlined, UserAddOutlined, DollarOutlined,
  LockOutlined, SafetyCertificateOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { PhotoUpload } from '@/components/shared/PhotoUpload';
import { roleLabels } from '@/constants/enums';
import { tokens } from '@/constants/tokens';
import { useUpdateUserMutation, useUserBonusesQuery, useUserActivityQuery } from '@/api/users';
import { useProspectsQuery } from '@/api/prospects';
import { useAppointmentsQuery } from '@/api/appointments';
import { useDeedsQuery } from '@/api/deeds';
import { usePayrollQuery, type PayrollRecord } from '@/api/payroll';
import { useBranchesQuery } from '@/api/branches';
import { getUserBranchRoleTitle } from '@/utils/branchIsolation';
import { useStaffBonuses } from '@/mock/bonusRules';

import { useAttendanceQuery, useStaffLeaveRequestsQuery } from '@/api/attendance';

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
  const [editModal, setEditModal] = useState(false);
  const [form] = Form.useForm();
  const updateUser = useUpdateUserMutation();

  const canSeeProspects = hasRole(['marketing_staff', 'marketing_director', 'admin']);
  const canSeeAppointments = hasRole(['customer_service', 'admin']);
  const canSeeDeeds = hasRole(['secretary', 'admin']);

  const { data: prospectsData, isLoading: prospectsLoading } = useProspectsQuery(
    { assignedUserId: user?.id, pageSize: 20 },
    canSeeProspects && !!user?.id
  );
  const { data: appointmentsData, isLoading: appointmentsLoading } = useAppointmentsQuery(
    { pageSize: 50 },
    canSeeAppointments
  );
  const { data: deedsData, isLoading: deedsLoading } = useDeedsQuery(
    { pageSize: 50 },
    canSeeDeeds
  );
  const { data: serverActivity = [] } = useUserActivityQuery(user?.id);

  // Live Attendance & Leave Queries
  const { data: attendanceData = [] } = useAttendanceQuery({ userId: user?.id });
  const { data: leaveData = [] } = useStaffLeaveRequestsQuery(undefined, user?.id);

  // Live Payroll & Bonus API queries
  const { data: payrollData, isLoading: payrollLoading } = usePayrollQuery({ staffUserId: user?.id });
  const { data: bonuses = [], isLoading: bonusesLoading } = useUserBonusesQuery(user?.id);
  const { bonuses: earnedBonuses, totalBonusMinor: earnedBonusMinorTotal } = useStaffBonuses(user?.id);

  const myPayroll: PayrollRecord[] = payrollData?.items ?? [];

  const activity: ActivityRow[] = useMemo(() => {
    const rows: ActivityRow[] = [];

    // Attendance Clock-Ins
    (Array.isArray(attendanceData) ? attendanceData : []).forEach((att) => {
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
    (Array.isArray(leaveData) ? leaveData : []).forEach((lv) => {
      rows.push({
        key: `leave-${lv.id}`,
        type: 'Leave',
        title: `Leave Application — ${lv.leaveType.toUpperCase()} (${lv.status.toUpperCase()})`,
        detail: `${lv.totalDays} Days (${lv.startDate} to ${lv.endDate}) — ${lv.reason}`,
        date: lv.createdAt,
      });
    });

    // Bonuses
    (Array.isArray(earnedBonuses) ? earnedBonuses : []).forEach((b) => {
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

    (prospectsData?.items ?? []).forEach((p) => {
      rows.push({
        key: `prospect-${p.id}`,
        type: 'Prospect',
        title: `${p.firstName} ${p.lastName}`,
        detail: `Assigned to you — ${p.status.replace('_', ' ')} (${p.source})`,
        date: p.updatedAt || p.createdAt,
      });
    });

    (appointmentsData?.items ?? [])
      .filter((a) => a.createdByUserId === user?.id)
      .forEach((a) => {
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
  }, [attendanceData, leaveData, earnedBonuses, myPayroll, prospectsData, appointmentsData, deedsData, serverActivity, user?.id]);

  const activityLoading = (canSeeProspects && prospectsLoading) || (canSeeAppointments && appointmentsLoading) || (canSeeDeeds && deedsLoading);

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
    if (!isAdmin) {
      message.warning('Staff profiles are view-only. Profile modifications must be performed by an Administrator.');
      return;
    }
    form.setFieldsValue({
      firstName: user?.firstName,
      lastName: user?.lastName,
      email: user?.email,
      phoneNumber: user?.phoneNumber,
    });
    setEditModal(true);
  };

  const handleSave = async (values: any) => {
    if (!user?.id) return;
    if (!isAdmin) {
      message.error('Unauthorized: Profile editing is restricted to administrators.');
      return;
    }
    try {
      await updateUser.mutateAsync({ id: user.id, payload: values });
      await refreshUser();
      message.success('Profile updated successfully');
      setEditModal(false);
    } catch (error: any) {
      message.error(error?.error?.message || error?.message || 'Failed to update profile');
    }
  };

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
    { title: 'Deductions', key: 'deductions', render: (_: any, r: PayrollRecord) => (r.deductionsMinor || 0) > 0 ? `GHS ${(r.deductionsMinor / 100).toLocaleString()}` : '—' },
    { title: 'Net Salary', key: 'net', render: (_: any, r: PayrollRecord) => <strong>GHS {(r.netSalaryMinor / 100).toLocaleString()}</strong> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={payrollStatusColor[v] || 'default'}>{v}</Tag> },
  ];

  return (
    <div>
      <PageHeader
        title="My Profile"
        actions={isAdmin ? [{ label: 'Edit Info', onClick: openEdit, icon: <EditOutlined /> }] : []}
      />

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={24} align="middle">
          <Col>
            <PhotoUpload
              entityType="staff"
              entityId={user.id}
              size={80}
              editable={isAdmin}
              src={user.avatarUrl || user.photoUrl}
              onPhotoChange={async (url) => {
                if (!isAdmin) return;
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
              {!isAdmin && (
                <Tag color="default" style={{ borderRadius: 6, fontSize: 11, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <LockOutlined style={{ marginRight: 4, color: '#64748b' }} />
                  View-Only Profile (Managed by Administrator)
                </Tag>
              )}
            </Space>
            <Descriptions column={{ xs: 1, sm: 2 }} style={{ marginTop: 16 }} contentStyle={{ wordBreak: 'break-word' }}>
              <Descriptions.Item label={<span><MailOutlined /> Email</span>}>
                <a href={`mailto:${user.email}`} style={{ wordBreak: 'break-all' }}>{user.email}</a>
              </Descriptions.Item>
              <Descriptions.Item label={<span><PhoneOutlined /> Phone</span>}>{user.phoneNumber || '—'}</Descriptions.Item>
            </Descriptions>
          </Col>
        </Row>
      </Card>

      <Card
        title={<span><AuditOutlined style={{ marginRight: 8 }} />My Activity Feed</span>}
        style={{ marginBottom: 24 }}
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

      <Card title={<span><IdcardOutlined style={{ marginRight: 8 }} />My Bonuses & Salary</span>} loading={payrollLoading || bonusesLoading}>
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
              🎯 Recent Commission & Bonus Earnings
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

      <Modal title="Edit Profile" open={editModal} onCancel={() => setEditModal(false)} footer={null} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="firstName" label="First Name" rules={[{ required: true, message: 'Required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="lastName" label="Last Name" rules={[{ required: true, message: 'Required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phoneNumber" label="Phone Number" rules={[{ required: true, message: 'Required' }]}>
            <Input />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={updateUser.isPending}>Save</Button>
              <Button onClick={() => setEditModal(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
