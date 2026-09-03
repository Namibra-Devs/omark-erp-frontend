// src/pages/branches/PayrollPage.tsx
import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button, Card, Col, Form, Input, InputNumber, Modal, Row, Select,
  Statistic, Table, Tag, message, Tooltip, Popconfirm, Space, Alert, Typography,
  Tabs, Badge, Avatar, Divider, List
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  EditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  DollarOutlined,
  TrophyOutlined,
  ReloadOutlined,
  FileTextOutlined,
  TeamOutlined,
  PercentageOutlined,
  CreditCardOutlined,
  PrinterOutlined,
  AuditOutlined,
  SafetyCertificateOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { PageHeader } from '@/components/shared/PageHeader';
import { BonusRulesModal } from '@/components/bonus/BonusRulesModal';
import { PayslipModal } from '@/components/payroll/PayslipModal';
import { CompensationModal } from '@/components/payroll/CompensationModal';
import { useBranchContext } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUsersQuery, getUserFullName } from '@/api/users';
import {
  useBonusRules,
  useStaffBonuses,
  getStaffBonuses,
  awardBonusForEvent,
  bonusTypeLabels,
  type StaffBonusRecord,
  type BonusType
} from '@/mock/bonusRules';
import {
  useStaffCompensation,
  salaryTypeLabels,
  paymentMethodLabels,
  payFrequencyLabels,
  type StaffCompensationProfile,
  type SalaryType
} from '@/mock/staffCompensation';
import { getStaffAssignment } from '@/mock/staffAssignments';
import {
  usePayrollQuery,
  useCreatePayrollMutation,
  useBulkPayrollRunMutation,
  useUpdatePayrollMutation,
  useDeletePayrollMutation,
  useClearPayrollMutation,
  type PayrollRecord,
} from '@/api/payroll';
import { roleLabels } from '@/constants/enums';
import { tokens } from '@/constants/tokens';

const { Text, Title, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export const PayrollPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { branches } = useBranchContext();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole(['admin']);
  const isManager = hasRole(['admin', 'branch_manager']);
  
  const { data: usersData, refetch: refetchUsers } = useUsersQuery();
  const staffUsers = usersData?.items ?? [];

  const [activeTab, setActiveTab] = useState<'payroll' | 'compensation' | 'rules' | 'bonuses'>('payroll');
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  
  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRecord | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bonusRulesModalOpen, setBonusRulesModalOpen] = useState(false);
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const [payslipRecord, setPayslipRecord] = useState<PayrollRecord | null>(null);
  
  // Compensation Modal
  const [compensationModalOpen, setCompensationModalOpen] = useState(false);
  const [editingCompProfile, setEditingCompProfile] = useState<StaffCompensationProfile | null>(null);
  
  // Direct Bonus Award Modal
  const [awardBonusModalOpen, setAwardBonusModalOpen] = useState(false);
  const [awardBonusForm] = Form.useForm();

  // Payment Confirmation Modal
  const [payConfirmModalOpen, setPayConfirmModalOpen] = useState(false);
  const [recordToPay, setRecordToPay] = useState<PayrollRecord | null>(null);
  const [payForm] = Form.useForm();

  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [bulkForm] = Form.useForm();

  const { data: payrollData, isLoading, refetch } = usePayrollQuery({ branchId });
  const payroll = payrollData?.items ?? [];
  const createPayroll = useCreatePayrollMutation();
  const bulkPayrollRun = useBulkPayrollRunMutation();
  const updatePayroll = useUpdatePayrollMutation();
  const deletePayroll = useDeletePayrollMutation();
  const clearPayroll = useClearPayrollMutation();

  const { profiles: compProfiles, getProfile, updateProfile, deleteProfile } = useStaffCompensation();
  const { rules: bonusRulesList } = useBonusRules();
  const { bonuses: allBonusesList, deleteBonus, clearBonuses } = useStaffBonuses();

  const totalNetMinor = payroll.reduce((sum, p) => sum + (p.netSalaryMinor || 0), 0);
  const totalBonusMinor = payroll.reduce((sum, p) => sum + (p.bonusMinor || 0), 0);
  const pendingCount = payroll.filter((p) => p.status === 'pending').length;
  const approvedCount = payroll.filter((p) => p.status === 'approved').length;

  const isAccountsContext = location.pathname.startsWith('/accounts');
  const backTarget = isAccountsContext ? '/accounts/dashboard' : '/head-office';
  const backLabel = isAccountsContext ? 'Accounts Dashboard' : 'Head Office';

  // ── Auto-populate complete compensation profile into the Add Payroll Form ──
  const handleStaffSelect = (staffUserId: string) => {
    const selectedStaff = staffUsers.find((u) => u.id === staffUserId);
    if (!selectedStaff) return;

    const comp = getProfile(staffUserId, getUserFullName(selectedStaff), selectedStaff.role);
    const assignment = getStaffAssignment(staffUserId);
    const staffBonuses = getStaffBonuses(staffUserId);
    
    // Categorize bonuses
    const salesBonusGHS = staffBonuses.filter(b => b.bonusType === 'sales_bonus').reduce((s, b) => s + b.amountGHS, 0);
    const attendanceBonusGHS = staffBonuses.filter(b => b.bonusType === 'attendance_bonus').reduce((s, b) => s + b.amountGHS, 0);
    const punctualityBonusGHS = staffBonuses.filter(b => b.bonusType === 'punctuality_bonus').reduce((s, b) => s + b.amountGHS, 0);
    const productivityBonusGHS = staffBonuses.filter(b => b.bonusType === 'productivity_bonus').reduce((s, b) => s + b.amountGHS, 0);
    const projectBonusGHS = staffBonuses.filter(b => b.bonusType === 'project_completion_bonus').reduce((s, b) => s + b.amountGHS, 0);
    const totalBonusGHS = staffBonuses.reduce((sum, b) => sum + (b.amountGHS || 0), 0);

    form.setFieldsValue({
      salaryType: comp.salaryType,
      basePayGHS: comp.baseSalaryGHS || 0,
      transportGHS: comp.allowances?.transportGHS || 0,
      housingGHS: comp.allowances?.housingGHS || 0,
      mealGHS: comp.allowances?.mealGHS || 0,
      otherAllowanceGHS: comp.allowances?.otherGHS || 0,
      overtimeGHS: 0,
      commissionGHS: comp.commissionFlatGHS || 0,
      salesBonusGHS,
      attendanceBonusGHS,
      punctualityBonusGHS,
      productivityBonusGHS,
      projectBonusGHS,
      taxSSNITGHS: comp.deductions?.taxSSNITGHS || 0,
      loanRepaymentGHS: comp.deductions?.loanRepaymentGHS || 0,
      advanceDeductionGHS: comp.deductions?.advanceDeductionGHS || 0,
      latenessDeductionGHS: comp.deductions?.latenessDeductionGHS || 0,
      absenceDeductionGHS: comp.deductions?.absenceDeductionGHS || 0,
      otherDeductionGHS: 0,
      paymentMethod: comp.paymentDetails?.method || 'bank_transfer',
      branchId: assignment?.branchId || (selectedStaff as any)?.branchId,
    });
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAdd = async (values: any) => {
    try {
      const selectedStaff = staffUsers.find((u) => u.id === values.staffUserId);
      const staffName = selectedStaff ? getUserFullName(selectedStaff) : 'Staff Member';
      const staffRole = selectedStaff?.role;
      const comp = getProfile(values.staffUserId);

      const baseSalaryMinor = Math.round((values.basePayGHS || 0) * 100);
      const overtimeMinor = Math.round((values.overtimeGHS || 0) * 100);
      const transportAllowanceMinor = Math.round((values.transportGHS || 0) * 100);
      const housingAllowanceMinor = Math.round((values.housingGHS || 0) * 100);
      const mealAllowanceMinor = Math.round((values.mealGHS || 0) * 100);
      const otherAllowanceMinor = Math.round((values.otherAllowanceGHS || 0) * 100);

      const commissionMinor = Math.round((values.commissionGHS || 0) * 100);
      const salesBonusMinor = Math.round((values.salesBonusGHS || 0) * 100);
      const attendanceBonusMinor = Math.round((values.attendanceBonusGHS || 0) * 100);
      const punctualityBonusMinor = Math.round((values.punctualityBonusGHS || 0) * 100);
      const productivityBonusMinor = Math.round((values.productivityBonusGHS || 0) * 100);
      const projectCompletionBonusMinor = Math.round((values.projectBonusGHS || 0) * 100);
      const bonusMinor = commissionMinor + salesBonusMinor + attendanceBonusMinor + punctualityBonusMinor + productivityBonusMinor + projectCompletionBonusMinor;

      const statutoryDeductionMinor = Math.round((values.taxSSNITGHS || 0) * 100);
      const loanDeductionMinor = Math.round((values.loanRepaymentGHS || 0) * 100);
      const advanceDeductionMinor = Math.round((values.advanceDeductionGHS || 0) * 100);
      const latenessDeductionMinor = Math.round((values.latenessDeductionGHS || 0) * 100);
      const absenceDeductionMinor = Math.round((values.absenceDeductionGHS || 0) * 100);
      const otherDeductionMinor = Math.round((values.otherDeductionGHS || 0) * 100);
      const deductionsMinor = statutoryDeductionMinor + loanDeductionMinor + advanceDeductionMinor + latenessDeductionMinor + absenceDeductionMinor + otherDeductionMinor;

      const grossEarningsMinor = baseSalaryMinor + overtimeMinor + transportAllowanceMinor + housingAllowanceMinor + mealAllowanceMinor + otherAllowanceMinor + bonusMinor;
      const netSalaryMinor = grossEarningsMinor - deductionsMinor;

      await createPayroll.mutateAsync({
        staffUserId: values.staffUserId,
        month: values.month,
        salaryType: values.salaryType || comp.salaryType,
        baseSalaryMinor,
        overtimeMinor,
        transportAllowanceMinor,
        housingAllowanceMinor,
        mealAllowanceMinor,
        otherAllowanceMinor,
        commissionMinor,
        salesBonusMinor,
        attendanceBonusMinor,
        punctualityBonusMinor,
        productivityBonusMinor,
        projectCompletionBonusMinor,
        bonusMinor,
        statutoryDeductionMinor,
        loanDeductionMinor,
        advanceDeductionMinor,
        latenessDeductionMinor,
        absenceDeductionMinor,
        otherDeductionMinor,
        deductionsMinor,
        paymentMethod: values.paymentMethod || comp.paymentDetails?.method,
        paymentDetails: comp.paymentDetails,
        notes: values.notes,
      });

      message.success(`Payroll entry for ${staffName} submitted for Admin approval`);
      form.resetFields();
      setAddModalOpen(false);
      refetch();
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Failed to add payroll record');
    }
  };

  const handleEditSubmit = async (values: any) => {
    if (!selectedPayroll) return;
    try {
      const baseSalaryMinor = Math.round((values.basePayGHS || 0) * 100);
      const bonusMinor = Math.round((values.bonusGHS || 0) * 100);
      const deductionsMinor = Math.round((values.deductionsGHS || 0) * 100);

      await updatePayroll.mutateAsync({
        id: selectedPayroll.id,
        payload: {
          baseSalaryMinor,
          bonusMinor,
          deductionsMinor,
          status: values.status,
          notes: values.notes,
        },
      });
      message.success('Payroll record updated successfully');
      setEditModalOpen(false);
      setSelectedPayroll(null);
      refetch();
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Failed to update payroll');
    }
  };

  const handleApprove = async (record: PayrollRecord) => {
    try {
      await updatePayroll.mutateAsync({
        id: record.id,
        payload: { status: 'approved' },
      });
      message.success(`Payroll record for ${record.staffName || record.month} approved!`);
      refetch();
    } catch (err: any) {
      message.error('Failed to approve payroll');
    }
  };

  const openPayConfirm = (record: PayrollRecord) => {
    setRecordToPay(record);
    const idSnippet = (record.staffUserId || record.code || record.id || 'STAFF').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4);
    payForm.setFieldsValue({
      paymentReference: `PAY-${dayjs().format('YYYYMMDD')}-${idSnippet}`,
      paymentMethod: record.paymentMethod || 'bank_transfer',
    });
    setPayConfirmModalOpen(true);
  };

  const handleConfirmPayment = async (values: any) => {
    if (!recordToPay) return;
    try {
      const updated = await updatePayroll.mutateAsync({
        id: recordToPay.id,
        payload: {
          status: 'paid',
          paidAt: new Date().toISOString(),
          paymentReference: values.paymentReference,
        },
      });
      message.success(`Salary payment of GH₵ ${((recordToPay.netSalaryMinor || 0) / 100).toLocaleString()} disbursed successfully!`);
      setPayConfirmModalOpen(false);
      setRecordToPay(null);
      refetch();
      // Automatically open the official Payment Receipt modal
      setPayslipRecord(updated);
      setPayslipModalOpen(true);
    } catch (err: any) {
      message.error('Failed to record payment');
    }
  };

  const handleBulkRun = async (values: any) => {
    try {
      const monthStr = typeof values.month === 'string'
        ? values.month
        : (values.month ? dayjs(values.month).format('YYYY-MM') : dayjs().format('YYYY-MM'));
      
      const res = await bulkPayrollRun.mutateAsync({
        month: monthStr,
        branchId: values.branchId || undefined,
        staffList: staffUsers,
      });
      message.success(`Successfully generated ${res?.count || 'all'} staff payroll statements for ${monthStr}!`);
      bulkForm.resetFields();
      setBulkModalOpen(false);
      setActiveTab('payroll');
      refetch();
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Failed to run bulk payroll');
    }
  };

  const handleAwardDirectBonus = (values: any) => {
    const selectedStaff = staffUsers.find((u) => u.id === values.staffUserId);
    if (!selectedStaff) return;
    try {
      awardBonusForEvent('custom', selectedStaff, {
        customAmountGHS: values.amountGHS,
        bonusType: values.bonusType,
        notes: values.reason,
      });
      message.success(`Bonus of GH₵ ${values.amountGHS} successfully awarded to ${getUserFullName(selectedStaff)}!`);
      setAwardBonusModalOpen(false);
      awardBonusForm.resetFields();
    } catch (err: any) {
      message.error('Failed to award bonus');
    }
  };

  // ── Columns for Payroll Table ─────────────────────────────────────────────
  const payrollColumns = [
    {
      title: 'Staff Member',
      key: 'staffName',
      render: (_: any, r: PayrollRecord) => {
        const staffObj = staffUsers.find((u) => u.id === r.staffUserId);
        const name = r.staffName || (staffObj ? getUserFullName(staffObj) : 'Staff Member');
        const role = staffObj ? (roleLabels[staffObj.role as keyof typeof roleLabels] || staffObj.role) : r.staffRole;
        const comp = getProfile(r.staffUserId);
        const salaryTypeConfig = salaryTypeLabels[r.salaryType || comp.salaryType || 'fixed'];

        return (
          <div>
            <Text strong style={{ fontSize: 13 }}>
              {r.staffUserId ? (
                <a onClick={() => navigate(`/admin/users/${r.staffUserId}`)}>{name}</a>
              ) : (
                name
              )}
            </Text>
            <div style={{ marginTop: 2 }}>
              <Tag color={salaryTypeConfig?.color || 'blue'} style={{ fontSize: 10 }}>
                {salaryTypeConfig?.label || 'Fixed'}
              </Tag>
              {role && <Tag style={{ fontSize: 10 }}>{role}</Tag>}
            </div>
          </div>
        );
      },
    },
    { title: 'Month', dataIndex: 'month', key: 'month', width: 90, render: (v: string) => <Tag color="geekblue">{v}</Tag> },
    {
      title: 'Basic Pay',
      key: 'base',
      render: (_: any, r: PayrollRecord) => `GH₵ ${(r.baseSalaryMinor / 100).toLocaleString()}`,
    },
    {
      title: 'Allowances',
      key: 'allowances',
      render: (_: any, r: PayrollRecord) => {
        const allowancesTotal = ((r.transportAllowanceMinor || 0) + (r.housingAllowanceMinor || 0) + (r.mealAllowanceMinor || 0) + (r.otherAllowanceMinor || 0)) / 100;
        return allowancesTotal > 0 ? (
          <span style={{ color: '#52c41a' }}>+ GH₵ {allowancesTotal.toLocaleString()}</span>
        ) : (
          <span style={{ color: '#bbb' }}>—</span>
        );
      },
    },
    {
      title: 'Bonuses & Commission',
      key: 'bonus',
      render: (_: any, r: PayrollRecord) => (r.bonusMinor || 0) > 0 ? (
        <Tag color="green" style={{ fontWeight: 600 }}>
          + GH₵ {((r.bonusMinor || 0) / 100).toLocaleString()}
        </Tag>
      ) : (
        <span style={{ color: '#bbb' }}>—</span>
      ),
    },
    {
      title: 'Deductions',
      key: 'deductions',
      render: (_: any, r: PayrollRecord) => (r.deductionsMinor || 0) > 0 ? (
        <span style={{ color: '#cf1322' }}>- GH₵ {((r.deductionsMinor || 0) / 100).toLocaleString()}</span>
      ) : (
        <span style={{ color: '#bbb' }}>—</span>
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
      title: 'Payment Status',
      key: 'status',
      render: (_: any, r: PayrollRecord) => {
        if (r.status === 'pending') {
          return <Tag color="gold">⏳ Pending Approval</Tag>;
        }
        if (r.status === 'approved') {
          return <Tag color="blue">✅ Approved (Ready)</Tag>;
        }
        return <Tag color="green">💳 Paid & Disbursed</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: PayrollRecord) => (
        <Space size="small">
          {/* Payslip View/Print Modal & Official Receipt */}
          <Tooltip title={r.status === 'paid' ? 'View & Print Official Payment Receipt' : 'View & Print Detailed Payslip'}>
            <Button
              size="small"
              type={r.status === 'paid' ? 'primary' : 'default'}
              ghost={r.status === 'paid'}
              icon={r.status === 'paid' ? <CheckCircleOutlined /> : <FileTextOutlined />}
              onClick={() => {
                setPayslipRecord(r);
                setPayslipModalOpen(true);
              }}
            >
              {r.status === 'paid' ? 'Receipt' : 'Payslip'}
            </Button>
          </Tooltip>

          {/* Approve button for pending records */}
          {r.status === 'pending' && (
            <Tooltip title="Approve payroll entry">
              <Button
                type="primary"
                size="small"
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                onClick={() => handleApprove(r)}
              >
                Approve
              </Button>
            </Tooltip>
          )}

          {/* Accounts/Admin can disburse once approved */}
          {r.status === 'approved' && (
            <Tooltip title="Disburse payment & record transaction">
              <Button
                type="primary"
                size="small"
                icon={<CreditCardOutlined />}
                onClick={() => openPayConfirm(r)}
              >
                Disburse
              </Button>
            </Tooltip>
          )}

          {/* Edit Payroll */}
          <Tooltip title="Edit Entry">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setSelectedPayroll(r);
                editForm.setFieldsValue({
                  basePayGHS: r.baseSalaryMinor / 100,
                  bonusGHS: (r.bonusMinor || 0) / 100,
                  deductionsGHS: (r.deductionsMinor || 0) / 100,
                  status: r.status,
                  notes: r.notes || '',
                });
                setEditModalOpen(true);
              }}
            />
          </Tooltip>

          {/* Delete Payroll Statement */}
          <Popconfirm
            title="Delete Payroll Statement"
            description={`Remove statement ${r.code || r.month} for ${r.staffName}?`}
            onConfirm={() => {
              deletePayroll.mutate(r.id);
              message.success('Payroll statement removed.');
            }}
            okText="Delete"
            okType="danger"
          >
            <Tooltip title="Delete Statement">
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── Columns for Staff Compensation Profiles Table ─────────────────────────
  const compColumns = [
    {
      title: 'Staff Member',
      key: 'name',
      render: (_: any, p: StaffCompensationProfile) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>
            <a onClick={() => navigate(`/admin/users/${p.userId}`)}>{p.staffName}</a>
          </Text>
          <div>
            <Tag style={{ fontSize: 11 }}>{roleLabels[p.role as keyof typeof roleLabels] || p.role}</Tag>
          </div>
        </div>
      ),
    },
    {
      title: 'Salary Type',
      key: 'type',
      render: (_: any, p: StaffCompensationProfile) => {
        const typeInfo = salaryTypeLabels[p.salaryType] || salaryTypeLabels.fixed;
        return (
          <Tag color={typeInfo.color} style={{ fontWeight: 600 }}>
            {typeInfo.label}
          </Tag>
        );
      },
    },
    {
      title: 'Base Pay (GH₵)',
      key: 'base',
      render: (_: any, p: StaffCompensationProfile) => (
        <span style={{ fontWeight: 600 }}>GH₵ {(p.baseSalaryGHS || 0).toLocaleString()}</span>
      ),
    },
    {
      title: 'Total Allowances',
      key: 'allowances',
      render: (_: any, p: StaffCompensationProfile) => {
        const total = (p.allowances?.transportGHS || 0) + (p.allowances?.housingGHS || 0) + (p.allowances?.mealGHS || 0) + (p.allowances?.otherGHS || 0);
        return total > 0 ? <span style={{ color: '#52c41a' }}>+ GH₵ {total.toLocaleString()}</span> : <span style={{ color: '#bbb' }}>—</span>;
      },
    },
    {
      title: 'Deductions (SSNIT/Loan)',
      key: 'deductions',
      render: (_: any, p: StaffCompensationProfile) => {
        const total = (p.deductions?.taxSSNITGHS || 0) + (p.deductions?.loanRepaymentGHS || 0) + (p.deductions?.advanceDeductionGHS || 0);
        return total > 0 ? <span style={{ color: '#cf1322' }}>- GH₵ {total.toLocaleString()}</span> : <span style={{ color: '#bbb' }}>—</span>;
      },
    },
    {
      title: 'Commission / Deal',
      key: 'commission',
      render: (_: any, p: StaffCompensationProfile) => {
        if (p.commissionPercentage > 0) return <Tag color="purple">{p.commissionPercentage}% of Sale</Tag>;
        if (p.commissionFlatGHS > 0) return <Tag color="purple">GH₵ {p.commissionFlatGHS} / deal</Tag>;
        return <span style={{ color: '#bbb' }}>—</span>;
      },
    },
    {
      title: 'Payment Method',
      key: 'payment',
      render: (_: any, p: StaffCompensationProfile) => {
        const methodInfo = paymentMethodLabels[p.paymentDetails?.method || 'bank_transfer'];
        return (
          <span>
            {methodInfo.icon} {methodInfo.label}
            {p.paymentDetails?.bankName && <Text type="secondary" style={{ fontSize: 11 }}> ({p.paymentDetails.bankName})</Text>}
          </span>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, p: StaffCompensationProfile) => (
        <Space size="small">
          <Button
            size="small"
            type="primary"
            ghost
            icon={<EditOutlined />}
            onClick={() => {
              setEditingCompProfile(p);
              setCompensationModalOpen(true);
            }}
          >
            Configure
          </Button>
          <Popconfirm
            title="Reset Compensation Profile"
            description={`Reset ${p.staffName}'s compensation profile to default?`}
            onConfirm={() => {
              deleteProfile(p.userId);
              message.success(`Compensation profile for ${p.staffName} reset to default.`);
            }}
            okText="Reset"
            okType="danger"
          >
            <Tooltip title="Reset to standard defaults">
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden', padding: '0 4px' }}>
      {/* ── TOP HERO HEADER & ACTIONS (RESPONSIVE & CLEAN UX) ─────────────── */}
      <Card
        style={{
          borderRadius: 12,
          marginBottom: 20,
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Space direction="vertical" size={2}>
              <Space align="center" wrap>
                <Title level={3} style={{ margin: 0, color: '#1e293b', fontWeight: 700 }}>
                  Salary, Bonuses & Incentive Management
                </Title>
                <Tag color="blue" style={{ borderRadius: 10, fontWeight: 600 }}>
                  Payroll Hub
                </Tag>
              </Space>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Multi-component salary engine, automated rule-based performance incentives, and disbursement workflow.
              </Text>
            </Space>
          </Col>

          <Col xs={24} lg={12}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start' }}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate(backTarget)}
              >
                {backLabel}
              </Button>
              <Button
                icon={<TrophyOutlined />}
                onClick={() => setAwardBonusModalOpen(true)}
              >
                Award Bonus
              </Button>
              <Button
                icon={<SettingOutlined />}
                onClick={() => setBonusRulesModalOpen(true)}
              >
                Bonus Rules
              </Button>
              <Button
                icon={<PlayCircleOutlined />}
                onClick={() => setBulkModalOpen(true)}
              >
                Bulk Run
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setAddModalOpen(true)}
              >
                Add Payroll Entry
              </Button>
            </div>
          </Col>
        </Row>
      </Card>

      {/* ── TOP EXECUTIVE METRIC STAT CARDS ─────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 8, borderLeft: '4px solid #1890ff' }}>
            <Statistic title="Total Net Payroll" value={totalNetMinor / 100} prefix="GH₵" precision={2} valueStyle={{ fontWeight: 600 }} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 8, borderLeft: '4px solid #52c41a' }}>
            <Statistic title="Total Bonuses Paid" value={totalBonusMinor / 100} prefix="GH₵" precision={2} valueStyle={{ color: '#52c41a', fontWeight: 600 }} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 8, borderLeft: '4px solid #faad14' }}>
            <Statistic title="Pending Admin Approval" value={pendingCount} prefix={<ClockCircleOutlined />} valueStyle={{ color: pendingCount > 0 ? '#faad14' : '#52c41a', fontWeight: 600 }} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderRadius: 8, borderLeft: '4px solid #722ed1' }}>
            <Statistic title="Approved (Ready to Pay)" value={approvedCount} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#722ed1', fontWeight: 600 }} />
          </Card>
        </Col>
      </Row>

      {/* ── 4 COMPREHENSIVE TABS ─────────────────────────────────────────── */}
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as any)}
        type="card"
        size="middle"
        items={[
          {
            key: 'payroll',
            label: <span><DollarOutlined /> Payroll Statements & Runs ({payroll.length})</span>,
            children: (
              <Card
                title="Monthly Staff Compensation Statements"
                extra={
                  payroll.length > 0 ? (
                    <Popconfirm
                      title="Clear All Statements"
                      description="Are you sure you want to clear all payroll statements and reset the list?"
                      onConfirm={() => {
                        clearPayroll.mutate();
                        message.success('All payroll statements cleared.');
                      }}
                      okText="Clear All"
                      okType="danger"
                    >
                      <Button danger size="small" icon={<DeleteOutlined />}>
                        Clear All Statements
                      </Button>
                    </Popconfirm>
                  ) : null
                }
              >
                <Table
                  columns={payrollColumns}
                  dataSource={payroll}
                  rowKey="id"
                  loading={isLoading}
                  pagination={{ pageSize: 10 }}
                  size="middle"
                  scroll={{ x: 1000 }}
                />
              </Card>
            ),
          },
          {
            key: 'compensation',
            label: <span><TeamOutlined /> Staff Compensation Profiles ({compProfiles.length})</span>,
            children: (
              <Card
                title="Staff Salary Structures & Benefits Setup"
                extra={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Configure Fixed, Commission, Mixed, and Incentive-only salary packages
                  </Text>
                }
              >
                <Table
                  columns={compColumns}
                  dataSource={compProfiles}
                  rowKey="userId"
                  pagination={{ pageSize: 10 }}
                  size="middle"
                  scroll={{ x: 950 }}
                />
              </Card>
            ),
          },
          {
            key: 'rules',
            label: <span><SettingOutlined /> Bonus & Incentive Rules ({bonusRulesList.length})</span>,
            children: (
              <Card
                title="Rule-Based Incentive Definitions"
                extra={
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setBonusRulesModalOpen(true)}>
                    Manage / Add Rules
                  </Button>
                }
              >
                <Row gutter={[16, 16]}>
                  {bonusRulesList.map((r) => {
                    const info = bonusTypeLabels[r.bonusType] || bonusTypeLabels.custom;
                    return (
                      <Col xs={24} sm={12} md={8} key={r.id}>
                        <Card size="small" style={{ borderRadius: 8, height: '100%', borderColor: r.isActive ? undefined : '#f0f0f0' }}>
                          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Tag color={info.color}>{info.icon} {info.label}</Tag>
                            <Tag color={r.isActive ? 'green' : 'default'}>{r.isActive ? 'Active' : 'Disabled'}</Tag>
                          </Space>
                          <Title level={5} style={{ marginTop: 8, marginBottom: 4 }}>{r.name}</Title>
                          <Text strong style={{ fontSize: 16, color: '#389e0d' }}>
                            GH₵ {r.amountGHS.toFixed(2)}
                          </Text>
                          <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 6, marginBottom: 4 }}>
                            {r.description}
                          </Paragraph>
                          {r.criteria && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              <strong>Target:</strong> {r.criteria}
                            </Text>
                          )}
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              </Card>
            ),
          },
          {
            key: 'bonuses',
            label: <span><TrophyOutlined /> Incentive & Bonus Ledger ({allBonusesList.length})</span>,
            children: (
              <Card
                title="Staff Activity-Linked Bonus Ledger"
                extra={
                  <Space>
                    {allBonusesList.length > 0 && (
                      <Popconfirm
                        title="Clear Bonus Ledger"
                        description="Are you sure you want to clear all bonus ledger history?"
                        onConfirm={() => {
                          clearBonuses();
                          message.success('Bonus ledger cleared.');
                        }}
                        okText="Clear All"
                        okType="danger"
                      >
                        <Button danger size="middle" icon={<DeleteOutlined />}>
                          Clear Ledger
                        </Button>
                      </Popconfirm>
                    )}
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setAwardBonusModalOpen(true)}>
                      Award Staff Incentive
                    </Button>
                  </Space>
                }
              >
                <List
                  itemLayout="horizontal"
                  dataSource={allBonusesList}
                  renderItem={(item: StaffBonusRecord) => {
                    const typeInfo = bonusTypeLabels[item.bonusType] || bonusTypeLabels.custom;
                    return (
                      <List.Item
                        extra={
                          <Space size={12} align="center">
                            <div style={{ textAlign: 'right' }}>
                              <Tag color="green" style={{ fontSize: 14, fontWeight: 700, padding: '4px 12px' }}>
                                + GH₵ {item.amountGHS.toFixed(2)}
                              </Tag>
                              <div>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {dayjs(item.earnedAt).format('MMM D, YYYY h:mm A')}
                                </Text>
                              </div>
                            </div>
                            <Popconfirm
                              title="Delete Bonus Record"
                              description="Remove this bonus entry from the ledger?"
                              onConfirm={() => {
                                deleteBonus(item.id);
                                message.success('Bonus record removed from ledger.');
                              }}
                              okText="Delete"
                              okType="danger"
                            >
                              <Tooltip title="Delete bonus entry">
                                <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                              </Tooltip>
                            </Popconfirm>
                          </Space>
                        }
                      >
                        <List.Item.Meta
                          avatar={<Avatar style={{ backgroundColor: '#f6ffed', color: '#52c41a' }}>{typeInfo.icon}</Avatar>}
                          title={
                            <Space>
                              <Text strong>{item.staffName}</Text>
                              <Tag color={typeInfo.color}>{typeInfo.label}</Tag>
                              <Tag color="blue">{roleLabels[item.role as keyof typeof roleLabels] || item.role}</Tag>
                            </Space>
                          }
                          description={item.reason}
                        />
                      </List.Item>
                    );
                  }}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* ── ADD MULTI-COMPONENT PAYROLL ENTRY MODAL ───────────────────────── */}
      <Modal
        title="Add Staff Payroll Statement"
        open={addModalOpen}
        onCancel={() => {
          setAddModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={720}
      >
        <Alert
          message="Multi-Component Salary & Incentive Engine"
          description="Select a staff member to auto-load their baseline compensation package, active allowances, fixed deductions, and earned performance bonuses."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item
            name="staffUserId"
            label="Select Staff Member"
            rules={[{ required: true, message: 'Please select a staff member' }]}
          >
            <Select
              showSearch
              placeholder="Search staff member by name or role..."
              optionFilterProp="children"
              onChange={handleStaffSelect}
            >
              {staffUsers.map((u) => (
                <Option key={u.id} value={u.id}>
                  👤 {getUserFullName(u)} — {roleLabels[u.role as keyof typeof roleLabels] || u.role} ({u.email})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="month" label="Payroll Month (YYYY-MM)" rules={[{ required: true }]} initialValue={dayjs().format('YYYY-MM')}>
                <Input placeholder="e.g. 2026-09" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="basePayGHS" label="Base Salary (GH₵)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="GH₵" />
              </Form.Item>
            </Col>
          </Row>

          {/* Allowances Section */}
          <div style={{ background: '#f6ffed', padding: 12, borderRadius: 8, marginBottom: 14, border: '1px solid #b7eb8f' }}>
            <Text strong style={{ color: '#237804', fontSize: 13, display: 'block', marginBottom: 8 }}>
              ➕ Standard Allowances (GH₵)
            </Text>
            <Row gutter={12}>
              <Col span={6}>
                <Form.Item name="transportGHS" label="Transport" style={{ marginBottom: 0 }}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="housingGHS" label="Housing" style={{ marginBottom: 0 }}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="mealGHS" label="Meal" style={{ marginBottom: 0 }}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="overtimeGHS" label="Overtime" style={{ marginBottom: 0 }}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </div>

          {/* Rule-Based Bonuses */}
          <div style={{ background: '#f9f0ff', padding: 12, borderRadius: 8, marginBottom: 14, border: '1px solid #d3adf7' }}>
            <Text strong style={{ color: '#531dab', fontSize: 13, display: 'block', marginBottom: 8 }}>
              🎯 Rule-Based Bonuses & Commission (GH₵)
            </Text>
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="salesBonusGHS" label="Sales / Plot Bonus" style={{ marginBottom: 8 }}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="attendanceBonusGHS" label="Attendance Bonus" style={{ marginBottom: 8 }}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="productivityBonusGHS" label="Productivity Bonus" style={{ marginBottom: 8 }}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </div>

          {/* Deductions Section */}
          <div style={{ background: '#fff1f0', padding: 12, borderRadius: 8, marginBottom: 14, border: '1px solid #ffa39e' }}>
            <Text strong style={{ color: '#cf1322', fontSize: 13, display: 'block', marginBottom: 8 }}>
              ➖ Deductions & Recoveries (GH₵)
            </Text>
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="taxSSNITGHS" label="SSNIT / Tax" style={{ marginBottom: 0 }}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="loanRepaymentGHS" label="Loan Repayment" style={{ marginBottom: 0 }}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="advanceDeductionGHS" label="Salary Advance" style={{ marginBottom: 0 }}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </div>

          <Form.Item name="notes" label="Notes & Adjustments">
            <TextArea rows={2} placeholder="Optional notes regarding bonus rules, allowances or deductions..." />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAddModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={createPayroll.isPending}>
                Submit for Approval
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── DISBURSEMENT / PAYMENT CONFIRMATION MODAL ─────────────────────── */}
      <Modal
        title="Disburse & Mark Salary as Paid"
        open={payConfirmModalOpen}
        onCancel={() => setPayConfirmModalOpen(false)}
        footer={null}
        width={480}
      >
        <Alert
          message={`Disbursing GH₵ ${(((recordToPay?.netSalaryMinor || 0) / 100)).toLocaleString()} to ${recordToPay?.staffName || 'Staff Member'}`}
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={payForm} layout="vertical" onFinish={handleConfirmPayment}>
          <Form.Item name="paymentReference" label="Transaction / Transfer Reference" rules={[{ required: true }]}>
            <Input placeholder="e.g. GCB-TRF-20260901-001" />
          </Form.Item>
          <Form.Item name="paymentMethod" label="Payment Channel">
            <Select>
              {Object.entries(paymentMethodLabels).map(([k, v]) => (
                <Option key={k} value={k}>{v.icon} {v.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setPayConfirmModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={updatePayroll.isPending}>
                Confirm Payment & Generate Receipt
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── AWARD DIRECT INCENTIVE MODAL ─────────────────────────────────── */}
      <Modal
        title="Award Direct Staff Incentive / Bonus"
        open={awardBonusModalOpen}
        onCancel={() => setAwardBonusModalOpen(false)}
        footer={null}
        width={500}
      >
        <Form form={awardBonusForm} layout="vertical" onFinish={handleAwardDirectBonus}>
          <Form.Item name="staffUserId" label="Select Staff Member" rules={[{ required: true }]}>
            <Select showSearch placeholder="Select staff member">
              {staffUsers.map((u) => (
                <Option key={u.id} value={u.id}>
                  👤 {getUserFullName(u)} ({roleLabels[u.role as keyof typeof roleLabels] || u.role})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="bonusType" label="Bonus Type" rules={[{ required: true }]} initialValue="sales_bonus">
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
            <TextArea rows={2} placeholder="e.g. Executed plot sales contract at Oyarifa site..." />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAwardBonusModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Award Incentive
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── EDIT PAYROLL ENTRY MODAL ─────────────────────────────────────── */}
      <Modal
        title="Edit Staff Payroll Entry"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setSelectedPayroll(null);
        }}
        footer={null}
        width={540}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
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

          <Form.Item name="status" label="Approval / Payment Status">
            <Select>
              <Option value="pending">⏳ Awaiting Admin Approval</Option>
              <Option value="approved">✅ Approved by Admin</Option>
              <Option value="paid">💳 Paid & Disbursed</Option>
            </Select>
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setEditModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={updatePayroll.isPending}>
                Save Changes
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── BULK PAYROLL RUN MODAL ───────────────────────────────────────── */}
      <Modal title="Generate Bulk Payroll Run" open={bulkModalOpen} onCancel={() => setBulkModalOpen(false)} footer={null} destroyOnClose>
        <Form form={bulkForm} layout="vertical" onFinish={handleBulkRun}>
          <Form.Item name="month" label="Month (YYYY-MM)" rules={[{ required: true, message: 'Please enter month' }]} initialValue={dayjs().format('YYYY-MM')}>
            <Input placeholder="e.g. 2026-09" />
          </Form.Item>
          <Form.Item name="branchId" label="Branch (Optional)">
            <Select allowClear placeholder="All branches" options={branches.map((b) => ({ value: b.id, label: b.name }))} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setBulkModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={bulkPayrollRun.isPending}>
                Generate Run (Submits for Approval)
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── BONUS RULES MODAL ────────────────────────────────────────────── */}
      <BonusRulesModal
        open={bonusRulesModalOpen}
        onClose={() => setBonusRulesModalOpen(false)}
      />

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
        onClose={() => {
          setCompensationModalOpen(false);
          setEditingCompProfile(null);
        }}
        profile={editingCompProfile}
        onSave={(updated) => {
          if (editingCompProfile) {
            updateProfile(editingCompProfile.userId, updated);
            message.success('Staff compensation package updated successfully');
          }
        }}
      />
    </div>
  );
};
