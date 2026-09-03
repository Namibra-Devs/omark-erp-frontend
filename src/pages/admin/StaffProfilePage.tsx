// src/pages/admin/StaffProfilePage.tsx
import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card, Row, Col, Typography, Tag, Button, Space, Tabs, Table,
  Descriptions, Avatar, Badge, Statistic, List, Tooltip, Popconfirm,
  Modal, Form, Input, Select, InputNumber, Divider, Empty, Spin, message, Alert
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
  PercentageOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { PhotoUpload } from '@/components/shared/PhotoUpload';
import { PayslipModal } from '@/components/payroll/PayslipModal';
import { CompensationModal } from '@/components/payroll/CompensationModal';
import { useUsersQuery, useUpdateUserMutation, getUserFullName, getUserPhone, getRoleLabel, getRoleColor, getRoleIcon } from '@/api/users';
import { useStaffAssignment, setStaffAssignment, getStaffAssignment } from '@/mock/staffAssignments';
import { useStaffBonuses, awardBonusForEvent, bonusTypeLabels, type StaffBonusRecord, type BonusType } from '@/mock/bonusRules';
import {
  useStaffCompensation,
  salaryTypeLabels,
  paymentMethodLabels,
  payFrequencyLabels,
  type StaffCompensationProfile,
  type SalaryType
} from '@/mock/staffCompensation';
import { usePayrollQuery, useCreatePayrollMutation, useUpdatePayrollMutation, type PayrollRecord } from '@/api/payroll';
import { useAttendanceQuery, useStaffAttendanceStatsQuery } from '@/api/attendance';
import { ATTENDANCE_STATUS_META, type AttendanceRecord, type AttendanceStatus } from '@/mock/staffAttendance';
import { useProspectsQuery } from '@/api/prospects';
import { useAppointmentsQuery } from '@/api/appointments';
import { useDeedsQuery } from '@/api/deeds';
import { useBranchesQuery } from '@/api/branches';
import { roleLabels } from '@/constants/enums';
import { tokens } from '@/constants/tokens';
import type { Role } from '@/types';

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

  const allUsers = usersData?.items ?? [];
  const staffMember = allUsers.find((u) => u.id === id);

  // Assignment
  const { assignment } = useStaffAssignment(id);
  const assignedBranch = branches.find((b: any) => b.id === (assignment?.branchId || (staffMember as any)?.branchId));

  // Compensation Profile
  const { getProfile, updateProfile } = useStaffCompensation(id);
  const compProfile = id ? getProfile(id, staffMember ? getUserFullName(staffMember) : 'Staff', staffMember?.role) : undefined;

  // Live Staff Bonuses
  const { bonuses = [], totalBonusGHS, totalBonusMinor } = useStaffBonuses(id);

  // Live Payroll Records
  const { data: payrollData, isLoading: payrollLoading, refetch: refetchPayroll } = usePayrollQuery({ staffUserId: id });
  const payrollRecords = payrollData?.items ?? [];
  const createPayrollMutation = useCreatePayrollMutation();
  const updatePayrollMutation = useUpdatePayrollMutation();

  // Related Activity & Records
  const { data: prospectsData, isLoading: prospectsLoading } = useProspectsQuery({ assignedUserId: id, pageSize: 100 });
  const { data: appointmentsData, isLoading: appointmentsLoading } = useAppointmentsQuery({ pageSize: 100 });
  const { data: deedsData, isLoading: deedsLoading } = useDeedsQuery({ pageSize: 100 });

  const staffProspects = prospectsData?.items ?? [];
  const staffAppointments = (appointmentsData?.items ?? []).filter((a) => a.createdByUserId === id);
  const staffDeeds = (deedsData?.items ?? []).filter((d) => d.generatedByUserId === id);
  // Attendance & Time Tracking
  const { data: staffAttendance = [], isLoading: attendanceLoading } = useAttendanceQuery({ userId: id });
  const { data: attendanceStats } = useStaffAttendanceStatsQuery(id);

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

  const [form] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [bonusForm] = Form.useForm();
  const [payrollForm] = Form.useForm();
  const [editPayrollForm] = Form.useForm();

  // Activity stream combining prospects, appointments, deeds, and bonuses
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

    bonuses.forEach((b) => {
      list.push({
        id: `bonus-${b.id}`,
        type: 'Incentive Earned',
        icon: <TrophyOutlined style={{ color: '#faad14' }} />,
        title: `Earned Bonus: GH₵ ${b.amountGHS.toFixed(2)} (${bonusTypeLabels[b.bonusType]?.label || 'Bonus'})`,
        detail: b.reason || b.ruleName,
        date: b.earnedAt,
      });
    });

    return list.sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix());
  }, [staffProspects, staffAppointments, staffDeeds, bonuses]);

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
      setStaffAssignment(staffMember.id, {
        branchId: values.branchId,
        departmentId: values.departmentId,
      });
      message.success('Branch & Department assignment updated');
      setAssignModal(false);
    } catch (err: any) {
      message.error('Failed to update assignment');
    }
  };

  const handleManualBonus = (values: any) => {
    try {
      awardBonusForEvent('custom', staffMember, {
        customAmountGHS: values.amountGHS,
        bonusType: values.bonusType || 'sales_bonus',
        notes: values.reason,
      });
      message.success(`Bonus of GH₵ ${values.amountGHS} awarded to ${fullName}!`);
      setAddBonusModal(false);
      bonusForm.resetFields();
    } catch (err: any) {
      message.error('Failed to award bonus');
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
                branchId: assignment?.branchId || (staffMember as any)?.branchId,
                departmentId: assignment?.departmentId || (staffMember as any)?.departmentId || (staffMember as any)?.department,
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
                {assignment?.departmentId && (
                  <Tag color="purple" style={{ fontSize: 13, padding: '3px 10px', borderRadius: 12 }}>
                    {deptLabels[assignment.departmentId] || assignment.departmentId}
                  </Tag>
                )}
                {compProfile && (
                  <Tag color={salaryTypeLabels[compProfile.salaryType]?.color || 'blue'} style={{ fontSize: 13, padding: '3px 10px', borderRadius: 12 }}>
                    {salaryTypeLabels[compProfile.salaryType]?.label || 'Fixed Salary'}
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
                  <Statistic
                    title="Total Prospects"
                    value={staffProspects.length}
                    prefix={<TeamOutlined />}
                    valueStyle={{ color: '#1890ff', fontWeight: 600, fontSize: 18 }}
                  />
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
                        {assignment?.departmentId ? (deptLabels[assignment.departmentId] || assignment.departmentId) : 'General Operations'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Salary Structure">
                        <Tag color={salaryTypeLabels[compProfile?.salaryType || 'fixed']?.color}>
                          {salaryTypeLabels[compProfile?.salaryType || 'fixed']?.label}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Base Pay">
                        <strong>GH₵ {(compProfile?.baseSalaryGHS || 0).toLocaleString()}</strong> / {compProfile?.payFrequency || 'month'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Disbursement">
                        <span>{paymentMethodLabels[compProfile?.paymentDetails?.method || 'bank_transfer']?.icon} {paymentMethodLabels[compProfile?.paymentDetails?.method || 'bank_transfer']?.label}</span>
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
                  <Card title="Quick Operational Summary" style={{ borderRadius: 8 }}>
                    <Row gutter={[16, 16]}>
                      <Col xs={12} sm={8} md={5} lg={5}>
                        <Card size="small" style={{ textAlign: 'center', background: '#f0f5ff', borderRadius: 8, borderColor: '#d6e4ff' }}>
                          <Statistic
                            title="Prospects Registered"
                            value={staffProspects.length}
                            valueStyle={{ color: '#1890ff', fontWeight: 600 }}
                            prefix={<UserOutlined />}
                          />
                        </Card>
                      </Col>
                      <Col xs={12} sm={8} md={5} lg={5}>
                        <Card size="small" style={{ textAlign: 'center', background: '#fff7e6', borderRadius: 8, borderColor: '#ffd591' }}>
                          <Statistic
                            title="Appointments Booked"
                            value={staffAppointments.length}
                            valueStyle={{ color: '#fa8c16', fontWeight: 600 }}
                            prefix={<CalendarOutlined />}
                          />
                        </Card>
                      </Col>
                      <Col xs={12} sm={8} md={4} lg={4}>
                        <Card size="small" style={{ textAlign: 'center', background: '#f6ffed', borderRadius: 8, borderColor: '#b7eb8f' }}>
                          <Statistic
                            title="Deeds Issued"
                            value={staffDeeds.length}
                            valueStyle={{ color: '#52c41a', fontWeight: 600 }}
                            prefix={<FileTextOutlined />}
                          />
                        </Card>
                      </Col>
                      <Col xs={12} sm={12} md={5} lg={5}>
                        <Card size="small" style={{ textAlign: 'center', background: '#fffbe6', borderRadius: 8, borderColor: '#ffe58f' }}>
                          <Statistic
                            title="Accumulated Bonuses"
                            value={totalBonusGHS}
                            prefix="GH₵"
                            precision={2}
                            valueStyle={{ color: '#d48806', fontWeight: 600 }}
                          />
                        </Card>
                      </Col>
                      <Col xs={12} sm={12} md={5} lg={5}>
                        <Card size="small" style={{ textAlign: 'center', background: '#f9f0ff', borderRadius: 8, borderColor: '#d3adf7' }}>
                          <Statistic
                            title="Payroll Runs"
                            value={payrollRecords.length}
                            suffix="runs"
                            valueStyle={{ color: '#722ed1', fontWeight: 600 }}
                            prefix={<DollarOutlined />}
                          />
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
                          <Tag color={salaryTypeLabels[compProfile?.salaryType || 'fixed']?.color}>
                            {salaryTypeLabels[compProfile?.salaryType || 'fixed']?.label}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Base Salary">
                          <strong>GH₵ {(compProfile?.baseSalaryGHS || 0).toLocaleString()}</strong> ({compProfile?.payFrequency || 'monthly'})
                        </Descriptions.Item>
                        <Descriptions.Item label="Sales Commission">
                          {compProfile?.commissionPercentage ? `${compProfile.commissionPercentage}% per closed sale` : compProfile?.commissionFlatGHS ? `GH₵ ${compProfile.commissionFlatGHS} flat / sale` : 'None configured'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Disbursement Method">
                          <span>{paymentMethodLabels[compProfile?.paymentDetails?.method || 'bank_transfer']?.icon} {paymentMethodLabels[compProfile?.paymentDetails?.method || 'bank_transfer']?.label}</span>
                          {compProfile?.paymentDetails?.accountNumber && (
                            <div><Text type="secondary">Acct: {compProfile.paymentDetails.accountNumber} ({compProfile.paymentDetails.bankName || 'Bank'})</Text></div>
                          )}
                          {compProfile?.paymentDetails?.momoNumber && (
                            <div><Text type="secondary">MoMo: {compProfile.paymentDetails.momoNumber} ({compProfile.paymentDetails.momoProvider})</Text></div>
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
                        <Descriptions.Item label="Transport Allowance">
                          GH₵ {(compProfile?.allowances?.transportGHS || 0).toLocaleString()}
                        </Descriptions.Item>
                        <Descriptions.Item label="Housing Allowance">
                          GH₵ {(compProfile?.allowances?.housingGHS || 0).toLocaleString()}
                        </Descriptions.Item>
                        <Descriptions.Item label="Meal Allowance">
                          GH₵ {(compProfile?.allowances?.mealGHS || 0).toLocaleString()}
                        </Descriptions.Item>
                        <Descriptions.Item label="SSNIT / Income Tax">
                          - GH₵ {(compProfile?.deductions?.taxSSNITGHS || 0).toLocaleString()}
                        </Descriptions.Item>
                        <Descriptions.Item label="Loan Repayments">
                          - GH₵ {(compProfile?.deductions?.loanRepaymentGHS || 0).toLocaleString()}
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
                      const typeInfo = bonusTypeLabels[b.bonusType] || bonusTypeLabels.custom;
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
                                <Tag color={typeInfo.color}>{typeInfo.label}</Tag>
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
            label: <span><TeamOutlined /> Assigned Prospects ({staffProspects.length})</span>,
            children: (
              <Card title="Marketer Prospects Portfolio">
                {staffProspects.length > 0 ? (
                  <Table
                    columns={[
                      {
                        title: 'Prospect Name',
                        key: 'name',
                        render: (_: any, p: any) => (
                          <a onClick={() => navigate(`/marketing/prospects/${p.id}`)}>
                            {p.firstName} {p.lastName}
                          </a>
                        ),
                      },
                      { title: 'Phone', dataIndex: 'phoneNumber', key: 'phone' },
                      { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color="blue">{v}</Tag> },
                      { title: 'Date Registered', dataIndex: 'createdAt', key: 'date', render: (v: string) => dayjs(v).format('MMM D, YYYY') },
                    ]}
                    dataSource={staffProspects}
                    rowKey="id"
                    pagination={{ pageSize: 5 }}
                    size="small"
                    scroll={{ x: 600 }}
                  />
                ) : (
                  <Empty description="No prospects assigned to this staff member." />
                )}
              </Card>
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
                    <Option key={k} value={k}>{v.icon} {v.label}</Option>
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
              <Form.Item name="deductionsGHS" label="Deductions (GH₵)" initialValue={compProfile?.deductions?.taxSSNITGHS || 0}>
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
        onSave={(updated) => {
          if (id) {
            updateProfile(id, updated);
            message.success('Staff compensation package updated successfully');
          }
        }}
      />
    </div>
  );
};
