// src/components/expenses/RoleExpenseDashboard.tsx
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
  Alert,
  Drawer,
  Empty,
  notification,
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
  PrinterOutlined,
  ThunderboltOutlined,
  CoffeeOutlined,
  CarOutlined,
  LockOutlined,
  GlobalOutlined,
  TeamOutlined,
  BarChartOutlined,
  PieChartOutlined,
  LeftOutlined,
  RightOutlined,
  HistoryOutlined,
  SwapOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAuth } from '@/contexts/AuthContext';
import {
  useExpensesQuery,
  useCreateExpenseMutation,
  useExpenseDecisionMutation,
  type ExpenseEntity,
} from '@/api/expenses';
import { useBranchContext } from '@/contexts/BranchContext';
import { useBranchesQuery } from '@/api/branches';
import { useUsersQuery, getUserFullName, getUserPhone, type UserEntity } from '@/api/users';
import { getBranchCanonicalKey } from '@/utils/branchIsolation';
import {
  filterExpensesByRole,
  getRoleDashboardConfig,
  calculateRoleMetrics,
  getDailyTrackingMetrics,
  groupExpensesByDay,
  type ExpenseRoleView,
  type DailyLedgerSummary,
} from '@/utils/expenseRoleIsolation';
import { HistoricalExpenseCrossCheck } from '@/components/expenses/HistoricalExpenseCrossCheck';
import type { Role } from '@/types';
import { tokens } from '@/constants/tokens';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const CHART_COLORS = ['#1890ff', '#52c41a', '#fa8c16', '#722ed1', '#13c2c2', '#eb2f96', '#faad14', '#2f54eb'];

export interface RoleExpenseDashboardProps {
  /**
   * Explicit role override if used inside a role-specific dashboard page
   * (e.g. forced to 'secretary' inside SecretaryDashboardPage)
   */
  fixedRole?: ExpenseRoleView;
  /**
   * Title override
   */
  customTitle?: string;
  /**
   * Optional compact mode when embedded inside a dashboard tab
   */
  compact?: boolean;
  style?: React.CSSProperties;
}

export const RoleExpenseDashboard: React.FC<RoleExpenseDashboardProps> = ({
  fixedRole,
  customTitle,
  compact = false,
  style,
}) => {
  const { user, hasRole } = useAuth();
  const isAdminOrAccounts = hasRole(['admin', 'accounts']);

  // If fixedRole is passed, use it; otherwise default to user's role or 'all' for admin
  const initialRoleLens: ExpenseRoleView = fixedRole || (isAdminOrAccounts ? 'all' : (user?.role as ExpenseRoleView) || 'branch_manager');
  const [roleLens, setRoleLens] = useState<ExpenseRoleView>(initialRoleLens);

  // If fixedRole changes, keep in sync
  useEffect(() => {
    if (fixedRole) {
      setRoleLens(fixedRole);
    }
  }, [fixedRole]);

  const { branches: contextBranches } = useBranchContext();
  const { data: apiBranches = [] } = useBranchesQuery();
  const branches = apiBranches.length > 0 ? apiBranches : contextBranches;

  const currentBranchName = useMemo(() => {
    const bId = user?.branchId || user?.branch;
    const found = branches.find((b: any) => b.id === bId || b.name === bId);
    return found?.name || user?.branch || 'Kumasi Main';
  }, [user?.branchId, user?.branch, branches]);

  // Live queries
  const { data: expensesData, isLoading, refetch, isFetching } = useExpensesQuery();
  const { data: usersData } = useUsersQuery({ pageSize: 100 });
  const liveUsers: UserEntity[] = useMemo(() => usersData?.items ?? [], [usersData]);

  const createExpenseMutation = useCreateExpenseMutation();
  const decisionMutation = useExpenseDecisionMutation();

  // Fast user lookup
  const { usersById, usersByName } = useMemo(() => {
    const byId = new Map<string, UserEntity>();
    const byName = new Map<string, UserEntity>();
    liveUsers.forEach((u) => {
      byId.set(u.id, u);
      const fullName = getUserFullName(u).toLowerCase().trim();
      if (fullName) byName.set(fullName, u);
      if (u.email) byName.set(u.email.toLowerCase().trim(), u);
    });
    return { usersById: byId, usersByName: byName };
  }, [liveUsers]);

  // 1. Reconcile raw live expenses with live users and branch data
  const rawExpenses = expensesData?.items ?? [];
  const enrichedExpenses: ExpenseEntity[] = useMemo(() => {
    return rawExpenses.map((expense) => {
      let matchedUser = expense.recordedByUserId ? usersById.get(expense.recordedByUserId) : undefined;
      if (!matchedUser && expense.recordedByUserName) {
        matchedUser = usersByName.get(expense.recordedByUserName.toLowerCase().trim());
      }

      const liveRole = matchedUser?.role || expense.recordedByUserRole || 'secretary';
      const liveName = matchedUser
        ? getUserFullName(matchedUser)
        : (expense.recordedByUserName || 'Staff Member');
      const branchId = expense.branchId || matchedUser?.branchId || user?.branchId;
      const branchObj = branches.find((b: any) => b.id === branchId);
      const liveBranchName = expense.branchName || branchObj?.name || 'Kumasi Main';

      return {
        ...expense,
        recordedByUserId: matchedUser?.id || expense.recordedByUserId,
        recordedByUserName: liveName,
        recordedByUserRole: liveRole,
        branchId,
        branchName: liveBranchName,
      };
    });
  }, [rawExpenses, usersById, usersByName, branches, user?.branchId]);

  // 2. Strict Role Isolation: Filter records according to the active role lens
  const roleFilteredExpenses = useMemo(() => {
    return filterExpensesByRole(enrichedExpenses, user, roleLens);
  }, [enrichedExpenses, user, roleLens]);

  // Active role dashboard configuration
  const roleConfig = useMemo(() => {
    return getRoleDashboardConfig(roleLens, user, currentBranchName);
  }, [roleLens, user, currentBranchName]);

  // ── 24-Hour Daily Tracking State ─────────────────────────────────────────────
  const [todayKey, setTodayKey] = useState<string>(() => dayjs().format('YYYY-MM-DD'));
  const [activeDailyDate, setActiveDailyDate] = useState<string>(() => dayjs().format('YYYY-MM-DD'));
  const [viewMode, setViewMode] = useState<'daily' | 'all_time'>('daily');
  const [crossCheckOpen, setCrossCheckOpen] = useState(false);
  const [countdownStr, setCountdownStr] = useState<string>('');

  const isDailyMode = viewMode === 'daily';
  const isTodayActive = activeDailyDate === todayKey;

  // ── 24-Hour Automated Rollover Engine ────────────────────────────────────────
  useEffect(() => {
    const updateCountdownAndCheckDay = () => {
      const now = dayjs();
      const currentDay = now.format('YYYY-MM-DD');

      // Check if 24 hours elapsed across midnight boundary or system woke up on a new day
      if (currentDay !== todayKey) {
        const prevDayFormatted = dayjs(todayKey).format('MMMM D, YYYY');
        const newDayFormatted = now.format('MMMM D, YYYY');

        setTodayKey(currentDay);
        // Automatically set up the new page for daily tracking
        setActiveDailyDate(currentDay);
        try {
          localStorage.setItem('omark_last_daily_cycle', currentDay);
        } catch {
          // ignore
        }

        notification.info({
          message: '🌅 Fresh Daily Ledger Initialized',
          description: `The 24-hour cycle has completed (${prevDayFormatted}). Today's fresh expense page (${newDayFormatted}) is now active for daily tracking.`,
          duration: 8,
          placement: 'topRight',
        });

        refetch();
      }

      // Calculate time remaining until next midnight rollover
      const midnight = now.endOf('day');
      const diffSec = midnight.diff(now, 'second');
      const hours = Math.floor(diffSec / 3600);
      const minutes = Math.floor((diffSec % 3600) / 60);
      const seconds = diffSec % 60;
      setCountdownStr(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdownAndCheckDay();
    const interval = setInterval(updateCountdownAndCheckDay, 1000);
    return () => clearInterval(interval);
  }, [todayKey, refetch]);

  // All historical days for this role
  const allHistoricalDays = useMemo(() => {
    return groupExpensesByDay(roleFilteredExpenses);
  }, [roleFilteredExpenses]);

  // Tailored daily metrics for activeDailyDate
  const dailyMetrics = useMemo(() => {
    return getDailyTrackingMetrics(roleFilteredExpenses, activeDailyDate, roleLens);
  }, [roleFilteredExpenses, activeDailyDate, roleLens]);

  // Stepper handlers
  const handlePrevDay = () => {
    const prev = dayjs(activeDailyDate).subtract(1, 'day').format('YYYY-MM-DD');
    setActiveDailyDate(prev);
    setViewMode('daily');
  };

  const handleNextDay = () => {
    const next = dayjs(activeDailyDate).add(1, 'day').format('YYYY-MM-DD');
    if (next <= todayKey) {
      setActiveDailyDate(next);
      setViewMode('daily');
    }
  };

  // ── Local Filter State ───────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'internal' | 'external'>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('all');
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(true);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [voucherDrawerOpen, setVoucherDrawerOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseEntity | null>(null);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionNote, setRejectionNote] = useState('');
  const [expenseToReject, setExpenseToReject] = useState<ExpenseEntity | null>(null);
  const [form] = Form.useForm();

  // Reset category filter if role lens changes
  useEffect(() => {
    setCategoryFilter('all');
  }, [roleLens]);

  // ── Apply Multi-Criteria Filters ────────────────────────────────────────────
  const baseFilteredExpenses = useMemo(() => {
    return roleFilteredExpenses.filter((e) => {
      // 1. Daily tracking filter: When in daily mode, isolate strictly to activeDailyDate
      if (isDailyMode) {
        const expDate = dayjs(e.incurredOn || e.createdAt);
        const expDateKey = expDate.isValid() ? expDate.format('YYYY-MM-DD') : todayKey;
        if (expDateKey !== activeDailyDate) {
          return false;
        }
      } else {
        // In all_time mode, apply general date filters if selected
        if (customDateRange && customDateRange[0] && customDateRange[1]) {
          const d = dayjs(e.incurredOn || e.createdAt);
          if (!d.isValid()) return false;
          if (d.isBefore(customDateRange[0].startOf('day')) || d.isAfter(customDateRange[1].endOf('day'))) return false;
        } else if (dateFilter !== 'all') {
          const d = dayjs(e.incurredOn || e.createdAt);
          if (!d.isValid()) return false;
          const now = dayjs();
          if (dateFilter === 'today' && !d.isSame(now, 'day')) return false;
          if (dateFilter === 'weekly' && !d.isSame(now, 'week')) return false;
          if (dateFilter === 'monthly' && !d.isSame(now, 'month')) return false;
          if (dateFilter === 'yearly' && !d.isSame(now, 'year')) return false;
        }
      }

      // Branch filter (if Admin chooses a specific branch, or 'all')
      if (branchFilter !== 'all') {
        const matchesDirect = e.branchId === branchFilter;
        const bObj = branches.find((b: any) => b.id === branchFilter);
        const canonSelected = getBranchCanonicalKey(bObj?.name || branchFilter);
        const canonExp = getBranchCanonicalKey(e.branchName || e.branchId);
        const matchesCanon = Boolean(canonSelected && canonExp && canonSelected === canonExp);
        if (!matchesDirect && !matchesCanon) return false;
      }

      // Search
      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        const inCat = (e.category || '').toLowerCase().includes(q);
        const inDesc = (e.description || '').toLowerCase().includes(q);
        const inCode = (e.code || '').toLowerCase().includes(q);
        const inUser = (e.recordedByUserName || '').toLowerCase().includes(q);
        if (!inCat && !inDesc && !inCode && !inUser) return false;
      }

      // Category
      if (categoryFilter !== 'all' && e.category !== categoryFilter) {
        return false;
      }

      // Type
      if (typeFilter !== 'all' && e.type !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [
    roleFilteredExpenses,
    isDailyMode,
    activeDailyDate,
    todayKey,
    branchFilter,
    searchText,
    categoryFilter,
    typeFilter,
    dateFilter,
    customDateRange,
    branches,
  ]);

  // Counts for status tabs
  const counts = useMemo(() => ({
    all: baseFilteredExpenses.length,
    pending: baseFilteredExpenses.filter((e) => e.status === 'pending').length,
    approved: baseFilteredExpenses.filter((e) => e.status === 'approved').length,
    rejected: baseFilteredExpenses.filter((e) => e.status === 'rejected').length,
  }), [baseFilteredExpenses]);

  // Final table expenses after status filter
  const finalExpenses = useMemo(() => {
    if (statusFilter === 'all') return baseFilteredExpenses;
    return baseFilteredExpenses.filter((e) => e.status === statusFilter);
  }, [baseFilteredExpenses, statusFilter]);

  // Role Metrics
  const metrics = useMemo(() => {
    return calculateRoleMetrics(baseFilteredExpenses, roleLens);
  }, [baseFilteredExpenses, roleLens]);

  // Charts data
  const categoryChartData = useMemo(() => {
    const map = new Map<string, number>();
    baseFilteredExpenses.forEach((e) => {
      const cat = e.category || 'General';
      const cur = map.get(cat) || 0;
      map.set(cat, cur + (e.amountMinor || 0));
    });
    return Array.from(map.entries())
      .map(([name, valMinor]) => ({
        name,
        value: Math.round(valMinor / 100),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [baseFilteredExpenses]);

  const branchOrRoleChartData = useMemo(() => {
    if (roleLens === 'all' || roleLens === 'admin') {
      // For Admin, show role spend comparison
      const roleMap = new Map<string, number>();
      baseFilteredExpenses.forEach((e) => {
        const r = (e.recordedByUserRole || 'other').replace(/_/g, ' ');
        const cur = roleMap.get(r) || 0;
        roleMap.set(r, cur + (e.amountMinor || 0));
      });
      return Array.from(roleMap.entries()).map(([label, valMinor]) => ({
        name: label.toUpperCase(),
        amountGHS: Math.round(valMinor / 100),
      }));
    } else {
      // For single roles, show monthly distribution
      const monthMap = new Map<string, number>();
      baseFilteredExpenses.forEach((e) => {
        const m = dayjs(e.incurredOn || e.createdAt).format('MMM YYYY');
        const cur = monthMap.get(m) || 0;
        monthMap.set(m, cur + (e.amountMinor || 0));
      });
      return Array.from(monthMap.entries()).map(([name, valMinor]) => ({
        name,
        amountGHS: Math.round(valMinor / 100),
      }));
    }
  }, [baseFilteredExpenses, roleLens]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleOpenAddModal = () => {
    const defaultCat = roleConfig.defaultCategories[0] || 'Office Supplies';
    const defaultType = roleLens === 'marketing_director' ? 'external' : 'internal';
    form.setFieldsValue({
      category: defaultCat,
      type: defaultType,
      amountGHS: undefined,
      date: isDailyMode ? dayjs(activeDailyDate) : dayjs(),
      branchId: user?.branchId || branches[0]?.id,
      description: '',
    });
    setAddModalOpen(true);
  };

  const handleCreateExpense = async (values: any) => {
    try {
      const userName = user
        ? (user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email)
        : 'Authorized Staff';
      const effectiveRole = fixedRole || (user?.role as Role) || 'secretary';

      await createExpenseMutation.mutateAsync({
        branchId: values.branchId || user?.branchId,
        category: values.category,
        description: values.description,
        amountMinor: Math.round(values.amountGHS * 100),
        type: values.type,
        incurredOn: values.date ? values.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        recordedByUserId: user?.id,
        recordedByUserName: userName,
        recordedByUserRole: effectiveRole,
        status: isAdminOrAccounts ? 'approved' : 'pending',
      });

      message.success(
        isAdminOrAccounts
          ? 'Expense recorded and authorized immediately!'
          : 'Expense requisition submitted successfully for Admin & Accounts approval!'
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
          note: note || `Authorized by ${user?.firstName || ''} (${user?.role || 'Admin'})`,
        },
      });
      message.success(`Expense ${decision === 'approved' ? 'authorized' : 'rejected'} successfully!`);
      if (selectedExpense?.id === id) {
        setSelectedExpense((prev) => (prev ? { ...prev, status: decision, decisionNote: note } : null));
      }
      setRejectionModalOpen(false);
      setRejectionNote('');
      setExpenseToReject(null);
      refetch();
    } catch (err: any) {
      message.error(err?.message || 'Failed to update expense status');
    }
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (finalExpenses.length === 0) {
      message.warning('No expense data to export with the current filters.');
      return;
    }
    if (format === 'csv') {
      const headers = ['Voucher Code', 'Date', 'Category', 'Description', 'Amount (GHS)', 'Type', 'Branch', 'Recorded By', 'Role', 'Status'];
      const rows = finalExpenses.map((e) => [
        `"${e.code || ''}"`,
        `"${e.incurredOn || ''}"`,
        `"${e.category || ''}"`,
        `"${(e.description || '').replace(/"/g, '""')}"`,
        (e.amountMinor / 100).toFixed(2),
        `"${e.type}"`,
        `"${e.branchName || ''}"`,
        `"${e.recordedByUserName || ''}"`,
        `"${e.recordedByUserRole || ''}"`,
        `"${e.status}"`,
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute(
        'download',
        isDailyMode
          ? `omark_expenses_${roleLens}_daily_${activeDailyDate}.csv`
          : `omark_expenses_${roleLens}_alltime_${dayjs().format('YYYY-MM-DD')}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success(isDailyMode ? `Daily expense report for ${activeDailyDate} exported!` : 'Expense report exported as CSV!');
    }
  };

  // ── Columns ─────────────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Voucher',
      key: 'voucher',
      width: 140,
      render: (_: any, record: ExpenseEntity) => (
        <div>
          <Text strong style={{ color: tokens.primary, fontSize: 13 }}>
            {record.code || `EXP-${record.id.slice(0, 6).toUpperCase()}`}
          </Text>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>
            {dayjs(record.incurredOn).format('MMM D, YYYY')}
          </div>
        </div>
      ),
    },
    {
      title: 'Category & Details',
      key: 'category',
      render: (_: any, record: ExpenseEntity) => (
        <div style={{ maxWidth: 280 }}>
          <Space size={4} wrap>
            <Tag color="blue" style={{ borderRadius: 4, fontWeight: 600 }}>
              {record.category}
            </Tag>
            <Tag color={record.type === 'internal' ? 'cyan' : 'purple'} style={{ borderRadius: 4, fontSize: 10 }}>
              {record.type.toUpperCase()}
            </Tag>
          </Space>
          {record.description && (
            <Paragraph
              ellipsis={{ rows: 2, tooltip: record.description }}
              style={{ fontSize: 12, color: '#595959', margin: '4px 0 0 0' }}
            >
              {record.description}
            </Paragraph>
          )}
        </div>
      ),
    },
    {
      title: 'Branch',
      dataIndex: 'branchName',
      key: 'branchName',
      width: 130,
      render: (branchName: string) => (
        <Space size={4}>
          <ShopOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
          <Text style={{ fontSize: 12 }}>{branchName || 'Kumasi Main'}</Text>
        </Space>
      ),
    },
    {
      title: 'Submitter',
      key: 'submitter',
      width: 160,
      render: (_: any, record: ExpenseEntity) => {
        const role = record.recordedByUserRole || 'staff';
        const roleBadgeColor =
          role === 'secretary' ? '#13c2c2' :
          role === 'marketing_director' ? '#fa8c16' :
          role === 'branch_manager' ? '#1890ff' : '#722ed1';

        return (
          <Space size={8}>
            <Avatar size="small" style={{ backgroundColor: roleBadgeColor }}>
              {(record.recordedByUserName || 'U').charAt(0).toUpperCase()}
            </Avatar>
            <div>
              <Text strong style={{ fontSize: 12, display: 'block', lineHeight: 1.2 }}>
                {record.recordedByUserName || 'Staff Member'}
              </Text>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'capitalize' }}>
                {role.replace(/_/g, ' ')}
              </Text>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Amount (GHS)',
      dataIndex: 'amountMinor',
      key: 'amountMinor',
      width: 140,
      align: 'right' as const,
      render: (amountMinor: number) => (
        <div>
          <Text strong style={{ fontSize: 14, color: '#1f1f1f' }}>
            ₵ {(amountMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: string, record: ExpenseEntity) => {
        const isApproved = status === 'approved';
        const isPending = status === 'pending';
        return (
          <Tooltip title={record.decisionNote ? `Note: ${record.decisionNote}` : undefined}>
            <Tag
              color={isApproved ? 'success' : isPending ? 'warning' : 'error'}
              icon={isApproved ? <CheckCircleOutlined /> : isPending ? <ClockCircleOutlined /> : <CloseCircleOutlined />}
              style={{ borderRadius: 12, padding: '2px 8px', fontWeight: 600 }}
            >
              {isApproved ? 'Approved' : isPending ? 'Pending' : 'Rejected'}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      align: 'center' as const,
      render: (_: any, record: ExpenseEntity) => (
        <Space size={6}>
          <Tooltip title="View Printable Voucher">
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => {
                setSelectedExpense(record);
                setVoucherDrawerOpen(true);
              }}
            />
          </Tooltip>

          {isAdminOrAccounts && record.status === 'pending' && (
            <>
              <Tooltip title="Authorize Expense">
                <Popconfirm
                  title="Authorize Expense"
                  description={`Approve ₵ ${(record.amountMinor / 100).toFixed(2)} for ${record.category}?`}
                  onConfirm={() => handleDecision(record.id, 'approved')}
                  okText="Authorize"
                  okButtonProps={{ type: 'primary', style: { background: '#52c41a' } }}
                >
                  <Button
                    size="small"
                    type="primary"
                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    icon={<CheckCircleOutlined />}
                  />
                </Popconfirm>
              </Tooltip>

              <Tooltip title="Reject with Note">
                <Button
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => {
                    setExpenseToReject(record);
                    setRejectionModalOpen(true);
                  }}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ ...style }}>
      {/* ── Top Header & Role Lens Control ─────────────────────────────────── */}
      <Card
        style={{
          borderRadius: 16,
          marginBottom: 20,
          background: 'linear-gradient(135deg, #ffffff 0%, #f9fbfd 100%)',
          border: '1px solid #e8eff5',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        }}
        bodyStyle={{ padding: compact ? '16px 20px' : '24px 28px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Space size={8} style={{ marginBottom: 6 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  color: roleConfig.badgeColor,
                  backgroundColor: roleConfig.badgeBg,
                  border: `1px solid ${roleConfig.badgeColor}33`,
                }}
              >
                {roleLens === 'all' || roleLens === 'admin' ? <GlobalOutlined /> : <LockOutlined />}
                {roleConfig.badgeLabel}
              </span>
              <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                • Updated {dayjs().format('h:mm A')}
              </span>
            </Space>

            <Title level={compact ? 4 : 3} style={{ margin: '4px 0 6px 0', color: '#1a1f36' }}>
              {customTitle || roleConfig.title}
            </Title>
            <Paragraph style={{ margin: 0, color: '#697386', maxWidth: 750, fontSize: 13 }}>
              {roleConfig.subtitle}
            </Paragraph>
          </div>

          <Space size={10} wrap>
            <Button
              icon={<ReloadOutlined spin={isFetching} />}
              onClick={() => refetch()}
              loading={isFetching}
            >
              Sync
            </Button>
            <Button
              icon={<ExportOutlined />}
              onClick={() => handleExport('csv')}
            >
              Export CSV
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenAddModal}
              style={{
                borderRadius: 8,
                background: tokens.primary,
                boxShadow: '0 4px 12px rgba(24, 144, 255, 0.25)',
              }}
            >
              Record Expense
            </Button>
          </Space>
        </div>

        {/* ── Admin / Accounts Role Lens Switcher ────────────────────────────── */}
        {isAdminOrAccounts && !fixedRole && (
          <div
            style={{
              marginTop: 18,
              paddingTop: 16,
              borderTop: '1px solid #f0f2f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text strong style={{ fontSize: 13, color: '#4a5568' }}>
                <TeamOutlined style={{ marginRight: 6 }} />
                Administrative Lens (Monitor Specific Role Views):
              </Text>
              <Segmented
                size="middle"
                value={roleLens}
                onChange={(val) => setRoleLens(val as ExpenseRoleView)}
                options={[
                  { label: '🌐 All Corporate Data', value: 'all' },
                  { label: '🏢 Branch Manager View', value: 'branch_manager' },
                  { label: '📝 Secretary & Admin View', value: 'secretary' },
                  { label: '📢 Marketing Director View', value: 'marketing_director' },
                ]}
                style={{
                  background: '#f1f5f9',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 12,
                }}
              />
            </div>

            <Button
              type="link"
              size="small"
              icon={showAnalytics ? <PieChartOutlined /> : <BarChartOutlined />}
              onClick={() => setShowAnalytics(!showAnalytics)}
            >
              {showAnalytics ? 'Hide Visual Charts' : 'Show Visual Charts'}
            </Button>
          </div>
        )}

        {/* ── Privacy Notice Banner ─────────────────────────────────────────── */}
        <div style={{ marginTop: 14 }}>
          <Alert
            type={roleLens === 'all' || roleLens === 'admin' ? 'info' : 'success'}
            showIcon
            icon={roleLens === 'all' || roleLens === 'admin' ? <GlobalOutlined /> : <LockOutlined />}
            message={
              <span style={{ fontSize: 12, fontWeight: 500 }}>
                {roleConfig.privacyNotice}
              </span>
            }
            style={{ borderRadius: 8, padding: '6px 14px' }}
          />
        </div>
      </Card>

      {/* ── 24-Hour Daily Cycle Control & Cross-Check Navigator ────────────── */}
      <Card
        style={{
          borderRadius: 14,
          marginBottom: 20,
          background: isTodayActive
            ? 'linear-gradient(135deg, #ffffff 0%, #f6ffed 100%)'
            : 'linear-gradient(135deg, #ffffff 0%, #f9f0ff 100%)',
          border: isTodayActive ? '1px solid #b7eb8f' : '1px solid #d3adf7',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
        }}
        bodyStyle={{ padding: '14px 20px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          {/* Left: Active Daily Ledger Badge & Status */}
          <Space size={10} wrap align="center">
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: isTodayActive ? '#d9f7be' : '#efdbff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isTodayActive ? '#389e0d' : '#722ed1',
                fontSize: 20,
              }}
            >
              <CalendarOutlined />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text strong style={{ fontSize: 16, color: '#111827' }}>
                  {dayjs(activeDailyDate).format('dddd, MMMM D, YYYY')}
                </Text>
                {isTodayActive ? (
                  <Tag color="success" style={{ borderRadius: 12, fontWeight: 700, padding: '2px 10px' }}>
                    ● Today's Fresh Daily Sheet
                  </Tag>
                ) : (
                  <Tag color="purple" style={{ borderRadius: 12, fontWeight: 700, padding: '2px 10px' }}>
                    📜 Historical Daily Sheet
                  </Tag>
                )}
                {isTodayActive && (
                  <Tooltip title="Every 24 hours at midnight, this dashboard automatically rolls over and sets up a fresh daily expense sheet for daily tracking.">
                    <Tag color="blue" icon={<ClockCircleOutlined />} style={{ borderRadius: 12, fontSize: 11 }}>
                      Auto-Rolls In: {countdownStr || 'Calculating...'}
                    </Tag>
                  </Tooltip>
                )}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {isDailyMode
                  ? isTodayActive
                    ? 'Automated 24h daily tracking active • Fresh daily ledger initialized for operational spend'
                    : `Cross-checking historical daily ledger for ${dayjs(activeDailyDate).format('MMMM D, YYYY')}. Click 'Today' to return to active cycle.`
                  : 'Viewing cumulative all-time corporate ledger across all recorded operational dates.'}
              </Text>
            </div>
          </Space>

          {/* Right: Date Navigation Stepper & Mode Switcher */}
          <Space size={8} wrap align="center">
            <Space.Compact>
              <Button
                icon={<LeftOutlined />}
                onClick={handlePrevDay}
                title="Go to Previous Day"
              >
                Prev Day
              </Button>
              <DatePicker
                value={dayjs(activeDailyDate)}
                onChange={(d) => {
                  if (d) {
                    setActiveDailyDate(d.format('YYYY-MM-DD'));
                    setViewMode('daily');
                  }
                }}
                allowClear={false}
                style={{ width: 130 }}
                format="YYYY-MM-DD"
              />
              <Button
                type={isTodayActive && isDailyMode ? 'primary' : 'default'}
                onClick={() => {
                  setActiveDailyDate(todayKey);
                  setViewMode('daily');
                }}
                style={{ fontWeight: 600 }}
              >
                Today
              </Button>
              <Button
                icon={<RightOutlined />}
                onClick={handleNextDay}
                disabled={activeDailyDate >= todayKey}
                title="Go to Next Day"
              >
                Next Day
              </Button>
            </Space.Compact>

            <Button
              icon={<HistoryOutlined />}
              onClick={() => setCrossCheckOpen(true)}
              style={{
                borderRadius: 8,
                borderColor: '#bfdbfe',
                color: '#1e40af',
                fontWeight: 600,
                background: '#eff6ff',
              }}
            >
              Cross-Check Archives ({allHistoricalDays.length} Days)
            </Button>

            <Segmented
              value={viewMode}
              onChange={(v) => setViewMode(v as any)}
              options={[
                { label: '🗓️ Daily Sheet (24h)', value: 'daily' },
                { label: '🌐 All-Time Ledger', value: 'all_time' },
              ]}
              style={{ fontWeight: 600 }}
            />
          </Space>
        </div>
      </Card>

      {/* ── Fresh Daily Ledger Clean Slate Card (when daily mode has 0 expenses) ── */}
      {isDailyMode && baseFilteredExpenses.length === 0 && (
        <Card
          style={{
            borderRadius: 14,
            border: '1px dashed #b7eb8f',
            background: 'linear-gradient(135deg, #f6ffed 0%, #e6fffb 100%)',
            textAlign: 'center',
            marginBottom: 20,
          }}
          bodyStyle={{ padding: '32px 24px' }}
        >
          <div style={{ maxWidth: 540, margin: '0 auto' }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: '#d9f7be',
                color: '#389e0d',
                fontSize: 24,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <CheckCircleOutlined />
            </div>
            <Title level={4} style={{ margin: '0 0 6px 0', color: '#135200' }}>
              Fresh Daily Expense Page Initialized
            </Title>
            <Paragraph style={{ color: '#595959', fontSize: 13, marginBottom: 16 }}>
              {isTodayActive
                ? `The 24-hour cycle for today (${dayjs(activeDailyDate).format('dddd, MMMM D, YYYY')}) is active with a clean slate. No operational expenses have been incurred yet today.`
                : `No expense records were logged on ${dayjs(activeDailyDate).format('dddd, MMMM D, YYYY')}. You can log expenses for this date or cross-check other dates.`}
            </Paragraph>
            <Space size={12}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleOpenAddModal}
                style={{ borderRadius: 8, background: tokens.primary }}
              >
                {isTodayActive ? 'Record Today\'s First Expense' : `Record Expense for ${dayjs(activeDailyDate).format('MMM D')}`}
              </Button>
              <Button
                icon={<HistoryOutlined />}
                onClick={() => setCrossCheckOpen(true)}
                style={{ borderRadius: 8 }}
              >
                Cross-Check Historical Dates
              </Button>
            </Space>
          </div>
        </Card>
      )}

      {/* ── Role KPI Metrics Row ──────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{
              borderRadius: 14,
              border: '1px solid #f0f0f0',
              background: 'linear-gradient(135deg, #ffffff 0%, #fbfcfe 100%)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
            }}
          >
            <Statistic
              title={
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                  {isDailyMode ? `Daily Spend • ${dayjs(activeDailyDate).format('MMM D')}` : 'Total Role Expenditure'}
                </Text>
              }
              value={isDailyMode ? dailyMetrics.totalGHS : metrics.totalGHS}
              prefix="₵"
              precision={2}
              valueStyle={{ color: tokens.primary, fontWeight: 800, fontSize: 24 }}
            />
            <div style={{ marginTop: 6, fontSize: 11, color: '#8c8c8c' }}>
              {isDailyMode ? (
                <span>
                  {dailyMetrics.count} voucher{dailyMetrics.count === 1 ? '' : 's'} today • Trend:{' '}
                  <span
                    style={{
                      fontWeight: 600,
                      color:
                        dailyMetrics.spendTrendPercent === null
                          ? '#8c8c8c'
                          : dailyMetrics.spendTrendPercent > 0
                          ? '#cf1322'
                          : '#389e0d',
                    }}
                  >
                    {dailyMetrics.spendTrendPercent !== null
                      ? `${dailyMetrics.spendTrendPercent > 0 ? '+' : ''}${dailyMetrics.spendTrendPercent}% vs yesterday`
                      : 'Baseline day'}
                  </span>
                </span>
              ) : (
                `${metrics.totalCount} requisition${metrics.totalCount === 1 ? '' : 's'} on record`
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{
              borderRadius: 14,
              border: '1px solid #f0f0f0',
              background: 'linear-gradient(135deg, #ffffff 0%, #fbfcfe 100%)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
            }}
          >
            <Statistic
              title={
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                  {isDailyMode ? 'Authorized for Day' : metrics.stat1.label}
                </Text>
              }
              value={isDailyMode ? dailyMetrics.roleMetrics.stat1.valueGHS : metrics.stat1.valueGHS}
              prefix="₵"
              precision={2}
              valueStyle={{ color: '#52c41a', fontWeight: 800, fontSize: 24 }}
            />
            <div style={{ marginTop: 6, fontSize: 11, color: '#8c8c8c' }}>
              {isDailyMode ? 'Approved & disbursed for date' : 'Authorized expenditure'}
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{
              borderRadius: 14,
              border: '1px solid #f0f0f0',
              background: 'linear-gradient(135deg, #ffffff 0%, #fbfcfe 100%)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
            }}
          >
            <Statistic
              title={
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                  {isDailyMode ? 'Pending Authorization' : metrics.stat2.label}
                </Text>
              }
              value={isDailyMode ? dailyMetrics.roleMetrics.stat2.valueGHS : metrics.stat2.valueGHS}
              prefix="₵"
              precision={2}
              valueStyle={{ color: '#fa8c16', fontWeight: 800, fontSize: 24 }}
            />
            <div style={{ marginTop: 6, fontSize: 11, color: '#8c8c8c' }}>
              {isDailyMode
                ? `${dailyMetrics.roleMetrics.pendingCount} requisition${dailyMetrics.roleMetrics.pendingCount === 1 ? '' : 's'} pending sign-off`
                : `${metrics.pendingCount} requisition${metrics.pendingCount === 1 ? '' : 's'} pending`}
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{
              borderRadius: 14,
              border: '1px solid #f0f0f0',
              background: 'linear-gradient(135deg, #ffffff 0%, #fbfcfe 100%)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
            }}
          >
            <Statistic
              title={
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                  {isDailyMode ? 'Daily Ledger Status' : metrics.stat3.label}
                </Text>
              }
              value={
                isDailyMode
                  ? dailyMetrics.closureStatus === 'clean_slate'
                    ? 'Clean Slate'
                    : dailyMetrics.closureStatus === 'fully_approved'
                    ? 'Reconciled'
                    : dailyMetrics.closureStatus === 'pending_authorization'
                    ? 'Pending Sign-Off'
                    : 'Flagged / Review'
                  : metrics.stat3.valueGHS
              }
              prefix={isDailyMode ? undefined : '₵'}
              precision={isDailyMode ? undefined : 2}
              valueStyle={{
                color: isDailyMode
                  ? dailyMetrics.closureStatus === 'fully_approved'
                    ? '#52c41a'
                    : dailyMetrics.closureStatus === 'pending_authorization'
                    ? '#fa8c16'
                    : '#1890ff'
                  : metrics.stat3.color,
                fontWeight: 800,
                fontSize: 22,
              }}
            />
            <div style={{ marginTop: 6, fontSize: 11, color: '#8c8c8c' }}>
              {isDailyMode
                ? isTodayActive
                  ? 'Active 24-hour cycle'
                  : 'Historical daily closure'
                : 'Specialized domain breakdown'}
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── Visual Analytics Section ───────────────────────────────────────── */}
      {showAnalytics && (
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <PieChartOutlined style={{ color: tokens.primary }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Category Expenditure Distribution</span>
                </Space>
              }
              style={{ borderRadius: 14, border: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
              bodyStyle={{ padding: '16px 20px' }}
            >
              {categoryChartData.length > 0 ? (
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={categoryChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                      >
                        {categoryChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(val: any) => `₵ ${Number(val).toLocaleString()}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <Empty description="No category spend recorded yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                </div>
              )}
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <BarChartOutlined style={{ color: '#52c41a' }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {roleLens === 'all' || roleLens === 'admin'
                      ? 'Expenditure by Staff Role Division'
                      : 'Monthly Burn Rate Breakdown'}
                  </span>
                </Space>
              }
              style={{ borderRadius: 14, border: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
              bodyStyle={{ padding: '16px 20px' }}
            >
              {branchOrRoleChartData.length > 0 ? (
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={branchOrRoleChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
                      <XAxis dataKey="name" stroke="#8c8c8c" fontSize={11} tickLine={false} />
                      <YAxis
                        stroke="#8c8c8c"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `₵${(v / 1000).toFixed(0)}k`}
                      />
                      <RechartsTooltip formatter={(val: any) => `₵ ${Number(val).toLocaleString()}`} />
                      <Bar dataKey="amountGHS" fill={tokens.primary} radius={[6, 6, 0, 0]} name="Amount (GHS)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <Empty description="No trend records available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                </div>
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* ── Action and Filter Bar ─────────────────────────────────────────── */}
      <Card
        style={{
          borderRadius: 14,
          marginBottom: 16,
          border: '1px solid #f0f0f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <Row gutter={[12, 12]} align="middle" justify="space-between">
          <Col xs={24} md={12}>
            <Segmented
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              options={[
                { label: `All (${counts.all})`, value: 'all' },
                { label: `Pending (${counts.pending})`, value: 'pending' },
                { label: `Approved (${counts.approved})`, value: 'approved' },
                { label: `Rejected (${counts.rejected})`, value: 'rejected' },
              ]}
              style={{ fontWeight: 600 }}
            />
          </Col>

          <Col xs={24} md={12} style={{ textAlign: 'right' }}>
            <Space size={8} wrap>
              <Input
                placeholder="Search descriptions, vouchers, staff..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 220, borderRadius: 8 }}
                allowClear
              />

              <Select
                value={categoryFilter}
                onChange={setCategoryFilter}
                style={{ width: 170 }}
                placeholder="Category"
              >
                <Option value="all">All Categories</Option>
                {roleConfig.defaultCategories.map((c) => (
                  <Option key={c} value={c}>{c}</Option>
                ))}
              </Select>

              {isAdminOrAccounts && (
                <Select
                  value={branchFilter}
                  onChange={setBranchFilter}
                  style={{ width: 140 }}
                  placeholder="Branch"
                >
                  <Option value="all">All Branches</Option>
                  {branches.map((b: any) => (
                    <Option key={b.id} value={b.id}>{b.name}</Option>
                  ))}
                </Select>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* ── Data Table ────────────────────────────────────────────────────── */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Space size={8}>
              <FileTextOutlined style={{ color: tokens.primary }} />
              <Text strong style={{ fontSize: 14 }}>
                {isDailyMode
                  ? `Daily Expense Ledger • ${dayjs(activeDailyDate).format('dddd, MMMM D, YYYY')}`
                  : 'Corporate Master Expense Ledger (All-Time Archive)'}
              </Text>
              <Tag color={isDailyMode ? (isTodayActive ? 'success' : 'purple') : 'blue'} style={{ borderRadius: 10 }}>
                {finalExpenses.length} Record{finalExpenses.length === 1 ? '' : 's'}
              </Tag>
            </Space>

            {isDailyMode && !isTodayActive && (
              <Button
                type="link"
                size="small"
                onClick={() => setActiveDailyDate(todayKey)}
                style={{ padding: 0, fontWeight: 600 }}
              >
                Return to Today's Active Sheet ➔
              </Button>
            )}
          </div>
        }
        style={{
          borderRadius: 14,
          border: '1px solid #f0f0f0',
          boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
        }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          dataSource={finalExpenses}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} records`,
          }}
          locale={{
            emptyText: (
              <div style={{ padding: '48px 0' }}>
                <Empty
                  description={
                    <div>
                      <Text strong style={{ display: 'block', fontSize: 14 }}>
                        {isDailyMode
                          ? `No ${roleConfig.badgeLabel} entries on ${dayjs(activeDailyDate).format('MMM D, YYYY')}`
                          : `No ${roleConfig.badgeLabel} records match your filters`}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {isDailyMode
                          ? 'This daily page is fresh. Click "Record Expense" to add a requisition.'
                          : 'Try clearing search filters or click "Record Expense".'}
                      </Text>
                    </div>
                  }
                />
              </div>
            ),
          }}
        />
      </Card>

      {/* ── Add Expense Modal (Tailored to Role) ───────────────────────────── */}
      <Modal
        title={
          <Space>
            <DollarOutlined style={{ color: tokens.primary }} />
            <span>Record Requisition • {roleConfig.badgeLabel}</span>
          </Space>
        }
        open={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        footer={null}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateExpense} style={{ marginTop: 16 }}>
          <Alert
            type="info"
            showIcon
            message={
              isAdminOrAccounts
                ? 'As an Administrator, this expenditure will be approved and authorized immediately on submit.'
                : 'This requisition will be submitted to the Executive & Accounts office for approval.'
            }
            style={{ marginBottom: 16, fontSize: 12 }}
          />

          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                name="category"
                label="Expense Category"
                rules={[{ required: true, message: 'Select an expense category' }]}
              >
                <Select placeholder="Select category">
                  {roleConfig.defaultCategories.map((c) => (
                    <Option key={c} value={c}>{c}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={10}>
              <Form.Item
                name="type"
                label="Expense Type"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="internal">Internal Overhead</Option>
                  <Option value="external">External Vendor</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                name="amountGHS"
                label="Amount (GHS)"
                rules={[{ required: true, message: 'Enter expense amount' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  prefix="₵"
                  min={0.01}
                  precision={2}
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>

            <Col span={10}>
              <Form.Item
                name="date"
                label="Incurred Date"
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>

          {isAdminOrAccounts ? (
            <Form.Item
              name="branchId"
              label="Assigned Branch Showroom"
              rules={[{ required: true, message: 'Select branch' }]}
            >
              <Select placeholder="Select branch">
                {branches.map((b: any) => (
                  <Option key={b.id} value={b.id}>{b.name}</Option>
                ))}
              </Select>
            </Form.Item>
          ) : (
            <Form.Item label="Branch Location">
              <Input value={currentBranchName} disabled />
            </Form.Item>
          )}

          <Form.Item
            name="description"
            label="Purpose / Memo Description"
            rules={[{ required: true, message: 'Provide detailed purpose for this expense' }]}
          >
            <TextArea
              rows={3}
              placeholder="e.g., Standby generator diesel replenishment for weekend customer site viewings..."
            />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <Button onClick={() => setAddModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={createExpenseMutation.isPending}>
              {isAdminOrAccounts ? 'Authorize & Record' : 'Submit for Approval'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ── Voucher Drawer (Printable Detail View) ─────────────────────────── */}
      <Drawer
        title="Official Expenditure Voucher"
        open={voucherDrawerOpen}
        onClose={() => setVoucherDrawerOpen(false)}
        width={500}
        extra={
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={() => window.print()}
          >
            Print Voucher
          </Button>
        }
      >
        {selectedExpense && (
          <div style={{ padding: '4px 0' }}>
            {/* Printable Header */}
            <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '2px solid #f0f0f0', paddingBottom: 16 }}>
              <Title level={4} style={{ margin: 0, color: tokens.primary }}>
                OMARK REAL ESTATE ERP
              </Title>
              <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
                Official Financial Disbursement Voucher
              </Text>
              <div style={{ marginTop: 8 }}>
                <Tag color={selectedExpense.status === 'approved' ? 'success' : selectedExpense.status === 'pending' ? 'warning' : 'error'} style={{ fontSize: 12, padding: '4px 12px' }}>
                  STATUS: {selectedExpense.status.toUpperCase()}
                </Tag>
              </div>
            </div>

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Voucher No.">
                <Text strong copyable>{selectedExpense.code || selectedExpense.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Incurred Date">
                {dayjs(selectedExpense.incurredOn).format('MMMM D, YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Category">
                <Tag color="blue">{selectedExpense.category}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Requisition Type">
                <Tag color="purple">{selectedExpense.type.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Branch Location">
                {selectedExpense.branchName || 'Kumasi Main'}
              </Descriptions.Item>
              <Descriptions.Item label="Submitted By">
                <Text strong>{selectedExpense.recordedByUserName || 'Staff Member'}</Text>
                <div style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'capitalize' }}>
                  Role: {(selectedExpense.recordedByUserRole || 'Staff').replace(/_/g, ' ')}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Total Amount">
                <Text strong style={{ fontSize: 18, color: '#1f1f1f' }}>
                  ₵ {(selectedExpense.amountMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Purpose / Description">
                {selectedExpense.description || 'No description provided'}
              </Descriptions.Item>
              {selectedExpense.decisionNote && (
                <Descriptions.Item label="Authorization Note">
                  <Text type="secondary">{selectedExpense.decisionNote}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Approval Footer */}
            <div style={{ marginTop: 32, padding: 16, background: '#fafafa', borderRadius: 8, textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                System-generated audit trail from Omark Real Estate ERP.
              </Text>
              <Text type="secondary" style={{ fontSize: 10 }}>
                Logged at {dayjs(selectedExpense.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Text>
            </div>
          </div>
        )}
      </Drawer>

      {/* ── Rejection Note Modal ───────────────────────────────────────────── */}
      <Modal
        title="Reject Requisition with Reason"
        open={rejectionModalOpen}
        onCancel={() => {
          setRejectionModalOpen(false);
          setExpenseToReject(null);
          setRejectionNote('');
        }}
        onOk={() => {
          if (!rejectionNote.trim()) {
            message.warning('Please provide a reason for rejecting this requisition.');
            return;
          }
          if (expenseToReject) {
            handleDecision(expenseToReject.id, 'rejected', rejectionNote.trim());
          }
        }}
        okText="Confirm Rejection"
        okButtonProps={{ danger: true }}
      >
        <Paragraph style={{ fontSize: 13 }}>
          Please document the financial or operational reason for declining this requisition so the submitter can review it.
        </Paragraph>
        <TextArea
          rows={3}
          placeholder="e.g., Quotation exceeds authorized monthly budget for this category. Please re-submit with revised estimate."
          value={rejectionNote}
          onChange={(e) => setRejectionNote(e.target.value)}
        />
      </Modal>

      {/* ── Historical Expense Cross-Check Drawer ─────────────────────────── */}
      <HistoricalExpenseCrossCheck
        open={crossCheckOpen}
        onClose={() => setCrossCheckOpen(false)}
        expenses={roleFilteredExpenses}
        activeDate={activeDailyDate}
        onSelectDate={(date) => {
          setActiveDailyDate(date);
          setViewMode('daily');
        }}
        roleTitle={roleConfig.badgeLabel}
      />
    </div>
  );
};
