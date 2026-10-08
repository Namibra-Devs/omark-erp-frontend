// src/pages/marketing/ProspectsPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Button, Space, Modal, Form, Input, Select, Row, Col, Table, 
  Tag, message, Typography, Card, Spin, Popconfirm, Tooltip, 
  Alert, Statistic, Badge, Dropdown, DatePicker, Drawer, Descriptions, 
  Timeline, Radio, Divider, Empty, Avatar 
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  DollarOutlined,
  CloseOutlined,
  FlagFilled,
  UserOutlined,
  PhoneOutlined,
  HomeOutlined,
  DownOutlined,
  SettingOutlined,
  TrophyOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  UserSwitchOutlined,
  ExportOutlined,
  ReloadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  CodeOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  StarFilled,
  GlobalOutlined,
  EnvironmentOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import { tokens } from '@/constants/tokens';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import { StatusTag } from '@/components/shared/StatusTag';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConvertProspectModal } from '@/components/shared/ConvertProspectModal';
import { LogInteractionModal } from '@/components/shared/LogInteractionModal';
import { PhotoUpload, PendingPhotoUpload } from '@/components/shared/PhotoUpload';
import { prospectStatusLabels, prospectSourceLabels, interactionChannelLabels } from '@/constants/enums';
import type { Prospect, ProspectStatus } from '@/types';
import {
  useProspectsQuery,
  useCreateProspectMutation,
  useUpdateProspectMutation,
  useDeleteProspectMutation,
  useInteractionsQuery,
  getStoredProspects,
  prospectKeys,
} from '@/api/prospects';
import { useCustomersQuery } from '@/api/customers';
import {
  appointmentsKeys,
  useAppointmentsQuery,
  useCreateAppointmentMutation,
  useUpdateAppointmentMutation,
} from '@/api/appointments';
import { useQueryClient } from '@tanstack/react-query';
import { useUsersQuery, getUserFullName } from '@/api/users';
import { useBranchesQuery } from '@/api/branches';
import { filterEntitiesByBranch, tagPayloadWithBranch } from '@/utils/branchIsolation';
import { isProspectAssignedOrCreatedByStaff } from '@/utils/prospectAssignment';
import {
  createDuplicatePhoneRule,
  createDuplicateNameRule,
  assertNoProspectDuplicates,
} from '@/utils/duplicateValidation';
import { useAwardBonusMutation, useStaffBonusesQuery } from '@/api/bonuses';
import { markSeen } from '@/utils/seenTracker';
import { BonusRulesModal } from '@/components/bonus/BonusRulesModal';

const { Option } = Select;
const { TextArea } = Input;
const { Text, Title } = Typography;



export const ProspectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, hasRole } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<'marketing' | 'all' | 'customer_service'>('marketing');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('all');
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editModal, setEditModal] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [convertModal, setConvertModal] = useState(false);
  const [prospectToConvert, setProspectToConvert] = useState<Prospect | null>(null);
  const [bookAppointmentModal, setBookAppointmentModal] = useState(false);
  const [appointmentTargetProspect, setAppointmentTargetProspect] = useState<Prospect | null>(null);
  const [appointmentForm] = Form.useForm();
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [logInteractionModal, setLogInteractionModal] = useState(false);

  // Export states
  const [exportModal, setExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv' | 'pdf' | 'json'>('excel');
  const [exportLoading, setExportLoading] = useState(false);

  const queryClient = useQueryClient();
  const createAppointment = useCreateAppointmentMutation();
  const updateAppointmentMutation = useUpdateAppointmentMutation();
  const { data: userBonuses = [] } = useStaffBonusesQuery(user?.id);
  const userBonusTotal = (userBonuses as any[]).reduce((sum: number, b: any) => sum + (b.amountGHS || 0), 0);

  // Drill-down from the Director Overview's per-marketer table ("View
  // Prospects") lands here with these params — apply them as a filter
  // instead of silently showing everyone's prospects.
  const assignedUserIdFilter = searchParams.get('assignedUserId') || undefined;
  const assignedUserName = searchParams.get('name') || undefined;

  const clearAssignedFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('assignedUserId');
    next.delete('name');
    setSearchParams(next);
  };

  // Multi-source live queries: All prospects, Marketing-specific, and Customer Service (CS) prospects
  const { data: allProspectsData, isLoading: allLoading, refetch: refetchAll } = useProspectsQuery({ pageSize: 10000 });
  const { data: mktProspectsData, isLoading: mktLoading, refetch: refetchMkt } = useProspectsQuery({ source: 'marketing', pageSize: 10000 });
  const { data: csProspectsData, isLoading: csLoading, refetch: refetchCs } = useProspectsQuery({ source: 'customer_service', pageSize: 10000 });
  const isLoading = allLoading || mktLoading || csLoading;

  const refetch = React.useCallback(() => {
    return Promise.all([refetchAll(), refetchMkt(), refetchCs()]);
  }, [refetchAll, refetchMkt, refetchCs]);

  // Consolidate full live prospects pool from all endpoints & storage without omitting records
  const allExistingProspects = useMemo(() => {
    const prospectMap = new Map<string, Prospect>();
    (allProspectsData?.items || []).forEach((p) => prospectMap.set(p.id, p));
    (mktProspectsData?.items || []).forEach((p) => prospectMap.set(p.id, p));
    (csProspectsData?.items || []).forEach((p) => prospectMap.set(p.id, p));
    getStoredProspects().forEach((p) => {
      if (!prospectMap.has(p.id)) prospectMap.set(p.id, p);
    });
    return Array.from(prospectMap.values());
  }, [allProspectsData, mktProspectsData, csProspectsData]);

  const { data: customersData } = useCustomersQuery({ pageSize: 10000 });
  const allExistingCustomers = customersData?.items ?? [];

  // Source breakdown counts
  const isMarketingStaff = user?.role === 'marketing_staff';
  const isMarketingRole = user?.role === 'marketing_director' || isMarketingStaff;
  const effectiveSource = isMarketingRole ? 'marketing' : sourceFilter;

  // Helper to determine if a prospect belongs to a marketing staff member (assigned or created)
  const isProspectAssignedOrAddedByStaff = (p: Prospect, staffId: string, staffName?: string): boolean => {
    return isProspectAssignedOrCreatedByStaff(p, { id: staffId, name: staffName });
  };

  const csProspectCount = useMemo(() => {
    const fromList = allExistingProspects.filter((p) => p.source === 'customer_service').length;
    return Math.max(fromList, csProspectsData?.total ?? 0);
  }, [allExistingProspects, csProspectsData?.total]);

  // Reset to page 1 whenever a filter changes, so a new, smaller result set
  // doesn't strand the user on a page that no longer exists.
  useEffect(() => {
    setPage(1);
  }, [searchText, statusFilter, sourceFilter, assignedUserIdFilter, dateFilter, customDateRange]);

  // Opening this page clears the "new prospects" nav badge (see NavMenu.tsx).
  useEffect(() => {
    if (user?.id) {
      markSeen('prospects', user.id);
    }
  }, [user?.id, allExistingProspects.length]);

  const createProspectMutation = useCreateProspectMutation();
  const updateProspectMutation = useUpdateProspectMutation();
  const deleteProspectMutation = useDeleteProspectMutation();

  // Only admins can set assignedUserId at creation (per the API), and only
  // admins need to pick — marketing_staff creating their own prospects
  // should just self-assign, matching how the field is hidden for them below.
  const isAdmin = hasRole(['admin', 'marketing_director']);
  const { data: usersData } = useUsersQuery({ pageSize: 500 });
  const allStaff = usersData?.items ?? [];
  const marketingStaff = allStaff.filter(
    (u) => u.role === 'marketing_staff' || u.role === 'marketing_director'
  );

  const { data: branches = [] } = useBranchesQuery();

  // Appointments Query to track due dates
  const { data: appointmentsData, refetch: refetchAppointments } = useAppointmentsQuery({ pageSize: 500 });
  const appointments = appointmentsData?.items ?? [];

  useEffect(() => {
    const handleAptsChanged = () => refetchAppointments();
    window.addEventListener('omark-appointments-changed', handleAptsChanged);
    return () => window.removeEventListener('omark-appointments-changed', handleAptsChanged);
  }, [refetchAppointments]);

  // Drawer Selected Prospect Interactions Query
  const {
    data: selectedProspectInteractions,
    isLoading: interactionsLoading,
    refetch: refetchInteractions,
  } = useInteractionsQuery(selectedProspect?.id ?? '');

  // Appointments for the selected prospect in the drawer
  const selectedProspectAppointments = useMemo(() => {
    if (!selectedProspect?.id) return [];
    return appointments.filter((a) => a.prospectId === selectedProspect.id);
  }, [appointments, selectedProspect?.id]);

  // Real-time selected prospect sync (so changes from edits or status updates immediately reflect in the drawer)
  const activeDrawerProspect = useMemo(() => {
    if (!selectedProspect) return null;
    return allExistingProspects.find((p) => p.id === selectedProspect.id) || selectedProspect;
  }, [allExistingProspects, selectedProspect]);

  useEffect(() => {
    const handleProspectsChanged = () => refetch();
    window.addEventListener('omark-prospects-changed', handleProspectsChanged);
    return () => window.removeEventListener('omark-prospects-changed', handleProspectsChanged);
  }, [refetch]);

  // Due appointments map - completed, canceled or no_show appointments NEVER create due flags
  const dueProspectMap = useMemo(() => {
    const map: Record<string, any> = {};
    const endOfToday = dayjs().endOf('day');

    appointments.forEach((apt) => {
      if (!apt.prospectId) return;
      const statusLower = String(apt.status || '').toLowerCase();
      if (statusLower === 'completed' || statusLower === 'canceled' || statusLower === 'no_show') return;
      const isScheduled = statusLower === 'scheduled' || statusLower === 'postponed';
      if (!isScheduled) return;

      const aptTime = dayjs(apt.scheduledFor);
      if (aptTime.isBefore(endOfToday)) {
        if (!map[apt.prospectId] || aptTime.isBefore(dayjs(map[apt.prospectId].scheduledFor))) {
          map[apt.prospectId] = apt;
        }
      }
    });

    return map;
  }, [appointments]);

  // Full marketing prospects list across all pages for status breakdown calculation
  const allMarketingProspects = useMemo(() => {
    let list = allExistingProspects;
    if (effectiveSource === 'marketing') {
      list = list.filter((p) => p.source === 'marketing' || !p.source);
    } else if (effectiveSource === 'customer_service') {
      list = list.filter((p) => p.source === 'customer_service');
    }
    // If 'all', keep full combined dataset

    // For marketing staff: ONLY show prospects that were added by or assigned to that respective staff
    if (isMarketingStaff && user?.id) {
      list = list.filter((p) => isProspectAssignedOrCreatedByStaff(p, user));
    } else if (assignedUserIdFilter) {
      const targetStaff = allStaff.find((u) => u.id === assignedUserIdFilter) || {
        id: assignedUserIdFilter,
        name: assignedUserName,
      };
      list = list.filter((p) => isProspectAssignedOrCreatedByStaff(p, targetStaff));
    }
    const filterUser = assignedUserIdFilter
      ? (allStaff.find((u) => u.id === assignedUserIdFilter) || user)
      : user;
    return filterEntitiesByBranch(list, filterUser, branches);
  }, [allExistingProspects, effectiveSource, isMarketingStaff, user, branches, assignedUserIdFilter, assignedUserName, allStaff]);

  const marketingProspectCount = useMemo(() => {
    if (isMarketingStaff) {
      return allMarketingProspects.length;
    }
    const fromList = allExistingProspects.filter((p) => p.source === 'marketing' || !p.source).length;
    return Math.max(fromList, mktProspectsData?.total ?? 0);
  }, [allExistingProspects, mktProspectsData?.total, isMarketingStaff, allMarketingProspects.length]);

  const totalProspectCount = useMemo(() => {
    return isMarketingStaff ? allMarketingProspects.length : (marketingProspectCount + csProspectCount);
  }, [isMarketingStaff, allMarketingProspects.length, marketingProspectCount, csProspectCount]);

  const statusBreakdown = useMemo(() => {
    return {
      total: allMarketingProspects.length,
      new: allMarketingProspects.filter((p) => p.status === 'new').length,
      meetingScheduled: allMarketingProspects.filter((p) => p.status === 'meeting_scheduled').length,
      meetingCompleted: allMarketingProspects.filter((p) => p.status === 'meeting_completed').length,
      purchased: allMarketingProspects.filter((p) => p.status === 'purchased').length,
      canceled: allMarketingProspects.filter((p) => {
        const s = String(p.status || '').toLowerCase();
        return s === 'canceled' || s === 'cancelled';
      }).length,
    };
  }, [allMarketingProspects]);

  // Date-wise, Status, and Search filtering + PRIORITY SORTING (Due appointments climb to top)
  const filteredMarketingProspects = useMemo(() => {
    let list = allMarketingProspects;

    // Status filter - supports both 'canceled' and 'cancelled'
    if (statusFilter && statusFilter !== 'all') {
      list = list.filter((p) => {
        const s = String(p.status || '').toLowerCase();
        if (statusFilter === 'canceled') {
          return s === 'canceled' || s === 'cancelled';
        }
        return s === statusFilter.toLowerCase();
      });
    }

    // Search filter
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter(
        (p) =>
          `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase().includes(q) ||
          (p.phoneNumber || '').toLowerCase().includes(q) ||
          (p.address || '').toLowerCase().includes(q) ||
          (p.status || '').toLowerCase().includes(q) ||
          (p.reasonForContact || '').toLowerCase().includes(q)
      );
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = dayjs();
      list = list.filter((p) => {
        if (!p.createdAt) return true;
        const created = dayjs(p.createdAt);
        if (dateFilter === 'today') {
          return created.isSame(now, 'day');
        }
        if (dateFilter === 'weekly') {
          return created.isSame(now, 'week');
        }
        if (dateFilter === 'monthly') {
          return created.isSame(now, 'month');
        }
        if (dateFilter === 'yearly') {
          return created.isSame(now, 'year');
        }
        if (dateFilter === 'custom' && customDateRange && customDateRange[0] && customDateRange[1]) {
          return (
            (created.isAfter(customDateRange[0].startOf('day')) || created.isSame(customDateRange[0].startOf('day'))) &&
            (created.isBefore(customDateRange[1].endOf('day')) || created.isSame(customDateRange[1].endOf('day')))
          );
        }
        return true;
      });
    }

    // Sort: Due appointments climb to the top! Completed/attended prospects do not climb
    return [...list].sort((a, b) => {
      const aIsDone =
        a.status === 'meeting_completed' ||
        a.status === 'purchased' ||
        a.status === 'canceled' ||
        (a.status as string) === 'cancelled';
      const bIsDone =
        b.status === 'meeting_completed' ||
        b.status === 'purchased' ||
        b.status === 'canceled' ||
        (b.status as string) === 'cancelled';

      const aDue = aIsDone ? null : dueProspectMap[a.id];
      const bDue = bIsDone ? null : dueProspectMap[b.id];

      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;
      if (aDue && bDue) {
        return dayjs(aDue.scheduledFor).valueOf() - dayjs(bDue.scheduledFor).valueOf();
      }
      return dayjs(b.createdAt || 0).valueOf() - dayjs(a.createdAt || 0).valueOf();
    });
  }, [allMarketingProspects, statusFilter, sourceFilter, searchText, dateFilter, customDateRange, dueProspectMap]);

  const handleAddProspect = async (values: any) => {
    try {
      // Hard pre-submission rejection guard
      assertNoProspectDuplicates(
        {
          firstName: values.firstName,
          lastName: values.lastName,
          phoneNumber: values.phoneNumber,
        },
        { existingProspects: allExistingProspects, existingCustomers: allExistingCustomers }
      );

      // `photo` isn't a real prospect field — POST /prospects would reject
      // it, so pull it out before spreading the rest into the payload.
      const { photo, ...prospectValues } = values;
      const newProspect = await createProspectMutation.mutateAsync(
        tagPayloadWithBranch(
          {
            ...prospectValues,
            source: 'marketing',
            assignedUserId: values.assignedUserId || user?.id,
            createdByUserId: user?.id,
            createdByName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : undefined,
          },
          user
        )
      );
      setIsModalOpen(false);
      form.resetFields();
      message.success('Prospect added successfully!');
    } catch (err: any) {
      console.error('Failed to add prospect:', err);
      message.error(err.error?.message || 'Failed to add prospect. Please try again.');
    }
  };

  const handleEditClick = (record: Prospect) => {
    setEditingProspect(record);
    editForm.setFieldsValue({
      firstName: record.firstName,
      lastName: record.lastName,
      address: record.address,
      phoneNumber: record.phoneNumber,
      status: (record.status as string) === 'cancelled' ? 'canceled' : record.status,
      reasonForContact: record.reasonForContact,
      notes: record.notes,
      assignedUserId: record.assignedUserId || (record as any).assignedStaffId,
    });
    setEditModal(true);
  };

  const handleAssignStaffToProspect = async (prospectId: string, staffId: string) => {
    try {
      const assignedStaff = allStaff.find((u) => u.id === staffId);
      const staffName = assignedStaff ? getUserFullName(assignedStaff) : 'Staff Member';
      await updateProspectMutation.mutateAsync({
        id: prospectId,
        data: {
          assignedUserId: staffId,
        },
      });
      message.success(`Prospect successfully assigned to ${staffName}!`);
      refetch();
    } catch (err: any) {
      message.error(err?.message || 'Failed to assign prospect to staff');
    }
  };

  const handleOpenBookAppointment = (target?: Prospect | null) => {
    if (target) {
      setAppointmentTargetProspect(target);
      appointmentForm.resetFields();
      appointmentForm.setFieldsValue({
        prospectId: target.id,
        staffId: target.assignedUserId || user?.id,
        scheduledFor: dayjs().add(1, 'day').set('hour', 10).set('minute', 0),
        reason: 'Site Inspection & Property Viewing',
        source: 'marketing',
      });
    } else {
      setAppointmentTargetProspect(null);
      appointmentForm.resetFields();
      appointmentForm.setFieldsValue({
        staffId: user?.id,
        scheduledFor: dayjs().add(1, 'day').set('hour', 10).set('minute', 0),
        reason: 'Site Inspection & Property Viewing',
        source: 'marketing',
      });
    }
    setBookAppointmentModal(true);
  };

  const handleExport = () => {
    setExportLoading(true);
    setTimeout(() => {
      const dataToExport = filteredMarketingProspects.map((p) => ({
        'Full Name': `${p.firstName} ${p.lastName}`,
        'Phone': p.phoneNumber,
        'Address': p.address || '',
        'Status': prospectStatusLabels[p.status as keyof typeof prospectStatusLabels] || p.status,
        'Source': prospectSourceLabels[p.source as keyof typeof prospectSourceLabels] || p.source || 'Marketing',
        'Reason': p.reasonForContact || '',
        'Notes': p.notes || '',
        'Created': dayjs(p.createdAt).format('YYYY-MM-DD HH:mm'),
        'Updated': dayjs(p.updatedAt).format('YYYY-MM-DD HH:mm'),
      }));

      let fileName = `marketing-prospects-${dayjs().format('YYYY-MM-DD-HHmmss')}`;
      let blob: Blob;

      switch (exportFormat) {
        case 'json':
          blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
          fileName += '.json';
          break;
        case 'csv': {
          const headers = Object.keys(dataToExport[0] || {});
          const csvRows = [
            headers.join(','),
            ...dataToExport.map((row) =>
              headers
                .map((header) => {
                  const value = row[header as keyof typeof row] || '';
                  return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
                })
                .join(',')
            ),
          ];
          blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
          fileName += '.csv';
          break;
        }
        case 'excel': {
          const headers = Object.keys(dataToExport[0] || {});
          const excelRows = [
            headers.join('\t'),
            ...dataToExport.map((row) =>
              headers
                .map((header) => {
                  const value = row[header as keyof typeof row] || '';
                  return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
                })
                .join('\t')
            ),
          ];
          blob = new Blob([excelRows.join('\n')], { type: 'application/vnd.ms-excel' });
          fileName += '.xls';
          break;
        }
        case 'pdf': {
          const pdfContent = dataToExport
            .map((row) => Object.entries(row).map(([key, value]) => `${key}: ${value}`).join('\n'))
            .join('\n\n---\n\n');
          blob = new Blob([pdfContent], { type: 'application/pdf' });
          fileName += '.txt';
          break;
        }
        default:
          blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
          fileName += '.json';
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportLoading(false);
      setExportModal(false);
      message.success(`Prospects exported as ${exportFormat.toUpperCase()}!`);
    }, 500);
  };

  const handleEditProspect = async (values: any) => {
    if (!editingProspect) return;
    try {
      // Hard pre-submission rejection guard
      assertNoProspectDuplicates(
        {
          firstName: values.firstName,
          lastName: values.lastName,
          phoneNumber: values.phoneNumber,
          excludeId: editingProspect.id,
        },
        { existingProspects: allExistingProspects, existingCustomers: allExistingCustomers }
      );

      await updateProspectMutation.mutateAsync({
        id: editingProspect.id,
        data: {
          firstName: values.firstName,
          lastName: values.lastName,
          address: values.address,
          phoneNumber: values.phoneNumber,
          status: values.status,
          reasonForContact: values.reasonForContact,
          notes: values.notes,
          assignedUserId: values.assignedUserId,
        },
      });
      message.success('Prospect updated successfully!');
      if (selectedProspect && selectedProspect.id === editingProspect.id) {
        setSelectedProspect((prev) => (prev ? { ...prev, ...values } : null));
      }
      setEditModal(false);
      setEditingProspect(null);
      editForm.resetFields();
      refetch();
    } catch (err: any) {
      message.error(err?.message || 'Failed to update prospect');
    }
  };

  const handleDeleteProspect = async (id: string) => {
    try {
      await deleteProspectMutation.mutateAsync(id);
      if (selectedProspect?.id === id) {
        setViewDrawerOpen(false);
        setSelectedProspect(null);
      }
      message.success('Prospect deleted successfully!');
      refetch();
    } catch (err: any) {
      message.error(err?.message || 'Failed to delete prospect');
    }
  };

  const handleStatusChange = async (id: string, newStatus: ProspectStatus) => {
    try {
      await updateProspectMutation.mutateAsync({ id, data: { status: newStatus } });

      if (selectedProspect && selectedProspect.id === id) {
        setSelectedProspect((prev) => (prev ? { ...prev, status: newStatus } : null));
      }

      // If prospect marked completed or purchased, mark any linked active appointments completed so flags disappear
      if (newStatus === 'meeting_completed' || newStatus === 'purchased') {
        const linkedApts = appointments.filter(
          (a) => a.prospectId === id && (a.status === 'scheduled' || a.status === 'postponed')
        );
        for (const apt of linkedApts) {
          try {
            await updateAppointmentMutation.mutateAsync({
              id: apt.id,
              payload: {
                status: 'completed',
                feedback: `Marked attended/completed when prospect status was set to ${prospectStatusLabels[newStatus] || newStatus}`,
              },
            });
          } catch (e) {
            console.warn('Could not auto-complete appointment:', e);
          }
        }
        window.dispatchEvent(new Event('omark-appointments-changed'));
      }

      window.dispatchEvent(new Event('omark-prospects-changed'));
      message.success(`Status updated to ${prospectStatusLabels[newStatus] || newStatus}`);
      refetch();
    } catch (err: any) {
      message.error(err?.message || 'Failed to update status');
    }
  };

  const columns = [
    {
      title: 'Customer',
      key: 'customer',
      width: 250,
      render: (_: any, record: Prospect) => {
        // Due flag disappears when prospect is attended to / completed
        const isAttendedOrCompleted =
          record.status === 'meeting_completed' ||
          record.status === 'purchased' ||
          record.status === 'canceled' ||
          (record.status as string) === 'cancelled';
        const dueApt = isAttendedOrCompleted ? null : dueProspectMap[record.id];

        let dueTag = null;
        if (dueApt) {
          const aptTime = dayjs(dueApt.scheduledFor);
          const isOverdue = aptTime.isBefore(dayjs().startOf('day')) || aptTime.isBefore(dayjs());
          if (isOverdue) {
            const daysAgo = dayjs().startOf('day').diff(aptTime.startOf('day'), 'day');
            const overdueLabel = daysAgo > 0 ? `OVERDUE (${daysAgo}d ago)` : 'OVERDUE (Time Passed)';
            dueTag = (
              <Tooltip
                title={`⚠️ APPOINTMENT OVERDUE: Scheduled for ${aptTime.format('MMM D, YYYY h:mm A')} (${aptTime.fromNow()}). Reason: ${dueApt.reason || 'Client follow-up'}`}
              >
                <Tag
                  color="error"
                  icon={<FlagFilled style={{ color: '#ff4d4f' }} />}
                  style={{
                    margin: 0,
                    fontWeight: 700,
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    border: '1px solid #ffa39e',
                    background: '#fff1f0',
                    color: '#cf1322',
                    boxShadow: '0 0 5px rgba(255, 77, 79, 0.3)',
                  }}
                >
                  {overdueLabel}
                </Tag>
              </Tooltip>
            );
          } else {
            dueTag = (
              <Tooltip
                title={`⏰ APPOINTMENT DUE TODAY: Scheduled for ${aptTime.format('h:mm A')}. Reason: ${dueApt.reason || 'Client follow-up'}`}
              >
                <Tag
                  color="warning"
                  icon={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
                  style={{
                    margin: 0,
                    fontWeight: 700,
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    border: '1px solid #ffe58f',
                    background: '#fffbe6',
                    color: '#d46b08',
                    boxShadow: '0 0 5px rgba(250, 140, 22, 0.25)',
                  }}
                >
                  DUE TODAY ({aptTime.format('h:mm A')})
                </Tag>
              </Tooltip>
            );
          }
        }

        return (
          <Space align="start">
            <PhotoUpload entityType="prospect" entityId={record.id} size={32} editable={false} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <Text strong>{record.firstName} {record.lastName}</Text>
                {dueTag}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <PhoneOutlined /> {record.phoneNumber}
              </Text>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Address',
      dataIndex: 'address',
      key: 'address',
      width: 180,
      ellipsis: true,
      render: (address: string) => (
        <Tooltip title={address}>
          <HomeOutlined style={{ marginRight: 6, color: '#8c8c8c' }} />
          {address || '—'}
        </Tooltip>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status: string) => <StatusTag status={status} type="prospect" />,
    },
    {
      title: 'Reason',
      dataIndex: 'reasonForContact',
      key: 'reasonForContact',
      width: 180,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <Text>{text || '—'}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 130,
      render: (source: string) => (
        <Tag color={source === 'customer_service' ? 'green' : 'blue'}>
          {prospectSourceLabels[source as keyof typeof prospectSourceLabels] || source || 'Marketing'}
        </Tag>
      ),
    },
    {
      title: 'Added By',
      key: 'addedBy',
      width: 190,
      render: (_: any, record: Prospect) => {
        const creatorId = record.createdByUserId || record.assignedUserId;
        const staff = allStaff.find(
          (u) => u.id === creatorId || (record.createdByUserId && u.id === record.createdByUserId)
        );
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
          marketing_staff: { label: 'Marketing', color: 'blue' },
          customer_service: { label: 'Customer Service', color: 'green' },
          secretary: { label: 'Secretary', color: 'cyan' },
          branch_manager: { label: 'Branch Manager', color: 'geekblue' },
          accounts: { label: 'Accounts', color: 'orange' },
        };
        const roleInfo = roleConfig[staff.role] || { label: staff.role, color: 'blue' };
        return (
          <Tooltip title={`Added on ${record.createdAt ? dayjs(record.createdAt).format('MMM D, YYYY h:mm A') : 'System record'}`}>
            <Space size={6}>
              <PhotoUpload entityType="staff" entityId={staff.id} size={24} editable={false} />
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
      title: 'Assigned Staff',
      key: 'assignedStaff',
      width: 210,
      render: (_: any, record: Prospect) => {
        const assignedId = record.assignedUserId || (record as any).assignedStaffId;
        const staff = allStaff.find((u) => u.id === assignedId);
        return (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            {staff ? (
              <Space size={6}>
                <PhotoUpload entityType="staff" entityId={staff.id} size={24} editable={false} />
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
            ) : (
              <Tag color="orange" icon={<UserSwitchOutlined />} style={{ fontSize: 10, borderRadius: 4 }}>
                Unassigned (Needs Staff)
              </Tag>
            )}
            {isAdmin && (
              <Select
                size="small"
                placeholder="Assign staff..."
                value={assignedId || undefined}
                style={{ width: '100%', maxWidth: 175, marginTop: 2 }}
                onChange={(newStaffId) => handleAssignStaffToProspect(record.id, newStaffId)}
                onClick={(e) => e.stopPropagation()}
                showSearch
                optionFilterProp="children"
              >
                {marketingStaff.map((s) => (
                  <Select.Option key={s.id} value={s.id}>
                    {getUserFullName(s)} ({s.role === 'marketing_director' ? 'Director' : 'Marketer'})
                  </Select.Option>
                ))}
              </Select>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Last Activity',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 130,
      render: (date: string) => (
        <Tooltip title={dayjs(date).format('MMMM DD, YYYY')}>
          {dayjs(date).fromNow()}
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 250,
      fixed: 'right' as any,
      render: (_: any, record: Prospect) => (
        <Space size={6} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Book Appointment">
            <Button
              icon={<CalendarOutlined style={{ color: '#001529' }} />}
              onClick={() => handleOpenBookAppointment(record)}
              size="small"
            />
          </Tooltip>
          <Tooltip title="View Details">
            <Button
              type="primary"
              ghost
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedProspect(record);
                setViewDrawerOpen(true);
              }}
              size="small"
            />
          </Tooltip>
          <Tooltip title="Edit Prospect">
            <Button
              icon={<EditOutlined />}
              onClick={() => handleEditClick(record)}
              size="small"
            />
          </Tooltip>
          {record.status !== 'purchased' && (
            <Tooltip title="Convert to Customer">
              <Button
                type="primary"
                icon={<DollarOutlined />}
                onClick={() => {
                  setProspectToConvert(record);
                  setConvertModal(true);
                }}
                size="small"
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
              />
            </Tooltip>
          )}
          <Tooltip title="Quick Status Change">
            <Dropdown
              menu={{
                items: [
                  { key: 'new', label: 'New', onClick: () => handleStatusChange(record.id, 'new') },
                  { key: 'meeting_scheduled', label: 'Meeting Scheduled', onClick: () => handleStatusChange(record.id, 'meeting_scheduled') },
                  { key: 'meeting_completed', label: 'Meeting Completed', onClick: () => handleStatusChange(record.id, 'meeting_completed') },
                  { key: 'suspended', label: 'Suspended', onClick: () => handleStatusChange(record.id, 'suspended') },
                  { key: 'postponed', label: 'Postponed', onClick: () => handleStatusChange(record.id, 'postponed') },
                  { key: 'canceled', label: 'Canceled', onClick: () => handleStatusChange(record.id, 'canceled') },
                ],
              }}
              trigger={['click']}
            >
              <Button icon={<ClockCircleOutlined />} size="small" />
            </Dropdown>
          </Tooltip>
          {hasRole(['admin']) && (
            <Popconfirm
              title="Delete Prospect"
              description={`Are you sure you want to delete ${record.firstName} ${record.lastName}? This also removes its interactions and appointments.`}
              onConfirm={() => handleDeleteProspect(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Tooltip title="Delete (admin only)">
                <Button danger icon={<DeleteOutlined />} size="small" />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // ── Drawer Content ──────────────────────────────────────────────────────
  const renderDrawerContent = () => {
    if (!activeDrawerProspect) return null;

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'new': return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
        case 'meeting_scheduled': return <CalendarOutlined style={{ color: '#faad14' }} />;
        case 'meeting_completed': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
        case 'suspended': return <WarningOutlined style={{ color: '#ff4d4f' }} />;
        case 'postponed': return <ClockCircleOutlined style={{ color: '#faad14' }} />;
        case 'canceled': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
        case 'purchased': return <StarFilled style={{ color: '#722ed1' }} />;
        default: return <UserOutlined />;
      }
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'new': return '#1890ff';
        case 'meeting_scheduled': return '#faad14';
        case 'meeting_completed': return '#52c41a';
        case 'suspended': return '#ff4d4f';
        case 'postponed': return '#faad14';
        case 'canceled': return '#ff4d4f';
        case 'purchased': return '#722ed1';
        default: return '#d9d9d9';
      }
    };

    const assignedStaffMember = allStaff.find(
      (u) => u.id === (activeDrawerProspect.assignedUserId || (activeDrawerProspect as any).assignedStaffId)
    );

    return (
      <div style={{ height: '100%' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: '1px solid #f0f0f0'
        }}>
          <Space>
            <Avatar 
              size={48} 
              icon={<UserOutlined />} 
              style={{ backgroundColor: tokens.primary }}
            />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {activeDrawerProspect.firstName} {activeDrawerProspect.lastName}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <IdcardOutlined /> ID: {activeDrawerProspect.id}
              </Text>
            </div>
          </Space>
          <Button 
            type="text" 
            icon={<CloseOutlined />} 
            onClick={() => setViewDrawerOpen(false)}
            style={{ fontSize: 18 }}
          />
        </div>

        {/* Status Banner */}
        <div style={{
          background: `${getStatusColor(activeDrawerProspect.status)}10`,
          border: `1px solid ${getStatusColor(activeDrawerProspect.status)}`,
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Space>
            {getStatusIcon(activeDrawerProspect.status)}
            <Text strong>Status: {prospectStatusLabels[activeDrawerProspect.status as keyof typeof prospectStatusLabels] || activeDrawerProspect.status}</Text>
          </Space>
          <Badge 
            status={activeDrawerProspect.status === 'purchased' ? 'success' : 'default'}
            text={activeDrawerProspect.status === 'purchased' ? 'Active' : 'Inactive'}
          />
        </div>

        {/* Quick Actions */}
        <div style={{ marginBottom: 24 }}>
          <Space wrap>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => {
                setViewDrawerOpen(false);
                handleEditClick(activeDrawerProspect);
              }}
            >
              Edit Prospect
            </Button>
            {activeDrawerProspect.status !== 'purchased' && (
              <Button
                icon={<DollarOutlined />}
                style={{ background: '#52c41a', borderColor: '#52c41a', color: '#fff' }}
                onClick={() => {
                  setViewDrawerOpen(false);
                  setProspectToConvert(activeDrawerProspect);
                  setConvertModal(true);
                }}
              >
                Convert to Customer
              </Button>
            )}
            <Button
              icon={<PlusOutlined />}
              onClick={() => setLogInteractionModal(true)}
            >
              Log Interaction
            </Button>
            <Button
              icon={<CalendarOutlined />}
              onClick={() => handleOpenBookAppointment(activeDrawerProspect)}
              style={{ background: '#001529', borderColor: '#001529', color: '#fff' }}
              className="btn-blue-black"
            >
              Book Appointment
            </Button>
          </Space>
        </div>

        {/* Main Info Cards */}
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card size="small" title="Personal Information" bordered={false} style={{ background: '#fafafa' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label={<Space><UserOutlined /> Full Name</Space>}>
                  <Text strong>{activeDrawerProspect.firstName} {activeDrawerProspect.lastName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Space><PhoneOutlined /> Phone</Space>}>
                  <a href={`tel:${activeDrawerProspect.phoneNumber}`}>
                    {activeDrawerProspect.phoneNumber}
                  </a>
                </Descriptions.Item>
                <Descriptions.Item label={<Space><EnvironmentOutlined /> Address</Space>}>
                  {activeDrawerProspect.address || '—'}
                </Descriptions.Item>
                <Descriptions.Item label={<Space><GlobalOutlined /> Source</Space>}>
                  <Tag color={activeDrawerProspect.source === 'customer_service' ? 'green' : 'blue'}>
                    {prospectSourceLabels[activeDrawerProspect.source as keyof typeof prospectSourceLabels] || activeDrawerProspect.source || 'Marketing'}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {/* Contact Details */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="Contact Details" bordered={false} style={{ background: '#fafafa' }}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Assigned To">
                  {assignedStaffMember ? (
                    <Tag color="blue">{getUserFullName(assignedStaffMember)}</Tag>
                  ) : (
                    <Tag color="orange">Unassigned</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Created">
                  {dayjs(activeDrawerProspect.createdAt).format('MMMM DD, YYYY')}
                </Descriptions.Item>
                <Descriptions.Item label="Last Updated" span={2}>
                  {dayjs(activeDrawerProspect.updatedAt).format('MMMM DD, YYYY')}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {/* Reason & Notes */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="Reason for Contact" bordered={false} style={{ background: '#fafafa' }}>
              <Text>{activeDrawerProspect.reasonForContact || '—'}</Text>
            </Card>
          </Col>
        </Row>

        {activeDrawerProspect.notes && (
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={24}>
              <Card size="small" title="Notes" bordered={false} style={{ background: '#fafafa' }}>
                <Text>{activeDrawerProspect.notes}</Text>
              </Card>
            </Col>
          </Row>
        )}

        {/* Interactions */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card
              size="small"
              title="Conversation Log"
              bordered={false}
              style={{ background: '#fafafa' }}
              extra={
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => setLogInteractionModal(true)}
                >
                  Log Interaction
                </Button>
              }
            >
              {interactionsLoading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <Spin size="small" />
                </div>
              ) : selectedProspectInteractions && selectedProspectInteractions.length > 0 ? (
                <Timeline>
                  {selectedProspectInteractions.map((interaction) => (
                    <Timeline.Item key={interaction.id} color="blue">
                      <Text strong>
                        {interactionChannelLabels[interaction.channel as keyof typeof interactionChannelLabels] || interaction.channel}
                      </Text>
                      <br />
                      <Text>{interaction.response}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(interaction.occurredAt).format('MMM DD, YYYY HH:mm')} ({dayjs(interaction.occurredAt).fromNow()})
                      </Text>
                    </Timeline.Item>
                  ))}
                </Timeline>
              ) : (
                <Empty
                  description="No interactions logged yet"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </Card>
          </Col>
        </Row>

        {/* ── APPOINTMENTS & MEETINGS SECTION ──────────────────────────────── */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card
              size="small"
              title={
                <Space>
                  <CalendarOutlined style={{ color: '#1890ff' }} />
                  <span>Scheduled Appointments & Follow-ups ({selectedProspectAppointments.length})</span>
                </Space>
              }
              bordered={false}
              style={{ background: '#fafafa' }}
              extra={
                <Button
                  type="primary"
                  size="small"
                  icon={<CalendarOutlined />}
                  onClick={() => handleOpenBookAppointment(activeDrawerProspect)}
                  style={{ background: '#001529', borderColor: '#001529', color: '#fff' }}
                  className="btn-blue-black"
                >
                  Book Appointment
                </Button>
              }
            >
              {selectedProspectAppointments.length > 0 ? (
                <Timeline style={{ marginTop: 8 }}>
                  {selectedProspectAppointments.map((apt) => {
                    const isDue =
                      String(apt.status || '').toLowerCase() === 'scheduled' &&
                      dayjs(apt.scheduledFor).isBefore(dayjs().endOf('day'));
                    return (
                      <Timeline.Item
                        key={apt.id}
                        color={apt.status === 'completed' ? 'green' : isDue ? 'red' : 'blue'}
                        dot={isDue ? <FlagFilled style={{ color: '#ff4d4f', fontSize: 14 }} /> : undefined}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <Space size={6} wrap>
                              <Text strong style={{ fontSize: 13 }}>
                                {dayjs(apt.scheduledFor).format('ddd, MMM D, YYYY · h:mm A')}
                              </Text>
                              {isDue && (
                                <Tag
                                  color="red"
                                  style={{
                                    fontWeight: 700,
                                    fontSize: 10,
                                    padding: '0 5px',
                                    border: '1px solid #ffa39e',
                                    background: '#fff1f0',
                                    color: '#cf1322',
                                  }}
                                >
                                  🚩 DUE TODAY
                                </Tag>
                              )}
                              <Tag color={apt.status === 'completed' ? 'green' : apt.status === 'postponed' ? 'orange' : apt.status === 'canceled' ? 'default' : 'blue'}>
                                {String(apt.status || 'scheduled').toUpperCase()}
                              </Tag>
                            </Space>
                            <div style={{ marginTop: 4 }}>
                              <Text style={{ fontSize: 12 }}>{apt.reason || 'Client Consultation / Site Inspection'}</Text>
                            </div>
                          </div>
                        </div>
                      </Timeline.Item>
                    );
                  })}
                </Timeline>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <Empty
                    description="No appointments booked yet for this prospect"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  >
                    <Button
                      type="primary"
                      ghost
                      size="small"
                      icon={<CalendarOutlined />}
                      onClick={() => handleOpenBookAppointment(activeDrawerProspect)}
                    >
                      Schedule Follow-up Meeting
                    </Button>
                  </Empty>
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* Footer */}
        <div style={{ 
          marginTop: 24, 
          paddingTop: 16, 
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <Space>
            <Button 
              type="primary" 
              onClick={() => {
                setViewDrawerOpen(false);
                navigate(`/marketing/prospects/${activeDrawerProspect.id}`);
              }}
            >
              View Full Details
            </Button>
          </Space>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '100%', padding: '0 4px' }}>
      <style>{`
        .btn-blue-black {
          background-color: #001529 !important;
          border-color: #001529 !important;
          color: #ffffff !important;
        }
        .btn-blue-black:hover, .btn-blue-black:focus {
          background-color: #0c2742 !important;
          border-color: #0c2742 !important;
          color: #ffffff !important;
        }
      `}</style>
      <PageHeader
        title={isMarketingStaff ? 'My Marketing Prospects' : 'Marketing Prospects'}
        subtitle={isMarketingStaff ? 'Viewing prospects added by or assigned to you' : undefined}
        actions={[
          {
            label: 'Book Appointment',
            onClick: () => handleOpenBookAppointment(),
            icon: <CalendarOutlined />,
            style: { background: '#001529', borderColor: '#001529', color: '#fff' },
            className: 'btn-blue-black',
          },
          ...(hasRole(['admin'])
            ? [{
                label: 'Bonus Rules',
                onClick: () => setBonusModalOpen(true),
                icon: <SettingOutlined />,
              }]
            : userBonusTotal > 0
            ? [{
                label: `Earned Bonus: GH₵${userBonusTotal.toFixed(2)}`,
                onClick: () => navigate('/profile'),
                icon: <TrophyOutlined style={{ color: '#faad14' }} />,
              }]
            : []),
          {
            label: 'Add Prospect',
            onClick: () => setIsModalOpen(true),
            icon: <PlusOutlined />,
          },
          {
            label: 'Export',
            onClick: () => setExportModal(true),
            icon: <ExportOutlined />,
          },
          {
            label: 'Refresh',
            onClick: () => {
              refetch();
              message.success('Refreshed!');
            },
            icon: <ReloadOutlined />,
          },
        ]}
      />

      {assignedUserIdFilter && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Showing prospects assigned to ${assignedUserName || 'this marketer'}`}
          action={
            <Button size="small" type="text" icon={<CloseOutlined />} onClick={clearAssignedFilter}>
              Clear
            </Button>
          }
        />
      )}

      {/* Status Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8} md={4}>
          <Card
            size="small"
            hoverable
            onClick={() => setStatusFilter('all')}
            style={{
              cursor: 'pointer',
              borderColor: statusFilter === 'all' ? tokens.primary : undefined,
              boxShadow: statusFilter === 'all' ? `0 0 0 2px ${tokens.primary}20` : undefined,
            }}
          >
            <Statistic
              title="Total"
              value={statusBreakdown.total}
              prefix={<UserOutlined />}
              valueStyle={{ color: tokens.primary }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card
            size="small"
            hoverable
            onClick={() => setStatusFilter(statusFilter === 'new' ? 'all' : 'new')}
            style={{
              cursor: 'pointer',
              borderColor: statusFilter === 'new' ? '#1890ff' : undefined,
              boxShadow: statusFilter === 'new' ? '0 0 0 2px rgba(24,144,255,0.2)' : undefined,
            }}
          >
            <Statistic
              title="New"
              value={statusBreakdown.new}
              prefix={<Badge status="processing" />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card
            size="small"
            hoverable
            onClick={() => setStatusFilter(statusFilter === 'meeting_scheduled' ? 'all' : 'meeting_scheduled')}
            style={{
              cursor: 'pointer',
              borderColor: statusFilter === 'meeting_scheduled' ? '#faad14' : undefined,
              boxShadow: statusFilter === 'meeting_scheduled' ? '0 0 0 2px rgba(250,173,20,0.2)' : undefined,
            }}
          >
            <Statistic
              title="Meeting Scheduled"
              value={statusBreakdown.meetingScheduled}
              prefix={<Badge status="warning" />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card
            size="small"
            hoverable
            onClick={() => setStatusFilter(statusFilter === 'meeting_completed' ? 'all' : 'meeting_completed')}
            style={{
              cursor: 'pointer',
              borderColor: statusFilter === 'meeting_completed' ? '#52c41a' : undefined,
              boxShadow: statusFilter === 'meeting_completed' ? '0 0 0 2px rgba(82,196,26,0.2)' : undefined,
            }}
          >
            <Statistic
              title="Meeting Completed"
              value={statusBreakdown.meetingCompleted}
              prefix={<Badge status="success" />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card
            size="small"
            hoverable
            onClick={() => setStatusFilter(statusFilter === 'purchased' ? 'all' : 'purchased')}
            style={{
              cursor: 'pointer',
              borderColor: statusFilter === 'purchased' ? '#722ed1' : undefined,
              boxShadow: statusFilter === 'purchased' ? '0 0 0 2px rgba(114,46,209,0.2)' : undefined,
            }}
          >
            <Statistic
              title="Purchased"
              value={statusBreakdown.purchased}
              prefix={<Badge status="success" />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card
            size="small"
            hoverable
            onClick={() => setStatusFilter(statusFilter === 'canceled' ? 'all' : 'canceled')}
            style={{
              cursor: 'pointer',
              borderColor: statusFilter === 'canceled' ? '#ff4d4f' : undefined,
              boxShadow: statusFilter === 'canceled' ? '0 0 0 2px rgba(255,77,79,0.2)' : undefined,
            }}
          >
            <Statistic
              title="Canceled"
              value={statusBreakdown.canceled}
              prefix={<Badge status="error" />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters (Search, Source, Status, and Date-wise: Daily, Weekly, Monthly, Yearly, Custom) */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={5}>
            <Input
              placeholder="Search prospects..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="middle"
            />
          </Col>
          {!isMarketingRole && (
            <Col xs={24} sm={12} md={5}>
              <Select
                style={{ width: '100%' }}
                placeholder="Source"
                value={sourceFilter}
                onChange={setSourceFilter}
                size="middle"
                options={[
                  { value: 'marketing', label: `🎯 Marketing (${marketingProspectCount})` },
                  { value: 'all', label: `🌐 All Prospects (${totalProspectCount})` },
                  { value: 'customer_service', label: `🎧 Customer Service (${csProspectCount})` },
                ]}
              />
            </Col>
          )}
          <Col xs={24} sm={12} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Filter by status"
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
              size="middle"
            >
              <Option value="all">All Statuses</Option>
              <Option value="new">New</Option>
              <Option value="meeting_scheduled">Meeting Scheduled</Option>
              <Option value="meeting_completed">Meeting Completed</Option>
              <Option value="suspended">Suspended</Option>
              <Option value="postponed">Postponed</Option>
              <Option value="canceled">Canceled</Option>
              <Option value="purchased">Purchased</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Date Filter"
              value={dateFilter}
              onChange={(val) => {
                setDateFilter(val);
                if (val !== 'custom') setCustomDateRange(null);
              }}
              size="middle"
              prefix={<CalendarOutlined style={{ color: '#8c8c8c' }} />}
            >
              <Option value="all">📅 All Time</Option>
              <Option value="today">☀️ Daily (Today)</Option>
              <Option value="weekly">📆 Weekly (This Week)</Option>
              <Option value="monthly">🗓️ Monthly (This Month)</Option>
              <Option value="yearly">📊 Yearly (This Year)</Option>
              <Option value="custom">🎯 Custom Date Range</Option>
            </Select>
          </Col>
          {dateFilter === 'custom' && (
            <Col xs={24} sm={12} md={4}>
              <DatePicker.RangePicker
                style={{ width: '100%' }}
                value={customDateRange}
                onChange={(dates: any) => setCustomDateRange(dates)}
                format="YYYY-MM-DD"
              />
            </Col>
          )}
          <Col xs={24} sm={24} md={dateFilter === 'custom' ? 2 : 6}>
            <Text type="secondary" style={{ display: 'block', textAlign: 'right', fontWeight: 500 }}>
              Showing {filteredMarketingProspects.length} of {allMarketingProspects.length} prospects
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <Table
          columns={columns}
          dataSource={filteredMarketingProspects}
          rowKey="id"
          loading={isLoading}
          size="middle"
          scroll={{ x: 1000 }}
          pagination={{
            current: page,
            pageSize,
            total: filteredMarketingProspects.length,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100', '250'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} prospects`,
            responsive: true,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            },
          }}
          onRow={(record) => ({
            onClick: () => {
              setSelectedProspect(record);
              setViewDrawerOpen(true);
            },
            style: { cursor: 'pointer' },
          })}
        />
      </div>

      {/* Bonus Rules Configuration Modal (Admin only) */}
      <BonusRulesModal
        open={bonusModalOpen}
        onClose={() => setBonusModalOpen(false)}
      />

      {/* Add Prospect Modal */}
      <Modal
        title="Add New Prospect"
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px' }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddProspect}
        >
          <Form.Item name="photo" label="Photo" style={{ textAlign: 'center' }}>
            <PendingPhotoUpload size={72} />
          </Form.Item>

          <Row gutter={[8, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="firstName"
                label="First Name"
                rules={[
                  { required: true, message: 'First name is required' },
                  createDuplicateNameRule({
                    entityType: 'prospect',
                    isFirstName: true,
                    getOtherName: () => form.getFieldValue('lastName'),
                    getExistingProspects: () => allExistingProspects,
                    getExistingCustomers: () => allExistingCustomers,
                  }),
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="lastName"
                label="Last Name"
                rules={[
                  { required: true, message: 'Last name is required' },
                  createDuplicateNameRule({
                    entityType: 'prospect',
                    isFirstName: false,
                    getOtherName: () => form.getFieldValue('firstName'),
                    getExistingProspects: () => allExistingProspects,
                    getExistingCustomers: () => allExistingCustomers,
                  }),
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            name="address"
            label="Address"
            rules={[{ required: true, message: 'Address is required' }]}
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          
          <Form.Item
            name="phoneNumber"
            label="Phone Number"
            rules={[
              { required: true, message: 'Phone number is required' },
              createDuplicatePhoneRule({
                entityType: 'prospect',
                getExistingProspects: () => allExistingProspects,
                getExistingCustomers: () => allExistingCustomers,
              }),
            ]}
          >
            <PhoneInput />
          </Form.Item>

          {isAdmin && (
            <Form.Item
              name="assignedUserId"
              label="Assign To Marketer"
              rules={[{ required: true, message: 'Please choose which marketer this prospect belongs to' }]}
              extra="This can't be changed later — the API only accepts assignment at creation."
            >
              <Select placeholder="Select marketer" showSearch optionFilterProp="children">
                {marketingStaff.map((staff) => (
                  <Option key={staff.id} value={staff.id}>
                    {staff.firstName} {staff.lastName} ({staff.email})
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item
            name="reasonForContact"
            label="Reason for Contact"
            rules={[{ required: true, message: 'Reason for contact is required' }]}
          >
            <TextArea rows={3} />
          </Form.Item>
          
          <Form.Item
            name="notes"
            label="Additional Notes"
          >
            <TextArea rows={3} />
          </Form.Item>
          
          <Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit" loading={createProspectMutation.isPending}>
                Create Prospect
              </Button>
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Prospect Modal */}
      <Modal
        title="Edit Prospect"
        open={editModal}
        onCancel={() => {
          setEditModal(false);
          setEditingProspect(null);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px' }}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEditProspect}
        >
          {editingProspect && (
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <PhotoUpload entityType="prospect" entityId={editingProspect.id} size={72} />
            </div>
          )}

          <Row gutter={[8, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="firstName"
                label="First Name"
                rules={[
                  { required: true, message: 'First name is required' },
                  createDuplicateNameRule({
                    entityType: 'prospect',
                    isFirstName: true,
                    excludeId: editingProspect?.id,
                    getOtherName: () => editForm.getFieldValue('lastName'),
                    getExistingProspects: () => allExistingProspects,
                    getExistingCustomers: () => allExistingCustomers,
                  }),
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="lastName"
                label="Last Name"
                rules={[
                  { required: true, message: 'Last name is required' },
                  createDuplicateNameRule({
                    entityType: 'prospect',
                    isFirstName: false,
                    excludeId: editingProspect?.id,
                    getOtherName: () => editForm.getFieldValue('firstName'),
                    getExistingProspects: () => allExistingProspects,
                    getExistingCustomers: () => allExistingCustomers,
                  }),
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="address"
            label="Address"
            rules={[{ required: true, message: 'Address is required' }]}
          >
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item
            name="phoneNumber"
            label="Phone Number"
            rules={[
              { required: true, message: 'Phone number is required' },
              createDuplicatePhoneRule({
                entityType: 'prospect',
                excludeId: editingProspect?.id,
                getExistingProspects: () => allExistingProspects,
                getExistingCustomers: () => allExistingCustomers,
              }),
            ]}
          >
            <PhoneInput />
          </Form.Item>

          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Please select a status' }]}
          >
            <Select placeholder="Select status">
              <Option value="new">New</Option>
              <Option value="meeting_scheduled">Meeting Scheduled</Option>
              <Option value="meeting_completed">Meeting Completed</Option>
              <Option value="suspended">Suspended</Option>
              <Option value="postponed">Postponed</Option>
              <Option value="canceled">Canceled</Option>
              <Option value="purchased">Purchased</Option>
            </Select>
          </Form.Item>

          {isAdmin && (
            <Form.Item
              name="assignedUserId"
              label="Assigned Marketer / Staff"
              extra="Assign or reassign this prospect to a marketing staff member"
            >
              <Select placeholder="Select assigned marketer..." allowClear showSearch optionFilterProp="children">
                {marketingStaff.map((staff) => (
                  <Option key={staff.id} value={staff.id}>
                    {getUserFullName(staff)} ({staff.role === 'marketing_director' ? 'Director' : 'Marketer'})
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item
            name="reasonForContact"
            label="Reason for Contact"
          >
            <TextArea rows={3} />
          </Form.Item>

          <Form.Item
            name="notes"
            label="Additional Notes"
          >
            <TextArea rows={3} />
          </Form.Item>

          <Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit" loading={updateProspectMutation.isPending}>
                Save Changes
              </Button>
              <Button onClick={() => {
                setEditModal(false);
                setEditingProspect(null);
                editForm.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <ConvertProspectModal
        open={convertModal}
        prospect={prospectToConvert}
        onClose={() => {
          setConvertModal(false);
          setProspectToConvert(null);
        }}
      />

      {/* ── Book Appointment Modal ── */}
      <Modal
        title={
          <Space>
            <CalendarOutlined style={{ color: '#001529' }} />
            <Text strong>
              {appointmentTargetProspect
                ? `Book Appointment: ${appointmentTargetProspect.firstName} ${appointmentTargetProspect.lastName}`
                : 'Book Prospect Appointment'}
            </Text>
          </Space>
        }
        open={bookAppointmentModal}
        onCancel={() => {
          setBookAppointmentModal(false);
          setAppointmentTargetProspect(null);
          appointmentForm.resetFields();
        }}
        footer={null}
        width={560}
        style={{ top: 24, maxWidth: '95%' }}
        destroyOnClose
      >
        <Form
          form={appointmentForm}
          layout="vertical"
          onFinish={async (values) => {
            const targetId = values.prospectId || appointmentTargetProspect?.id;
            if (!targetId) {
              message.error('Please select a prospect for this appointment');
              return;
            }
            try {
              const reasonText = values.reason?.trim()
                ? `[${values.source || 'marketing'}] ${values.reason.trim()}`
                : `[${values.source || 'marketing'}] Site inspection and sales consultation`;

              await createAppointment.mutateAsync({
                prospectId: targetId,
                scheduledFor: values.scheduledFor.toISOString(),
                reason: reasonText,
              });
              queryClient.invalidateQueries({ queryKey: appointmentsKeys.all });
              window.dispatchEvent(new Event('omark-appointments-changed'));
              const target = allExistingProspects.find((p) => p.id === targetId) || appointmentTargetProspect;
              message.success(
                `Appointment booked successfully for ${target ? `${target.firstName} ${target.lastName}` : 'Prospect'} on ${dayjs(values.scheduledFor).format('MMM D, YYYY h:mm A')}!`
              );
              setBookAppointmentModal(false);
              setAppointmentTargetProspect(null);
              appointmentForm.resetFields();
              refetchAppointments();
            } catch (err: any) {
              message.error(err?.message || 'Failed to book appointment');
            }
          }}
          initialValues={{
            scheduledFor: dayjs().add(1, 'day').set('hour', 10).set('minute', 0),
            reason: 'Site Inspection & Property Viewing',
            source: 'marketing',
            staffId: user?.id,
          }}
        >
          <Form.Item
            name="prospectId"
            label={<span><UserOutlined style={{ marginRight: 6 }} />Select Prospect</span>}
            rules={[{ required: true, message: 'Please search and select a prospect' }]}
            extra={<Text type="secondary" style={{ fontSize: 11 }}>Choose from all prospects or type to search by name, phone, or address</Text>}
          >
            <Select
              showSearch
              placeholder="Type name, phone, or location to filter all prospects..."
              optionFilterProp="label"
              filterOption={(input, option) => {
                const text = String(option?.label ?? '').toLowerCase();
                return text.includes(input.toLowerCase().trim());
              }}
              onChange={(val) => {
                const chosen = allExistingProspects.find((p) => p.id === val);
                if (chosen) setAppointmentTargetProspect(chosen);
              }}
              options={allExistingProspects.map((p) => ({
                value: p.id,
                label: `${p.firstName} ${p.lastName} — ${p.phoneNumber || 'No phone'} (${p.address || 'No location'})`,
              }))}
            />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="staffId"
                label="Assigned Marketer / Staff"
                rules={[{ required: true, message: 'Please select staff' }]}
              >
                <Select>
                  {marketingStaff.map((s) => (
                    <Option key={s.id} value={s.id}>
                      {getUserFullName(s)} ({s.role === 'marketing_director' ? 'Director' : 'Marketer'})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="scheduledFor"
                label="Appointment Date & Time"
                rules={[{ required: true, message: 'Please pick date and time' }]}
              >
                <DatePicker
                  showTime={{ format: 'hh:mm A' }}
                  format="YYYY-MM-DD hh:mm A"
                  style={{ width: '100%' }}
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="reason" label="Agenda / Purpose" rules={[{ required: true, message: 'Please select agenda' }]}>
                <Select>
                  <Option value="Site Inspection & Property Viewing">🏡 Site Inspection & Property Viewing</Option>
                  <Option value="Payment Plan & Pricing Discussion">💰 Payment Plan & Pricing Discussion</Option>
                  <Option value="Land Title & Contract Discussion">📝 Land Title & Contract Discussion</Option>
                  <Option value="General Consultation">🗣️ General Consultation</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="source" label="Source" rules={[{ required: true }]}>
                <Select>
                  <Option value="marketing">Marketing</Option>
                  <Option value="office_walk_in">Office Walk-in</Option>
                  <Option value="referral">Referral</Option>
                  <Option value="website">Website / Social Media</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 16 }}>
            <Space>
              <Button onClick={() => {
                setBookAppointmentModal(false);
                setAppointmentTargetProspect(null);
                appointmentForm.resetFields();
              }}>
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createAppointment.isPending}
                icon={<CheckCircleOutlined />}
                style={{ background: '#001529', borderColor: '#001529', color: '#fff' }}
                className="btn-blue-black"
              >
                Confirm Appointment
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Premium Slide-in Drawer */}
      <Drawer
        title={null}
        placement="right"
        closable={false}
        onClose={() => setViewDrawerOpen(false)}
        open={viewDrawerOpen}
        width="50%"
        style={{ 
          padding: 0,
          boxShadow: '-4px 0 20px rgba(0,0,0,0.1)'
        }}
        bodyStyle={{ 
          padding: '24px',
          background: '#f5f7fa',
          overflowY: 'auto',
          height: '100%'
        }}
        maskStyle={{ background: 'rgba(0,0,0,0.3)' }}
        push={false}
      >
        {renderDrawerContent()}
      </Drawer>

      {/* Export Modal */}
      <Modal
        title={
          <Space>
            <ExportOutlined style={{ color: tokens.primary }} />
            <Text strong>Export Prospects</Text>
          </Space>
        }
        open={exportModal}
        onCancel={() => {
          setExportModal(false);
          setExportFormat('excel');
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setExportModal(false);
            setExportFormat('excel');
          }}>
            Cancel
          </Button>,
          <Button 
            key="export" 
            type="primary" 
            icon={<DownloadOutlined />}
            onClick={handleExport}
            loading={exportLoading}
          >
            Export {exportFormat.toUpperCase()}
          </Button>,
        ]}
        width={500}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px' }}
      >
        <Alert
          message={`${filteredMarketingProspects.length} prospects will be exported`}
          description="Select the file format you want to export your data in."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <div style={{ marginBottom: 16 }}>
          <Text strong>Select Export Format:</Text>
        </div>

        <Radio.Group 
          value={exportFormat} 
          onChange={(e) => setExportFormat(e.target.value)}
          style={{ width: '100%' }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Radio value="excel" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6 }}>
              <Space>
                <FileExcelOutlined style={{ color: '#217346', fontSize: 18 }} />
                <div>
                  <Text strong>Excel (.xls)</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>Best for data analysis and editing</Text>
                </div>
              </Space>
            </Radio>
            
            <Radio value="csv" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6 }}>
              <Space>
                <FileTextOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                <div>
                  <Text strong>CSV (.csv)</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>Compatible with most spreadsheet apps</Text>
                </div>
              </Space>
            </Radio>
            
            <Radio value="pdf" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6 }}>
              <Space>
                <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                <div>
                  <Text strong>PDF (.pdf)</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>For printing and sharing</Text>
                </div>
              </Space>
            </Radio>
            
            <Radio value="json" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6 }}>
              <Space>
                <CodeOutlined style={{ color: '#722ed1', fontSize: 18 }} />
                <div>
                  <Text strong>JSON (.json)</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>For developers and API integration</Text>
                </div>
              </Space>
            </Radio>
          </Space>
        </Radio.Group>

        <Divider />
        <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <InfoCircleOutlined /> The export will include all filtered prospects with their current status and details.
          </Text>
        </div>
      </Modal>

      {/* Log Interaction Modal */}
      <LogInteractionModal
        open={logInteractionModal}
        prospect={activeDrawerProspect}
        onClose={() => setLogInteractionModal(false)}
        onLogged={() => {
          refetchInteractions();
          refetchAppointments();
          refetch();
        }}
      />
    </div>
  );
};