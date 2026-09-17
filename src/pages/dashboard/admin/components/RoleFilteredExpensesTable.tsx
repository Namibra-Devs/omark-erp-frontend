// src/pages/dashboard/admin/components/RoleFilteredExpensesTable.tsx
import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Statistic,
  Table,
  Tag,
  Space,
  Button,
  Segmented,
  Input,
  Select,
  Modal,
  Form,
  InputNumber,
  DatePicker,
  Tooltip,
  Descriptions,
  Badge,
  Popconfirm,
  message,
  Avatar,
  Divider,
  Radio,
} from 'antd';
import {
  DollarOutlined,
  UserOutlined,
  RiseOutlined,
  ShopOutlined,
  BankOutlined,
  SafetyCertificateOutlined,
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  ExportOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FilterOutlined,
  FileTextOutlined,
  CalendarOutlined,
  CarOutlined,
  CoffeeOutlined,
  NotificationOutlined,
  ThunderboltOutlined,
  MailOutlined,
  PhoneOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAuth } from '@/contexts/AuthContext';
import {
  useExpensesQuery,
  useCreateExpenseMutation,
  useExpenseDecisionMutation,
  EXPENSES_STORAGE_KEY,
  type ExpenseEntity,
  type CreateExpensePayload,
} from '@/api/expenses';
import { useBranchContext } from '@/contexts/BranchContext';
import { useBranchesQuery } from '@/api/branches';
import {
  useUsersQuery,
  getUserFullName,
  getUserPhone,
  type UserEntity,
} from '@/api/users';
import { filterEntitiesByBranch } from '@/utils/branchIsolation';
import { tokens } from '@/constants/tokens';
import type { Role } from '@/types';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export interface RoleFilteredExpensesTableProps {
  title?: string;
  subtitle?: string;
  style?: React.CSSProperties;
}

export interface EnrichedExpenseEntity extends ExpenseEntity {
  liveAvatar?: string;
  liveEmail?: string;
  livePhone?: string;
  liveDepartment?: string;
  isLiveSystemUser?: boolean;
}

// Role display configurations
export const ROLE_CONFIGS: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ReactNode; description: string }
> = {
  secretary: {
    label: 'Secretary',
    color: '#13c2c2',
    bg: '#e6fffb',
    icon: <UserOutlined />,
    description: 'Front desk, office stationery, client refreshments & courier dispatch',
  },
  marketing_director: {
    label: 'Marketing Director',
    color: '#fa8c16',
    bg: '#fff7e6',
    icon: <RiseOutlined />,
    description: 'Highway mega-billboards, property expos, digital ads & brochure printing',
  },
  branch_manager: {
    label: 'Branch Manager',
    color: '#1890ff',
    bg: '#e6f7ff',
    icon: <ShopOutlined />,
    description: 'Standby generator diesel, client inspection transit, AC & premise repairs',
  },
  accounts: {
    label: 'Accounts',
    color: '#52c41a',
    bg: '#f6ffed',
    icon: <BankOutlined />,
    description: 'Statutory fees, Lands Commission title searches & financial filing',
  },
  admin: {
    label: 'Admin',
    color: '#722ed1',
    bg: '#f9f0ff',
    icon: <SafetyCertificateOutlined />,
    description: 'Executive IT cloud hosting, data security compliance & audit overheads',
  },
  marketing_staff: {
    label: 'Marketing Staff',
    color: '#eb2f96',
    bg: '#fff0f6',
    icon: <NotificationOutlined />,
    description: 'Field marketing allowances, prospect transport & site flyers',
  },
  customer_service: {
    label: 'Customer Service',
    color: '#2f54eb',
    bg: '#f0f5ff',
    icon: <CoffeeOutlined />,
    description: 'Client onboarding refreshments & customer care materials',
  },
};

export const getRoleConfig = (role?: string) => {
  const normalized = (role || 'branch_manager').toLowerCase();
  return (
    ROLE_CONFIGS[normalized] || {
      label: normalized.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      color: '#595959',
      bg: '#fafafa',
      icon: <UserOutlined />,
      description: 'General staff expenses',
    }
  );
};

export const formatCurrency = (minor: number) => {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
  }).format((minor || 0) / 100);
};

export const RoleFilteredExpensesTable: React.FC<RoleFilteredExpensesTableProps> = ({
  title = 'Role-Filtered Expense Tracking & Disbursement',
  subtitle = 'Monitor and audit expenditures separated by staff roles (Secretary, Marketing Director, Branch Manager, and more).',
  style,
}) => {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole(['admin', 'accounts']);
  const { branches: contextBranches } = useBranchContext();
  const { data: apiBranches = [] } = useBranchesQuery();
  const branches: Array<{ id: string; name: string; [key: string]: any }> =
    apiBranches.length > 0 ? apiBranches : contextBranches;

  // ── Live Data Queries ──────────────────────────────────────────────────────
  const { data: expensesData, isLoading: expensesLoading, refetch: refetchExpenses } = useExpensesQuery();
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useUsersQuery({ pageSize: 1000 });
  const liveUsers: UserEntity[] = useMemo(() => usersData?.items ?? [], [usersData]);

  const createExpenseMutation = useCreateExpenseMutation();
  const decisionMutation = useExpenseDecisionMutation();

  // ── Fast User Dictionaries ─────────────────────────────────────────────────
  const { usersById, usersByName } = useMemo(() => {
    const byId = new Map<string, UserEntity>();
    const byName = new Map<string, UserEntity>();
    liveUsers.forEach((u) => {
      byId.set(u.id, u);
      const fullName = getUserFullName(u).toLowerCase().trim();
      if (fullName) byName.set(fullName, u);
      const firstLast = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().trim();
      if (firstLast) byName.set(firstLast, u);
      if (u.email) byName.set(u.email.toLowerCase().trim(), u);
    });
    return { usersById: byId, usersByName: byName };
  }, [liveUsers]);

  // ── Real-Time Cross-System Event Sync ──────────────────────────────────────
  useEffect(() => {
    const onExpensesChanged = () => {
      refetchExpenses();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === EXPENSES_STORAGE_KEY) {
        refetchExpenses();
      }
    };
    window.addEventListener('omark-expenses-changed', onExpensesChanged);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('omark-expenses-changed', onExpensesChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, [refetchExpenses]);

  // ── Reconcile Raw Expenses with Live System Users & Branches ────────────────
  const rawExpenses = expensesData?.items ?? [];
  const enrichedExpenses: EnrichedExpenseEntity[] = useMemo(() => {
    return rawExpenses.map((expense) => {
      // 1. Resolve live user
      let matchedUser: UserEntity | undefined;
      if (expense.recordedByUserId) {
        matchedUser = usersById.get(expense.recordedByUserId);
      }
      if (!matchedUser && expense.recordedByUserName) {
        matchedUser = usersByName.get(expense.recordedByUserName.toLowerCase().trim());
      }

      // 2. Resolve live role
      const liveRole = matchedUser?.role || expense.recordedByUserRole || 'branch_manager';

      // 3. Resolve live name
      const liveName = matchedUser
        ? getUserFullName(matchedUser)
        : (expense.recordedByUserName || 'Staff Member');

      // 4. Resolve live branch
      const branchId = expense.branchId || matchedUser?.branchId || (matchedUser as any)?.branch;
      const branchObj = branches.find((b) => b.id === branchId);
      const liveBranchName = expense.branchName || branchObj?.name || 'Head Office';

      // 5. Live contact & avatar info
      const liveAvatar = matchedUser?.avatarUrl || matchedUser?.photoUrl || matchedUser?.profilePictureUrl;
      const liveEmail = matchedUser?.email;
      const livePhone = matchedUser ? getUserPhone(matchedUser) : undefined;
      const liveDepartment = matchedUser?.department;

      return {
        ...expense,
        recordedByUserRole: liveRole,
        recordedByUserName: liveName,
        branchId,
        branchName: liveBranchName,
        liveAvatar,
        liveEmail,
        livePhone,
        liveDepartment,
        isLiveSystemUser: Boolean(matchedUser),
      };
    });
  }, [rawExpenses, usersById, usersByName, branches]);

  const branchExpenses = useMemo(() => {
    return filterEntitiesByBranch(enrichedExpenses, user, branches);
  }, [enrichedExpenses, user, branches]);

  // ── Filters State ──────────────────────────────────────────────────────────
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'weekly' | 'monthly' | 'custom'>('all');
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // Modal states
  const [recordModalOpen, setRecordModalOpen] = useState<boolean>(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState<boolean>(false);
  const [selectedExpense, setSelectedExpense] = useState<EnrichedExpenseEntity | null>(null);
  const [staffMode, setStaffMode] = useState<'system' | 'custom'>('system');
  const [selectedStaffUser, setSelectedStaffUser] = useState<UserEntity | null>(null);
  const [form] = Form.useForm();

  // ── Role Metrics Calculation ───────────────────────────────────────────────
  const roleMetrics = useMemo(() => {
    const calcForRole = (roleKey: string) => {
      const items = branchExpenses.filter((e) => (e.recordedByUserRole || '').toLowerCase() === roleKey);
      const totalMinor = items.reduce((acc, curr) => acc + (curr.amountMinor || 0), 0);
      return { count: items.length, totalMinor };
    };

    const secretary = calcForRole('secretary');
    const marketingDirector = calcForRole('marketing_director');
    const branchManager = calcForRole('branch_manager');
    const accounts = calcForRole('accounts');
    const admin = calcForRole('admin');
    const marketingStaff = calcForRole('marketing_staff');
    const customerService = calcForRole('customer_service');
    const allTotalMinor = branchExpenses.reduce((acc, curr) => acc + (curr.amountMinor || 0), 0);

    return {
      secretary,
      marketingDirector,
      branchManager,
      accounts,
      admin,
      marketingStaff,
      customerService,
      total: { count: branchExpenses.length, totalMinor: allTotalMinor },
    };
  }, [branchExpenses]);

  // ── Filtered Expenses ───────────────────────────────────────────────────────
  const filteredExpenses = useMemo(() => {
    return branchExpenses.filter((expense) => {
      // Role filter
      if (selectedRole !== 'all') {
        const role = (expense.recordedByUserRole || '').toLowerCase();
        if (role !== selectedRole) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && expense.status !== statusFilter) {
        return false;
      }

      // Type filter
      if (typeFilter !== 'all' && expense.type !== typeFilter) {
        return false;
      }

      // Branch filter
      if (branchFilter !== 'all' && expense.branchId !== branchFilter) {
        return false;
      }

      // Date filter
      if (dateFilter !== 'all') {
        const incurred = dayjs(expense.incurredOn || expense.createdAt);
        const now = dayjs();
        if (dateFilter === 'today' && !incurred.isSame(now, 'day')) return false;
        if (dateFilter === 'weekly' && !incurred.isSame(now, 'week')) return false;
        if (dateFilter === 'monthly' && !incurred.isSame(now, 'month')) return false;
        if (dateFilter === 'custom' && customDateRange && customDateRange[0] && customDateRange[1]) {
          const start = customDateRange[0].startOf('day');
          const end = customDateRange[1].endOf('day');
          if (incurred.isBefore(start) || incurred.isAfter(end)) return false;
        }
      }

      // Search text query
      if (searchText) {
        const query = searchText.toLowerCase();
        const matchesDesc = (expense.description || '').toLowerCase().includes(query);
        const matchesCategory = (expense.category || '').toLowerCase().includes(query);
        const matchesCode = (expense.code || '').toLowerCase().includes(query);
        const matchesStaff = (expense.recordedByUserName || '').toLowerCase().includes(query);
        const matchesBranch = (expense.branchName || '').toLowerCase().includes(query);
        const matchesEmail = (expense.liveEmail || '').toLowerCase().includes(query);
        if (!matchesDesc && !matchesCategory && !matchesCode && !matchesStaff && !matchesBranch && !matchesEmail) {
          return false;
        }
      }

      return true;
    });
  }, [
    branchExpenses,
    selectedRole,
    statusFilter,
    typeFilter,
    branchFilter,
    dateFilter,
    customDateRange,
    searchText,
  ]);

  // ── Open Record Modal with Live Defaults ────────────────────────────────────
  const openRecordModal = () => {
    form.resetFields();
    setStaffMode('system');

    // Find default staff matching selectedRole if not 'all'
    const targetRole = selectedRole !== 'all' ? selectedRole : 'secretary';
    const defaultUser = liveUsers.find((u) => u.role === targetRole) || liveUsers[0];

    if (defaultUser) {
      setSelectedStaffUser(defaultUser);
      form.setFieldsValue({
        staffUserId: defaultUser.id,
        staffName: getUserFullName(defaultUser),
        role: defaultUser.role || targetRole,
        branchId: defaultUser.branchId || (defaultUser as any).branch || branches[0]?.id,
        type: 'internal',
        incurredOn: dayjs(),
      });
    } else {
      setSelectedStaffUser(null);
      form.setFieldsValue({
        role: targetRole,
        type: 'internal',
        incurredOn: dayjs(),
        branchId: user?.branchId || branches[0]?.id,
      });
    }

    setRecordModalOpen(true);
  };

  // ── Handle Staff User Select in Modal ───────────────────────────────────────
  const handleStaffUserSelect = (userId: string) => {
    const targetUser = usersById.get(userId);
    if (targetUser) {
      setSelectedStaffUser(targetUser);
      form.setFieldsValue({
        role: targetUser.role || 'branch_manager',
        branchId: targetUser.branchId || (targetUser as any).branch || branches[0]?.id,
        staffName: getUserFullName(targetUser),
      });
    }
  };

  // ── Handle Role Change in Modal ────────────────────────────────────────────
  const handleModalRoleChange = (newRole: string) => {
    form.setFieldsValue({ role: newRole });
    if (staffMode === 'system') {
      const matchInRole = liveUsers.find((u) => u.role === newRole);
      if (matchInRole) {
        handleStaffUserSelect(matchInRole.id);
        form.setFieldsValue({ staffUserId: matchInRole.id });
      }
    }
  };

  // ── Record New Expense Submission ──────────────────────────────────────────
  const handleRecordExpense = async (values: any) => {
    try {
      let finalUserId = user?.id;
      let finalUserName = user ? getUserFullName(user) : 'Staff Member';
      let finalRole = values.role;

      if (staffMode === 'system' && selectedStaffUser) {
        finalUserId = selectedStaffUser.id;
        finalUserName = getUserFullName(selectedStaffUser);
        finalRole = values.role || selectedStaffUser.role;
      } else if (staffMode === 'custom' && values.customStaffName) {
        finalUserId = undefined;
        finalUserName = values.customStaffName.trim();
        finalRole = values.role;
      } else if (values.staffName) {
        finalUserName = values.staffName.trim();
      }

      const payload: CreateExpensePayload = {
        category: values.category,
        type: values.type,
        amountMinor: Math.round(Number(values.amount) * 100),
        incurredOn: values.incurredOn ? values.incurredOn.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        branchId: values.branchId || selectedStaffUser?.branchId || user?.branchId,
        description: values.description,
        recordedByUserId: finalUserId,
        recordedByUserName: finalUserName,
        recordedByUserRole: finalRole,
      };

      await createExpenseMutation.mutateAsync(payload);
      message.success(`Expense of ${formatCurrency(payload.amountMinor)} recorded successfully!`);
      setRecordModalOpen(false);
      form.resetFields();
      setSelectedStaffUser(null);
      setStaffMode('system');
      refetchExpenses();
    } catch (err: any) {
      message.error(err?.message || 'Failed to record expense');
    }
  };

  // ── Decision Handlers ──────────────────────────────────────────────────────
  const handleDecision = async (id: string, decision: 'approved' | 'rejected') => {
    try {
      await decisionMutation.mutateAsync({
        id,
        payload: { decision, note: `Decided by administrator ${user?.firstName} on ${dayjs().format('YYYY-MM-DD')}` },
      });
      message.success(`Expense marked as ${decision}!`);
      refetchExpenses();
      if (selectedExpense && selectedExpense.id === id) {
        setSelectedExpense((prev) => (prev ? { ...prev, status: decision } : null));
      }
    } catch (err: any) {
      message.error(err?.message || `Failed to ${decision} expense`);
    }
  };

  // ── Export CSV Handler ─────────────────────────────────────────────────────
  const handleExportCSV = () => {
    try {
      const headers = ['Code', 'Role', 'Staff Name', 'System Staff', 'Email', 'Category', 'Type', 'Amount (GHS)', 'Branch', 'Incurred Date', 'Status', 'Description'];
      const rows = filteredExpenses.map((e) => {
        const roleCfg = getRoleConfig(e.recordedByUserRole);
        return [
          e.code || e.id,
          roleCfg.label,
          `"${(e.recordedByUserName || 'N/A').replace(/"/g, '""')}"`,
          e.isLiveSystemUser ? 'Yes' : 'No',
          e.liveEmail || 'N/A',
          e.category,
          e.type,
          ((e.amountMinor || 0) / 100).toFixed(2),
          e.branchName || 'N/A',
          dayjs(e.incurredOn).format('YYYY-MM-DD'),
          e.status,
          `"${(e.description || '').replace(/"/g, '""')}"`,
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `role-expenses-${selectedRole}-${dayjs().format('YYYYMMDD-HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success(`Exported ${filteredExpenses.length} expense records!`);
    } catch (err) {
      message.error('Failed to export CSV');
    }
  };

  // ── Table Columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Expense Code & Category',
      key: 'codeCategory',
      width: 210,
      render: (_: any, record: EnrichedExpenseEntity) => (
        <Space direction="vertical" size={2}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tag color="geekblue" style={{ fontWeight: 600, fontSize: 11, margin: 0 }}>
              {record.code || record.id.slice(0, 10).toUpperCase()}
            </Tag>
            <Tag color={record.type === 'internal' ? 'blue' : 'purple'} style={{ fontSize: 10, margin: 0 }}>
              {record.type.toUpperCase()}
            </Tag>
          </div>
          <Text strong style={{ fontSize: 13, display: 'block', marginTop: 2 }}>
            {record.category}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Staff Member & Role',
      key: 'roleStaff',
      width: 230,
      render: (_: any, record: EnrichedExpenseEntity) => {
        const roleCfg = getRoleConfig(record.recordedByUserRole);
        return (
          <Space align="center" size={10}>
            <Tooltip
              title={
                record.liveEmail ? (
                  <div>
                    <div>{record.liveEmail}</div>
                    {record.livePhone && <div>{record.livePhone}</div>}
                    {record.isLiveSystemUser && <Tag color="green" style={{ marginTop: 4 }}>Verified System Staff</Tag>}
                  </div>
                ) : undefined
              }
            >
              <Avatar
                size={36}
                src={record.liveAvatar}
                style={{
                  backgroundColor: roleCfg.bg,
                  color: roleCfg.color,
                  border: `1.5px solid ${roleCfg.color}60`,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                icon={!record.liveAvatar && roleCfg.icon}
              >
                {!record.liveAvatar && (record.recordedByUserName?.[0] || 'S')}
              </Avatar>
            </Tooltip>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Text strong style={{ fontSize: 13, display: 'block', lineHeight: 1.2 }}>
                  {record.recordedByUserName || 'Staff Member'}
                </Text>
                {record.isLiveSystemUser && (
                  <Tooltip title="Live System User">
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                  </Tooltip>
                )}
              </div>
              <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Tag
                  color={roleCfg.color}
                  icon={roleCfg.icon}
                  style={{
                    fontWeight: 600,
                    fontSize: 11,
                    padding: '0 6px',
                    borderRadius: 4,
                    margin: 0,
                  }}
                >
                  {roleCfg.label}
                </Tag>
                {record.liveDepartment && (
                  <Tag style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>
                    {record.liveDepartment}
                  </Tag>
                )}
              </div>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <Text style={{ fontSize: 12 }}>{text || 'No description provided.'}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Branch',
      dataIndex: 'branchName',
      key: 'branchName',
      width: 140,
      render: (name: string, record: EnrichedExpenseEntity) => {
        const bName = name || branches.find((b) => b.id === record.branchId)?.name || 'Head Office';
        return (
          <Tag icon={<ShopOutlined />} style={{ fontSize: 11 }}>
            {bName}
          </Tag>
        );
      },
    },
    {
      title: 'Amount (GH₵)',
      dataIndex: 'amountMinor',
      key: 'amountMinor',
      width: 140,
      align: 'right' as const,
      sorter: (a: EnrichedExpenseEntity, b: EnrichedExpenseEntity) => a.amountMinor - b.amountMinor,
      render: (minor: number) => (
        <Text strong style={{ fontSize: 13.5, color: '#262626' }}>
          {formatCurrency(minor)}
        </Text>
      ),
    },
    {
      title: 'Incurred Date',
      dataIndex: 'incurredOn',
      key: 'incurredOn',
      width: 130,
      sorter: (a: EnrichedExpenseEntity, b: EnrichedExpenseEntity) =>
        dayjs(a.incurredOn || a.createdAt).unix() - dayjs(b.incurredOn || b.createdAt).unix(),
      render: (date: string, record: EnrichedExpenseEntity) => {
        const d = dayjs(date || record.createdAt);
        return (
          <Tooltip title={d.format('dddd, MMMM D, YYYY')}>
            <Space direction="vertical" size={0}>
              <Text style={{ fontSize: 12 }}>{d.format('MMM DD, YYYY')}</Text>
              <Text type="secondary" style={{ fontSize: 10 }}>
                {d.fromNow()}
              </Text>
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => {
        if (status === 'approved') {
          return <Tag color="success" icon={<CheckCircleOutlined />}>Approved</Tag>;
        }
        if (status === 'rejected') {
          return <Tag color="error" icon={<CloseCircleOutlined />}>Rejected</Tag>;
        }
        return <Tag color="warning" icon={<ClockCircleOutlined />}>Pending</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      fixed: 'right' as const,
      render: (_: any, record: EnrichedExpenseEntity) => (
        <Space size={6}>
          <Tooltip title="View Detailed Breakdown">
            <Button
              type="primary"
              ghost
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedExpense(record);
                setDetailsModalOpen(true);
              }}
            />
          </Tooltip>
          {isAdmin && record.status === 'pending' && (
            <>
              <Popconfirm
                title="Approve this expense?"
                onConfirm={() => handleDecision(record.id, 'approved')}
                okText="Approve"
                cancelText="No"
              >
                <Tooltip title="Approve">
                  <Button
                    size="small"
                    style={{ color: '#52c41a', borderColor: '#b7eb8f' }}
                    icon={<CheckCircleOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
              <Popconfirm
                title="Reject this expense?"
                onConfirm={() => handleDecision(record.id, 'rejected')}
                okText="Reject"
                cancelText="No"
              >
                <Tooltip title="Reject">
                  <Button size="small" danger icon={<CloseCircleOutlined />} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={style}>
      {/* ── CARD HEADER & ACTION BUTTONS ─────────────────────────────────── */}
      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
          marginBottom: 16,
        }}
        bodyStyle={{ padding: '20px' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: '#f0f5ff',
                  color: tokens.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                }}
              >
                <DollarOutlined />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Title level={4} style={{ margin: 0, fontWeight: 700, lineHeight: 1.2 }}>
                    {title}
                  </Title>
                  <Tag color="processing" icon={<CheckCircleOutlined />}>
                    Live System Data ({liveUsers.length} Staff)
                  </Tag>
                </div>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {subtitle}
                </Text>
              </div>
            </div>
          </div>

          <Space wrap>
            <Button icon={<ExportOutlined />} onClick={handleExportCSV} style={{ borderRadius: 6 }}>
              Export CSV
            </Button>
            <Button
              icon={<ReloadOutlined spin={expensesLoading || usersLoading} />}
              onClick={() => {
                refetchExpenses();
                refetchUsers();
                message.success('Live expense and staff tracking updated!');
              }}
              style={{ borderRadius: 6 }}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openRecordModal}
              style={{
                borderRadius: 6,
                fontWeight: 600,
                background: tokens.primary,
                borderColor: tokens.primary,
              }}
            >
              Record Role Expense
            </Button>
          </Space>
        </div>

        {/* ── ROLE KPI SUMMARY STATS CARDS ───────────────────────────────── */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {/* Secretary Expenses */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              size="small"
              style={{
                borderRadius: 10,
                border: '1px solid #87e8de',
                background: 'linear-gradient(135deg, #e6fffb 0%, #ffffff 100%)',
              }}
              bodyStyle={{ padding: '14px 16px' }}
            >
              <Statistic
                title={
                  <Space>
                    <UserOutlined style={{ color: '#13c2c2' }} />
                    <Text strong style={{ color: '#006d75', fontSize: 13 }}>
                      Secretary Expenses
                    </Text>
                  </Space>
                }
                value={formatCurrency(roleMetrics.secretary.totalMinor)}
                valueStyle={{ color: '#006d75', fontWeight: 700, fontSize: 18 }}
              />
              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Office, Refreshments, Courier
                </Text>
                <Tag color="cyan" style={{ margin: 0, fontSize: 10, fontWeight: 600 }}>
                  {roleMetrics.secretary.count} records
                </Tag>
              </div>
            </Card>
          </Col>

          {/* Marketing Director Expenses */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              size="small"
              style={{
                borderRadius: 10,
                border: '1px solid #ffd591',
                background: 'linear-gradient(135deg, #fff7e6 0%, #ffffff 100%)',
              }}
              bodyStyle={{ padding: '14px 16px' }}
            >
              <Statistic
                title={
                  <Space>
                    <RiseOutlined style={{ color: '#fa8c16' }} />
                    <Text strong style={{ color: '#d46b08', fontSize: 13 }}>
                      Marketing Director
                    </Text>
                  </Space>
                }
                value={formatCurrency(roleMetrics.marketingDirector.totalMinor)}
                valueStyle={{ color: '#d46b08', fontWeight: 700, fontSize: 18 }}
              />
              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Billboards, Expos, Digital Ads
                </Text>
                <Tag color="orange" style={{ margin: 0, fontSize: 10, fontWeight: 600 }}>
                  {roleMetrics.marketingDirector.count} records
                </Tag>
              </div>
            </Card>
          </Col>

          {/* Branch Manager Expenses */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              size="small"
              style={{
                borderRadius: 10,
                border: '1px solid #91d5ff',
                background: 'linear-gradient(135deg, #e6f7ff 0%, #ffffff 100%)',
              }}
              bodyStyle={{ padding: '14px 16px' }}
            >
              <Statistic
                title={
                  <Space>
                    <ShopOutlined style={{ color: '#1890ff' }} />
                    <Text strong style={{ color: '#096dd9', fontSize: 13 }}>
                      Branch Manager
                    </Text>
                  </Space>
                }
                value={formatCurrency(roleMetrics.branchManager.totalMinor)}
                valueStyle={{ color: '#096dd9', fontWeight: 700, fontSize: 18 }}
              />
              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Generator Diesel, Van Fuel, Repairs
                </Text>
                <Tag color="blue" style={{ margin: 0, fontSize: 10, fontWeight: 600 }}>
                  {roleMetrics.branchManager.count} records
                </Tag>
              </div>
            </Card>
          </Col>

          {/* Total Role Disbursements */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              size="small"
              style={{
                borderRadius: 10,
                border: '1px solid #b7eb8f',
                background: 'linear-gradient(135deg, #f6ffed 0%, #ffffff 100%)',
              }}
              bodyStyle={{ padding: '14px 16px' }}
            >
              <Statistic
                title={
                  <Space>
                    <DollarOutlined style={{ color: '#52c41a' }} />
                    <Text strong style={{ color: '#389e0d', fontSize: 13 }}>
                      Total Disbursements
                    </Text>
                  </Space>
                }
                value={formatCurrency(roleMetrics.total.totalMinor)}
                valueStyle={{ color: '#389e0d', fontWeight: 700, fontSize: 18 }}
              />
              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Combined Tracked Outlays
                </Text>
                <Tag color="green" style={{ margin: 0, fontSize: 10, fontWeight: 600 }}>
                  {roleMetrics.total.count} records
                </Tag>
              </div>
            </Card>
          </Col>
        </Row>

        {/* ── ROLE SEGMENTED FILTER BAR ────────────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: '#8c8c8c' }}>
            Filter By Role
          </Text>
          <div style={{ marginTop: 6, overflowX: 'auto' }}>
            <Segmented
              value={selectedRole}
              onChange={(val) => setSelectedRole(val as string)}
              options={[
                {
                  value: 'all',
                  label: (
                    <span style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      All Roles <Badge count={roleMetrics.total.count} style={{ backgroundColor: '#595959' }} />
                    </span>
                  ),
                },
                {
                  value: 'secretary',
                  label: (
                    <span style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <UserOutlined style={{ color: '#13c2c2' }} /> Secretary{' '}
                      <Badge count={roleMetrics.secretary.count} style={{ backgroundColor: '#13c2c2' }} />
                    </span>
                  ),
                },
                {
                  value: 'marketing_director',
                  label: (
                    <span style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <RiseOutlined style={{ color: '#fa8c16' }} /> Marketing Director{' '}
                      <Badge count={roleMetrics.marketingDirector.count} style={{ backgroundColor: '#fa8c16' }} />
                    </span>
                  ),
                },
                {
                  value: 'branch_manager',
                  label: (
                    <span style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <ShopOutlined style={{ color: '#1890ff' }} /> Branch Manager{' '}
                      <Badge count={roleMetrics.branchManager.count} style={{ backgroundColor: '#1890ff' }} />
                    </span>
                  ),
                },
                {
                  value: 'accounts',
                  label: (
                    <span style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <BankOutlined style={{ color: '#52c41a' }} /> Accounts{' '}
                      <Badge count={roleMetrics.accounts.count} style={{ backgroundColor: '#52c41a' }} />
                    </span>
                  ),
                },
                {
                  value: 'admin',
                  label: (
                    <span style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <SafetyCertificateOutlined style={{ color: '#722ed1' }} /> Admin{' '}
                      <Badge count={roleMetrics.admin.count} style={{ backgroundColor: '#722ed1' }} />
                    </span>
                  ),
                },
                ...(roleMetrics.marketingStaff.count > 0
                  ? [
                      {
                        value: 'marketing_staff',
                        label: (
                          <span style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <NotificationOutlined style={{ color: '#eb2f96' }} /> Marketing Staff{' '}
                            <Badge count={roleMetrics.marketingStaff.count} style={{ backgroundColor: '#eb2f96' }} />
                          </span>
                        ),
                      },
                    ]
                  : []),
                ...(roleMetrics.customerService.count > 0
                  ? [
                      {
                        value: 'customer_service',
                        label: (
                          <span style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <CoffeeOutlined style={{ color: '#2f54eb' }} /> Customer Service{' '}
                            <Badge count={roleMetrics.customerService.count} style={{ backgroundColor: '#2f54eb' }} />
                          </span>
                        ),
                      },
                    ]
                  : []),
              ]}
              size="middle"
            />
          </div>
        </div>

        {/* ── SECONDARY FILTERS & SEARCH ROW ───────────────────────────────── */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={7}>
            <Input
              placeholder="Search by keyword, live staff name, email, code..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Select
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Filter status"
            >
              <Option value="all">All Statuses</Option>
              <Option value="approved">Approved</Option>
              <Option value="pending">Pending</Option>
              <Option value="rejected">Rejected</Option>
            </Select>
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Select
              style={{ width: '100%' }}
              value={typeFilter}
              onChange={setTypeFilter}
              placeholder="Filter type"
            >
              <Option value="all">All Types</Option>
              <Option value="internal">Internal Only</Option>
              <Option value="external">External Only</Option>
            </Select>
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Select
              style={{ width: '100%' }}
              value={branchFilter}
              onChange={setBranchFilter}
              placeholder="Filter branch"
            >
              <Option value="all">All Branches</Option>
              {branches.map((b) => (
                <Option key={b.id} value={b.id}>
                  {b.name}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={12} sm={6} md={5}>
            <Select
              style={{ width: '100%' }}
              value={dateFilter}
              onChange={(val) => setDateFilter(val as any)}
            >
              <Option value="all">All Time</Option>
              <Option value="today">Today</Option>
              <Option value="weekly">This Week</Option>
              <Option value="monthly">This Month</Option>
              <Option value="custom">Custom Date Range</Option>
            </Select>
          </Col>

          {dateFilter === 'custom' && (
            <Col xs={24} md={8}>
              <DatePicker.RangePicker
                style={{ width: '100%' }}
                onChange={(dates) => setCustomDateRange(dates as any)}
              />
            </Col>
          )}
        </Row>

        {/* ── EXPENSES DATA TABLE ──────────────────────────────────────────── */}
        <Table
          columns={columns}
          dataSource={filteredExpenses}
          rowKey="id"
          loading={expensesLoading || usersLoading}
          size="middle"
          pagination={{
            pageSize: 8,
            showSizeChanger: true,
            pageSizeOptions: ['8', '15', '25', '50'],
            showTotal: (total) => `Total ${total} live role-filtered expenses`,
          }}
          scroll={{ x: 1100 }}
        />
      </Card>

      {/* ── VIEW EXPENSE DETAILS MODAL ────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <FileTextOutlined style={{ color: tokens.primary }} />
            <Text strong>Expense Audit & Disbursement Details</Text>
          </Space>
        }
        open={detailsModalOpen}
        onCancel={() => {
          setDetailsModalOpen(false);
          setSelectedExpense(null);
        }}
        footer={[
          isAdmin && selectedExpense?.status === 'pending' && (
            <Button
              key="reject"
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => selectedExpense && handleDecision(selectedExpense.id, 'rejected')}
            >
              Reject Expense
            </Button>
          ),
          isAdmin && selectedExpense?.status === 'pending' && (
            <Button
              key="approve"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => selectedExpense && handleDecision(selectedExpense.id, 'approved')}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
            >
              Approve Expense
            </Button>
          ),
          <Button
            key="close"
            onClick={() => {
              setDetailsModalOpen(false);
              setSelectedExpense(null);
            }}
          >
            Close
          </Button>,
        ]}
        width={680}
      >
        {selectedExpense && (() => {
          const roleCfg = getRoleConfig(selectedExpense.recordedByUserRole);
          return (
            <div>
              {/* Staff Member Live Profile Banner */}
              <div
                style={{
                  background: roleCfg.bg,
                  border: `1px solid ${roleCfg.color}40`,
                  borderRadius: 10,
                  padding: '16px 20px',
                  marginBottom: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <Space align="center" size={12}>
                    <Avatar
                      size={48}
                      src={selectedExpense.liveAvatar}
                      style={{
                        backgroundColor: roleCfg.color,
                        color: '#fff',
                        fontWeight: 700,
                        border: '2px solid #fff',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      }}
                      icon={!selectedExpense.liveAvatar && roleCfg.icon}
                    >
                      {!selectedExpense.liveAvatar && (selectedExpense.recordedByUserName?.[0] || 'S')}
                    </Avatar>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong style={{ fontSize: 16 }}>
                          {selectedExpense.recordedByUserName || 'Staff Member'}
                        </Text>
                        {selectedExpense.isLiveSystemUser && (
                          <Tag color="success" icon={<CheckCircleOutlined />}>
                            Live System Staff
                          </Tag>
                        )}
                      </div>
                      <Space size={6} style={{ marginTop: 3 }}>
                        <Tag color={roleCfg.color} icon={roleCfg.icon} style={{ margin: 0 }}>
                          {roleCfg.label}
                        </Tag>
                        {selectedExpense.liveDepartment && (
                          <Tag style={{ margin: 0 }}>{selectedExpense.liveDepartment}</Tag>
                        )}
                        <Tag icon={<ShopOutlined />} style={{ margin: 0 }}>
                          {selectedExpense.branchName || 'Head Office'}
                        </Tag>
                      </Space>
                      {selectedExpense.liveEmail && (
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            <MailOutlined style={{ marginRight: 4 }} /> {selectedExpense.liveEmail}
                            {selectedExpense.livePhone && (
                              <>
                                <Divider type="vertical" />
                                <PhoneOutlined style={{ marginRight: 4 }} /> {selectedExpense.livePhone}
                              </>
                            )}
                          </Text>
                        </div>
                      )}
                    </div>
                  </Space>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                    Total Disbursement
                  </Text>
                  <Text strong style={{ fontSize: 22, color: '#262626' }}>
                    {formatCurrency(selectedExpense.amountMinor)}
                  </Text>
                </div>
              </div>

              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="Expense Code">
                  <Tag color="geekblue" style={{ fontWeight: 700 }}>
                    {selectedExpense.code || selectedExpense.id}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Category">
                  <Text strong>{selectedExpense.category}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Expense Type">
                  <Tag color={selectedExpense.type === 'internal' ? 'blue' : 'purple'}>
                    {selectedExpense.type.toUpperCase()}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Branch Location">
                  {selectedExpense.branchName ||
                    branches.find((b) => b.id === selectedExpense.branchId)?.name ||
                    'Head Office'}
                </Descriptions.Item>
                <Descriptions.Item label="Date Incurred">
                  {dayjs(selectedExpense.incurredOn).format('MMMM DD, YYYY')} ({dayjs(selectedExpense.incurredOn).fromNow()})
                </Descriptions.Item>
                <Descriptions.Item label="Approval Status">
                  {selectedExpense.status === 'approved' ? (
                    <Tag color="success" icon={<CheckCircleOutlined />}>Approved</Tag>
                  ) : selectedExpense.status === 'rejected' ? (
                    <Tag color="error" icon={<CloseCircleOutlined />}>Rejected</Tag>
                  ) : (
                    <Tag color="warning" icon={<ClockCircleOutlined />}>Pending Authorization</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Description & Notes">
                  <Paragraph style={{ margin: 0 }}>
                    {selectedExpense.description || 'No description recorded.'}
                  </Paragraph>
                </Descriptions.Item>
                {selectedExpense.decisionNote && (
                  <Descriptions.Item label="Decision Note">
                    <Text italic>{selectedExpense.decisionNote}</Text>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Created On System">
                  {dayjs(selectedExpense.createdAt).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
              </Descriptions>
            </div>
          );
        })()}
      </Modal>

      {/* ── RECORD ROLE EXPENSE MODAL ─────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <PlusOutlined style={{ color: tokens.primary }} />
            <Text strong>Record Role Expense</Text>
          </Space>
        }
        open={recordModalOpen}
        onCancel={() => {
          setRecordModalOpen(false);
          form.resetFields();
          setSelectedStaffUser(null);
          setStaffMode('system');
        }}
        footer={null}
        width={580}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleRecordExpense}
          initialValues={{
            role: selectedRole !== 'all' ? selectedRole : 'secretary',
            type: 'internal',
            incurredOn: dayjs(),
            branchId: user?.branchId || (branches[0]?.id ?? undefined),
          }}
        >
          {/* Initiator Source Toggle */}
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
              Initiator Source
            </Text>
            <Radio.Group
              value={staffMode}
              onChange={(e) => setStaffMode(e.target.value)}
              buttonStyle="solid"
              style={{ width: '100%' }}
            >
              <Radio.Button value="system" style={{ width: '50%', textAlign: 'center' }}>
                <TeamOutlined style={{ marginRight: 6 }} />
                Live System Staff ({liveUsers.length})
              </Radio.Button>
              <Radio.Button value="custom" style={{ width: '50%', textAlign: 'center' }}>
                <UserOutlined style={{ marginRight: 6 }} />
                External / Custom Initiator
              </Radio.Button>
            </Radio.Group>
          </div>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="role"
                label="Attributed Role"
                rules={[{ required: true, message: 'Please select role' }]}
              >
                <Select placeholder="Select role" onChange={handleModalRoleChange}>
                  <Option value="secretary">
                    <Space><UserOutlined style={{ color: '#13c2c2' }} /> Secretary</Space>
                  </Option>
                  <Option value="marketing_director">
                    <Space><RiseOutlined style={{ color: '#fa8c16' }} /> Marketing Director</Space>
                  </Option>
                  <Option value="branch_manager">
                    <Space><ShopOutlined style={{ color: '#1890ff' }} /> Branch Manager</Space>
                  </Option>
                  <Option value="accounts">
                    <Space><BankOutlined style={{ color: '#52c41a' }} /> Accounts</Space>
                  </Option>
                  <Option value="admin">
                    <Space><SafetyCertificateOutlined style={{ color: '#722ed1' }} /> Admin</Space>
                  </Option>
                  <Option value="marketing_staff">
                    <Space><NotificationOutlined style={{ color: '#eb2f96' }} /> Marketing Staff</Space>
                  </Option>
                  <Option value="customer_service">
                    <Space><CoffeeOutlined style={{ color: '#2f54eb' }} /> Customer Service</Space>
                  </Option>
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              {staffMode === 'system' ? (
                <Form.Item
                  name="staffUserId"
                  label="Staff Member (Live System)"
                  rules={[{ required: true, message: 'Please select live staff member' }]}
                >
                  <Select
                    showSearch
                    placeholder="Search live staff..."
                    optionFilterProp="label"
                    onChange={handleStaffUserSelect}
                    loading={usersLoading}
                    notFoundContent={usersLoading ? 'Loading users...' : 'No matching staff found'}
                  >
                    {liveUsers.map((u) => (
                      <Option
                        key={u.id}
                        value={u.id}
                        label={`${getUserFullName(u)} ${u.email} ${u.role}`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
                          <Space size={6}>
                            <Avatar
                              size="small"
                              src={u.avatarUrl || u.photoUrl || u.profilePictureUrl}
                              style={{
                                backgroundColor: getRoleConfig(u.role).color,
                                fontSize: 10,
                              }}
                            >
                              {u.firstName?.[0] || 'U'}
                            </Avatar>
                            <div>
                              <Text strong style={{ fontSize: 12 }}>
                                {getUserFullName(u)}
                              </Text>
                              <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
                                {u.email}
                              </Text>
                            </div>
                          </Space>
                          <Tag
                            color={getRoleConfig(u.role).color}
                            style={{ fontSize: 9, margin: 0, padding: '0 4px' }}
                          >
                            {getRoleConfig(u.role).label}
                          </Tag>
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              ) : (
                <Form.Item
                  name="customStaffName"
                  label="Staff / Initiator Name"
                  rules={[{ required: true, message: 'Please enter initiator name' }]}
                >
                  <Input placeholder="e.g. Ama Serwaa, David Osei" />
                </Form.Item>
              )}
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="category"
                label="Category"
                rules={[{ required: true, message: 'Please select or enter category' }]}
              >
                <Select placeholder="Select category" allowClear showSearch>
                  <Option value="Client Hospitality">Client Hospitality</Option>
                  <Option value="Office Supplies">Office Supplies</Option>
                  <Option value="Courier & Dispatch">Courier & Dispatch</Option>
                  <Option value="Mega Billboard & Out-Of-Home">Mega Billboard & OOH</Option>
                  <Option value="Exhibitions & Events">Exhibitions & Events</Option>
                  <Option value="Digital Ads & Media">Digital Ads & Media</Option>
                  <Option value="Power & Generator Servicing">Power & Generator</Option>
                  <Option value="Site Inspection Logistics">Site Inspection Logistics</Option>
                  <Option value="Facility Air Conditioning">Facility Air Conditioning</Option>
                  <Option value="Lands Commission Title Searches">Lands Commission Searches</Option>
                  <Option value="Other">Other Operational</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="type"
                label="Expense Type"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="internal">Internal Operational</Option>
                  <Option value="external">External Vendor</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="Amount (GH₵)"
                rules={[{ required: true, message: 'Please enter amount' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  prefix="GH₵"
                  min={1}
                  precision={2}
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="incurredOn"
                label="Date Incurred"
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="branchId"
            label="Branch Location"
            rules={[{ required: true, message: 'Please select branch' }]}
          >
            <Select placeholder="Select branch">
              {branches.map((b) => (
                <Option key={b.id} value={b.id}>
                  {b.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="Description & Purpose"
            rules={[{ required: true, message: 'Please provide expense description' }]}
          >
            <TextArea
              rows={3}
              placeholder="Provide a clear description of the goods or services procured and receipt details..."
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 16 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                onClick={() => {
                  setRecordModalOpen(false);
                  form.resetFields();
                  setSelectedStaffUser(null);
                  setStaffMode('system');
                }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createExpenseMutation.isPending}
                style={{ background: tokens.primary, borderColor: tokens.primary }}
              >
                Submit & Record Expense
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
