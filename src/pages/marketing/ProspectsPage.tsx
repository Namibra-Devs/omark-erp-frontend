// src/pages/marketing/ProspectsPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Space, Modal, Form, Input, Select, Row, Col, Table, Tag, message, Typography, Card, Spin, Popconfirm, Tooltip, Alert, Statistic, Badge, Dropdown, DatePicker } from 'antd';
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
} from '@ant-design/icons';
import { tokens } from '@/constants/tokens';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import { StatusTag } from '@/components/shared/StatusTag';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConvertProspectModal } from '@/components/shared/ConvertProspectModal';
import { PhotoUpload, PendingPhotoUpload } from '@/components/shared/PhotoUpload';
import { prospectStatusLabels } from '@/constants/enums';
import type { Prospect, ProspectStatus } from '@/types';
import { useProspectsQuery, useCreateProspectMutation, useUpdateProspectMutation, useDeleteProspectMutation } from '@/api/prospects';
import { useCustomersQuery } from '@/api/customers';
import { useAppointmentsQuery, useCreateAppointmentMutation } from '@/api/appointments';
import { useUsersQuery, getUserFullName } from '@/api/users';
import { useBranchesQuery } from '@/api/branches';
import { filterEntitiesByBranch, tagPayloadWithBranch } from '@/utils/branchIsolation';
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
const { Text } = Typography;



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
  const createAppointment = useCreateAppointmentMutation();
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

  // Fetch all prospects (pageSize: 10000) for complete, robust marketing dataset
  const { data: allProspectsData, isLoading, refetch } = useProspectsQuery({ pageSize: 10000 });
  const allExistingProspects = allProspectsData?.items ?? [];
  const { data: customersData } = useCustomersQuery({ pageSize: 10000 });
  const allExistingCustomers = customersData?.items ?? [];

  // Reset to page 1 whenever a filter changes, so a new, smaller result set
  // doesn't strand the user on a page that no longer exists.
  useEffect(() => {
    setPage(1);
  }, [searchText, statusFilter, assignedUserIdFilter, dateFilter, customDateRange]);

  // Opening this page clears the "new prospects" nav badge (see NavMenu.tsx).
  useEffect(() => {
    if (user?.id) markSeen('prospects', user.id);
  }, [user?.id, allExistingProspects]);

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

  // Due appointments map
  const dueProspectMap = useMemo(() => {
    const map: Record<string, any> = {};
    const endOfToday = dayjs().endOf('day');

    appointments.forEach((apt) => {
      if (!apt.prospectId) return;
      const isScheduled = String(apt.status || '').toLowerCase() === 'scheduled';
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
    let list = allExistingProspects.filter((p) => p.source === 'marketing' || !p.source);
    if (assignedUserIdFilter) {
      list = list.filter((p) => p.assignedUserId === assignedUserIdFilter);
    }
    return filterEntitiesByBranch(list, user, branches);
  }, [allExistingProspects, assignedUserIdFilter, user, branches]);

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

    // Sort: Due appointments climb to the top!
    return [...list].sort((a, b) => {
      const aDue = dueProspectMap[a.id];
      const bDue = dueProspectMap[b.id];

      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;
      if (aDue && bDue) {
        return dayjs(aDue.scheduledFor).valueOf() - dayjs(bDue.scheduledFor).valueOf();
      }
      return dayjs(b.createdAt || 0).valueOf() - dayjs(a.createdAt || 0).valueOf();
    });
  }, [allMarketingProspects, statusFilter, searchText, dateFilter, customDateRange, dueProspectMap]);

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
            assignedUserId: isAdmin ? values.assignedUserId : user?.id,
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
    });
    setEditModal(true);
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
        },
      });
      message.success('Prospect updated successfully!');
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
      message.success('Prospect deleted successfully!');
      refetch();
    } catch (err: any) {
      message.error(err?.message || 'Failed to delete prospect');
    }
  };

  const handleStatusChange = async (id: string, newStatus: ProspectStatus) => {
    try {
      await updateProspectMutation.mutateAsync({ id, data: { status: newStatus } });
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
        const dueApt = dueProspectMap[record.id];
        return (
          <Space align="start">
            <PhotoUpload entityType="prospect" entityId={record.id} size={32} editable={false} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <Text strong>{record.firstName} {record.lastName}</Text>
                {dueApt && (
                  <Tooltip
                    title={`🚩 APPOINTMENT DUE: ${dayjs(dueApt.scheduledFor).format('MMM D, YYYY h:mm A')} (${dayjs(dueApt.scheduledFor).fromNow()}). Reason: ${dueApt.reason || 'Client follow-up'}`}
                  >
                    <Tag
                      color="red"
                      icon={<FlagFilled style={{ color: '#ff4d4f' }} />}
                      style={{
                        margin: 0,
                        fontWeight: 700,
                        fontSize: 10,
                        padding: '0 5px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        border: '1px solid #ffa39e',
                        background: '#fff1f0',
                        color: '#cf1322',
                      }}
                    >
                      DUE {dayjs(dueApt.scheduledFor).isBefore(dayjs().startOf('day')) ? 'OVERDUE' : dayjs(dueApt.scheduledFor).format('h:mm A')}
                    </Tag>
                  </Tooltip>
                )}
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
              icon={<CalendarOutlined style={{ color: '#722ed1' }} />}
              onClick={() => {
                setAppointmentTargetProspect(record);
                appointmentForm.resetFields();
                appointmentForm.setFieldsValue({
                  staffId: record.assignedUserId || user?.id,
                  scheduledFor: dayjs().add(1, 'day').set('hour', 10).set('minute', 0),
                  reason: 'Site Inspection & Property Viewing',
                  source: 'marketing',
                });
                setBookAppointmentModal(true);
              }}
              size="small"
              style={{ borderColor: '#d3adf7' }}
            />
          </Tooltip>
          <Tooltip title="View Details">
            <Button
              type="primary"
              ghost
              icon={<EyeOutlined />}
              onClick={() => navigate(`/marketing/prospects/${record.id}`)}
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
              <Button size="small">
                Status <DownOutlined style={{ fontSize: 10 }} />
              </Button>
            </Dropdown>
          </Tooltip>
          {hasRole(['admin']) && (
            <Popconfirm
              title="Delete Prospect"
              description={`Are you sure you want to delete ${record.firstName} ${record.lastName}?`}
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

  return (
    <div style={{ maxWidth: '100%', padding: '0 4px' }}>
      <PageHeader
        title="Marketing Prospects"
        actions={[
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
          // All staff members are granted permission to add new prospects
          {
            label: 'Add Prospect',
            onClick: () => setIsModalOpen(true),
            icon: <PlusOutlined />,
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

      {/* Filters (Search, Status, and Date-wise: Daily, Weekly, Monthly, Yearly, Custom) */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Search prospects..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="middle"
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
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
          <Col xs={24} sm={12} md={5}>
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
            <Col xs={24} sm={12} md={5}>
              <DatePicker.RangePicker
                style={{ width: '100%' }}
                value={customDateRange}
                onChange={(dates: any) => setCustomDateRange(dates)}
                format="YYYY-MM-DD"
              />
            </Col>
          )}
          <Col xs={24} sm={24} md={dateFilter === 'custom' ? 3 : 8}>
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
            onClick: () => navigate(`/marketing/prospects/${record.id}`),
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
            <CalendarOutlined style={{ color: '#722ed1', fontSize: 20 }} />
            <span>
              Book Appointment —{' '}
              {appointmentTargetProspect
                ? `${appointmentTargetProspect.firstName} ${appointmentTargetProspect.lastName}`
                : 'Prospect'}
            </span>
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
        destroyOnClose
      >
        <Form
          form={appointmentForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!appointmentTargetProspect) return;
            try {
              const reasonText = values.reason?.trim()
                ? `[${values.source || 'marketing'}] ${values.reason.trim()}`
                : `[${values.source || 'marketing'}] Site inspection and sales consultation`;

              await createAppointment.mutateAsync({
                prospectId: appointmentTargetProspect.id,
                scheduledFor: values.scheduledFor.toISOString(),
                reason: reasonText,
              });
              message.success(
                `Appointment booked successfully for ${appointmentTargetProspect.firstName} ${appointmentTargetProspect.lastName} on ${dayjs(values.scheduledFor).format('MMM D, YYYY h:mm A')}!`
              );
              setBookAppointmentModal(false);
              setAppointmentTargetProspect(null);
              appointmentForm.resetFields();
              refetchAppointments();
              window.dispatchEvent(new Event('omark-appointments-changed'));
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
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="reason" label="Agenda / Purpose" rules={[{ required: true }]}>
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

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setBookAppointmentModal(false)}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createAppointment.isPending}
                style={{ background: '#722ed1', borderColor: '#722ed1' }}
              >
                Schedule Appointment
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};