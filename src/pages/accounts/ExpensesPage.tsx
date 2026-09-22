// src/pages/accounts/ExpensesPage.tsx
import React, { useState, useMemo, useEffect } from 'react';
import {
  Card, Row, Col, Typography, Statistic, Table, Tag, Space, Button,
  Modal, Form, Input, InputNumber, Select, DatePicker, message, Tooltip,
  Popconfirm, Divider, Alert, Tabs, Badge, Drawer, Timeline, Empty,
} from 'antd';
import {
  DollarOutlined,
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  ExportOutlined,
  CalendarOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FilterOutlined,
  RiseOutlined,
  UserOutlined,
  EyeOutlined,
  PrinterOutlined,
  EnvironmentOutlined,
  AuditOutlined,
  BarChartOutlined,
  PieChartOutlined,
  DownOutlined,
  UpOutlined,
  InfoCircleOutlined,
  BankOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { PhotoUpload } from '@/components/shared/PhotoUpload';
import {
  useExpensesQuery,
  useCreateExpenseMutation,
  useExpenseDecisionMutation,
  type ExpenseEntity,
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

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const CHART_COLORS = [
  '#1890ff', '#52c41a', '#faad14', '#722ed1', '#13c2c2', '#eb2f96', '#fa541c', '#2f54eb'
];

const getCategoryIcon = (category: string) => {
  const c = (category || '').toLowerCase();
  if (c.includes('power') || c.includes('generator') || c.includes('fuel')) return '⚡';
  if (c.includes('hospitality') || c.includes('refreshment')) return '☕';
  if (c.includes('supplies') || c.includes('stationery')) return '📝';
  if (c.includes('ad') || c.includes('billboard') || c.includes('marketing') || c.includes('collateral')) return '📢';
  if (c.includes('courier') || c.includes('dispatch') || c.includes('logistics') || c.includes('transport') || c.includes('site tour')) return '🚚';
  if (c.includes('maintenance') || c.includes('repairs') || c.includes('sanitation') || c.includes('security')) return '🔧';
  if (c.includes('legal') || c.includes('lands commission') || c.includes('audit')) return '⚖️';
  if (c.includes('utilities') || c.includes('internet')) return '🌐';
  return '💳';
};

const getRoleBadgeColor = (role?: string) => {
  switch (role) {
    case 'admin': return 'red';
    case 'accounts': return 'green';
    case 'marketing_director': return 'gold';
    case 'secretary': return 'purple';
    case 'branch_manager': return 'cyan';
    case 'marketing_staff': return 'blue';
    default: return 'geekblue';
  }
};

const getRoleDisplay = (role?: string) => {
  switch (role) {
    case 'admin': return 'Administrator';
    case 'accounts': return 'Accounts & Finance';
    case 'marketing_director': return 'Marketing Director';
    case 'secretary': return 'Secretary';
    case 'branch_manager': return 'Branch Manager';
    case 'marketing_staff': return 'Marketing Staff';
    default: return 'Staff Member';
  }
};

export const ExpensesPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const { branches: contextBranches } = useBranchContext();
  const { data: apiBranches = [] } = useBranchesQuery();
  const branches: Array<{ id: string; name: string; branchCode?: string; [key: string]: any }> =
    apiBranches.length > 0 ? (apiBranches as any) : (contextBranches as any);

  const { data: expensesData, isLoading, refetch, isFetching } = useExpensesQuery();
  const { data: usersData } = useUsersQuery({ pageSize: 1000 });
  const liveUsers: UserEntity[] = useMemo(() => usersData?.items ?? [], [usersData]);

  const createExpenseMutation = useCreateExpenseMutation();
  const decisionMutation = useExpenseDecisionMutation();

  // Fast live user lookup maps for accurate attribution
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

  // Reconcile raw live expenses with live users and branch data
  const rawExpenses = expensesData?.items ?? [];
  const enrichedExpenses = useMemo(() => {
    return rawExpenses.map((expense) => {
      let matchedUser: UserEntity | undefined;
      if (expense.recordedByUserId) {
        matchedUser = usersById.get(expense.recordedByUserId);
      }
      if (!matchedUser && expense.recordedByUserName) {
        matchedUser = usersByName.get(expense.recordedByUserName.toLowerCase().trim());
      }

      const liveRole = matchedUser?.role || expense.recordedByUserRole || 'branch_manager';
      const liveName = matchedUser
        ? getUserFullName(matchedUser)
        : (expense.recordedByUserName || 'Staff Member');
      const liveEmail = matchedUser?.email;
      const livePhone = matchedUser ? getUserPhone(matchedUser) : undefined;
      const liveAvatar = matchedUser?.avatarUrl || matchedUser?.photoUrl || matchedUser?.profilePictureUrl;
      const branchId = expense.branchId || matchedUser?.branchId;
      const branchObj = branches.find((b: any) => b.id === branchId);
      const liveBranchName = expense.branchName || branchObj?.name || 'Head Office';

      return {
        ...expense,
        recordedByUserName: liveName,
        recordedByUserRole: liveRole,
        branchId,
        branchName: liveBranchName,
        liveEmail,
        livePhone,
        liveAvatar,
      };
    });
  }, [rawExpenses, usersById, usersByName, branches]);

  const branchExpenses = useMemo(() => {
    return filterEntitiesByBranch(enrichedExpenses, user, branches);
  }, [enrichedExpenses, user, branches]);

  // Real-time synchronization across all dashboards and tabs
  useEffect(() => {
    const handleSync = () => {
      refetch();
    };
    window.addEventListener('omark-expenses-changed', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('omark-expenses-changed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [refetch]);

  // ── State ─────────────────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'internal' | 'external'>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  // Default to 'all' so all recorded live expenses in the system are immediately visible
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('all');
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // Visual Analytics Section Toggle
  const [showAnalytics, setShowAnalytics] = useState(true);

  // Voucher Detail Drawer State
  const [selectedExpense, setSelectedExpense] = useState<ExpenseEntity | null>(null);
  const [voucherDrawerOpen, setVoucherDrawerOpen] = useState(false);

  // Rejection Reason Modal State
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [expenseToReject, setExpenseToReject] = useState<ExpenseEntity | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');

  // Add Expense Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form] = Form.useForm();

  // ── Counts for Tabs ────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    return {
      all: branchExpenses.length,
      pending: branchExpenses.filter((e) => e.status === 'pending').length,
      approved: branchExpenses.filter((e) => e.status === 'approved').length,
      rejected: branchExpenses.filter((e) => e.status === 'rejected').length,
    };
  }, [branchExpenses]);

  // ── Filter Expenses ───────────────────────────────────────────────────────
  const filteredExpenses = useMemo(() => {
    return branchExpenses.filter((e) => {
      // Status Filter
      if (statusFilter !== 'all' && e.status !== statusFilter) {
        return false;
      }

      // Branch Filter
      if (branchFilter !== 'all' && e.branchId !== branchFilter) {
        return false;
      }

      // Search
      if (searchText.trim()) {
        const query = searchText.trim().toLowerCase();
        const matchesCategory = (e.category || '').toLowerCase().includes(query);
        const matchesDesc = (e.description || '').toLowerCase().includes(query);
        const matchesCode = (e.code || '').toLowerCase().includes(query);
        const matchesUser = (e.recordedByUserName || '').toLowerCase().includes(query);
        if (!matchesCategory && !matchesDesc && !matchesCode && !matchesUser) return false;
      }

      // Category
      if (categoryFilter !== 'all' && e.category !== categoryFilter) {
        return false;
      }

      // Type
      if (typeFilter !== 'all' && e.type !== typeFilter) {
        return false;
      }

      // Date
      if (dateFilter !== 'all') {
        const date = dayjs(e.incurredOn || e.createdAt);
        const now = dayjs();
        if (dateFilter === 'today' && !date.isSame(now, 'day')) return false;
        if (dateFilter === 'weekly' && !date.isSame(now, 'week')) return false;
        if (dateFilter === 'monthly' && !date.isSame(now, 'month')) return false;
        if (dateFilter === 'yearly' && !date.isSame(now, 'year')) return false;
        if (dateFilter === 'custom' && customDateRange && customDateRange[0] && customDateRange[1]) {
          const start = customDateRange[0].startOf('day');
          const end = customDateRange[1].endOf('day');
          if (date.isBefore(start) || date.isAfter(end)) return false;
        }
      }

      return true;
    });
  }, [branchExpenses, statusFilter, branchFilter, searchText, categoryFilter, typeFilter, dateFilter, customDateRange]);

  // ── Metrics ───────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const totalMinor = filteredExpenses.reduce((sum, e) => sum + (e.amountMinor || 0), 0);
    const approvedMinor = filteredExpenses.filter((e) => e.status === 'approved').reduce((sum, e) => sum + (e.amountMinor || 0), 0);
    const pendingMinor = branchExpenses.filter((e) => e.status === 'pending').reduce((sum, e) => sum + (e.amountMinor || 0), 0);
    const internalMinor = filteredExpenses.filter((e) => e.type === 'internal').reduce((sum, e) => sum + (e.amountMinor || 0), 0);
    const externalMinor = filteredExpenses.filter((e) => e.type === 'external').reduce((sum, e) => sum + (e.amountMinor || 0), 0);
    const count = filteredExpenses.length;

    return {
      totalGHS: totalMinor / 100,
      approvedGHS: approvedMinor / 100,
      pendingGHS: pendingMinor / 100,
      internalGHS: internalMinor / 100,
      externalGHS: externalMinor / 100,
      count,
    };
  }, [filteredExpenses, branchExpenses]);

  // ── Analytics Data (Category Breakdown & Branch Spend) ────────────────────
  const categoryChartData = useMemo(() => {
    const map = new Map<string, number>();
    filteredExpenses.forEach((e) => {
      const cat = e.category || 'General';
      const cur = map.get(cat) || 0;
      map.set(cat, cur + (e.amountMinor || 0));
    });
    return Array.from(map.entries())
      .map(([name, valMinor]) => ({
        name,
        value: Math.round(valMinor / 100),
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  const branchChartData = useMemo(() => {
    const map = new Map<string, number>();
    filteredExpenses.forEach((e) => {
      const bObj = branches.find((b: any) => b.id === e.branchId);
      const bName = bObj ? bObj.name.replace(' Branch', '') : 'Main HQ';
      const cur = map.get(bName) || 0;
      map.set(bName, cur + (e.amountMinor || 0));
    });
    return Array.from(map.entries()).map(([branch, valMinor]) => ({
      branch,
      amountGHS: Math.round(valMinor / 100),
    }));
  }, [filteredExpenses, branches]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddExpense = async (values: any) => {
    try {
      const userName = user
        ? (user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email)
        : 'Accounts Officer';
      await createExpenseMutation.mutateAsync({
        branchId: values.branchId || user?.branchId,
        category: values.category,
        description: values.description,
        amountMinor: Math.round(values.amountGHS * 100),
        type: values.type,
        incurredOn: values.date ? values.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        recordedByUserId: user?.id,
        recordedByUserName: userName,
        recordedByUserRole: user?.role || 'accounts',
        status: hasRole(['admin']) ? 'approved' : 'pending',
      });
      message.success(
        hasRole(['admin'])
          ? 'Expense recorded and authorized immediately!'
          : 'Expense submitted successfully for Admin & Accounts authorization!'
      );
      setAddModalOpen(false);
      form.resetFields();
      refetch();
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Failed to record expense');
    }
  };

  const handleDecision = async (id: string, decision: 'approved' | 'rejected', note?: string) => {
    try {
      await decisionMutation.mutateAsync({
        id,
        payload: {
          decision,
          note: note || `Authorized by ${user?.firstName || ''} (${user?.role || 'authorized user'})`,
        },
      });
      message.success(`Expense ${decision === 'approved' ? 'authorized' : 'rejected'} successfully!`);
      if (selectedExpense?.id === id) {
        setSelectedExpense((prev) => (prev ? { ...prev, status: decision, decisionNote: note } : null));
      }
      refetch();
    } catch (err: any) {
      message.error(err?.message || 'Failed to update expense status');
    }
  };

  const handleOpenRejectionModal = (expense: ExpenseEntity) => {
    setExpenseToReject(expense);
    setRejectionNote('');
    setRejectionModalOpen(true);
  };

  const handleConfirmRejection = async () => {
    if (!expenseToReject) return;
    await handleDecision(expenseToReject.id, 'rejected', rejectionNote.trim() || 'Declined during accounts review.');
    setRejectionModalOpen(false);
    setExpenseToReject(null);
  };

  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) {
      message.warning('No expenses available to export for the current filters.');
      return;
    }
    const headers = [
      'Voucher Code',
      'Category',
      'Type',
      'Branch',
      'Initiated By',
      'Role',
      'Incurred Date',
      'Amount (GH₵)',
      'Status',
      'Purpose / Description',
      'Decision Note',
    ];
    const rows = filteredExpenses.map((e) => {
      const branchName = branches.find((b: any) => b.id === e.branchId)?.name || 'Head Office';
      return [
        `"${e.code || e.id}"`,
        `"${e.category || ''}"`,
        `"${e.type || ''}"`,
        `"${branchName}"`,
        `"${e.recordedByUserName || 'Staff'}"`,
        `"${getRoleDisplay(e.recordedByUserRole)}"`,
        `"${e.incurredOn || ''}"`,
        (e.amountMinor / 100).toFixed(2),
        `"${e.status || ''}"`,
        `"${(e.description || '').replace(/"/g, '""')}"`,
        `"${(e.decisionNote || '').replace(/"/g, '""')}"`,
      ];
    });
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `omark_expenses_${dayjs().format('YYYY-MM-DD')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success(`Exported ${filteredExpenses.length} expense records to CSV!`);
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    branchExpenses.forEach((e) => {
      if (e.category) set.add(e.category);
    });
    return Array.from(set);
  }, [branchExpenses]);

  // ── Table Columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Expense Voucher & Purpose',
      key: 'desc',
      width: 280,
      render: (_: any, r: ExpenseEntity) => (
        <div style={{ cursor: 'pointer' }} onClick={() => { setSelectedExpense(r); setVoucherDrawerOpen(true); }}>
          <Space align="start">
            <span style={{ fontSize: 20, lineHeight: 1 }}>{getCategoryIcon(r.category)}</span>
            <div>
              <Text strong style={{ fontSize: 13, color: '#1e293b', display: 'block' }}>
                {r.description || r.category || 'General Operational Expense'}
              </Text>
              <Space size={6} style={{ marginTop: 2 }}>
                <Tag color="geekblue" style={{ fontSize: 11, margin: 0, padding: '0 5px', borderRadius: 4 }}>
                  {r.code || 'EXP'}
                </Tag>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {dayjs(r.incurredOn || r.createdAt).fromNow()}
                </Text>
              </Space>
            </div>
          </Space>
        </div>
      ),
    },
    {
      title: 'Initiated By',
      key: 'initiator',
      width: 200,
      render: (_: any, r: ExpenseEntity) => (
        <Space size={8}>
          <PhotoUpload entityType="staff" entityId={r.recordedByUserId || r.id} size={32} editable={false} />
          <div>
            <Text strong style={{ fontSize: 12, display: 'block', lineHeight: 1.2 }}>
              {r.recordedByUserName || 'Staff Member'}
            </Text>
            <Tag
              color={getRoleBadgeColor(r.recordedByUserRole)}
              style={{ fontSize: 10, padding: '0 4px', borderRadius: 4, marginTop: 2 }}
            >
              {getRoleDisplay(r.recordedByUserRole)}
            </Tag>
          </div>
        </Space>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 170,
      render: (v: string) => (
        <Tag color="blue" style={{ borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>
          {getCategoryIcon(v)} {v || 'Operations'}
        </Tag>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 130,
      render: (v: string) => (
        <Tag color={v === 'internal' ? 'cyan' : 'purple'} style={{ borderRadius: 6 }}>
          {v === 'internal' ? '🏢 Internal' : '🚚 External'}
        </Tag>
      ),
    },
    {
      title: 'Branch',
      key: 'branch',
      width: 160,
      render: (_: any, r: ExpenseEntity) => {
        const branch = branches.find((b: any) => b.id === r.branchId);
        return (
          <Space size={4}>
            <EnvironmentOutlined style={{ color: '#64748b' }} />
            <Text style={{ fontSize: 12 }}>{branch ? branch.name : 'Head Office'}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Incurred Date',
      key: 'date',
      width: 130,
      render: (_: any, r: ExpenseEntity) => (
        <Text style={{ fontSize: 12, color: '#475569' }}>
          {dayjs(r.incurredOn || r.createdAt).format('MMM D, YYYY')}
        </Text>
      ),
    },
    {
      title: 'Amount',
      key: 'amount',
      width: 140,
      align: 'right' as const,
      render: (_: any, r: ExpenseEntity) => (
        <strong style={{ color: '#b91c1c', fontSize: 14, fontFamily: 'monospace' }}>
          GH₵ {(r.amountMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </strong>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 150,
      render: (_: any, r: ExpenseEntity) => {
        if (r.status === 'approved') {
          return (
            <Tag color="green" icon={<CheckCircleOutlined />} style={{ borderRadius: 6, padding: '2px 8px' }}>
              Approved
            </Tag>
          );
        }
        if (r.status === 'rejected') {
          return (
            <Tooltip title={r.decisionNote || 'Rejected during administrative review'}>
              <Tag color="red" icon={<CloseCircleOutlined />} style={{ borderRadius: 6, padding: '2px 8px' }}>
                Rejected
              </Tag>
            </Tooltip>
          );
        }
        return (
          <Tag color="gold" icon={<ClockCircleOutlined />} style={{ borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
            Pending Authorization
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, r: ExpenseEntity) => (
        <Space size={4}>
          <Tooltip title="View Detailed Voucher & Audit Trail">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedExpense(r);
                setVoucherDrawerOpen(true);
              }}
            />
          </Tooltip>
          {hasRole(['admin', 'accounts']) && r.status === 'pending' && (
            <>
              <Popconfirm
                title="Authorize this expense?"
                description="Funds will be marked authorized and reflected in financial summaries."
                onConfirm={() => handleDecision(r.id, 'approved')}
                okText="Approve"
                cancelText="Cancel"
              >
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                >
                  Approve
                </Button>
              </Popconfirm>
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleOpenRejectionModal(r)}
              >
                Reject
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden', padding: '0 4px' }}>
      <PageHeader
        title="Expense Management Hub"
        actions={[
          {
            label: 'Record New Expense',
            onClick: () => setAddModalOpen(true),
            icon: <PlusOutlined />,
            type: 'primary',
          },
          {
            label: 'Export Ledger (CSV)',
            onClick: handleExportCSV,
            icon: <ExportOutlined />,
          },
          {
            label: showAnalytics ? 'Hide Analytics' : 'Show Analytics',
            onClick: () => setShowAnalytics((v) => !v),
            icon: showAnalytics ? <UpOutlined /> : <BarChartOutlined />,
          },
          {
            label: 'Refresh',
            onClick: () => {
              refetch();
              message.success('Refreshed expenses ledger');
            },
            icon: <ReloadOutlined />,
          },
        ]}
      />

      {/* ── METRIC STAT CARDS ────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            style={{
              borderRadius: 10,
              background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)',
              borderLeft: '5px solid #ef4444',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <Statistic
              title={<span style={{ fontWeight: 600, color: '#64748b' }}>TOTAL EXPENSES LEDGER</span>}
              value={metrics.totalGHS}
              prefix="GH₵"
              precision={2}
              valueStyle={{ color: '#b91c1c', fontWeight: 700 }}
              suffix={
                <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', display: 'block', marginTop: 4 }}>
                  {filteredExpenses.length} entries
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            style={{
              borderRadius: 10,
              background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)',
              borderLeft: '5px solid #f59e0b',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <Statistic
              title={<span style={{ fontWeight: 600, color: '#64748b' }}>PENDING AUTHORIZATION</span>}
              value={metrics.pendingGHS}
              prefix="GH₵"
              precision={2}
              valueStyle={{ color: '#d97706', fontWeight: 700 }}
              suffix={
                <span style={{ fontSize: 12, fontWeight: 600, color: '#d97706', display: 'block', marginTop: 4 }}>
                  ⚠️ {counts.pending} awaiting approval
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            style={{
              borderRadius: 10,
              background: 'linear-gradient(135deg, #ffffff 0%, #ecfeff 100%)',
              borderLeft: '5px solid #06b6d4',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <Statistic
              title={<span style={{ fontWeight: 600, color: '#64748b' }}>INTERNAL OPERATIONS</span>}
              value={metrics.internalGHS}
              prefix="GH₵"
              precision={2}
              valueStyle={{ color: '#0891b2', fontWeight: 600 }}
              suffix={
                <span style={{ fontSize: 12, color: '#64748b', display: 'block', marginTop: 4 }}>
                  Office, Power, Hospitality
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            style={{
              borderRadius: 10,
              background: 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%)',
              borderLeft: '5px solid #8b5cf6',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <Statistic
              title={<span style={{ fontWeight: 600, color: '#64748b' }}>EXTERNAL & PROJECTS</span>}
              value={metrics.externalGHS}
              prefix="GH₵"
              precision={2}
              valueStyle={{ color: '#7c3aed', fontWeight: 600 }}
              suffix={
                <span style={{ fontSize: 12, color: '#64748b', display: 'block', marginTop: 4 }}>
                  Billboards, Ads, Site Logistics
                </span>
              }
            />
          </Card>
        </Col>
      </Row>

      {/* ── COLLAPSIBLE VISUAL ANALYTICS ─────────────────────────────────── */}
      {showAnalytics && (
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <PieChartOutlined style={{ color: tokens.primary }} />
                  <span style={{ fontWeight: 600 }}>Spend Distribution by Category</span>
                </Space>
              }
              style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
            >
              {categoryChartData.length > 0 ? (
                <div style={{ height: 260, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categoryChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(val: any) => [`GH₵ ${Number(val).toLocaleString()}`, 'Amount']}
                      />
                      <Legend
                        layout="horizontal"
                        verticalAlign="bottom"
                        align="center"
                        wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data available for charts" />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <BarChartOutlined style={{ color: '#722ed1' }} />
                  <span style={{ fontWeight: 600 }}>Operational Expenditure by Branch</span>
                </Space>
              }
              style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
            >
              {branchChartData.length > 0 ? (
                <div style={{ height: 260, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={branchChartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                      <XAxis dataKey="branch" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `GH₵${v / 1000}k`} />
                      <RechartsTooltip formatter={(val: any) => [`GH₵ ${Number(val).toLocaleString()}`, 'Expenditure']} />
                      <Bar dataKey="amountGHS" name="Total Spend" fill="#1890ff" radius={[6, 6, 0, 0]}>
                        {branchChartData.map((_, idx) => (
                          <Cell key={`bar-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No branch spend recorded yet" />
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* ── COMMAND & FILTERS BAR ────────────────────────────────────────── */}
      <Card style={{ marginBottom: 16, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={5}>
            <Input
              placeholder="Search code, category, staff..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="middle"
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Branch"
              value={branchFilter}
              onChange={setBranchFilter}
              size="middle"
            >
              <Option value="all">🏢 All Branches</Option>
              {branches.map((b: any) => (
                <Option key={b.id} value={b.id}>
                  {b.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Expense Type"
              value={typeFilter}
              onChange={setTypeFilter}
              size="middle"
            >
              <Option value="all">🌐 All Types</Option>
              <Option value="internal">🏢 Internal Operations</Option>
              <Option value="external">🚚 External / Projects</Option>
            </Select>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Category"
              value={categoryFilter}
              onChange={setCategoryFilter}
              size="middle"
              showSearch
              optionFilterProp="children"
            >
              <Option value="all">🏷️ All Categories</Option>
              {categories.map((c) => (
                <Option key={c} value={c}>
                  {getCategoryIcon(c)} {c}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              style={{ width: '100%' }}
              value={dateFilter}
              onChange={(val) => {
                setDateFilter(val);
                if (val !== 'custom') setCustomDateRange(null);
              }}
              size="middle"
              prefix={<CalendarOutlined style={{ color: '#8c8c8c' }} />}
            >
              <Option value="today">☀️ Today</Option>
              <Option value="weekly">📆 This Week</Option>
              <Option value="monthly">🗓️ This Month</Option>
              <Option value="yearly">📊 This Year</Option>
              <Option value="all">📅 All Time</Option>
              <Option value="custom">🎯 Custom Range</Option>
            </Select>
          </Col>
          {dateFilter === 'custom' && (
            <Col xs={24} md={3}>
              <DatePicker.RangePicker
                style={{ width: '100%' }}
                value={customDateRange}
                onChange={(dates: any) => setCustomDateRange(dates)}
                format="YYYY-MM-DD"
              />
            </Col>
          )}
        </Row>
      </Card>

      {/* ── STATUS TABS ─────────────────────────────────────────────────── */}
      <Tabs
        activeKey={statusFilter}
        onChange={(k) => setStatusFilter(k as any)}
        style={{ marginBottom: 12 }}
        items={[
          {
            key: 'all',
            label: (
              <span>
                All Ledger Records <Badge count={counts.all} style={{ backgroundColor: '#64748b', marginLeft: 6 }} />
              </span>
            ),
          },
          {
            key: 'pending',
            label: (
              <span>
                Pending Authorization <Badge count={counts.pending} style={{ backgroundColor: '#f59e0b', marginLeft: 6 }} />
              </span>
            ),
          },
          {
            key: 'approved',
            label: (
              <span>
                Authorized & Disbursed <Badge count={counts.approved} style={{ backgroundColor: '#10b981', marginLeft: 6 }} />
              </span>
            ),
          },
          {
            key: 'rejected',
            label: (
              <span>
                Declined <Badge count={counts.rejected} style={{ backgroundColor: '#ef4444', marginLeft: 6 }} />
              </span>
            ),
          },
        ]}
      />

      {/* ── TABLE ────────────────────────────────────────────────────────── */}
      <Card style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={filteredExpenses}
          rowKey="id"
          loading={isLoading}
          size="middle"
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) => `Showing ${range[0]}-${range[1]} of ${total} expenses`,
          }}
        />
      </Card>

      {/* ── EXPENSE VOUCHER DETAIL DRAWER ─────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <AuditOutlined style={{ color: tokens.primary }} />
            <span>Expense Payment Voucher Details</span>
          </Space>
        }
        open={voucherDrawerOpen}
        onClose={() => setVoucherDrawerOpen(false)}
        width={560}
      >
        {selectedExpense ? (
          <div>
            {/* Voucher Hero Card */}
            <Card
              style={{
                marginBottom: 20,
                background: selectedExpense.status === 'approved' ? '#f0fdf4' : selectedExpense.status === 'pending' ? '#fffbeb' : '#fef2f2',
                borderColor: selectedExpense.status === 'approved' ? '#bbf7d0' : selectedExpense.status === 'pending' ? '#fde68a' : '#fecaca',
                borderRadius: 10,
              }}
            >
              <Row align="middle" justify="space-between">
                <Col>
                  <Text type="secondary" style={{ fontSize: 12 }}>VOUCHER REFERENCE</Text>
                  <Title level={4} style={{ margin: 0, color: '#0f172a' }}>
                    {selectedExpense.code || selectedExpense.id}
                  </Title>
                </Col>
                <Col style={{ textAlign: 'right' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>TOTAL DISBURSEMENT</Text>
                  <Title level={3} style={{ margin: 0, color: '#b91c1c', fontFamily: 'monospace' }}>
                    GH₵ {(selectedExpense.amountMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Title>
                </Col>
              </Row>
              <div style={{ marginTop: 12 }}>
                <Tag
                  color={selectedExpense.status === 'approved' ? 'green' : selectedExpense.status === 'pending' ? 'gold' : 'red'}
                  style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, fontWeight: 600 }}
                >
                  {selectedExpense.status === 'approved' ? '✓ Authorized & Released' : selectedExpense.status === 'pending' ? '⏳ Pending Authorization' : '✗ Declined Request'}
                </Tag>
              </div>
            </Card>

            {/* Quick Actions in Drawer */}
            {hasRole(['admin', 'accounts']) && selectedExpense.status === 'pending' && (
              <Alert
                message="Authorization Required"
                description="This expense was submitted by staff and requires administrative review to release funds."
                type="warning"
                showIcon
                action={
                  <Space direction="vertical" size={6} style={{ marginTop: 8 }}>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      style={{ background: '#10b981', borderColor: '#10b981', width: '100%' }}
                      onClick={() => handleDecision(selectedExpense.id, 'approved')}
                    >
                      Authorize & Disburse Funds
                    </Button>
                    <Button
                      danger
                      icon={<CloseCircleOutlined />}
                      style={{ width: '100%' }}
                      onClick={() => handleOpenRejectionModal(selectedExpense)}
                    >
                      Decline Request
                    </Button>
                  </Space>
                }
                style={{ marginBottom: 20 }}
              />
            )}

            {/* Itemized Breakdown */}
            <Title level={5} style={{ marginBottom: 12 }}>Itemized Breakdown</Title>
            <Card size="small" style={{ marginBottom: 20, borderRadius: 8 }}>
              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11 }}>EXPENSE CATEGORY</Text>
                  <Text strong style={{ display: 'block', fontSize: 13 }}>
                    {getCategoryIcon(selectedExpense.category)} {selectedExpense.category}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11 }}>OPERATIONAL TYPE</Text>
                  <Text strong style={{ display: 'block', fontSize: 13 }}>
                    {selectedExpense.type === 'internal' ? '🏢 Internal Operations' : '🚚 External Project Cost'}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11 }}>INCURRED DATE</Text>
                  <Text strong style={{ display: 'block', fontSize: 13 }}>
                    {dayjs(selectedExpense.incurredOn || selectedExpense.createdAt).format('MMMM D, YYYY')}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11 }}>BRANCH / LOCATION</Text>
                  <Text strong style={{ display: 'block', fontSize: 13 }}>
                    {branches.find((b: any) => b.id === selectedExpense.branchId)?.name || 'Head Office'}
                  </Text>
                </Col>
                <Col span={24}>
                  <Text type="secondary" style={{ fontSize: 11 }}>PURPOSE & DETAILS</Text>
                  <Paragraph style={{ margin: '4px 0 0 0', color: '#334155', background: '#f8fafc', padding: 10, borderRadius: 6 }}>
                    {selectedExpense.description || 'No additional notes provided.'}
                  </Paragraph>
                </Col>
              </Row>
            </Card>

            {/* Initiator Details */}
            <Title level={5} style={{ marginBottom: 12 }}>Initiator Information</Title>
            <Card size="small" style={{ marginBottom: 20, borderRadius: 8 }}>
              <Space align="center" size={12}>
                <PhotoUpload entityType="staff" entityId={selectedExpense.recordedByUserId || selectedExpense.id} size={48} editable={false} />
                <div>
                  <Text strong style={{ fontSize: 14, display: 'block' }}>
                    {selectedExpense.recordedByUserName || 'Staff Member'}
                  </Text>
                  <Tag color={getRoleBadgeColor(selectedExpense.recordedByUserRole)} style={{ marginTop: 2 }}>
                    {getRoleDisplay(selectedExpense.recordedByUserRole)}
                  </Tag>
                  {(selectedExpense as any).liveEmail && (
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 3 }}>
                      ✉️ {(selectedExpense as any).liveEmail}
                    </Text>
                  )}
                  {(selectedExpense as any).livePhone && (
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 1 }}>
                      📞 {(selectedExpense as any).livePhone}
                    </Text>
                  )}
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                    Recorded in ledger on {dayjs(selectedExpense.createdAt).format('MMM D, YYYY hh:mm A')}
                  </Text>
                </div>
              </Space>
            </Card>

            {/* Approval Audit Trail */}
            <Title level={5} style={{ marginBottom: 12 }}>Audit & Decision Timeline</Title>
            <Card size="small" style={{ marginBottom: 20, borderRadius: 8 }}>
              <Timeline
                style={{ marginTop: 8 }}
                items={[
                  {
                    color: 'blue',
                    children: (
                      <div>
                        <Text strong>Expense Initiated</Text>
                        <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
                          Submitted by {selectedExpense.recordedByUserName || 'Staff'} on {dayjs(selectedExpense.createdAt).format('MMM D, YYYY')}
                        </Text>
                      </div>
                    ),
                  },
                  selectedExpense.status === 'approved'
                    ? {
                        color: 'green',
                        children: (
                          <div>
                            <Text strong style={{ color: '#16a34a' }}>Authorized & Released</Text>
                            <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
                              {selectedExpense.decisionNote || 'Authorized by Accounts & Finance'}
                            </Text>
                          </div>
                        ),
                      }
                    : selectedExpense.status === 'rejected'
                    ? {
                        color: 'red',
                        children: (
                          <div>
                            <Text strong style={{ color: '#dc2626' }}>Declined by Reviewer</Text>
                            <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
                              Reason: {selectedExpense.decisionNote || 'Not authorized for disbursement.'}
                            </Text>
                          </div>
                        ),
                      }
                    : {
                        color: 'gold',
                        children: (
                          <div>
                            <Text strong style={{ color: '#d97706' }}>Awaiting Administrative Decision</Text>
                            <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
                              Pending review on Admin and Accounts dashboards.
                            </Text>
                          </div>
                        ),
                      },
                ]}
              />
            </Card>

            {/* Print Payment Slip Action */}
            <Button
              block
              icon={<PrinterOutlined />}
              onClick={() => window.print()}
              style={{ borderRadius: 6 }}
            >
              Print Official Payment Voucher Slip
            </Button>
          </div>
        ) : (
          <Empty description="No expense voucher selected" />
        )}
      </Drawer>

      {/* ── REJECTION REASON MODAL ────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <CloseCircleOutlined style={{ color: '#ef4444' }} />
            <span>Decline Expense Request</span>
          </Space>
        }
        open={rejectionModalOpen}
        onCancel={() => {
          setRejectionModalOpen(false);
          setExpenseToReject(null);
        }}
        onOk={handleConfirmRejection}
        okText="Confirm Rejection"
        okButtonProps={{ danger: true }}
      >
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>
          Provide an explanation or reason for rejecting this expense request. The initiator will see this note in their voucher history.
        </p>
        <Input.TextArea
          rows={3}
          placeholder="e.g. Missing receipt invoice, amount exceeds department threshold, or duplicate voucher..."
          value={rejectionNote}
          onChange={(e) => setRejectionNote(e.target.value)}
        />
      </Modal>

      {/* ── RECORD NEW EXPENSE MODAL ─────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <DollarOutlined style={{ color: tokens.primary }} />
            <span>Record Branch / Operational Expense</span>
          </Space>
        }
        open={addModalOpen}
        onCancel={() => {
          setAddModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={580}
      >
        <Form form={form} layout="vertical" onFinish={handleAddExpense}>
          <Alert
            type="info"
            showIcon
            message="Authorization Policy"
            description={
              hasRole(['admin'])
                ? 'As an Administrator, recorded expenses are authorized immediately.'
                : 'All staff-initiated expenses are placed in pending status awaiting authorization by Admin or Accounts officers.'
            }
            style={{ marginBottom: 16 }}
          />

          <Row gutter={12}>
            <Col span={14}>
              <Form.Item
                name="category"
                label="Expense Category"
                rules={[{ required: true, message: 'Please pick category' }]}
                initialValue="Office Supplies"
              >
                <Select placeholder="Select category">
                  <Option value="Office Supplies">📝 Office Supplies & Stationery</Option>
                  <Option value="Fuel & Transport">⚡ Fuel, Generator & Transport</Option>
                  <Option value="Utilities & Internet">🌐 Utilities & Internet</Option>
                  <Option value="Site Survey & Equipment">📍 Site Inspection & Field Logistics</Option>
                  <Option value="Marketing & Advertising">📢 Marketing, Billboards & Ads</Option>
                  <Option value="Legal & Documentation">⚖️ Legal, Cadastral & Deeds</Option>
                  <Option value="Maintenance & Repairs">🔧 Facility Maintenance & Repairs</Option>
                  <Option value="Refreshments & Hospitality">☕ Client Hospitality & Executive Lounge</Option>
                  <Option value="Courier & Dispatch">🚚 Express Courier & Document Dispatch</Option>
                  <Option value="Other">💳 Other Operational Cost</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="type" label="Expense Type" initialValue="internal" rules={[{ required: true }]}>
                <Select>
                  <Option value="internal">🏢 Internal Operations</Option>
                  <Option value="external">🚚 External / Project</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="amountGHS"
                label="Amount (GH₵)"
                rules={[{ required: true, message: 'Enter disbursement amount' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  precision={2}
                  prefix="GH₵"
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="date" label="Incurred Date" initialValue={dayjs()} rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="branchId" label="Branch Office" initialValue={user?.branchId || branches[0]?.id}>
            <Select placeholder="Select branch office">
              {branches.map((b: any) => (
                <Option key={b.id} value={b.id}>
                  🏢 {b.name} ({b.branchCode || b.id})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="Detailed Purpose / Vendor Reference"
            rules={[{ required: true, message: 'Provide detailed purpose or vendor info' }]}
          >
            <TextArea rows={3} placeholder="Vendor name, itemized service details, invoice number, or project reference..." />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAddModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={createExpenseMutation.isPending}>
                {hasRole(['admin']) ? 'Authorize & Save Expense' : 'Submit for Authorization'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default ExpensesPage;
