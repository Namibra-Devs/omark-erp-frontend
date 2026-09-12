// src/pages/branches/PayrollPage.tsx
import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
  useBonusRulesQuery,
  useBonusesQuery,
  useAwardBonusMutation,
  bonusTypeLabels,
  type StaffBonusRecord,
  type BonusType,
} from '@/api/bonuses';
import {
  useStaffCompensationQuery,
  useUpdateStaffCompensationMutation,
  salaryTypeLabels,
  paymentMethodLabels,
  payFrequencyLabels,
  type StaffCompensationProfile,
  type SalaryType,
  type PaymentMethod,
  type PayFrequency,
} from '@/api/compensation';
import {
  usePayrollQuery,
  useCreatePayrollMutation,
  useBulkPayrollRunMutation,
  useUpdatePayrollMutation,
  type PayrollRecord,
} from '@/api/payroll';
import { roleLabels } from '@/constants/enums';
import { tokens } from '@/constants/tokens';

const { Text, Title, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export const PayrollPage: React.FC = () => {
  const { branchId } = useParams<{ branchId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { branches } = useBranchContext();
  const { hasRole } = useAuth();
  const isAdmin = hasRole(['admin', 'super_admin']);
  const isAccountsOrAdmin = hasRole(['admin', 'super_admin', 'accountant', 'branch_manager']);
  
  const { data: usersData } = useUsersQuery();
  const staffUsers = useMemo(() => {
    return (usersData?.items ?? []).filter((u: any) => u.isActive !== false);
  }, [usersData]);

  const [activeTab, setActiveTab] = useState<'payroll' | 'compensation' | 'rules' | 'bonuses'>('payroll');
  const [selectedMonth, setSelectedMonth] = useState<string>(dayjs().format('YYYY-MM'));
  const [selectedBranch, setSelectedBranch] = useState<string>(branchId || 'all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
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

  const { data: payrollData, isLoading, refetch } = usePayrollQuery({ branchId: selectedBranch !== 'all' ? selectedBranch : undefined });
  const rawPayroll = payrollData?.items ?? [];
  const staffUserIds = useMemo(() => new Set(staffUsers.map((u: any) => u.id)), [staffUsers]);
  const payroll = useMemo(() => {
    // Display statements tied to registered staff members; fallback to all raw records if staff list is loading
    if (staffUsers.length === 0) return rawPayroll;
    return rawPayroll.filter((p: any) => !p.staffUserId || staffUserIds.has(p.staffUserId));
  }, [rawPayroll, staffUsers.length, staffUserIds]);

  const createPayroll = useCreatePayrollMutation();
  const bulkPayrollRun = useBulkPayrollRunMutation();
  const updatePayroll = useUpdatePayrollMutation();

  const { data: bonusRulesList = [] } = useBonusRulesQuery();
  const { data: rawBonusesList = [] } = useBonusesQuery();
  const allBonusesList = useMemo(() => {
    return (rawBonusesList ?? []).filter((b: any) => b.userId && staffUserIds.has(b.userId));
  }, [rawBonusesList, staffUserIds]);
  const awardBonusMutation = useAwardBonusMutation();
  const updateCompensationMutation = useUpdateStaffCompensationMutation();

  const [customCompProfiles, setCustomCompProfiles] = useState<StaffCompensationProfile[]>(() => {
    try {
      const stored = localStorage.getItem('omark_staff_compensation_configs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const compProfiles: StaffCompensationProfile[] = useMemo(() => {
    return customCompProfiles.filter((p) => p.userId && staffUserIds.has(p.userId));
  }, [customCompProfiles, staffUserIds]);

  const getProfile = (userId?: string): Partial<StaffCompensationProfile> => {
    const found = compProfiles.find((p) => p.userId === userId);
    return found || {
      salaryType: 'monthly',
      baseSalaryGHS: 0,
      baseSalaryMinor: 0,
      paymentMethod: 'bank_transfer',
    };
  };

  const totalNetMinor = payroll.reduce((sum: number, p: any) => sum + (p.netSalaryMinor || 0), 0);
  const totalBonusMinor = payroll.reduce((sum: number, p: any) => sum + (p.bonusMinor || 0), 0);
  const pendingCount = payroll.filter((p: any) => p.status === 'pending').length;
  const approvedCount = payroll.filter((p: any) => p.status === 'approved').length;

  const isAccountsContext = location.pathname.startsWith('/accounts');
  const backTarget = isAccountsContext ? '/accounts/dashboard' : '/head-office';
  const backLabel = isAccountsContext ? 'Accounts Dashboard' : 'Head Office';

  // ── Auto-populate complete compensation profile into the Add Payroll Form ──
  const handleStaffSelect = (staffUserId: string) => {
    const selectedStaff = staffUsers.find((u) => u.id === staffUserId);
    if (!selectedStaff) return;

    const staffBonuses = allBonusesList.filter((b: any) => b.userId === staffUserId);
    
    // Categorize bonuses
    const salesBonusGHS = staffBonuses.filter((b: any) => b.bonusType === 'prospect_conversion').reduce((s: number, b: any) => s + (b.amountGHS || 0), 0);
    const attendanceBonusGHS = staffBonuses.filter((b: any) => b.bonusType === 'punctuality_streak').reduce((s: number, b: any) => s + (b.amountGHS || 0), 0);
    const punctualityBonusGHS = staffBonuses.filter((b: any) => b.bonusType === 'punctuality_streak').reduce((s: number, b: any) => s + (b.amountGHS || 0), 0);
    const productivityBonusGHS = staffBonuses.filter((b: any) => b.bonusType === 'monthly_target_met').reduce((s: number, b: any) => s + (b.amountGHS || 0), 0);
    const projectBonusGHS = staffBonuses.filter((b: any) => b.bonusType === 'deed_completion').reduce((s: number, b: any) => s + (b.amountGHS || 0), 0);
    const totalBonusGHS = staffBonuses.reduce((sum: number, b: any) => sum + (b.amountGHS || 0), 0);

    form.setFieldsValue({
      salaryType: (selectedStaff as any)?.salaryType || 'monthly',
      basePayGHS: (selectedStaff as any)?.baseSalaryGHS || 0,
      transportGHS: 0,
      housingGHS: 0,
      mealGHS: 0,
      otherAllowanceGHS: 0,
      overtimeGHS: 0,
      commissionGHS: 0,
      salesBonusGHS,
      attendanceBonusGHS,
      punctualityBonusGHS,
      productivityBonusGHS,
      advanceDeductionGHS: 0,
      latenessDeductionGHS: 0,
      absenceDeductionGHS: 0,
      otherDeductionGHS: 0,
      paymentMethod: (selectedStaff as any)?.paymentMethod || 'bank_transfer',
      branchId: (selectedStaff as any)?.branchId || undefined,
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
        deductionsMinor,
        paymentMethod: values.paymentMethod || comp.paymentMethod,
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

  const handleAwardDirectBonus = async (values: any) => {
    const selectedStaff = staffUsers.find((u) => u.id === values.staffUserId);
    if (!selectedStaff) return;
    try {
      const amountGHS = Number(values.amountGHS) || 0;
      await awardBonusMutation.mutateAsync({
        userId: values.staffUserId,
        staffUserId: values.staffUserId,
        staffName: getUserFullName(selectedStaff),
        branchId: (selectedStaff as any).branchId || branchId || (selectedBranch !== 'all' ? selectedBranch : undefined),
        amountGHS,
        amountMinor: Math.round(amountGHS * 100),
        reason: values.reason,
        bonusType: values.bonusType || 'monthly_target_met',
      });
      message.success(`Bonus of GH₵ ${amountGHS.toFixed(2)} successfully awarded to ${getUserFullName(selectedStaff)}!`);
      setAwardBonusModalOpen(false);
      awardBonusForm.resetFields();
      refetch();
    } catch (err: any) {
      message.error(err?.message || 'Failed to award bonus');
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
        const salaryTypeConfig = salaryTypeLabels[r.salaryType || comp.salaryType || 'monthly'];

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
              <Tag color="blue" style={{ fontSize: 10 }}>
                {salaryTypeConfig || 'Monthly'}
              </Tag>
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
            <Tag style={{ fontSize: 11 }}>{roleLabels[p.staffRole as keyof typeof roleLabels] || p.staffRole || 'Staff'}</Tag>
          </div>
        </div>
      ),
    },
    {
      title: 'Salary Type',
      key: 'type',
      render: (_: any, p: StaffCompensationProfile) => {
        const typeInfo = salaryTypeLabels[p.salaryType] || salaryTypeLabels.monthly;
        return (
          <Tag color="blue" style={{ fontWeight: 600 }}>
            {typeInfo}
          </Tag>
        );
      },
    },
    {
      title: 'Base Pay (GH₵)',
      key: 'base',
      render: (_: any, p: StaffCompensationProfile) => (
        (p.baseSalaryGHS || 0) > 0 ? (
          <span style={{ fontWeight: 600 }}>GH₵ {(p.baseSalaryGHS || 0).toLocaleString()}</span>
        ) : (
          <span style={{ color: '#bbb' }}>—</span>
        )
      ),
    },
    {
      title: 'Commission / Deal',
      key: 'commission',
      render: (_: any, p: StaffCompensationProfile) => {
        if ((p.commissionRatePct || 0) > 0) return <Tag color="purple">{p.commissionRatePct}% of Sale</Tag>;
        return <span style={{ color: '#bbb' }}>—</span>;
      },
    },
    {
      title: 'Payment Method',
      key: 'payment',
      render: (_: any, p: StaffCompensationProfile) => {
        const methodInfo = paymentMethodLabels[p.paymentMethod || 'bank_transfer'] || 'Bank Transfer';
        return (
          <span>
            {methodInfo}
            {p.bankName && <Text type="secondary" style={{ fontSize: 11 }}> ({p.bankName})</Text>}
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
            title="Remove Compensation Profile"
            description={`Remove configured compensation profile for ${p.staffName}?`}
            onConfirm={() => {
              setCustomCompProfiles((prev) => {
                const filtered = prev.filter((item) => item.userId !== p.userId);
                localStorage.setItem('omark_staff_compensation_configs', JSON.stringify(filtered));
                return filtered;
              });
              message.success(`Compensation profile for ${p.staffName} removed.`);
            }}
            okText="Remove"
            okType="danger"
          >
            <Tooltip title="Remove compensation profile">
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
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setEditingCompProfile(null);
                      setCompensationModalOpen(true);
                    }}
                  >
                    Configure Staff Compensation
                  </Button>
                }
              >
                {compProfiles.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                    <TeamOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
                    <Text type="secondary">No staff compensation packages configured yet. Click "Configure Staff Compensation" to set up an employee.</Text>
                  </div>
                ) : (
                  <Table
                    columns={compColumns}
                    dataSource={compProfiles}
                    rowKey="userId"
                    pagination={{ pageSize: 10 }}
                    size="middle"
                    scroll={{ x: 950 }}
                  />
                )}
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
                {bonusRulesList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                    <SettingOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
                    <Text type="secondary">No bonus rules configured yet. Click "Manage / Add Rules" to set up incentive rules.</Text>
                  </div>
                ) : (
                  <Row gutter={[16, 16]}>
                    {bonusRulesList.map((r: any) => {
                      const label = bonusTypeLabels[r.bonusType as keyof typeof bonusTypeLabels] || r.bonusType || 'Performance Bonus';
                      return (
                        <Col xs={24} sm={12} md={8} key={r.id}>
                          <Card size="small" style={{ borderRadius: 8, height: '100%', borderColor: r.isActive ? undefined : '#f0f0f0' }}>
                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                              <Tag color="gold"><TrophyOutlined /> {label}</Tag>
                              <Tag color={r.isActive ? 'green' : 'default'}>{r.isActive ? 'Active' : 'Disabled'}</Tag>
                            </Space>
                            <Title level={5} style={{ marginTop: 8, marginBottom: 4 }}>{r.ruleName || r.name}</Title>
                            <Text strong style={{ fontSize: 16, color: '#389e0d' }}>
                              GH₵ {(r.rewardAmountGHS ?? r.amountGHS ?? 0).toFixed(2)}
                            </Text>
                            <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 6, marginBottom: 4 }}>
                              {r.description}
                            </Paragraph>
                            {(r.qualificationCriteria || r.criteria) && (
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                <strong>Target:</strong> {r.qualificationCriteria || r.criteria}
                              </Text>
                            )}
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>
                )}
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
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setAwardBonusModalOpen(true)}>
                      Award Staff Incentive
                    </Button>
                  </Space>
                }
              >
                <List
                  itemLayout="horizontal"
                  dataSource={allBonusesList}
                  locale={{ emptyText: 'No bonus records awarded yet' }}
                  renderItem={(item: any) => {
                    const label = bonusTypeLabels[item.bonusType as keyof typeof bonusTypeLabels] || item.bonusType || 'Bonus';
                    return (
                      <List.Item
                        extra={
                          <Space size={12} align="center">
                            <div style={{ textAlign: 'right' }}>
                              <Tag color="green" style={{ fontSize: 14, fontWeight: 700, padding: '4px 12px' }}>
                                + GH₵ {(item.amountGHS || 0).toFixed(2)}
                              </Tag>
                              <div>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {dayjs(item.earnedAt || item.createdAt).format('MMM D, YYYY h:mm A')}
                                </Text>
                              </div>
                            </div>
                          </Space>
                        }
                      >
                        <List.Item.Meta
                          avatar={<Avatar style={{ backgroundColor: '#f6ffed', color: '#52c41a' }} icon={<TrophyOutlined />} />}
                          title={
                            <Space>
                              <Text strong>{item.staffName || 'Staff Member'}</Text>
                              <Tag color="gold">{label}</Tag>
                              {item.role && <Tag color="blue">{roleLabels[item.role as keyof typeof roleLabels] || item.role}</Tag>}
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
                <Option key={k} value={k}>{v}</Option>
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
              <Form.Item name="bonusType" label="Bonus Type" rules={[{ required: true }]} initialValue="prospect_conversion">
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
        staffUsers={staffUsers}
        onSave={async (updated) => {
          const u = updated as any;
          const targetUserId = u.userId || editingCompProfile?.userId;
          if (!targetUserId) return;
          const targetStaff = staffUsers.find((user) => user.id === targetUserId);
          const newProfile: StaffCompensationProfile = {
            id: `comp-${targetUserId}`,
            userId: targetUserId,
            staffName: targetStaff ? getUserFullName(targetStaff) : (u.staffName || 'Staff Member'),
            staffRole: targetStaff?.role || u.staffRole || 'Staff',
            salaryType: (u.salaryType || 'monthly') as SalaryType,
            baseSalaryGHS: u.baseSalaryGHS || 0,
            baseSalaryMinor: (u.baseSalaryGHS || 0) * 100,
            commissionRatePct: u.commissionPercentage || u.commissionRatePct || 0,
            paymentMethod: (u.paymentDetails?.method || u.paymentMethod || 'bank_transfer') as PaymentMethod,
            bankName: u.paymentDetails?.bankName || u.bankName,
            bankAccountNumber: u.paymentDetails?.accountNumber || u.bankAccountNumber,
            bankAccountName: u.paymentDetails?.accountName || u.bankAccountName,
            bankBranch: u.paymentDetails?.branchName || u.bankBranch,
            momoNetwork: u.paymentDetails?.momoProvider || u.momoNetwork,
            momoNumber: u.paymentDetails?.momoNumber || u.momoNumber,
            payFrequency: (u.payFrequency || 'monthly') as PayFrequency,
            effectiveDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            notes: u.notes,
          };

          setCustomCompProfiles((prev) => {
            const index = prev.findIndex((p) => p.userId === targetUserId);
            const next = index >= 0 ? prev.map((p, i) => (i === index ? { ...p, ...newProfile } : p)) : [...prev, newProfile];
            localStorage.setItem('omark_staff_compensation_configs', JSON.stringify(next));
            return next;
          });

          try {
            await updateCompensationMutation.mutateAsync({
              userId: targetUserId,
              payload: updated,
            });
          } catch {
            // local state persistence
          }
          message.success(`Staff compensation package for ${newProfile.staffName} configured successfully`);
        }}
      />
    </div>
  );
};
