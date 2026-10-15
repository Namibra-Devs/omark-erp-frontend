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
  Drawer,
  Empty,
  Alert,
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
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FilterOutlined,
  FileTextOutlined,
  CalendarOutlined,
  PrinterOutlined,
  LockOutlined,
  GlobalOutlined,
  TeamOutlined,
  FolderOpenOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAuth } from '@/contexts/AuthContext';
import {
  useExpensesQuery,
  useCreateExpenseMutation,
  useExpenseDecisionMutation,
  isDummyFuelExpense,
  type ExpenseEntity,
} from '@/api/expenses';
import { useBranchContext } from '@/contexts/BranchContext';
import { useBranchesQuery, STANDARD_DEPARTMENTS } from '@/api/branches';
import { useUsersQuery, getUserFullName, type UserEntity } from '@/api/users';
import { getBranchCanonicalKey } from '@/utils/branchIsolation';
import { getStoredUserAssignment } from '@/utils/userAssignmentStorage';
import {
  normalizeDepartmentName,
  calculateGrandTotals,
  calculateFourDepartmentSummaries,
  resolveFourMainDepartment,
  type FourMainDepartmentKey,
  type DynamicGrandTotals,
} from '@/utils/departmentExpenses';
import {
  filterExpensesByRole,
  getRoleDashboardConfig,
  type ExpenseRoleView,
} from '@/utils/expenseRoleIsolation';
import type { Role } from '@/types';
import { tokens } from '@/constants/tokens';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

export const FOUR_DEPARTMENT_UI_CONFIG: Record<
  FourMainDepartmentKey,
  {
    name: string;
    label: string;
    color: string;
    accentColor: string;
    borderColor: string;
    bg: string;
    description: string;
    icon: React.ReactNode;
  }
> = {
  secretary: {
    name: 'Secretary',
    label: 'Secretary Department',
    color: '#13c2c2',
    accentColor: '#006d75',
    borderColor: '#87e8de',
    bg: 'linear-gradient(135deg, #e6fffb 0%, #ffffff 100%)',
    description: 'Front desk, office stationery, client refreshments & courier dispatch',
    icon: <UserOutlined />,
  },
  bm: {
    name: 'BM',
    label: 'Branch Manager (BM)',
    color: '#1890ff',
    accentColor: '#096dd9',
    borderColor: '#91d5ff',
    bg: 'linear-gradient(135deg, #e6f7ff 0%, #ffffff 100%)',
    description: 'Standby generator diesel, client inspection transit & premise repairs',
    icon: <ShopOutlined />,
  },
  marketing: {
    name: 'Marketing',
    label: 'Marketing Department',
    color: '#fa8c16',
    accentColor: '#d46b08',
    borderColor: '#ffd591',
    bg: 'linear-gradient(135deg, #fff7e6 0%, #ffffff 100%)',
    description: 'Highway mega-billboards, property expos, digital ads & campaign outreach',
    icon: <RiseOutlined />,
  },
  admin: {
    name: 'Admin',
    label: 'Executive & Admin',
    color: '#722ed1',
    accentColor: '#531dab',
    borderColor: '#d3adf7',
    bg: 'linear-gradient(135deg, #f9f0ff 0%, #ffffff 100%)',
    description: 'Executive IT hosting, audit compliance, legal retainers & corporate filing',
    icon: <SafetyCertificateOutlined />,
  },
};

export const DEPARTMENT_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  'Marketing & Sales': {
    color: '#fa8c16',
    bg: '#fff7e6',
    icon: <RiseOutlined />,
  },
  'Customer Service': {
    color: '#13c2c2',
    bg: '#e6fffb',
    icon: <UserOutlined />,
  },
  'Finance & Accounts': {
    color: '#52c41a',
    bg: '#f6ffed',
    icon: <BankOutlined />,
  },
  'Operations': {
    color: '#1890ff',
    bg: '#e6f7ff',
    icon: <ShopOutlined />,
  },
  'Executive Administration': {
    color: '#722ed1',
    bg: '#f9f0ff',
    icon: <SafetyCertificateOutlined />,
  },
  'Administration': {
    color: '#2f54eb',
    bg: '#f0f5ff',
    icon: <FileTextOutlined />,
  },
};

export interface RoleExpenseDashboardProps {
  fixedRole?: ExpenseRoleView;
  customTitle?: string;
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

  // Role Lens (Admin/Accounts can switch lenses)
  const initialRoleLens: ExpenseRoleView = fixedRole || (isAdminOrAccounts ? 'all' : (user?.role as ExpenseRoleView) || 'branch_manager');
  const [roleLens, setRoleLens] = useState<ExpenseRoleView>(initialRoleLens);

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
    const cleanRaw = rawExpenses.filter((e) => !isDummyFuelExpense(e));
    return cleanRaw.map((expense) => {
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

      const userAssignment = matchedUser ? getStoredUserAssignment(matchedUser.id) : undefined;
      const assignedDept = userAssignment?.departmentName || userAssignment?.department;
      const liveDepartment = normalizeDepartmentName(expense.department || assignedDept, liveRole);

      return {
        ...expense,
        recordedByUserId: matchedUser?.id || expense.recordedByUserId,
        recordedByUserName: liveName,
        recordedByUserRole: liveRole,
        branchId,
        branchName: liveBranchName,
        department: liveDepartment,
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

  // ── Periodic Filter State ─────────────────────────────────────────────────
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('all');
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs>(() => dayjs());
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // ── Other Filter States ───────────────────────────────────────────────────
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [departmentFilter, setDepartmentFilter] = useState<'all' | FourMainDepartmentKey>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');

  // ── Department Expense Drawer State (4 Buttons: Secretary, BM, Marketing, Admin) ──
  const [selectedDepartment, setSelectedDepartment] = useState<FourMainDepartmentKey | null>(null);
  const [departmentDrawerOpen, setDepartmentDrawerOpen] = useState(false);
  const [hoveredDept, setHoveredDept] = useState<string | null>(null);
  const [departmentSearchText, setDepartmentSearchText] = useState('');
  const [departmentStatusFilter, setDepartmentStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [departmentDrawerDateScope, setDepartmentDrawerDateScope] = useState<'current_filter' | 'all_records'>('current_filter');

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

  // Human-readable active date scope label
  const activeDateScopeLabel = useMemo(() => {
    if (dateFilter === 'today') {
      return `Today (${dayjs().format('MMM D, YYYY')})`;
    }
    if (dateFilter === 'weekly') {
      return `This Week (${dayjs().startOf('week').format('MMM D')} – ${dayjs().endOf('week').format('MMM D')})`;
    }
    if (dateFilter === 'monthly') {
      return `Month: ${selectedMonth.format('MMMM YYYY')}`;
    }
    if (dateFilter === 'yearly') {
      return `Annual: ${dayjs().format('YYYY')}`;
    }
    if (dateFilter === 'custom' && customDateRange && customDateRange[0] && customDateRange[1]) {
      return `${customDateRange[0].format('MMM D')} – ${customDateRange[1].format('MMM D, YYYY')}`;
    }
    return 'All-Time';
  }, [dateFilter, selectedMonth, customDateRange]);

  // Is any filter currently applied?
  const isAnyFilterActive = useMemo(() => {
    return (
      dateFilter !== 'all' ||
      departmentFilter !== 'all' ||
      statusFilter !== 'all' ||
      categoryFilter !== 'all' ||
      branchFilter !== 'all' ||
      searchText.trim().length > 0
    );
  }, [dateFilter, departmentFilter, statusFilter, categoryFilter, branchFilter, searchText]);

  const handleClearFilters = () => {
    setDateFilter('all');
    setDepartmentFilter('all');
    setStatusFilter('all');
    setCategoryFilter('all');
    setBranchFilter('all');
    setSearchText('');
    setCustomDateRange(null);
    setSelectedMonth(dayjs());
  };

  // ── Step 1: Periodic Filtering (All expenses filtered by selected date period) ──
  const periodicFilteredExpenses = useMemo(() => {
    return roleFilteredExpenses.filter((e) => {
      const d = dayjs(e.incurredOn || e.createdAt);
      if (!d.isValid()) return dateFilter === 'all';

      const now = dayjs();
      if (dateFilter === 'today') return d.isSame(now, 'day');
      if (dateFilter === 'weekly') return d.isSame(now, 'week');
      if (dateFilter === 'monthly') {
        const target = selectedMonth || now;
        return d.isSame(target, 'month') && d.isSame(target, 'year');
      }
      if (dateFilter === 'yearly') return d.isSame(now, 'year');
      if (dateFilter === 'custom' && customDateRange && customDateRange[0] && customDateRange[1]) {
        return !d.isBefore(customDateRange[0].startOf('day')) && !d.isAfter(customDateRange[1].endOf('day'));
      }
      return true;
    });
  }, [roleFilteredExpenses, dateFilter, selectedMonth, customDateRange]);

  // ── Step 2: 4 Department Subtotals for the Active Period ─────────────────
  // These accurately reflect the selected period across Secretary, BM, Marketing, Admin
  const fourDepartmentSummaries = useMemo(() => {
    return calculateFourDepartmentSummaries(periodicFilteredExpenses);
  }, [periodicFilteredExpenses]);

  // ── Step 3: Overall Totals reflecting the Active Period ───────────────────
  const dynamicGrandTotals = useMemo(() => {
    return calculateGrandTotals(periodicFilteredExpenses);
  }, [periodicFilteredExpenses]);

  // ── Step 4: Multi-Criteria Filter (Search, Department, Category, Branch) ─
  const baseFilteredExpenses = useMemo(() => {
    return periodicFilteredExpenses.filter((e) => {
      // Department Filter
      if (departmentFilter !== 'all') {
        const expDeptKey = resolveFourMainDepartment(e);
        if (expDeptKey !== departmentFilter) return false;
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

      // Search (description, code, category, submitter, department)
      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        const inCat = (e.category || '').toLowerCase().includes(q);
        const inDesc = (e.description || '').toLowerCase().includes(q);
        const inCode = (e.code || '').toLowerCase().includes(q);
        const inUser = (e.recordedByUserName || '').toLowerCase().includes(q);
        const inDept = (e.department || '').toLowerCase().includes(q);
        if (!inCat && !inDesc && !inCode && !inUser && !inDept) return false;
      }

      // Category
      if (categoryFilter !== 'all' && e.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [
    periodicFilteredExpenses,
    departmentFilter,
    branchFilter,
    searchText,
    categoryFilter,
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

  // ── Drawer Specific Department Expenses & Stats ──────────────────────────
  const departmentDrawerExpenses = useMemo(() => {
    if (!selectedDepartment) return [];

    const sourceSet = departmentDrawerDateScope === 'all_records' ? roleFilteredExpenses : periodicFilteredExpenses;
    const deptItems = sourceSet.filter((e) => resolveFourMainDepartment(e) === selectedDepartment);

    const q = departmentSearchText.trim().toLowerCase();
    const searched = q
      ? deptItems.filter((e) => {
          const inCat = (e.category || '').toLowerCase().includes(q);
          const inDesc = (e.description || '').toLowerCase().includes(q);
          const inCode = (e.code || '').toLowerCase().includes(q);
          const inUser = (e.recordedByUserName || '').toLowerCase().includes(q);
          return inCat || inDesc || inCode || inUser;
        })
      : deptItems;

    if (departmentStatusFilter === 'all') return searched;
    return searched.filter((e) => e.status === departmentStatusFilter);
  }, [
    selectedDepartment,
    departmentDrawerDateScope,
    roleFilteredExpenses,
    periodicFilteredExpenses,
    departmentSearchText,
    departmentStatusFilter,
  ]);

  const departmentDrawerStats = useMemo(() => {
    if (!selectedDepartment) {
      return { totalGHS: 0, approvedGHS: 0, pendingGHS: 0, rejectedGHS: 0, count: 0, pendingCount: 0 };
    }
    const sourceSet = departmentDrawerDateScope === 'all_records' ? roleFilteredExpenses : periodicFilteredExpenses;
    const allInDept = sourceSet.filter((e) => resolveFourMainDepartment(e) === selectedDepartment);

    let totalMinor = 0;
    let approvedMinor = 0;
    let pendingMinor = 0;
    let rejectedMinor = 0;
    let pendingCount = 0;

    allInDept.forEach((exp) => {
      const amt = exp.amountMinor || 0;
      totalMinor += amt;
      if (exp.status === 'approved') approvedMinor += amt;
      else if (exp.status === 'pending') {
        pendingMinor += amt;
        pendingCount += 1;
      } else if (exp.status === 'rejected') rejectedMinor += amt;
    });

    return {
      totalGHS: totalMinor / 100,
      approvedGHS: approvedMinor / 100,
      pendingGHS: pendingMinor / 100,
      rejectedGHS: rejectedMinor / 100,
      count: allInDept.length,
      pendingCount,
    };
  }, [selectedDepartment, departmentDrawerDateScope, roleFilteredExpenses, periodicFilteredExpenses]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleOpenAddModal = (presetDept?: FourMainDepartmentKey) => {
    const defaultCat = roleConfig.defaultCategories[0] || 'Office Supplies';
    const defaultType = roleLens === 'marketing_director' ? 'external' : 'internal';
    let initialDept = normalizeDepartmentName(undefined, roleLens === 'all' ? (user?.role as string) : roleLens);

    if (presetDept) {
      const mapPreset: Record<FourMainDepartmentKey, string> = {
        secretary: 'Administration',
        bm: 'Operations',
        marketing: 'Marketing & Sales',
        admin: 'Executive Administration',
      };
      initialDept = mapPreset[presetDept] || initialDept;
    }

    form.setFieldsValue({
      department: initialDept,
      category: defaultCat,
      type: defaultType,
      amountGHS: undefined,
      date: dayjs(),
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
        department: values.department,
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

  const handleAuthorizeAllInDepartment = async (deptKey: FourMainDepartmentKey) => {
    const pendingItems = departmentDrawerExpenses.filter((e) => e.status === 'pending');
    if (pendingItems.length === 0) return;

    try {
      for (const item of pendingItems) {
        await decisionMutation.mutateAsync({
          id: item.id,
          payload: {
            decision: 'approved',
            note: `Batch authorized by ${user?.firstName || 'Admin'} for ${deptKey.toUpperCase()} department`,
          },
        });
      }
      message.success(`Authorized all ${pendingItems.length} pending requisitions in ${deptKey.toUpperCase()}!`);
      refetch();
    } catch (err: any) {
      message.error(err?.message || 'Failed to authorize batch requisitions');
    }
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (finalExpenses.length === 0) {
      message.warning('No expense data to export with the current filters.');
      return;
    }
    if (format === 'csv') {
      const headers = ['Voucher Code', 'Date', 'Department', 'Category', 'Description', 'Amount (GHS)', 'Type', 'Branch', 'Recorded By', 'Role', 'Status'];
      const rows = finalExpenses.map((e) => [
        `"${e.code || ''}"`,
        `"${e.incurredOn || ''}"`,
        `"${resolveFourMainDepartment(e)}"`,
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
        `omark_expenses_${roleLens}_${dateFilter}_${dayjs().format('YYYY-MM-DD')}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success('Expense report exported as CSV!');
    }
  };

  const handleExportDepartmentExpenses = (deptKey: FourMainDepartmentKey, items: ExpenseEntity[]) => {
    if (items.length === 0) {
      message.warning('No department data to export.');
      return;
    }
    const headers = ['Voucher Code', 'Date', 'Department', 'Category', 'Description', 'Amount (GHS)', 'Type', 'Branch', 'Recorded By', 'Role', 'Status'];
    const rows = items.map((e) => [
      `"${e.code || ''}"`,
      `"${e.incurredOn || ''}"`,
      `"${resolveFourMainDepartment(e)}"`,
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
    link.setAttribute('download', `omark_${deptKey}_expenses.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success(`Exported ${deptKey.toUpperCase()} department expenses as CSV!`);
  };

  // ── Main Table Columns (7 Columns) ────────────────────────────────────────
  const columns = [
    {
      title: 'Voucher',
      key: 'voucher',
      width: 140,
      render: (_: any, record: ExpenseEntity) => (
        <div>
          <Text strong style={{ color: tokens.primary, fontSize: 13 }} copyable>
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
      width: 250,
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
      title: 'Department',
      key: 'department',
      width: 140,
      render: (_: any, record: ExpenseEntity) => {
        const deptKey = resolveFourMainDepartment(record);
        const cfg = FOUR_DEPARTMENT_UI_CONFIG[deptKey];
        return (
          <Tooltip title={`Open ${cfg.name} Department Drawer`}>
            <Tag
              color={cfg.color}
              style={{
                cursor: 'pointer',
                borderRadius: 12,
                padding: '2px 8px',
                fontWeight: 600,
                fontSize: 11,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              onClick={() => {
                setSelectedDepartment(deptKey);
                setDepartmentDrawerOpen(true);
              }}
            >
              {cfg.icon}
              {cfg.name}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Submitter & Branch',
      key: 'submitter',
      width: 170,
      render: (_: any, record: ExpenseEntity) => (
        <div>
          <Space size={4}>
            <UserOutlined style={{ color: '#8c8c8c', fontSize: 11 }} />
            <Text style={{ fontSize: 12, fontWeight: 500 }}>
              {record.recordedByUserName || 'Staff Member'}
            </Text>
          </Space>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>
            {record.branchName || 'Kumasi Main'} • <span style={{ textTransform: 'capitalize' }}>{(record.recordedByUserRole || '').replace(/_/g, ' ')}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amountMinor',
      key: 'amountMinor',
      width: 150,
      align: 'right' as const,
      render: (amountMinor: number) => (
        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          ₵ {(amountMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center' as const,
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
      width: 155,
      align: 'center' as const,
      render: (_: any, record: ExpenseEntity) => (
        <Space size={4}>
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
              <Tooltip title="Direct Administrative Approval">
                <Popconfirm
                  title="Authorize Department Expense"
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
                  >
                    Approve
                  </Button>
                </Popconfirm>
              </Tooltip>

              <Tooltip title="Reject Requisition with Reason">
                <Button
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => {
                    setExpenseToReject(record);
                    setRejectionModalOpen(true);
                  }}
                >
                  Reject
                </Button>
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  // ── Dedicated Drawer Columns (Excludes redundant Department column) ──────
  const drawerColumns = [
    {
      title: 'Voucher',
      key: 'voucher',
      width: 130,
      render: (_: any, record: ExpenseEntity) => (
        <div>
          <Text strong style={{ color: tokens.primary, fontSize: 13 }} copyable>
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
        <div>
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
      title: 'Submitter',
      key: 'submitter',
      width: 140,
      render: (_: any, record: ExpenseEntity) => (
        <div>
          <Text style={{ fontSize: 12, fontWeight: 500, display: 'block' }}>
            {record.recordedByUserName || 'Staff Member'}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.branchName || 'Kumasi Main'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amountMinor',
      key: 'amountMinor',
      width: 130,
      align: 'right' as const,
      render: (amountMinor: number) => (
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          ₵ {(amountMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      align: 'center' as const,
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
      width: 120,
      align: 'center' as const,
      render: (_: any, record: ExpenseEntity) => (
        <Space size={4}>
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
                  title="Authorize Requisition"
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
                  >
                    Approve
                  </Button>
                </Popconfirm>
              </Tooltip>

              <Tooltip title="Reject Requisition">
                <Button
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => {
                    setExpenseToReject(record);
                    setRejectionModalOpen(true);
                  }}
                >
                  Reject
                </Button>
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  // Drawer Department Config
  const selectedDeptConfig = selectedDepartment ? FOUR_DEPARTMENT_UI_CONFIG[selectedDepartment] : null;

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
        bodyStyle={{ padding: compact ? '16px 20px' : '22px 28px' }}
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
              {customTitle || 'Corporate Expense Management'}
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
              onClick={() => handleOpenAddModal()}
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
              marginTop: 16,
              paddingTop: 14,
              borderTop: '1px solid #f0f2f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text strong style={{ fontSize: 13, color: '#4a5568' }}>
                <TeamOutlined style={{ marginRight: 6 }} />
                Administrative Lens (Role Views):
              </Text>
              <Segmented
                size="middle"
                value={roleLens}
                onChange={(val) => setRoleLens(val as ExpenseRoleView)}
                options={[
                  { label: '🌐 All Corporate Data', value: 'all' },
                  { label: '🏢 Branch Manager', value: 'branch_manager' },
                  { label: '📝 Secretary', value: 'secretary' },
                  { label: '📢 Marketing Director', value: 'marketing_director' },
                ]}
                style={{
                  background: '#f1f5f9',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 12,
                }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* ── 4 DEPARTMENT BUTTON CARDS (Secretary, BM, Marketing, Admin) ──────── */}
      {/* Replaces the old stat cards with buttons of similar size; clicking draws the drawer */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {fourDepartmentSummaries.map((dept) => {
          const cfg = FOUR_DEPARTMENT_UI_CONFIG[dept.key];
          const isSelected = selectedDepartment === dept.key && departmentDrawerOpen;
          const isHovered = hoveredDept === dept.key;
          const pendingCount = dept.items.filter((i: any) => i.status === 'pending').length;
          const approvedCount = dept.items.filter((i: any) => i.status === 'approved').length;
          const totalGHS = dept.totalMinor / 100;
          const approvedGHS = dept.approvedMinor / 100;
          const pendingGHS = dept.pendingMinor / 100;

          return (
            <Col xs={24} sm={12} lg={6} key={dept.key}>
              <div
                role="button"
                tabIndex={0}
                onMouseEnter={() => setHoveredDept(dept.key)}
                onMouseLeave={() => setHoveredDept(null)}
                onClick={() => {
                  setSelectedDepartment(dept.key);
                  setDepartmentDrawerOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedDepartment(dept.key);
                    setDepartmentDrawerOpen(true);
                  }
                }}
                style={{
                  borderRadius: 14,
                  border: isSelected
                    ? `2px solid ${cfg.color}`
                    : isHovered
                    ? `1.5px solid ${cfg.color}`
                    : `1px solid ${cfg.borderColor}`,
                  background: cfg.bg,
                  padding: '16px 18px',
                  boxShadow: isSelected
                    ? `0 6px 20px ${cfg.color}33, 0 0 0 3px ${cfg.color}22`
                    : isHovered
                    ? `0 8px 24px rgba(0,0,0,0.08), 0 2px 8px ${cfg.color}22`
                    : '0 2px 10px rgba(0,0,0,0.03)',
                  cursor: 'pointer',
                  transform: isHovered && !isSelected ? 'translateY(-2px)' : 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  outline: 'none',
                }}
              >
                {/* Header: Icon + Department Name + Pending Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Space size={8}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: '#ffffff',
                        border: `1px solid ${cfg.borderColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: cfg.color,
                        fontSize: 18,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                      }}
                    >
                      {cfg.icon}
                    </div>
                    <div>
                      <Text strong style={{ fontSize: 15, color: '#111827', display: 'block', lineHeight: 1.2 }}>
                        {cfg.name}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {dept.key === 'bm' ? 'Branch Manager' : `${cfg.name} Department`}
                      </Text>
                    </div>
                  </Space>

                  {pendingCount > 0 ? (
                    <Tooltip title={`${pendingCount} requisition(s) pending approval`}>
                      <Badge count={pendingCount} style={{ backgroundColor: '#fa8c16' }} />
                    </Tooltip>
                  ) : (
                    <Tag color="success" style={{ margin: 0, fontSize: 10, borderRadius: 8 }}>
                      All Clear
                    </Tag>
                  )}
                </div>

                {/* Subtotal for the active period */}
                <div style={{ margin: '8px 0 6px 0' }}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    Subtotal • {activeDateScopeLabel}
                  </Text>
                  <div style={{ fontSize: 22, fontWeight: 800, color: cfg.accentColor, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                    ₵ {totalGHS.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Breakdown chips */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: '#237804', fontWeight: 600 }}>
                    Approved: ₵{approvedGHS.toFixed(0)}
                  </span>
                  {pendingGHS > 0 && (
                    <span style={{ fontSize: 11, color: '#d46b08', fontWeight: 600 }}>
                      • Pending: ₵{pendingGHS.toFixed(0)}
                    </span>
                  )}
                </div>

                {/* Bottom: Count + Action Button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 10,
                    borderTop: '1px solid rgba(0,0,0,0.06)',
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {dept.count} voucher{dept.count === 1 ? '' : 's'}
                  </Text>
                  <Button
                    type="primary"
                    size="small"
                    style={{
                      borderRadius: 6,
                      background: cfg.color,
                      borderColor: cfg.color,
                      fontSize: 11,
                      fontWeight: 600,
                      height: 26,
                      padding: '0 10px',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDepartment(dept.key);
                      setDepartmentDrawerOpen(true);
                    }}
                  >
                    Open Drawer ➔
                  </Button>
                </div>
              </div>
            </Col>
          );
        })}
      </Row>

      {/* ── Action, Status & Periodic Filter Bar ─────────────────────────────── */}
      <Card
        style={{
          borderRadius: 14,
          marginBottom: 16,
          border: '1px solid #f0f0f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        }}
        bodyStyle={{ padding: '14px 18px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Row 1: Status Segmented Control (Left) + Search & Reset (Right) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
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

            <Space size={8} wrap>
              {/* Search text */}
              <Input
                placeholder="Search vouchers, staff, category..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 240, borderRadius: 8 }}
                allowClear
              />

              {/* Reset Filters CTA if any filter is active */}
              {isAnyFilterActive && (
                <Tooltip title="Reset all filters back to default">
                  <Button
                    icon={<ClearOutlined />}
                    onClick={handleClearFilters}
                    size="middle"
                  >
                    Reset
                  </Button>
                </Tooltip>
              )}
            </Space>
          </div>

          {/* Row 2: Department, Period, Category & Branch Filters */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
              paddingTop: 10,
              borderTop: '1px solid #f0f2f5',
            }}
          >
            <Space size={6} style={{ marginRight: 2 }}>
              <FilterOutlined style={{ color: tokens.primary, fontSize: 13 }} />
              <Text strong style={{ fontSize: 12, color: '#595959' }}>
                Filter By:
              </Text>
            </Space>

            {/* Department Dropdown Filter */}
            <Select
              value={departmentFilter}
              onChange={(val) => setDepartmentFilter(val)}
              style={{ minWidth: 150 }}
              placeholder="Department"
            >
              <Option value="all">All Departments</Option>
              <Option value="secretary">Secretary</Option>
              <Option value="bm">BM (Branch Mgr)</Option>
              <Option value="marketing">Marketing</Option>
              <Option value="admin">Admin</Option>
            </Select>

            {/* Periodic Filter Dropdown */}
            <Select
              value={dateFilter}
              onChange={(val) => setDateFilter(val)}
              style={{ minWidth: 145 }}
              placeholder="Period Filter"
            >
              <Option value="all">🌐 All-Time</Option>
              <Option value="today">📅 Today</Option>
              <Option value="weekly">📆 This Week</Option>
              <Option value="monthly">🗓️ This Month</Option>
              <Option value="yearly">📊 This Year</Option>
              <Option value="custom">📆 Custom Range</Option>
            </Select>

            {dateFilter === 'monthly' && (
              <DatePicker
                picker="month"
                value={selectedMonth}
                onChange={(m) => m && setSelectedMonth(m)}
                allowClear={false}
                style={{ width: 130 }}
                format="MMM YYYY"
              />
            )}

            {dateFilter === 'custom' && (
              <RangePicker
                value={customDateRange}
                onChange={(r) => setCustomDateRange(r as any)}
                style={{ width: 230 }}
              />
            )}

            {/* Category Filter */}
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              style={{ minWidth: 150 }}
              placeholder="Category"
            >
              <Option value="all">All Categories</Option>
              {roleConfig.defaultCategories.map((c) => (
                <Option key={c} value={c}>{c}</Option>
              ))}
            </Select>

            {/* Branch Filter */}
            {isAdminOrAccounts && (
              <Select
                value={branchFilter}
                onChange={setBranchFilter}
                style={{ minWidth: 135 }}
                placeholder="Branch"
              >
                <Option value="all">All Branches</Option>
                {branches.map((b: any) => (
                  <Option key={b.id} value={b.id}>{b.name}</Option>
                ))}
              </Select>
            )}

            {/* Active Period Scope Tag */}
            <div style={{ marginLeft: 'auto' }}>
              <Tag color="blue" style={{ borderRadius: 10, fontWeight: 600, margin: 0 }}>
                Period: {activeDateScopeLabel}
              </Tag>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Main Data Table (All Expenses with Subtotals & Overall Totals) ───── */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Space size={8}>
              <FileTextOutlined style={{ color: tokens.primary }} />
              <Text strong style={{ fontSize: 14 }}>
                Corporate Master Expense Ledger
              </Text>
              <Tag color="blue" style={{ borderRadius: 10, fontWeight: 600 }}>
                {activeDateScopeLabel}
              </Tag>
              <Tag color="cyan" style={{ borderRadius: 10 }}>
                {finalExpenses.length} Record{finalExpenses.length === 1 ? '' : 's'}
              </Tag>
            </Space>

            <Space size={8}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Overall Outlay: <Text strong style={{ color: tokens.primary }}>₵ {dynamicGrandTotals.grandTotalGHS.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
              </Text>
            </Space>
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
          scroll={{ x: 1120 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} records`,
          }}
          summary={() => {
            // Total columns = 7:
            // 0: Voucher (width 140)
            // 1: Category & Details (width 250)
            // 2: Department (width 140)
            // 3: Submitter & Branch (width 170)
            // 4: Amount (width 150, align: right)
            // 5: Status (width 120, align: center)
            // 6: Actions (width 155, align: center)
            return (
              <Table.Summary fixed>
                {/* ── 4 Department Sub-Total Rows (Secretary, BM, Marketing, Admin) ── */}
                {fourDepartmentSummaries.map((dept) => {
                  const cfg = FOUR_DEPARTMENT_UI_CONFIG[dept.key];
                  return (
                    <Table.Summary.Row
                      key={dept.key}
                      style={{
                        backgroundColor: '#fafbfc',
                        borderTop: '1px solid #f0f0f0',
                      }}
                    >
                      {/* Cols 0 & 1: Department Name & Subtotal Badge */}
                      <Table.Summary.Cell index={0} colSpan={2}>
                        <Space size={8} wrap>
                          <Tag
                            color={cfg.color}
                            style={{
                              cursor: 'pointer',
                              padding: '3px 10px',
                              borderRadius: 12,
                              fontWeight: 700,
                              fontSize: 12,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                            onClick={() => {
                              setSelectedDepartment(dept.key);
                              setDepartmentDrawerOpen(true);
                            }}
                          >
                            {cfg.icon}
                            {cfg.name} Sub-Total
                          </Tag>
                          <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>
                            ({dept.count} item{dept.count === 1 ? '' : 's'})
                          </Text>
                        </Space>
                      </Table.Summary.Cell>

                      {/* Cols 2 & 3: Approved / Pending / Rejected Breakdown */}
                      <Table.Summary.Cell index={2} colSpan={2}>
                        <Space size={8} wrap>
                          <Tag color="success" style={{ borderRadius: 10, fontSize: 11 }}>
                            Approved: ₵ {(dept.approvedMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </Tag>
                          {dept.pendingMinor > 0 && (
                            <Tag color="warning" style={{ borderRadius: 10, fontSize: 11 }}>
                              Pending: ₵ {(dept.pendingMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </Tag>
                          )}
                          {dept.rejectedMinor > 0 && (
                            <Tag color="error" style={{ borderRadius: 10, fontSize: 11 }}>
                              Rejected: ₵ {(dept.rejectedMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </Tag>
                          )}
                        </Space>
                      </Table.Summary.Cell>

                      {/* Col 4: Subtotal Amount in GHS (Aligns directly under Amount column with nowrap!) */}
                      <Table.Summary.Cell index={4} align="right">
                        <div style={{ whiteSpace: 'nowrap' }}>
                          <Text strong style={{ fontSize: 14, color: '#111827', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            ₵ {(dept.totalMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </Text>
                        </div>
                      </Table.Summary.Cell>

                      {/* Col 5: Entry count (Aligns under Status column) */}
                      <Table.Summary.Cell index={5} align="center">
                        <Tag color="blue" style={{ fontSize: 11, borderRadius: 8 }}>
                          {dept.count} entries
                        </Tag>
                      </Table.Summary.Cell>

                      {/* Col 6: Action button (Aligns under Actions column) */}
                      <Table.Summary.Cell index={6} align="center">
                        <Button
                          type="link"
                          size="small"
                          icon={<FolderOpenOutlined />}
                          onClick={() => {
                            setSelectedDepartment(dept.key);
                            setDepartmentDrawerOpen(true);
                          }}
                          style={{ fontWeight: 600, color: cfg.color, padding: 0, fontSize: 12 }}
                        >
                          View Drawer ➔
                        </Button>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  );
                })}

                {/* ── OVERALL GRAND TOTAL ROW (Reflects Active Period) ── */}
                <Table.Summary.Row
                  style={{
                    backgroundColor: '#f0f7ff',
                    borderTop: `2px solid ${tokens.primary}`,
                  }}
                >
                  {/* Cols 0 & 1: Grand Total Title */}
                  <Table.Summary.Cell index={0} colSpan={2}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text strong style={{ fontSize: 13, color: tokens.primary, letterSpacing: 0.3 }}>
                        🏛️ OVERALL GRAND TOTAL
                      </Text>
                      <Tag color="blue" style={{ borderRadius: 12, fontWeight: 700 }}>
                        {dynamicGrandTotals.grandCount} Requisitions
                      </Tag>
                    </div>
                  </Table.Summary.Cell>

                  {/* Cols 2 & 3: Approved & Pending summary badges */}
                  <Table.Summary.Cell index={2} colSpan={2}>
                    <Space size={12} wrap>
                      <Badge
                        status="success"
                        text={
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#237804', whiteSpace: 'nowrap' }}>
                            Approved: ₵ {dynamicGrandTotals.grandApprovedGHS.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        }
                      />
                      {dynamicGrandTotals.grandPendingMinor > 0 && (
                        <Badge
                          status="warning"
                          text={
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#ad4e00', whiteSpace: 'nowrap' }}>
                              Pending: ₵ {dynamicGrandTotals.grandPendingGHS.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          }
                        />
                      )}
                    </Space>
                  </Table.Summary.Cell>

                  {/* Col 4: Overall Grand Total Amount (Aligns directly under Amount column with nowrap!) */}
                  <Table.Summary.Cell index={4} align="right">
                    <div style={{ whiteSpace: 'nowrap' }}>
                      <Text strong style={{ fontSize: 15, color: tokens.primary, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        ₵ {dynamicGrandTotals.grandTotalGHS.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </Text>
                    </div>
                  </Table.Summary.Cell>

                  {/* Cols 5 & 6: Active Period Scope Tag & Live Recalc */}
                  <Table.Summary.Cell index={5} colSpan={2} align="center">
                    <Space size={6} wrap>
                      <Tag color="cyan" style={{ borderRadius: 10, fontSize: 11, fontWeight: 600, margin: 0 }}>
                        {activeDateScopeLabel}
                      </Tag>
                      <Tag color="processing" style={{ borderRadius: 10, fontWeight: 700, margin: 0 }}>
                        Live Recalc
                      </Tag>
                    </Space>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
          locale={{
            emptyText: (
              <div style={{ padding: '48px 0' }}>
                <Empty
                  description={
                    <div>
                      <Text strong style={{ display: 'block', fontSize: 14 }}>
                        No expense records match your current filters
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Try adjusting your search, department, or periodic filter.
                      </Text>
                      {isAnyFilterActive && (
                        <div style={{ marginTop: 12 }}>
                          <Button size="small" icon={<ClearOutlined />} onClick={handleClearFilters}>
                            Clear All Filters
                          </Button>
                        </div>
                      )}
                    </div>
                  }
                />
              </div>
            ),
          }}
        />
      </Card>

      {/* ── DEPARTMENT DRAWER (Opens when Department button is clicked) ───── */}
      <Drawer
        title={
          selectedDeptConfig ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: `${selectedDeptConfig.color}18`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: selectedDeptConfig.color,
                  fontSize: 18,
                }}
              >
                {selectedDeptConfig.icon}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text strong style={{ fontSize: 16 }}>
                    {selectedDeptConfig.label} Expenses
                  </Text>
                  <Tag color="blue" style={{ borderRadius: 10 }}>
                    {departmentDrawerExpenses.length} Record{departmentDrawerExpenses.length === 1 ? '' : 's'}
                  </Tag>
                </div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {selectedDeptConfig.description}
                </Text>
              </div>
            </div>
          ) : (
            'Department Expenses'
          )
        }
        open={departmentDrawerOpen && Boolean(selectedDepartment)}
        onClose={() => {
          setDepartmentDrawerOpen(false);
          setDepartmentSearchText('');
          setDepartmentStatusFilter('all');
        }}
        width={Math.min(780, typeof window !== 'undefined' ? window.innerWidth - 32 : 780)}
        placement="right"
        extra={
          <Space>
            {selectedDepartment && (
              <Button
                icon={<PlusOutlined />}
                size="small"
                type="primary"
                onClick={() => handleOpenAddModal(selectedDepartment)}
              >
                Add {selectedDeptConfig?.name} Expense
              </Button>
            )}
            {selectedDepartment && (
              <Button
                icon={<ExportOutlined />}
                size="small"
                onClick={() => handleExportDepartmentExpenses(selectedDepartment, departmentDrawerExpenses)}
              >
                Export CSV
              </Button>
            )}
          </Space>
        }
      >
        {selectedDepartment && selectedDeptConfig && (
          <div>
            {/* Top Stat Summary Strip */}
            <Row gutter={[10, 10]} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Card size="small" style={{ borderRadius: 10, background: '#fafafa', border: '1px solid #f0f0f0' }}>
                  <Statistic
                    title={<Text type="secondary" style={{ fontSize: 11 }}>Department Sub-Total</Text>}
                    value={departmentDrawerStats.totalGHS}
                    prefix="₵"
                    precision={2}
                    valueStyle={{ fontSize: 16, fontWeight: 700, color: tokens.primary, fontVariantNumeric: 'tabular-nums' }}
                  />
                  <div style={{ fontSize: 10, color: '#8c8c8c' }}>
                    {departmentDrawerStats.count} total records
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ borderRadius: 10, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                  <Statistic
                    title={<Text type="secondary" style={{ fontSize: 11 }}>Authorized Spend</Text>}
                    value={departmentDrawerStats.approvedGHS}
                    prefix="₵"
                    precision={2}
                    valueStyle={{ fontSize: 16, fontWeight: 700, color: '#52c41a', fontVariantNumeric: 'tabular-nums' }}
                  />
                  <div style={{ fontSize: 10, color: '#52c41a' }}>
                    Approved by accounts
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ borderRadius: 10, background: '#fff7e6', border: '1px solid #ffd591' }}>
                  <Statistic
                    title={<Text type="secondary" style={{ fontSize: 11 }}>Pending Sign-Off</Text>}
                    value={departmentDrawerStats.pendingGHS}
                    prefix="₵"
                    precision={2}
                    valueStyle={{ fontSize: 16, fontWeight: 700, color: '#fa8c16', fontVariantNumeric: 'tabular-nums' }}
                  />
                  <div style={{ fontSize: 10, color: '#fa8c16' }}>
                    {departmentDrawerStats.pendingCount} awaiting approval
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ borderRadius: 10, background: '#fff1f0', border: '1px solid #ffa39e' }}>
                  <Statistic
                    title={<Text type="secondary" style={{ fontSize: 11 }}>Rejected / Flagged</Text>}
                    value={departmentDrawerStats.rejectedGHS}
                    prefix="₵"
                    precision={2}
                    valueStyle={{ fontSize: 16, fontWeight: 700, color: '#f5222d', fontVariantNumeric: 'tabular-nums' }}
                  />
                  <div style={{ fontSize: 10, color: '#f5222d' }}>
                    Declined requisitions
                  </div>
                </Card>
              </Col>
            </Row>

            {/* Date Scope Controls inside Drawer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                padding: '8px 12px',
                background: '#f8fafc',
                borderRadius: 8,
                marginBottom: 16,
                border: '1px solid #e2e8f0',
              }}
            >
              <Space size={6} wrap>
                <CalendarOutlined style={{ color: tokens.primary }} />
                <Text strong style={{ fontSize: 12 }}>
                  Active Scope:
                </Text>
                <Tag color="cyan" style={{ borderRadius: 8, fontWeight: 600 }}>
                  {departmentDrawerDateScope === 'current_filter' ? activeDateScopeLabel : 'All Historical Records'}
                </Tag>
              </Space>

              <Segmented
                size="small"
                value={departmentDrawerDateScope}
                onChange={(val) => setDepartmentDrawerDateScope(val as any)}
                options={[
                  { label: '📅 Active Filter Scope', value: 'current_filter' },
                  { label: '🌐 All-Time History', value: 'all_records' },
                ]}
                style={{ fontWeight: 600 }}
              />
            </div>

            {/* Administrative Batch Action Banner */}
            {isAdminOrAccounts && departmentDrawerStats.pendingCount > 0 && (
              <Alert
                type="warning"
                showIcon
                message={
                  <span style={{ fontWeight: 600 }}>
                    {departmentDrawerStats.pendingCount} Requisition(s) Pending Administrative Authorization
                  </span>
                }
                description={
                  <div style={{ marginTop: 4 }}>
                    Totaling ₵ {departmentDrawerStats.pendingGHS.toFixed(2)} in {selectedDeptConfig.name}. You can authorize all at once or review individually below.
                  </div>
                }
                action={
                  <Popconfirm
                    title={`Authorize All Pending in ${selectedDeptConfig.name}?`}
                    description={`This will immediately approve ${departmentDrawerStats.pendingCount} pending requisitions (₵${departmentDrawerStats.pendingGHS.toFixed(2)}).`}
                    onConfirm={() => handleAuthorizeAllInDepartment(selectedDepartment)}
                    okText="Authorize All"
                    okButtonProps={{ type: 'primary', style: { background: '#52c41a' } }}
                  >
                    <Button
                      size="small"
                      type="primary"
                      style={{ background: '#52c41a', borderColor: '#52c41a' }}
                      icon={<CheckCircleOutlined />}
                    >
                      Authorize All ({departmentDrawerStats.pendingCount})
                    </Button>
                  </Popconfirm>
                }
                style={{ marginBottom: 16, borderRadius: 8 }}
              />
            )}

            {/* In-Drawer Search & Status Filters */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <Segmented
                size="small"
                value={departmentStatusFilter}
                onChange={(val) => setDepartmentStatusFilter(val as any)}
                options={[
                  { label: 'All', value: 'all' },
                  { label: 'Pending', value: 'pending' },
                  { label: 'Approved', value: 'approved' },
                  { label: 'Rejected', value: 'rejected' },
                ]}
                style={{ fontWeight: 600 }}
              />

              <Input
                placeholder={`Search within ${selectedDeptConfig.name}...`}
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                value={departmentSearchText}
                onChange={(e) => setDepartmentSearchText(e.target.value)}
                size="small"
                style={{ width: 220, borderRadius: 6 }}
                allowClear
              />
            </div>

            {/* Department Expenses Table (Optimized with dedicated drawerColumns & horizontal scroll) */}
            <Table
              dataSource={departmentDrawerExpenses}
              columns={drawerColumns}
              rowKey="id"
              size="small"
              scroll={{ x: 720 }}
              pagination={{
                pageSize: 8,
                showSizeChanger: false,
                showTotal: (total) => `${total} items`,
              }}
              summary={() => {
                const totalMinor = departmentDrawerExpenses.reduce((sum, e) => sum + (e.amountMinor || 0), 0);
                const approvedCount = departmentDrawerExpenses.filter((e) => e.status === 'approved').length;
                const pendingCount = departmentDrawerExpenses.filter((e) => e.status === 'pending').length;
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ backgroundColor: '#fafbfc', fontWeight: 600 }}>
                      <Table.Summary.Cell index={0} colSpan={3}>
                        <Space size={8}>
                          <Text strong style={{ fontSize: 12 }}>
                            {selectedDeptConfig.name} Drawer Total
                          </Text>
                          <Tag color="blue" style={{ borderRadius: 8, fontSize: 11 }}>
                            {departmentDrawerExpenses.length} records
                          </Tag>
                        </Space>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <div style={{ whiteSpace: 'nowrap' }}>
                          <Text strong style={{ fontSize: 13, color: selectedDeptConfig.accentColor, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            ₵ {(totalMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </Text>
                        </div>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={4} colSpan={2} align="center">
                        <Space size={4}>
                          <Tag color="success" style={{ fontSize: 10, borderRadius: 6, margin: 0 }}>
                            {approvedCount} apprv
                          </Tag>
                          {pendingCount > 0 && (
                            <Tag color="warning" style={{ fontSize: 10, borderRadius: 6, margin: 0 }}>
                              {pendingCount} pend
                            </Tag>
                          )}
                        </Space>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                );
              }}
              locale={{
                emptyText: (
                  <div style={{ padding: '32px 0', textAlign: 'center' }}>
                    <Empty
                      description={
                        <div>
                          <Text strong style={{ fontSize: 13, display: 'block' }}>
                            No {selectedDeptConfig.name} expenses found
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {departmentDrawerDateScope === 'current_filter'
                              ? 'No entries for this department under current date filters.'
                              : 'No expenses have been recorded for this department yet.'}
                          </Text>
                          {departmentDrawerDateScope === 'current_filter' && (
                            <div style={{ marginTop: 10 }}>
                              <Button
                                size="small"
                                onClick={() => setDepartmentDrawerDateScope('all_records')}
                              >
                                Switch to All-Time History
                              </Button>
                            </div>
                          )}
                        </div>
                      }
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  </div>
                ),
              }}
            />
          </div>
        )}
      </Drawer>

      {/* ── Add Expense Modal ──────────────────────────────────────────────── */}
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
                name="department"
                label="Department"
                rules={[{ required: true, message: 'Select department' }]}
              >
                <Select placeholder="Select department">
                  {STANDARD_DEPARTMENTS.map((d) => (
                    <Option key={d.name} value={d.name}>{d.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={10}>
              <Form.Item
                name="type"
                label="Type"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="internal">Internal Operational</Option>
                  <Option value="external">External Vendor/Third-Party</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                name="category"
                label="Expense Category"
                rules={[{ required: true, message: 'Select or specify category' }]}
              >
                <Select
                  showSearch
                  placeholder="Select or enter category"
                  options={roleConfig.defaultCategories.map((c) => ({ value: c, label: c }))}
                />
              </Form.Item>
            </Col>

            <Col span={10}>
              <Form.Item
                name="amountGHS"
                label="Amount (GHS)"
                rules={[{ required: true, message: 'Specify amount in GHS' }]}
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
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="date"
                label="Incurred Date"
                rules={[{ required: true, message: 'Select date' }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="branchId"
                label="Branch Location"
                rules={[{ required: true, message: 'Select branch' }]}
              >
                <Select placeholder="Select branch">
                  {branches.map((b: any) => (
                    <Option key={b.id} value={b.id}>{b.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

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
              <Descriptions.Item label="Department">
                <Tag color="geekblue">{selectedExpense.department || normalizeDepartmentName(undefined, selectedExpense.recordedByUserRole)}</Tag>
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
                <Text strong style={{ fontSize: 18, color: '#1f1f1f', fontVariantNumeric: 'tabular-nums' }}>
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
    </div>
  );
};

export default RoleExpenseDashboard;
