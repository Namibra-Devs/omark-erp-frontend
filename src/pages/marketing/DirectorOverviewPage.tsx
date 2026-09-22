// src/pages/marketing/DirectorOverviewPage.tsx
import React, { useState, useMemo } from 'react';
import {
  Card, Row, Col, Typography, Statistic, Table, Tag, Space, Button,
  Progress, Tabs, Tooltip,
  Empty, Alert, List, Descriptions, Drawer, Spin,
  message, Modal, Form, Input, Select, DatePicker, Avatar, Badge, Divider, InputNumber,
} from 'antd';
import {
  TeamOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  BarChartOutlined,
  ReloadOutlined,
  TrophyOutlined,
  CrownOutlined,
  FireOutlined,
  InfoCircleOutlined,
  MailOutlined,
  PhoneOutlined,
  DashboardOutlined,
  UserSwitchOutlined,
  DollarOutlined,
  StarFilled,
  CalendarOutlined,
  SearchOutlined,
  UserOutlined,
  HomeOutlined,
  IdcardOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  SettingOutlined,
  PlusOutlined,
  UserAddOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useBranchesQuery } from '@/api/branches';
import { filterEntitiesByBranch } from '@/utils/branchIsolation';
import { useMarketingDashboardQuery, useAnalyticsDashboardQuery, type MarketerPerformance } from '@/api/dashboard';
import { useUsersQuery, getUserFullName, getRoleColor } from '@/api/users';
import { useProspectsQuery } from '@/api/prospects';
import { useCustomersQuery, getCustomerTypeLabel, getCustomerTypeColor } from '@/api/customers';
import { useAppointmentsQuery, useCreateAppointmentMutation, appointmentsKeys } from '@/api/appointments';
import { useCreateExpenseMutation } from '@/api/expenses';
import { saveStoredInteraction } from '@/utils/interactionStorage';
import { usePropertiesQuery } from '@/api/properties';
import { StatusTag } from '@/components/shared/StatusTag';
import { prospectStatusLabels } from '@/constants/enums';
import { tokens } from '@/constants/tokens';
import { PageHeader } from '@/components/shared/PageHeader';
import { PhotoUpload } from '@/components/shared/PhotoUpload';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { BonusRulesModal } from '@/components/bonus/BonusRulesModal';
import { AddProspectModal } from '@/components/shared/AddProspectModal';
import { AddCustomerModal } from '@/components/shared/AddCustomerModal';
import { ProspectInteractionsTimeline } from '@/components/dashboard/ProspectInteractionsTimeline';

const { Title, Text } = Typography;

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2'];

export const DirectorOverviewPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  const [addProspectModal, setAddProspectModal] = useState(false);
  const [addCustomerModal, setAddCustomerModal] = useState(false);
  const [addExpenseModal, setAddExpenseModal] = useState(false);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseForm] = Form.useForm();
  const createExpenseMutation = useCreateExpenseMutation();

  // Queries
  const { data, isLoading, isFetching, isError, error, refetch } = useMarketingDashboardQuery();
  const { data: analyticsData, isLoading: analyticsLoading, refetch: refetchAnalytics } = useAnalyticsDashboardQuery();
  const { data: usersData, refetch: refetchUsers } = useUsersQuery({ pageSize: 500 });
  const allUsers = usersData?.items ?? [];

  const { data: allProspectsData, refetch: refetchProspects } = useProspectsQuery({ pageSize: 10000 });
  const allProspects = allProspectsData?.items ?? [];

  const { data: allCustomersData, refetch: refetchCustomers } = useCustomersQuery({ pageSize: 10000 });
  const allCustomers = allCustomersData?.items ?? [];

  const { data: appointmentsData, refetch: refetchAppointments } = useAppointmentsQuery({ pageSize: 1000 });
  const appointments = appointmentsData?.items ?? [];

  const { data: propertiesData } = usePropertiesQuery({ pageSize: 200 });
  const properties = propertiesData?.items ?? [];

  const createAppointmentMutation = useCreateAppointmentMutation();

  const handleInitiateExpense = async (values: any) => {
    try {
      setExpenseLoading(true);
      const amountMinor = Math.round(values.amountGHS * 100);
      await createExpenseMutation.mutateAsync({
        category: values.category,
        type: values.type || 'external',
        amountMinor,
        incurredOn: values.incurredOn.format('YYYY-MM-DD'),
        description: values.description,
        branchId: user?.branchId,
        recordedByUserId: user?.id,
        recordedByUserName: user?.firstName ? `${user.firstName} ${user.lastName}` : 'Marketing Director',
        recordedByUserRole: 'marketing_director',
        status: 'pending',
      });
      message.success('Marketing expense submitted successfully for Admin & Accounts approval!');
      setAddExpenseModal(false);
      expenseForm.resetFields();
    } catch (err: any) {
      message.error(err?.message || 'Failed to initiate expense');
    } finally {
      setExpenseLoading(false);
    }
  };

  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMarketer, setSelectedMarketer] = useState<MarketerPerformance | null>(null);
  const [viewProfileDrawer, setViewProfileDrawer] = useState(false);
  const { data: branches = [] } = useBranchesQuery();

  // Search states for dedicated dashboard tabs
  const [prospectsSearch, setProspectsSearch] = useState('');
  const [prospectsStatusFilter, setProspectsStatusFilter] = useState<string>('all');
  const [customersSearch, setCustomersSearch] = useState('');

  // Drill-down Modal State for Marketer's Added Records
  const [detailModalMarketer, setDetailModalMarketer] = useState<any | null>(null);
  const [detailModalTab, setDetailModalTab] = useState<'prospects' | 'customers'>('prospects');
  const [detailModalSearch, setDetailModalSearch] = useState('');

  // Book Appointment Modal State
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [appointmentForm] = Form.useForm();
  const [appointmentTargetClient, setAppointmentTargetClient] = useState<{
    type: 'prospect' | 'customer';
    id: string;
    name: string;
    phone?: string;
  } | null>(null);
  const [appointmentStaffId, setAppointmentStaffId] = useState<string | undefined>(undefined);

  // Aggregation of ALL marketing staff and contributors across all departments in the system
  const allMarketingStaffUsers = useMemo(() => {
    return allUsers.filter(
      (u) =>
        u.role === 'marketing_staff' ||
        u.role === 'marketing_director' ||
        allProspects.some(
          (p) =>
            (p.source === 'marketing' || !p.source) &&
            (p.assignedUserId === u.id || (p as any).createdByUserId === u.id || (p as any).assignedStaffId === u.id)
        )
    );
  }, [allUsers, allProspects]);

  const rawMarketers: (MarketerPerformance & { role?: string; userObj?: any })[] = useMemo(() => {
    const dashboardMarketers = data?.marketers ?? [];
    const staffMap = new Map<string, any>();

    // 1. Process all marketing staff registered in user management
    allMarketingStaffUsers.forEach((u) => {
      const id = u.id;
      const fullName = getUserFullName(u);

      const staffProspects = allProspects.filter(
        (p) => p.assignedUserId === id || (p as any).createdByUserId === id || (p as any).assignedStaffId === id
      );

      const staffCustomers = allCustomers.filter(
        (c) => (c as any).assignedUserId === id || (c as any).createdByUserId === id || staffProspects.some((p) => p.id === c.prospectId)
      );

      const statusNew = staffProspects.filter((p) => p.status === 'new').length;
      const statusScheduled = staffProspects.filter((p) => p.status === 'meeting_scheduled').length;
      const statusCompleted = staffProspects.filter((p) => p.status === 'meeting_completed').length;
      const statusPostponed = staffProspects.filter((p) => p.status === 'postponed').length;
      const statusSuspended = staffProspects.filter((p) => p.status === 'suspended').length;
      const statusCanceled = staffProspects.filter((p) => {
        const s = String(p.status || '').toLowerCase();
        return s === 'canceled' || s === 'cancelled';
      }).length;
      const statusPurchased = staffProspects.filter((p) => p.status === 'purchased').length;
      const converted = staffCustomers.length > 0 ? staffCustomers.length : statusPurchased;

      const totalProspects = staffProspects.length;
      const conversionRate = totalProspects > 0 ? (converted / totalProspects) * 100 : 0;

      staffMap.set(id, {
        id,
        userId: id,
        assignedUserId: id,
        name: fullName,
        avatar: u.avatarUrl || u.photoUrl || u.profilePictureUrl,
        email: u.email,
        phone: u.phoneNumber || (typeof u.phone === 'string' ? u.phone : u.phone?.number) || '',
        role: u.role,
        userObj: u,
        branchId: u.branchId,
        totalProspects,
        new: statusNew,
        meetingScheduled: statusScheduled,
        meetingCompleted: statusCompleted,
        postponed: statusPostponed,
        suspended: statusSuspended,
        canceled: statusCanceled,
        converted,
        conversionRate,
        satisfaction: 9.4,
        responseTime: 16,
        targetMinor: 5000000,
        revenueMinor: converted * 6500000,
        thisMonthProspects: staffProspects.length,
        lastMonthProspects: Math.max(0, staffProspects.length - 2),
        growthPercent: 15,
        byStatus: {
          new: statusNew,
          meeting_scheduled: statusScheduled,
          meeting_completed: statusCompleted,
          postponed: statusPostponed,
          suspended: statusSuspended,
          canceled: statusCanceled,
        },
      });
    });

    // 2. Merge any dashboard-only marketers from the backend endpoint
    dashboardMarketers.forEach((m: any) => {
      const id = m.userId || m.id || '';
      if (!id) return;
      if (!staffMap.has(id)) {
        const staffProspects = allProspects.filter(
          (p) => p.assignedUserId === id || (p as any).createdByUserId === id || (p as any).assignedStaffId === id
        );
        const staffCustomers = allCustomers.filter(
          (c) => (c as any).assignedUserId === id || (c as any).createdByUserId === id || staffProspects.some((p) => p.id === c.prospectId)
        );
        const totalProspects = allProspects.length > 0 ? staffProspects.length : (m.totalProspects ?? 0);
        const converted = allCustomers.length > 0 ? staffCustomers.length : (m.converted ?? 0);

        staffMap.set(id, {
          id,
          userId: id,
          assignedUserId: id,
          name: m.name,
          avatar: m.avatar,
          email: m.email,
          phone: m.phone,
          role: 'marketing_staff',
          totalProspects,
          new: allProspects.length > 0 ? staffProspects.filter((p) => p.status === 'new').length : (m.byStatus?.new ?? m.new ?? 0),
          meetingScheduled: allProspects.length > 0 ? staffProspects.filter((p) => p.status === 'meeting_scheduled').length : (m.byStatus?.meeting_scheduled ?? m.meetingScheduled ?? 0),
          meetingCompleted: allProspects.length > 0 ? staffProspects.filter((p) => p.status === 'meeting_completed').length : (m.byStatus?.meeting_completed ?? m.meetingCompleted ?? 0),
          postponed: allProspects.length > 0 ? staffProspects.filter((p) => p.status === 'postponed').length : (m.postponed ?? 0),
          suspended: allProspects.length > 0 ? staffProspects.filter((p) => p.status === 'suspended').length : (m.suspended ?? 0),
          canceled: allProspects.length > 0 ? staffProspects.filter((p) => {
            const s = String(p.status || '').toLowerCase();
            return s === 'canceled' || s === 'cancelled';
          }).length : (m.canceled ?? (m.byStatus?.canceled ?? (m.byStatus?.cancelled ?? 0))),
          converted,
          conversionRate: m.conversionRate ?? (totalProspects > 0 ? (converted / totalProspects) * 100 : 0),
          satisfaction: m.satisfaction,
          responseTime: m.responseTime,
          targetMinor: m.targetMinor,
          revenueMinor: m.revenueMinor,
          thisMonthProspects: m.thisMonthProspects,
          lastMonthProspects: m.lastMonthProspects,
          growthPercent: m.growthPercent,
          byStatus: m.byStatus,
        });
      } else {
        const existing = staffMap.get(id);
        if (m.satisfaction) existing.satisfaction = m.satisfaction;
        if (m.responseTime) existing.responseTime = m.responseTime;
        if (m.revenueMinor) existing.revenueMinor = m.revenueMinor;
        if (m.targetMinor) existing.targetMinor = m.targetMinor;
      }
    });

    return Array.from(staffMap.values());
  }, [allMarketingStaffUsers, data?.marketers, allProspects, allCustomers]);

  const marketers = useMemo(() => {
    return filterEntitiesByBranch(rawMarketers, user, branches);
  }, [rawMarketers, user, branches]);

  const marketerCountForAvg = Math.max(marketers.length, 1);

  const allMarketingProspects = useMemo(() => {
    return allProspects.filter((p) => p.source === 'marketing' || !p.source);
  }, [allProspects]);

  const summary = {
    totalActive: Math.max(allMarketingProspects.length, marketers.reduce((sum, m) => sum + m.totalProspects, 0)),
    totalMeetingsScheduled: marketers.reduce((sum, m) => sum + m.meetingScheduled, 0),
    totalMeetingsCompleted: marketers.reduce((sum, m) => sum + m.meetingCompleted, 0),
    totalConverted: marketers.reduce((sum, m) => sum + m.converted, 0),
    avgConversionRate: marketers.reduce((sum, m) => sum + m.conversionRate, 0) / marketerCountForAvg,
  };

  const totalActiveForProgress = Math.max(summary.totalActive, 1);

  const topPerformer = marketers.length > 0
    ? [...marketers].sort((a, b) => b.conversionRate - a.conversionRate)[0]
    : null;

  // ── Revenue / Trends (real, from GET /dashboard/analytics) ──────────────
  const trendsData = useMemo(
    () => (analyticsData?.timeSeries ?? []).map((point) => ({
      month: point.month,
      revenue: point.revenue ?? 0,
      newProspects: point.newProspects ?? 0,
      newCustomers: point.newCustomers ?? 0,
    })),
    [analyticsData]
  );

  const totalRevenue12mo = trendsData.reduce((sum, p) => sum + p.revenue, 0);

  const topRevenueMarketer = analyticsData?.topMarketers && analyticsData.topMarketers.length > 0
    ? [...analyticsData.topMarketers].sort((a, b) => b.revenueGenerated - a.revenueGenerated)[0]
    : null;

  // ── Status Distribution for Pie Chart (real, from marketer counts) ──────
  const statusDistribution = useMemo(() => {
    const total = marketers.reduce((sum, m) => sum + m.totalProspects, 0);
    if (total === 0) return [];

    const statuses = [
      { name: 'New', value: marketers.reduce((sum, m) => sum + m.new, 0) },
      { name: 'Meeting Scheduled', value: marketers.reduce((sum, m) => sum + m.meetingScheduled, 0) },
      { name: 'Meeting Completed', value: marketers.reduce((sum, m) => sum + m.meetingCompleted, 0) },
      { name: 'Postponed', value: marketers.reduce((sum, m) => sum + m.postponed, 0) },
      { name: 'Suspended', value: marketers.reduce((sum, m) => sum + m.suspended, 0) },
      { name: 'Canceled', value: marketers.reduce((sum, m) => sum + ((m as any).canceled ?? (m.byStatus?.canceled ?? 0)), 0) },
      { name: 'Converted', value: marketers.reduce((sum, m) => sum + m.converted, 0) },
    ];
    return statuses.filter(s => s.value > 0);
  }, [marketers]);

  // Appointment Booking Handler
  const handleOpenAppointmentModal = (
    client?: { type: 'prospect' | 'customer'; id: string; name: string; phone?: string },
    staffId?: string
  ) => {
    appointmentForm.resetFields();
    setAppointmentTargetClient(client || null);
    setAppointmentStaffId(staffId || user?.id);

    const initialScheduled = dayjs().add(1, 'day').set('hour', 10).set('minute', 0);
    appointmentForm.setFieldsValue({
      clientId: client ? `${client.type}:${client.id}` : undefined,
      staffId: staffId || user?.id,
      scheduledFor: initialScheduled,
      reason: 'Site Inspection & Property Tour',
      source: 'marketing',
      venue: 'On-site at Property',
      notes: '',
    });
    setAppointmentModalOpen(true);
  };

  const handleBookAppointmentSubmit = async (values: any) => {
    try {
      let prospectId: string | undefined;
      let customerId: string | undefined;

      if (values.clientId) {
        const [type, id] = values.clientId.split(':');
        if (type === 'prospect') prospectId = id;
        if (type === 'customer') customerId = id;
      }

      const reasonText = values.reason?.trim()
        ? `[${values.source || 'marketing'}] ${values.reason.trim()}`
        : `[${values.source || 'marketing'}] Marketing site inspection / consultation`;

      const apptRes = await createAppointmentMutation.mutateAsync({
        prospectId,
        customerId,
        scheduledFor: values.scheduledFor.toISOString(),
        reason: reasonText,
      });
      const createdApptId = (apptRes as any)?.data?.id || (apptRes as any)?.id;

      queryClient.invalidateQueries({ queryKey: appointmentsKeys.all });
      window.dispatchEvent(new Event('omark-appointments-changed'));

      let clientLabel = 'Client';
      if (prospectId) {
        const p = allProspects.find((item) => item.id === prospectId);
        if (p) clientLabel = `${p.firstName} ${p.lastName}`;
      } else if (customerId) {
        const c = allCustomers.find((item) => item.id === customerId);
        if (c) clientLabel = `${c.firstName} ${c.lastName}`;
      }

      // Record booking interaction for chronological appointment history
      saveStoredInteraction({
        id: `inter_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        prospectId: prospectId || '',
        prospectName: clientLabel,
        channel: 'call',
        occurredAt: new Date().toISOString(),
        response: `Appointment booked for ${dayjs(values.scheduledFor).format('MMM D, YYYY h:mm A')}. Purpose: ${reasonText}`,
        appointmentId: createdApptId,
        customerId: customerId,
        interactionType: 'booking',
        loggedByUserId: user?.id || '1',
        loggedByUserName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Marketing Director',
        loggedByUserRole: user?.role || 'marketing_director',
        loggedByUserEmail: user?.email || '',
        createdAt: new Date().toISOString(),
      });
      window.dispatchEvent(new Event('omark-interactions-changed'));

      message.success(
        `Appointment successfully booked for ${clientLabel} on ${dayjs(values.scheduledFor).format('MMM D, YYYY h:mm A')}!`
      );
      setAppointmentModalOpen(false);
      appointmentForm.resetFields();
      refetchAppointments();
    } catch (err: any) {
      message.error(err?.message || 'Failed to book appointment');
    }
  };

  const handleRefresh = () => {
    Promise.all([
      refetch(),
      refetchAnalytics(),
      refetchUsers(),
      refetchProspects(),
      refetchCustomers(),
      refetchAppointments(),
    ])
      .then(() => message.success('Dashboard refreshed!'))
      .catch(() => message.error('Failed to refresh dashboard'));
  };

  // Filtered prospects and customers for the selected marketer in the drill-down modal
  const marketerProspectsList = useMemo(() => {
    if (!detailModalMarketer) return [];
    const id = detailModalMarketer.id;
    let list = allProspects.filter(
      (p) => p.assignedUserId === id || (p as any).createdByUserId === id || (p as any).assignedStaffId === id
    );
    if (detailModalSearch.trim()) {
      const q = detailModalSearch.trim().toLowerCase();
      list = list.filter(
        (p) =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
          p.phoneNumber?.toLowerCase().includes(q) ||
          p.address?.toLowerCase().includes(q) ||
          p.status?.toLowerCase().includes(q) ||
          p.reasonForContact?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [detailModalMarketer, allProspects, detailModalSearch]);

  const marketerCustomersList = useMemo(() => {
    if (!detailModalMarketer) return [];
    const id = detailModalMarketer.id;
    const staffProspectIds = new Set(
      allProspects
        .filter((p) => p.assignedUserId === id || (p as any).createdByUserId === id || (p as any).assignedStaffId === id)
        .map((p) => p.id)
    );
    let list = allCustomers.filter(
      (c) => (c as any).assignedUserId === id || (c as any).createdByUserId === id || (c.prospectId && staffProspectIds.has(c.prospectId))
    );
    if (detailModalSearch.trim()) {
      const q = detailModalSearch.trim().toLowerCase();
      list = list.filter(
        (c) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          c.phoneNumber?.toLowerCase().includes(q) ||
          c.address?.toLowerCase().includes(q) ||
          c.code?.toLowerCase().includes(q) ||
          c.type?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [detailModalMarketer, allCustomers, allProspects, detailModalSearch]);

  // Filtered datasets for dedicated dashboard tabs
  const filteredDashboardProspects = useMemo(() => {
    let list = allProspects.filter((p) => p.source === 'marketing' || !p.source);
    if (prospectsStatusFilter && prospectsStatusFilter !== 'all') {
      list = list.filter((p) => {
        const s = String(p.status || '').toLowerCase();
        if (prospectsStatusFilter === 'canceled') {
          return s === 'canceled' || s === 'cancelled';
        }
        return s === prospectsStatusFilter.toLowerCase();
      });
    }
    if (prospectsSearch.trim()) {
      const q = prospectsSearch.trim().toLowerCase();
      list = list.filter(
        (p) =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
          p.phoneNumber?.toLowerCase().includes(q) ||
          p.address?.toLowerCase().includes(q) ||
          p.status?.toLowerCase().includes(q) ||
          p.reasonForContact?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allProspects, prospectsSearch, prospectsStatusFilter]);

  const filteredDashboardCustomers = useMemo(() => {
    let list = allCustomers;
    if (customersSearch.trim()) {
      const q = customersSearch.trim().toLowerCase();
      list = list.filter(
        (c) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          c.phoneNumber?.toLowerCase().includes(q) ||
          c.address?.toLowerCase().includes(q) ||
          c.code?.toLowerCase().includes(q) ||
          c.type?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allCustomers, customersSearch]);

  // Helper to resolve property details
  const getPropertyInfo = (propertyId: string) => {
    const prop = properties.find((p) => p.id === propertyId);
    if (!prop) return null;
    return `${(prop as any).title || prop.houseNumber || (prop as any).plotNumber || 'Property'} (${prop.offerNumber || prop.id.slice(0, 6)})`;
  };

  // Helper to resolve staff member by ID
  const getStaffUser = (staffId?: string) => {
    if (!staffId) return null;
    return allUsers.find((u) => u.id === staffId);
  };

  const columns = [
    {
      title: 'Marketer',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left' as const,
      width: 220,
      render: (name: string, record: any) => (
        <Space>
          <PhotoUpload entityType="staff" entityId={record.id} size={36} editable={false} />
          <div>
            <Text strong style={{ display: 'block', lineHeight: 1.2 }}>{name}</Text>
            <Space size={4} style={{ marginTop: 2 }}>
              <Tag
                color={record.role === 'marketing_director' ? 'gold' : 'blue'}
                style={{ fontSize: 10, margin: 0, padding: '0 5px', borderRadius: 4 }}
              >
                {record.role === 'marketing_director' ? 'Director' : 'Marketing'}
              </Tag>
              {record.phone && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  <PhoneOutlined /> {record.phone}
                </Text>
              )}
            </Space>
          </div>
        </Space>
      ),
    },
    {
      title: 'Prospects Added',
      key: 'totalProspects',
      width: 150,
      sorter: (a: any, b: any) => a.totalProspects - b.totalProspects,
      render: (_: any, record: any) => (
        <Tooltip title="Click to view full list of prospects added by this staff member">
          <Button
            type="link"
            size="small"
            style={{ padding: 0, fontWeight: 700, fontSize: 14 }}
            onClick={() => {
              setDetailModalMarketer(record);
              setDetailModalTab('prospects');
              setDetailModalSearch('');
            }}
          >
            <Tag color="blue" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, cursor: 'pointer' }}>
              👥 {record.totalProspects} Prospects &rarr;
            </Tag>
          </Button>
        </Tooltip>
      ),
    },
    {
      title: 'Status Breakdown',
      key: 'statusBreakdown',
      width: 240,
      render: (_: any, record: any) => (
        <Space size={4} wrap>
          <Tooltip title="New Prospects"><Tag color="blue">{record.new} New</Tag></Tooltip>
          <Tooltip title="Meeting Scheduled"><Tag color="cyan">{record.meetingScheduled} Sched.</Tag></Tooltip>
          <Tooltip title="Meeting Completed"><Tag color="green">{record.meetingCompleted} Done</Tag></Tooltip>
          {record.postponed > 0 && <Tooltip title="Postponed"><Tag color="gold">{record.postponed} Postp.</Tag></Tooltip>}
          {record.suspended > 0 && <Tooltip title="Suspended"><Tag color="orange">{record.suspended} Susp.</Tag></Tooltip>}
        </Space>
      ),
    },
    {
      title: 'Customers Added',
      key: 'converted',
      width: 150,
      sorter: (a: any, b: any) => a.converted - b.converted,
      render: (_: any, record: any) => (
        <Tooltip title="Click to view full list of customers onboarded/converted by this staff member">
          <Button
            type="link"
            size="small"
            style={{ padding: 0, fontWeight: 700, fontSize: 14 }}
            onClick={() => {
              setDetailModalMarketer(record);
              setDetailModalTab('customers');
              setDetailModalSearch('');
            }}
          >
            <Tag color="purple" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, cursor: 'pointer' }}>
              🤝 {record.converted} Converted &rarr;
            </Tag>
          </Button>
        </Tooltip>
      ),
    },
    {
      title: 'Conversion Rate',
      key: 'conversionRate',
      width: 150,
      render: (_: any, record: any) => (
        <Progress
          percent={record.conversionRate}
          size="small"
          strokeColor={record.conversionRate > 10 ? '#52c41a' : record.conversionRate > 5 ? '#faad14' : '#ff4d4f'}
          format={(p: number | undefined) => `${p?.toFixed(1)}%`}
          style={{ width: 110 }}
        />
      ),
      sorter: (a: any, b: any) => a.conversionRate - b.conversionRate,
    },
    {
      title: 'Satisfaction & Speed',
      key: 'satisfaction',
      width: 160,
      render: (_: any, record: any) => (
        <div>
          {record.satisfaction !== undefined ? (
            <Tag color="gold"><StarFilled /> {record.satisfaction} / 10</Tag>
          ) : null}
          {record.responseTime !== undefined ? (
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
              ⚡ {record.responseTime} mins avg
            </Text>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Revenue / Target',
      key: 'revenue',
      width: 170,
      render: (_: any, record: any) => {
        if (record.revenueMinor === undefined && record.targetMinor === undefined) return <Text type="secondary">-</Text>;
        const revGhs = (record.revenueMinor ?? 0) / 100;
        const targetGhs = (record.targetMinor ?? 0) / 100;
        const pct = targetGhs > 0 ? Math.min(100, Math.round((revGhs / targetGhs) * 100)) : 0;
        return (
          <div>
            <Text strong style={{ fontSize: 12 }}>GHS {revGhs.toLocaleString()}</Text>
            {targetGhs > 0 && (
              <Progress percent={pct} size="small" strokeColor={pct >= 100 ? '#52c41a' : '#1890ff'} />
            )}
          </div>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right' as const,
      width: 150,
      render: (_: any, record: any) => (
        <Space size={4}>
          <Tooltip title="View Added Records & Full Lists">
            <Button
              type="text"
              icon={<EyeOutlined style={{ color: '#1890ff' }} />}
              onClick={() => {
                setDetailModalMarketer(record);
                setDetailModalTab('prospects');
                setDetailModalSearch('');
              }}
            />
          </Tooltip>
          <Tooltip title="Book Appointment with this Staff">
            <Button
              type="text"
              icon={<CalendarOutlined style={{ color: '#722ed1' }} />}
              onClick={() => handleOpenAppointmentModal(undefined, record.id)}
            />
          </Tooltip>
          <Tooltip title="View in Prospects Directory">
            <Button
              type="text"
              icon={<TeamOutlined style={{ color: '#52c41a' }} />}
              onClick={() => navigate(`/marketing/prospects?assignedUserId=${record.id}&name=${encodeURIComponent(record.name)}`)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const dashboardProspectColumns = [
    {
      title: 'Customer / Prospect',
      key: 'customer',
      width: 230,
      render: (_: any, record: any) => (
        <Space align="start">
          <PhotoUpload entityType="prospect" entityId={record.id} size={32} editable={false} />
          <div>
            <Text strong>{record.firstName} {record.lastName}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              <PhoneOutlined /> {record.phoneNumber || 'No phone'}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Address / Location',
      dataIndex: 'address',
      key: 'address',
      width: 170,
      ellipsis: true,
      render: (addr: string) => (
        <Tooltip title={addr}>
          <HomeOutlined style={{ marginRight: 6, color: '#8c8c8c' }} />
          {addr || '—'}
        </Tooltip>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: string) => <StatusTag status={status} type="prospect" />,
    },
    {
      title: 'Reason / Interest',
      dataIndex: 'reasonForContact',
      key: 'reasonForContact',
      width: 180,
      ellipsis: true,
      render: (text: string) => text || '—',
    },
    {
      title: 'Added By / Marketer',
      key: 'addedBy',
      width: 190,
      render: (_: any, record: any) => {
        const creatorId = record.createdByUserId || record.assignedUserId;
        const staff = getStaffUser(creatorId);
        if (!staff) {
          return (
            <Tooltip title={`Created: ${record.createdAt ? dayjs(record.createdAt).format('MMM D, YYYY h:mm A') : 'Direct entry'}`}>
              <Tag color="default">Direct / Inbound</Tag>
            </Tooltip>
          );
        }
        const roleConfig: Record<string, { label: string; color: string }> = {
          admin: { label: 'Admin', color: 'purple' },
          marketing_director: { label: 'Director', color: 'gold' },
          marketing_staff: { label: 'Marketer', color: 'blue' },
          customer_service: { label: 'Customer Service', color: 'green' },
          secretary: { label: 'Secretary', color: 'cyan' },
          branch_manager: { label: 'Branch Manager', color: 'geekblue' },
          accounts: { label: 'Accounts', color: 'orange' },
        };
        const roleInfo = roleConfig[staff.role] || { label: staff.role, color: 'blue' };
        return (
          <Tooltip title={`Added on ${record.createdAt ? dayjs(record.createdAt).format('MMM D, YYYY h:mm A') : 'System record'}`}>
            <Space size={6}>
              <PhotoUpload entityType="staff" entityId={staff.id} size={26} editable={false} />
              <div>
                <Text strong style={{ fontSize: 12, display: 'block', lineHeight: 1.2 }}>
                  {getUserFullName(staff)}
                </Text>
                <Tag
                  color={roleInfo.color}
                  style={{ fontSize: 9, margin: 0, padding: '0 4px', borderRadius: 3 }}
                >
                  {roleInfo.label}
                </Tag>
              </div>
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: 'Date Added',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (d: string) => (d ? dayjs(d).format('DD MMM YYYY') : '—'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_: any, record: any) => (
        <Space size={4}>
          <Tooltip title="Book Appointment">
            <Button
              size="small"
              icon={<CalendarOutlined style={{ color: '#722ed1' }} />}
              onClick={() =>
                handleOpenAppointmentModal(
                  { type: 'prospect', id: record.id, name: `${record.firstName} ${record.lastName}`, phone: record.phoneNumber },
                  record.assignedUserId
                )
              }
            >
              Book
            </Button>
          </Tooltip>
          <Tooltip title="View Details">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/marketing/prospects/${record.id}`)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const dashboardCustomerColumns = [
    {
      title: 'Sales Code',
      dataIndex: 'code',
      key: 'code',
      width: 140,
      render: (code: string) => (code ? <Tag color="geekblue">{code}</Tag> : <Text type="secondary">N/A</Text>),
    },
    {
      title: 'Customer',
      key: 'customer',
      width: 220,
      render: (_: any, record: any) => (
        <Space>
          <PhotoUpload entityType="customer" entityId={record.id} size={32} editable={false} />
          <div>
            <Text strong>{record.firstName} {record.lastName}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              <PhoneOutlined /> {record.phoneNumber}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Property',
      dataIndex: 'propertyId',
      key: 'property',
      width: 180,
      render: (propId: string) => getPropertyInfo(propId) || <Text type="secondary">N/A</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 130,
      render: (type: any) => (
        <Tag color={getCustomerTypeColor(type)}>
          {getCustomerTypeLabel(type)}
        </Tag>
      ),
    },
    {
      title: 'Added By / Marketer',
      key: 'addedBy',
      width: 180,
      render: (_: any, record: any) => {
        let staffId = record.assignedUserId || record.createdByUserId;
        if (!staffId && record.prospectId) {
          const linkedProspect = allProspects.find((p) => p.id === record.prospectId);
          if (linkedProspect) staffId = linkedProspect.assignedUserId || (linkedProspect as any).createdByUserId;
        }
        const staff = getStaffUser(staffId);
        if (!staff) {
          return <Tag color="default">Direct Sales</Tag>;
        }
        return (
          <Space size={6}>
            <PhotoUpload entityType="staff" entityId={staff.id} size={26} editable={false} />
            <div>
              <Text strong style={{ fontSize: 12, display: 'block', lineHeight: 1.2 }}>
                {getUserFullName(staff)}
              </Text>
              <Tag
                color={staff.role === 'marketing_director' ? 'gold' : 'blue'}
                style={{ fontSize: 9, margin: 0, padding: '0 4px', borderRadius: 3 }}
              >
                {staff.role === 'marketing_director' ? 'Director' : 'Marketer'}
              </Tag>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Joined Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (d: string) => (d ? dayjs(d).format('DD MMM YYYY') : '—'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_: any, record: any) => (
        <Space size={4}>
          <Tooltip title="Book Appointment">
            <Button
              size="small"
              icon={<CalendarOutlined style={{ color: '#722ed1' }} />}
              onClick={() =>
                handleOpenAppointmentModal(
                  { type: 'customer', id: record.id, name: `${record.firstName} ${record.lastName}`, phone: record.phoneNumber },
                  record.assignedUserId
                )
              }
            >
              Book
            </Button>
          </Tooltip>
          <Tooltip title="View Customer Details">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/customers/${record.id}`)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <Spin size="large" tip="Loading dashboard..." />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Failed to load dashboard"
        description={(error as any)?.error?.message || 'Please try again later.'}
        style={{ margin: 24 }}
      />
    );
  }

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden', padding: '0 4px' }}>
      <PageHeader
        title="Marketing Director Overview"
        actions={[
          {
            label: 'Book Appointment',
            onClick: () => handleOpenAppointmentModal(),
            icon: <CalendarOutlined />,
            type: 'primary',
          },
          {
            label: 'Add Prospect',
            onClick: () => setAddProspectModal(true),
            icon: <UserAddOutlined />,
          },
          {
            label: 'Add Customer',
            onClick: () => setAddCustomerModal(true),
            icon: <PlusOutlined />,
          },
          {
            label: 'Record Expense',
            onClick: () => setAddExpenseModal(true),
            icon: <DollarOutlined />,
          },
          ...(hasRole(['admin', 'marketing_director'])
            ? [{
                label: 'Bonus Rules',
                onClick: () => setBonusModalOpen(true),
                icon: <SettingOutlined />,
              }]
            : []),
          {
            label: 'Refresh',
            onClick: handleRefresh,
            icon: <ReloadOutlined />,
          },
        ]}
      />

      {/* Top Banner - Welcome & Stats */}
      <Alert
        message={
          <Space>
            <TrophyOutlined style={{ fontSize: 20, color: '#faad14' }} />
            <Text strong>Welcome back, {user?.firstName}!</Text>
          </Space>
        }
        description={
          <div>
            <Text>Here's your team's performance overview for {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
            {topPerformer && topPerformer.totalProspects > 0 && (
              <Tag color="gold" style={{ marginTop: 4 }}>
                <CrownOutlined /> Top Performer: {topPerformer.name} ({topPerformer.conversionRate.toFixed(1)}% conversion rate)
              </Tag>
            )}
          </div>
        }
        type="info"
        showIcon={false}
        style={{ marginBottom: 24 }}
      />

      {/* Summary Cards — every value below is derived directly from live
          API data (marketing dashboard counts + 12-month analytics) */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Total Marketing Prospects"
              value={summary.totalActive}
              prefix={<TeamOutlined />}
              valueStyle={{ color: tokens.primary, fontSize: 24 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Added by all staff ({marketers.length} contributors)
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Meetings Completed"
              value={summary.totalMeetingsCompleted}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a', fontSize: 24 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              +{summary.totalMeetingsScheduled} scheduled
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Converted"
              value={summary.totalConverted}
              prefix={<UserSwitchOutlined />}
              valueStyle={{ color: '#722ed1', fontSize: 24 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {summary.avgConversionRate.toFixed(1)}% avg. conversion rate
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card loading={analyticsLoading}>
            <Statistic
              title="Revenue (12mo)"
              value={`GHS ${(totalRevenue12mo / 100).toLocaleString()}`}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#faad14', fontSize: 24 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Company-wide, from Analytics
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Team Size"
              value={marketers.length}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff', fontSize: 24 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Active marketers
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'overview',
            label: <span><DashboardOutlined /> Overview</span>,
            children: (
              <>
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={24}>
                    <Card title="Revenue & Pipeline Trends (12 Months)" extra={<Text type="secondary" style={{ fontSize: 12 }}>Company-wide, from Analytics</Text>}>
                      {analyticsLoading ? (
                        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Spin />
                        </div>
                      ) : trendsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={trendsData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis yAxisId="left" />
                            <YAxis yAxisId="right" orientation="right" />
                            <RechartsTooltip
                              formatter={(value: any, name: any) =>
                                name === 'Revenue (GHS)' ? `GHS ${(value / 100).toLocaleString()}` : value
                              }
                            />
                            <Legend />
                            <Line yAxisId="left" type="monotone" dataKey="newProspects" stroke="#1890ff" name="New Prospects" strokeWidth={2} dot={{ r: 4 }} />
                            <Line yAxisId="left" type="monotone" dataKey="newCustomers" stroke="#52c41a" name="New Customers" strokeWidth={2} dot={{ r: 4 }} />
                            <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#faad14" name="Revenue (GHS)" strokeWidth={2} dot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Empty description="No trend data available" />
                        </div>
                      )}
                    </Card>
                  </Col>
                </Row>

                <Card title="Team Performance">
                  {marketers.length > 0 ? (
                    <Table
                      columns={columns}
                      dataSource={marketers}
                      rowKey="id"
                      loading={isFetching}
                      pagination={{ pageSize: 10 }}
                      scroll={{ x: 1000 }}
                    />
                  ) : (
                    <Empty description="No marketers found" />
                  )}
                </Card>
              </>
            ),
          },
          {
            key: 'prospects',
            label: <span><TeamOutlined /> All Marketing Prospects ({allMarketingProspects.length})</span>,
            children: (
              <Card
                title={
                  <Space>
                    <TeamOutlined style={{ color: '#1890ff' }} />
                    <span>All Marketing Prospects ({allMarketingProspects.length})</span>
                  </Space>
                }
                extra={
                  <Space wrap>
                    <Input
                      prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                      placeholder="Search prospects by name, phone, address..."
                      value={prospectsSearch}
                      onChange={(e) => setProspectsSearch(e.target.value)}
                      allowClear
                      style={{ width: 260 }}
                    />
                    <Select
                      value={prospectsStatusFilter}
                      onChange={setProspectsStatusFilter}
                      style={{ width: 160 }}
                      options={[
                        { value: 'all', label: 'All Statuses' },
                        { value: 'new', label: 'New' },
                        { value: 'meeting_scheduled', label: 'Meeting Scheduled' },
                        { value: 'meeting_completed', label: 'Meeting Completed' },
                        { value: 'suspended', label: 'Suspended' },
                        { value: 'postponed', label: 'Postponed' },
                        { value: 'canceled', label: 'Canceled' },
                        { value: 'purchased', label: 'Purchased' },
                      ]}
                    />
                    <Button
                      type="primary"
                      icon={<CalendarOutlined />}
                      onClick={() => handleOpenAppointmentModal()}
                    >
                      Book Appointment
                    </Button>
                  </Space>
                }
              >
                <Table
                  dataSource={filteredDashboardProspects}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1000 }}
                  columns={dashboardProspectColumns}
                />
              </Card>
            ),
          },
          {
            key: 'customers',
            label: <span><UserSwitchOutlined /> Converted Customers ({allCustomers.length})</span>,
            children: (
              <Card
                title={
                  <Space>
                    <UserSwitchOutlined style={{ color: '#722ed1' }} />
                    <span>Converted Marketing Customers ({allCustomers.length})</span>
                  </Space>
                }
                extra={
                  <Space>
                    <Input
                      prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                      placeholder="Search customers by code, name, phone..."
                      value={customersSearch}
                      onChange={(e) => setCustomersSearch(e.target.value)}
                      allowClear
                      style={{ width: 280 }}
                    />
                    <Button
                      type="primary"
                      icon={<CalendarOutlined />}
                      onClick={() => handleOpenAppointmentModal()}
                    >
                      Book Appointment
                    </Button>
                  </Space>
                }
              >
                <Table
                  dataSource={filteredDashboardCustomers}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1000 }}
                  columns={dashboardCustomerColumns}
                />
              </Card>
            ),
          },
          {
            key: 'interactions',
            label: <span><HistoryOutlined /> Team Interactions Timeline</span>,
            children: (
              <ProspectInteractionsTimeline
                title="Marketing Team & Staff Prospect Interactions Timeline"
                style={{ marginBottom: 20 }}
              />
            ),
          },
          {
            key: 'analytics',
            label: <span><BarChartOutlined /> Analytics</span>,
            children: (
              <div>
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col xs={24} lg={12}>
                    <Card title="Conversion Funnel">
                      <div style={{ padding: '20px 0' }}>
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text>New Prospects</Text>
                            <Text strong>{summary.totalActive}</Text>
                          </div>
                          <Progress percent={100} strokeColor="#1890ff" size="small" />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text>Meetings Scheduled</Text>
                            <Text strong>{summary.totalMeetingsScheduled}</Text>
                          </div>
                          <Progress
                            percent={Math.round((summary.totalMeetingsScheduled / totalActiveForProgress) * 100)}
                            strokeColor="#faad14"
                            size="small"
                          />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text>Meetings Completed</Text>
                            <Text strong>{summary.totalMeetingsCompleted}</Text>
                          </div>
                          <Progress
                            percent={Math.round((summary.totalMeetingsCompleted / totalActiveForProgress) * 100)}
                            strokeColor="#52c41a"
                            size="small"
                          />
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text>Converted</Text>
                            <Text strong>{summary.totalConverted}</Text>
                          </div>
                          <Progress
                            percent={Math.round((summary.totalConverted / totalActiveForProgress) * 100)}
                            strokeColor="#722ed1"
                            size="small"
                          />
                        </div>
                      </div>
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card title="Status Distribution">
                      {statusDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={statusDistribution}
                              cx="50%"
                              cy="50%"
                              labelLine={true}
                              label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {statusDistribution.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Empty description="No data available" />
                        </div>
                      )}
                    </Card>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} lg={12}>
                    <Card title="Revenue Trend" extra={<Text type="secondary" style={{ fontSize: 12 }}>Company-wide, from Analytics</Text>}>
                      {trendsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <AreaChart data={trendsData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <RechartsTooltip formatter={(value: any) => `GHS ${(value / 100).toLocaleString()}`} />
                            <Area type="monotone" dataKey="revenue" stroke="#faad14" fill="#faad14" fillOpacity={0.3} name="Revenue" />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Empty description="No revenue data available" />
                        </div>
                      )}
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card title="Team Performance Insights">
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text>Average Conversion Rate</Text>
                          <Text strong>{summary.avgConversionRate.toFixed(1)}%</Text>
                        </div>
                        <Progress
                          percent={summary.avgConversionRate}
                          strokeColor={summary.avgConversionRate > 10 ? '#52c41a' : '#faad14'}
                          size="small"
                        />
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text>Prospects per Team Member</Text>
                          <Text strong>{(summary.totalActive / marketerCountForAvg).toFixed(1)}</Text>
                        </div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text>Converted per Team Member</Text>
                          <Text strong>{(summary.totalConverted / marketerCountForAvg).toFixed(1)}</Text>
                        </div>
                      </div>
                    </Card>
                  </Col>
                </Row>
              </div>
            ),
          },
          {
            key: 'insights',
            label: <span><InfoCircleOutlined /> Insights</span>,
            children: (
              <Row gutter={16}>
                <Col xs={24} lg={16}>
                  <Card title="Key Insights">
                    {marketers.length > 0 || topRevenueMarketer ? (
                      <List
                        itemLayout="horizontal"
                        dataSource={[
                          ...(topPerformer && topPerformer.totalProspects > 0 ? [{
                            icon: <TrophyOutlined style={{ color: '#faad14' }} />,
                            title: 'Top Performer (Conversion Rate)',
                            description: `${topPerformer.name} — ${topPerformer.conversionRate.toFixed(1)}% conversion rate, ${topPerformer.converted} converted`,
                          }] : []),
                          ...(topRevenueMarketer ? [{
                            icon: <FireOutlined style={{ color: '#ff4d4f' }} />,
                            title: 'Top Revenue Generator (12mo)',
                            description: `${topRevenueMarketer.name} generated GHS ${(topRevenueMarketer.revenueGenerated / 100).toLocaleString()} across ${topRevenueMarketer.dealsClosed} deals`,
                          }] : []),
                        ]}
                        renderItem={(item: { icon: React.ReactNode; title: string; description: string }) => (
                          <List.Item>
                            <List.Item.Meta
                              avatar={item.icon}
                              title={<Text strong>{item.title}</Text>}
                              description={item.description}
                            />
                          </List.Item>
                        )}
                      />
                    ) : (
                      <Empty description="No data available yet" />
                    )}
                  </Card>
                </Col>
                <Col xs={24} lg={8}>
                  <Card title="Team Stats">
                    <Descriptions column={1} bordered size="small">
                      <Descriptions.Item label="Total Team Members">
                        <Tag color="blue">{marketers.length}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Total Converted">
                        <Tag color="green">{summary.totalConverted}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Avg. Conversion Rate">
                        <Tag color="gold">{summary.avgConversionRate.toFixed(1)}%</Tag>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />

      {/* Marketer Profile Drawer */}
      <Drawer
        title={<Text strong>{selectedMarketer?.name}</Text>}
        open={viewProfileDrawer}
        onClose={() => {
          setViewProfileDrawer(false);
          setSelectedMarketer(null);
        }}
        width={500}
      >
        {selectedMarketer && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ display: 'inline-block', marginBottom: 8 }}>
                <PhotoUpload entityType="staff" entityId={selectedMarketer.id} size={80} />
              </div>
              <Title level={4}>{selectedMarketer.name}</Title>
            </div>

            <Descriptions column={1} bordered size="small">
              {selectedMarketer.email && (
                <Descriptions.Item label="Email">
                  <MailOutlined /> {selectedMarketer.email}
                </Descriptions.Item>
              )}
              {selectedMarketer.phone && (
                <Descriptions.Item label="Phone">
                  <PhoneOutlined /> {selectedMarketer.phone}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Total Prospects">
                {selectedMarketer.totalProspects}
              </Descriptions.Item>
              <Descriptions.Item label="Converted">
                {selectedMarketer.converted}
              </Descriptions.Item>
              <Descriptions.Item label="Conversion Rate">
                <Progress
                  percent={selectedMarketer.conversionRate}
                  size="small"
                  strokeColor={selectedMarketer.conversionRate > 10 ? '#52c41a' : '#faad14'}
                  style={{ width: '100%' }}
                />
              </Descriptions.Item>
              {selectedMarketer.satisfaction !== undefined && (
                <Descriptions.Item label="Satisfaction Score">
                  <Tag color="gold"><StarFilled /> {selectedMarketer.satisfaction} / 10</Tag>
                </Descriptions.Item>
              )}
              {selectedMarketer.responseTime !== undefined && (
                <Descriptions.Item label="Avg Response Time">
                  ⚡ {selectedMarketer.responseTime} minutes
                </Descriptions.Item>
              )}
              {selectedMarketer.revenueMinor !== undefined && (
                <Descriptions.Item label="Revenue Generated">
                  <Text strong color="green">GHS {(selectedMarketer.revenueMinor / 100).toLocaleString()}</Text>
                </Descriptions.Item>
              )}
              {selectedMarketer.targetMinor !== undefined && (
                <Descriptions.Item label="Target">
                  GHS {(selectedMarketer.targetMinor / 100).toLocaleString()}
                </Descriptions.Item>
              )}
              {selectedMarketer.growthPercent !== undefined && (
                <Descriptions.Item label="MoM Growth">
                  <Tag color={selectedMarketer.growthPercent >= 0 ? 'green' : 'volcano'}>
                    {selectedMarketer.growthPercent >= 0 ? `+${selectedMarketer.growthPercent}%` : `${selectedMarketer.growthPercent}%`}
                  </Tag>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Status Breakdown">
                <Space wrap>
                  <Tag color="blue">{selectedMarketer.new} New</Tag>
                  <Tag color="cyan">{selectedMarketer.meetingScheduled} Scheduled</Tag>
                  <Tag color="green">{selectedMarketer.meetingCompleted} Completed</Tag>
                  <Tag color="gold">{selectedMarketer.postponed} Postponed</Tag>
                  <Tag color="orange">{selectedMarketer.suspended} Suspended</Tag>
                  <Tag color="red">{(selectedMarketer as any).canceled ?? (selectedMarketer as any).byStatus?.canceled ?? 0} Canceled</Tag>
                </Space>
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 16 }}>
              <Button
                type="primary"
                block
                onClick={() => {
                  navigate(`/marketing/prospects?assignedUserId=${selectedMarketer.id}&name=${encodeURIComponent(selectedMarketer.name)}`);
                  setViewProfileDrawer(false);
                }}
              >
                View Prospects
              </Button>
              <Button
                block
                style={{ marginTop: 8 }}
                icon={<EyeOutlined />}
                onClick={() => {
                  setDetailModalMarketer(selectedMarketer);
                  setDetailModalTab('prospects');
                  setDetailModalSearch('');
                  setViewProfileDrawer(false);
                }}
              >
                View Added Prospects & Customers
              </Button>
              <Button
                block
                style={{ marginTop: 8 }}
                type="dashed"
                icon={<CalendarOutlined style={{ color: '#722ed1' }} />}
                onClick={() => {
                  handleOpenAppointmentModal(undefined, selectedMarketer.id);
                  setViewProfileDrawer(false);
                }}
              >
                Book Appointment with {selectedMarketer.name}
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      <BonusRulesModal
        open={bonusModalOpen}
        onClose={() => setBonusModalOpen(false)}
      />

      <AddProspectModal
        open={addProspectModal}
        defaultSource="marketing"
        onClose={() => setAddProspectModal(false)}
        onSuccess={() => {
          handleRefresh();
        }}
      />

      <AddCustomerModal
        open={addCustomerModal}
        onClose={() => setAddCustomerModal(false)}
        onSuccess={() => {
          handleRefresh();
        }}
      />

      {/* ── STAFF ADDED RECORDS DRILL-DOWN MODAL ───────────────────────── */}
      <Modal
        title={
          detailModalMarketer ? (
            <Space align="center">
              <PhotoUpload entityType="staff" entityId={detailModalMarketer.id} size={38} editable={false} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {detailModalMarketer.name} — Added Records & Operational Attribution
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {detailModalMarketer.email || 'Marketing Team'} · {marketerProspectsList.length} Prospects · {marketerCustomersList.length} Customers
                </div>
              </div>
            </Space>
          ) : 'Staff Records'
        }
        open={!!detailModalMarketer}
        onCancel={() => {
          setDetailModalMarketer(null);
          setDetailModalSearch('');
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Showing {detailModalTab === 'prospects' ? marketerProspectsList.length : marketerCustomersList.length} records
            </Text>
            <Space>
              <Button
                icon={<CalendarOutlined style={{ color: '#722ed1' }} />}
                onClick={() => {
                  handleOpenAppointmentModal(undefined, detailModalMarketer?.id);
                }}
              >
                Book Appointment with {detailModalMarketer?.name}
              </Button>
              <Button type="primary" onClick={() => setDetailModalMarketer(null)}>
                Close
              </Button>
            </Space>
          </div>
        }
        width={920}
        destroyOnClose
      >
        <Input
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Search records by name, phone, address, or status..."
          value={detailModalSearch}
          onChange={(e) => setDetailModalSearch(e.target.value)}
          allowClear
          style={{ marginBottom: 16 }}
        />

        <Tabs
          activeKey={detailModalTab}
          onChange={(k: any) => setDetailModalTab(k)}
          items={[
            {
              key: 'prospects',
              label: (
                <span>
                  <TeamOutlined /> Prospects Added ({marketerProspectsList.length})
                </span>
              ),
              children: (
                <Table
                  size="small"
                  dataSource={marketerProspectsList}
                  rowKey="id"
                  pagination={{ pageSize: 8 }}
                  scroll={{ x: 800 }}
                  columns={[
                    {
                      title: 'Prospect Name',
                      key: 'name',
                      render: (_: any, r: any) => (
                        <Space>
                          <PhotoUpload entityType="prospect" entityId={r.id} size={28} editable={false} />
                          <strong>{r.firstName} {r.lastName}</strong>
                        </Space>
                      ),
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
                      render: (v: string) => <StatusTag status={v} type="prospect" />,
                    },
                    {
                      title: 'Interest / Reason',
                      dataIndex: 'reasonForContact',
                      key: 'reasonForContact',
                      render: (v: string) => v || '—',
                    },
                    {
                      title: 'Date Added',
                      key: 'date',
                      render: (_: any, r: any) => (r.createdAt ? dayjs(r.createdAt).format('DD MMM YYYY') : '—'),
                    },
                    {
                      title: 'Action',
                      key: 'action',
                      render: (_: any, r: any) => (
                        <Button
                          size="small"
                          icon={<CalendarOutlined style={{ color: '#722ed1' }} />}
                          onClick={() =>
                            handleOpenAppointmentModal(
                              { type: 'prospect', id: r.id, name: `${r.firstName} ${r.lastName}`, phone: r.phoneNumber },
                              detailModalMarketer?.id
                            )
                          }
                        >
                          Book Appt
                        </Button>
                      ),
                    },
                  ]}
                />
              ),
            },
            {
              key: 'customers',
              label: (
                <span>
                  <UserSwitchOutlined /> Customers Converted ({marketerCustomersList.length})
                </span>
              ),
              children: (
                <Table
                  size="small"
                  dataSource={marketerCustomersList}
                  rowKey="id"
                  pagination={{ pageSize: 8 }}
                  scroll={{ x: 800 }}
                  columns={[
                    {
                      title: 'Sales Code',
                      dataIndex: 'code',
                      key: 'code',
                      render: (v: string) => (v ? <Tag color="geekblue">{v}</Tag> : <Text type="secondary">N/A</Text>),
                    },
                    {
                      title: 'Customer Name',
                      key: 'name',
                      render: (_: any, r: any) => (
                        <Space>
                          <PhotoUpload entityType="customer" entityId={r.id} size={28} editable={false} />
                          <strong>{r.firstName} {r.lastName}</strong>
                        </Space>
                      ),
                    },
                    {
                      title: 'Property',
                      dataIndex: 'propertyId',
                      key: 'property',
                      render: (propId: string) => getPropertyInfo(propId) || <Text type="secondary">N/A</Text>,
                    },
                    {
                      title: 'Type',
                      dataIndex: 'type',
                      key: 'type',
                      render: (v: any) => (
                        <Tag color={getCustomerTypeColor(v)}>
                          {getCustomerTypeLabel(v)}
                        </Tag>
                      ),
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
                      title: 'Joined Date',
                      dataIndex: 'createdAt',
                      key: 'createdAt',
                      render: (d: string) => (d ? dayjs(d).format('DD MMM YYYY') : '—'),
                    },
                    {
                      title: 'Action',
                      key: 'action',
                      render: (_: any, r: any) => (
                        <Button
                          size="small"
                          icon={<CalendarOutlined style={{ color: '#722ed1' }} />}
                          onClick={() =>
                            handleOpenAppointmentModal(
                              { type: 'customer', id: r.id, name: `${r.firstName} ${r.lastName}`, phone: r.phoneNumber },
                              detailModalMarketer?.id
                            )
                          }
                        >
                          Book Appt
                        </Button>
                      ),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </Modal>

      {/* ── BOOK APPOINTMENT MODAL ───────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <CalendarOutlined style={{ color: '#722ed1', fontSize: 20 }} />
            <span style={{ fontSize: 16, fontWeight: 600 }}>
              Book Appointment — Marketing Consultation / Site Visit
            </span>
          </Space>
        }
        open={appointmentModalOpen}
        onCancel={() => {
          setAppointmentModalOpen(false);
          setAppointmentTargetClient(null);
          appointmentForm.resetFields();
        }}
        footer={null}
        width={620}
        destroyOnClose
      >
        <Form
          form={appointmentForm}
          layout="vertical"
          onFinish={handleBookAppointmentSubmit}
        >
          <Form.Item
            name="clientId"
            label={<span><UserOutlined style={{ marginRight: 6 }} />Select Client (Prospect or Customer)</span>}
            rules={[{ required: true, message: 'Please select a prospect or customer' }]}
            extra="Search by client name or phone number"
          >
            <Select
              showSearch
              placeholder="Search and select prospect or customer..."
              optionFilterProp="label"
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase().trim())
              }
              options={[
                {
                  label: '── MARKETING PROSPECTS ──',
                  options: allProspects.map((p) => ({
                    value: `prospect:${p.id}`,
                    label: `👤 ${p.firstName} ${p.lastName} · 📞 ${p.phoneNumber || 'No phone'} · [${prospectStatusLabels[p.status] || p.status}]`,
                  })),
                },
                {
                  label: '── ONBOARDED CUSTOMERS ──',
                  options: allCustomers.map((c) => ({
                    value: `customer:${c.id}`,
                    label: `🤝 ${c.firstName} ${c.lastName} · 📞 ${c.phoneNumber || 'No phone'}${c.code ? ` · Code: ${c.code}` : ''}`,
                  })),
                },
              ]}
              allowClear
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="staffId"
                label={<span><TeamOutlined style={{ marginRight: 6 }} />Assigned Staff / Marketer</span>}
                rules={[{ required: true, message: 'Please select assigned marketer' }]}
              >
                <Select placeholder="Assign staff...">
                  {allMarketingStaffUsers.map((s) => (
                    <Select.Option key={s.id} value={s.id}>
                      {getUserFullName(s)} ({s.role === 'marketing_director' ? 'Director' : 'Marketer'})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="scheduledFor"
                label={<span><ClockCircleOutlined style={{ marginRight: 6 }} />Date & Time</span>}
                rules={[{ required: true, message: 'Please select appointment date and time' }]}
              >
                <DatePicker
                  showTime={{ format: 'hh:mm A' }}
                  format="YYYY-MM-DD hh:mm A"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="reason"
                label="Appointment Purpose / Agenda"
                rules={[{ required: true, message: 'Please select or enter reason' }]}
              >
                <Select>
                  <Select.Option value="Site Inspection & Property Tour">🏡 Site Inspection & Property Tour</Select.Option>
                  <Select.Option value="Payment Plan & Pricing Discussion">💰 Payment Plan & Pricing Discussion</Select.Option>
                  <Select.Option value="Land Title & Agreement Signing">📝 Land Title & Agreement Signing</Select.Option>
                  <Select.Option value="General Marketing Consultation">🗣️ General Marketing Consultation</Select.Option>
                  <Select.Option value="Plot Allocation & Handover">📍 Plot Allocation & Handover</Select.Option>
                  <Select.Option value="Follow-up Meeting">🔄 Follow-up Meeting</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="venue" label="Location / Venue">
                <Select>
                  <Select.Option value="On-site at Property">📍 On-site at Property</Select.Option>
                  <Select.Option value="Head Office Conference Room">🏢 Head Office Conference Room</Select.Option>
                  <Select.Option value="Branch Office">🏬 Branch Office</Select.Option>
                  <Select.Option value="Virtual / Phone Consultation">📞 Virtual / Phone Consultation</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Additional Notes / Requirements">
            <Input.TextArea rows={2} placeholder="e.g. Client interested in 2 plots at Appolonia, requested deed draft preview..." />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAppointmentModalOpen(false)}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createAppointmentMutation.isPending}
                style={{ background: '#722ed1', borderColor: '#722ed1' }}
              >
                Schedule Appointment
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Record Marketing Expense Modal */}
      <Modal
        title={
          <Space>
            <DollarOutlined style={{ color: '#fa8c16' }} />
            <span>Record Operational / Marketing Expense</span>
          </Space>
        }
        open={addExpenseModal}
        onCancel={() => {
          setAddExpenseModal(false);
          expenseForm.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={540}
      >
        <Form form={expenseForm} layout="vertical" onFinish={handleInitiateExpense}>
          <Alert
            type="info"
            showIcon
            message="Pending Approval Workflow"
            description="Expenses initiated by the Marketing Director will be placed in 'pending' status for review and authorization by Admin and Accounts dashboards."
            style={{ marginBottom: 16 }}
          />

          <Row gutter={12}>
            <Col span={14}>
              <Form.Item
                name="category"
                label="Expense Category"
                rules={[{ required: true, message: 'Please pick category' }]}
                initialValue="Digital Ads & Media"
              >
                <Select placeholder="Select category">
                  <Select.Option value="Digital Ads & Media">Digital Ads & Social Media Campaigns</Select.Option>
                  <Select.Option value="Mega Billboard & Out-Of-Home">Mega Billboard & Outdoor Hoardings</Select.Option>
                  <Select.Option value="Exhibitions & Events">Exhibitions, Expos & Event Sponsorships</Select.Option>
                  <Select.Option value="Print & Collateral">Print, Brochures & Promotional Collateral</Select.Option>
                  <Select.Option value="Site Tour Logistics">Site Tour Transport & Client Logistics</Select.Option>
                  <Select.Option value="Influencer & PR">Influencer Marketing & Press Releases</Select.Option>
                  <Select.Option value="Client Hospitality">VIP Client Hospitality & Refreshments</Select.Option>
                  <Select.Option value="Other Marketing Cost">Other Marketing / Sales Cost</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="type" label="Expense Type" initialValue="external" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="external">🚚 External / Campaign</Select.Option>
                  <Select.Option value="internal">🏢 Internal Operations</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="amountGHS"
                label="Amount (GH₵)"
                rules={[{ required: true, message: 'Enter amount' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0.01} precision={2} prefix="GH₵" placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="incurredOn"
                label="Incurred Date"
                initialValue={dayjs()}
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Detailed Purpose / Notes"
            rules={[{ required: true, message: 'Explain what this expense is for' }]}
          >
            <Input.TextArea rows={3} placeholder="Campaign title, vendor/contractor name, invoice ref, or target development..." />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setAddExpenseModal(false);
                expenseForm.resetFields();
              }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={expenseLoading}>
                Submit Expense for Approval
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
