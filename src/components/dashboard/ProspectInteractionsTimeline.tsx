// src/components/dashboard/ProspectInteractionsTimeline.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Timeline,
  Typography,
  Tag,
  Space,
  Avatar,
  Input,
  Select,
  Button,
  Row,
  Col,
  Empty,
  Spin,
  Tooltip,
  Badge,
  Modal,
  Form,
  DatePicker,
  message,
  Popconfirm,
} from 'antd';
import {
  PhoneOutlined,
  MailOutlined,
  WhatsAppOutlined,
  UserOutlined,
  MessageOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ClockCircleOutlined,
  FilterOutlined,
  IdcardOutlined,
  HomeOutlined,
  CalendarOutlined,
  EyeOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAuth } from '@/contexts/AuthContext';
import { useAllStaffInteractionsQuery } from '@/api/interactions';
import { LogInteractionModal } from '@/components/shared/LogInteractionModal';
import { useCreateAppointmentMutation } from '@/api/appointments';
import { roleLabels, interactionChannelLabels } from '@/constants/enums';
import type { InteractionChannel, Prospect } from '@/types';
import { type StaffInteraction, saveStoredInteraction } from '@/utils/interactionStorage';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface ProspectInteractionsTimelineProps {
  title?: string;
  maxItems?: number;
  showFilters?: boolean;
  defaultStaffId?: string;
  style?: React.CSSProperties;
}

const CHANNEL_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; bg: string; border: string; label: string }
> = {
  call: {
    icon: <PhoneOutlined />,
    color: '#1677ff',
    bg: '#e6f4ff',
    border: '#91caff',
    label: 'Phone Call',
  },
  whatsapp: {
    icon: <WhatsAppOutlined />,
    color: '#52c41a',
    bg: '#f6ffed',
    border: '#b7eb8f',
    label: 'WhatsApp',
  },
  in_person: {
    icon: <HomeOutlined />,
    color: '#722ed1',
    bg: '#f9f0ff',
    border: '#d3adf7',
    label: 'In-Person Visit',
  },
  email: {
    icon: <MailOutlined />,
    color: '#faad14',
    bg: '#fffbe6',
    border: '#ffe58f',
    label: 'Email',
  },
  sms: {
    icon: <MessageOutlined />,
    color: '#13c2c2',
    bg: '#e6fffb',
    border: '#87e8de',
    label: 'SMS',
  },
  social_media: {
    icon: <UserOutlined />,
    color: '#eb2f96',
    bg: '#fff0f6',
    border: '#ffadd2',
    label: 'Social Media',
  },
  other: {
    icon: <HistoryOutlined />,
    color: '#8c8c8c',
    bg: '#f5f5f5',
    border: '#d9d9d9',
    label: 'Other',
  },
};

export const ProspectInteractionsTimeline: React.FC<ProspectInteractionsTimelineProps> = ({
  title = 'Staff Prospect Interactions Timeline',
  maxItems,
  showFilters = true,
  defaultStaffId,
  style,
}) => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { interactions, isLoading, refetch, prospects, deleteInteraction } = useAllStaffInteractionsQuery();

  const [selectedStaff, setSelectedStaff] = useState<string>(defaultStaffId || 'all');
  const [selectedProspect, setSelectedProspect] = useState<string>('all');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  
  // Modals for actions
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [targetFollowUpProspect, setTargetFollowUpProspect] = useState<Prospect | null>(null);
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [appointmentTarget, setAppointmentTarget] = useState<StaffInteraction | null>(null);
  const [appointmentForm] = Form.useForm();
  const createAppointmentMutation = useCreateAppointmentMutation();

  const handleDeleteInteraction = (id: string, prospectName?: string) => {
    deleteInteraction(id);
    message.success(`Interaction record for ${prospectName || 'prospect'} removed`);
    refetch();
  };

  // Auto-refresh every 30 seconds for live continuous tracking
  useEffect(() => {
    const timer = setInterval(() => {
      refetch();
    }, 30000);
    return () => clearInterval(timer);
  }, [refetch]);

  useEffect(() => {
    if (defaultStaffId) {
      setSelectedStaff(defaultStaffId);
    }
  }, [defaultStaffId]);

  // Extract unique staff members present in interactions
  const staffOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role?: string }>();
    interactions.forEach((item) => {
      const key = item.loggedByUserId || item.loggedByUserName || 'unknown';
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: item.loggedByUserName || 'Staff Member',
          role: item.loggedByUserRole,
        });
      }
    });
    return Array.from(map.values());
  }, [interactions]);

  // Extract unique prospects present in interactions
  const prospectOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    interactions.forEach((item) => {
      if (item.prospectId && !map.has(item.prospectId)) {
        map.set(item.prospectId, {
          id: item.prospectId,
          name: item.prospectName || 'Prospect',
        });
      }
    });
    return Array.from(map.values());
  }, [interactions]);

  // Filtered interactions
  const filteredInteractions = useMemo(() => {
    return interactions.filter((item) => {
      // Staff filter
      if (selectedStaff !== 'all') {
        const matchesUser =
          item.loggedByUserId === selectedStaff ||
          item.loggedByUserName?.toLowerCase() === selectedStaff.toLowerCase() ||
          (item as any).assignedUserId === selectedStaff;
        if (!matchesUser) return false;
      }

      // Prospect filter
      if (selectedProspect !== 'all' && item.prospectId !== selectedProspect) {
        return false;
      }

      // Channel filter
      if (selectedChannel !== 'all' && item.channel !== selectedChannel) {
        return false;
      }

      // Search text filter (prospect name, phone, response notes, staff name)
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        const matchesQuery =
          item.prospectName?.toLowerCase().includes(q) ||
          item.prospectPhone?.toLowerCase().includes(q) ||
          item.response?.toLowerCase().includes(q) ||
          item.loggedByUserName?.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [interactions, selectedStaff, selectedProspect, selectedChannel, searchText]);

  const displayedInteractions = maxItems
    ? filteredInteractions.slice(0, maxItems)
    : filteredInteractions;

  // Compute summary stats
  const stats = useMemo(() => {
    const total = interactions.length;
    const staffCount = staffOptions.length;
    const calls = interactions.filter((i) => i.channel === 'call').length;
    const whatsapp = interactions.filter((i) => i.channel === 'whatsapp').length;
    const inPerson = interactions.filter((i) => i.channel === 'in_person').length;
    const emails = interactions.filter((i) => i.channel === 'email').length;
    return { total, staffCount, calls, whatsapp, inPerson, emails };
  }, [interactions, staffOptions]);

  const handleCreateAppointment = async (values: any) => {
    if (!appointmentTarget) return;
    try {
      const res = await createAppointmentMutation.mutateAsync({
        prospectId: appointmentTarget.prospectId,
        scheduledFor: values.scheduledFor.toISOString(),
        reason: values.reason,
      });
      const createdApptId = (res as any)?.data?.id || (res as any)?.id;

      // Automatically record linked booking interaction in history
      saveStoredInteraction({
        id: `inter_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        prospectId: appointmentTarget.prospectId,
        prospectName: appointmentTarget.prospectName,
        channel: 'call',
        occurredAt: new Date().toISOString(),
        response: `Follow-up appointment booked for ${dayjs(values.scheduledFor).format('MMM D, YYYY h:mm A')}. Meeting reason: ${values.reason || 'No additional notes'}`,
        appointmentId: createdApptId,
        interactionType: 'booking',
        loggedByUserId: currentUser?.id || '1',
        loggedByUserName: `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.email || 'Staff Member',
        loggedByUserRole: currentUser?.role || 'marketing_staff',
        loggedByUserEmail: currentUser?.email || '',
        createdAt: new Date().toISOString(),
      });
      window.dispatchEvent(new Event('omark-interactions-changed'));

      message.success(`Follow-up appointment booked for ${appointmentTarget.prospectName}!`);
      setAppointmentModalOpen(false);
      appointmentForm.resetFields();
      window.dispatchEvent(new Event('omark-appointments-changed'));
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Failed to schedule appointment');
    }
  };

  return (
    <Card
      style={{
        borderRadius: 12,
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        border: '1px solid #f0f0f0',
        ...style,
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <HistoryOutlined style={{ color: '#1677ff', fontSize: 18 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{title}</div>
            <div style={{ fontSize: 12, fontWeight: 400, color: '#8c8c8c' }}>
              Live, interactive prospect interaction logs recorded across all communication channels
            </div>
          </div>
        </div>
      }
      extra={
        <Space wrap>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isLoading}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setLogModalOpen(true)}
            style={{ background: '#1677ff' }}
          >
            Log Interaction
          </Button>
        </Space>
      }
    >
      {/* ── Metric Summary Chips ────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 16,
          padding: '10px 12px',
          background: '#fafafa',
          borderRadius: 8,
          border: '1px solid #f0f0f0',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Space wrap size={[8, 8]}>
          <Tag color="blue" style={{ padding: '2px 8px', fontSize: 12 }}>
            <strong>{stats.total}</strong> Total Live Logs
          </Tag>
          <Tag color="purple" style={{ padding: '2px 8px', fontSize: 12 }}>
            <strong>{stats.staffCount}</strong> Staff Logging
          </Tag>
          <Tag color="cyan" style={{ padding: '2px 8px', fontSize: 12 }}>
            📞 <strong>{stats.calls}</strong> Calls
          </Tag>
          <Tag color="green" style={{ padding: '2px 8px', fontSize: 12 }}>
            💬 <strong>{stats.whatsapp}</strong> WhatsApp
          </Tag>
          <Tag color="geekblue" style={{ padding: '2px 8px', fontSize: 12 }}>
            🏢 <strong>{stats.inPerson}</strong> In-Person
          </Tag>
          <Tag color="gold" style={{ padding: '2px 8px', fontSize: 12 }}>
            ✉️ <strong>{stats.emails}</strong> Email
          </Tag>
        </Space>
        <Badge status="processing" text={<Text type="secondary" style={{ fontSize: 12 }}>Live Sync</Text>} />
      </div>

      {/* ── Filter Controls ─────────────────────────────────────────────────── */}
      {showFilters && (
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12} md={6}>
            <Input
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Search note, prospect, or staff..."
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: '100%', borderRadius: 6 }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              style={{ width: '100%' }}
              value={selectedStaff}
              onChange={setSelectedStaff}
              showSearch
              optionFilterProp="children"
              placeholder="Filter by staff member"
            >
              <Option value="all">👥 All Staff Members ({interactions.length})</Option>
              {staffOptions.map((s) => {
                const count = interactions.filter(
                  (i) => i.loggedByUserId === s.id || i.loggedByUserName === s.name
                ).length;
                return (
                  <Option key={s.id} value={s.id}>
                    {s.name} {s.role ? `(${roleLabels[s.role as keyof typeof roleLabels] || s.role})` : ''} — {count}
                  </Option>
                );
              })}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              style={{ width: '100%' }}
              value={selectedProspect}
              onChange={setSelectedProspect}
              showSearch
              optionFilterProp="children"
              placeholder="Filter by prospect"
            >
              <Option value="all">🎯 All Prospects ({prospectOptions.length})</Option>
              {prospectOptions.map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              style={{ width: '100%' }}
              value={selectedChannel}
              onChange={setSelectedChannel}
              placeholder="Filter by channel"
            >
              <Option value="all">⚡ All Channels</Option>
              <Option value="call">📞 Phone Calls</Option>
              <Option value="whatsapp">💬 WhatsApp</Option>
              <Option value="in_person">🏢 In-Person Visits</Option>
              <Option value="email">✉️ Email</Option>
              <Option value="sms">📱 SMS</Option>
            </Select>
          </Col>
        </Row>
      )}

      {/* ── Timeline Display ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin tip="Loading live interaction logs..." />
        </div>
      ) : displayedInteractions.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span>
              No interaction logs found matching your filters.{' '}
              <Button
                type="link"
                onClick={() => {
                  setSelectedStaff('all');
                  setSelectedProspect('all');
                  setSelectedChannel('all');
                  setSearchText('');
                }}
              >
                Reset Filters
              </Button>
            </span>
          }
        />
      ) : (
        <div style={{ maxHeight: '650px', overflowY: 'auto', paddingRight: 6 }}>
          <Timeline mode="left">
            {displayedInteractions.map((item) => {
              const cfg = CHANNEL_CONFIG[item.channel] || CHANNEL_CONFIG.other;
              const formattedDate = dayjs(item.occurredAt).format('MMM D, YYYY · h:mm A');
              const relative = dayjs(item.occurredAt).fromNow();

              return (
                <Timeline.Item
                  key={item.id}
                  dot={
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        backgroundColor: cfg.bg,
                        border: `1.5px solid ${cfg.border}`,
                        color: cfg.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                      }}
                    >
                      {cfg.icon}
                    </div>
                  }
                  style={{ paddingBottom: 24 }}
                >
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid #f0f0f0',
                      borderRadius: 10,
                      padding: '14px 16px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = cfg.border;
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#f0f0f0';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                    }}
                  >
                    {/* Header Row: Staff Attribution + Timestamp */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        gap: 8,
                        marginBottom: 10,
                        borderBottom: '1px solid #f8f8f8',
                        paddingBottom: 8,
                      }}
                    >
                      <Space
                        size={10}
                        align="center"
                        style={{ cursor: item.loggedByUserId ? 'pointer' : 'default' }}
                        onClick={() => {
                          if (item.loggedByUserId) {
                            navigate(`/admin/users/${item.loggedByUserId}`);
                          }
                        }}
                      >
                        <Avatar
                          size={32}
                          src={item.loggedByUserAvatar}
                          style={{
                            backgroundColor: cfg.color,
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: 13,
                          }}
                        >
                          {(item.loggedByUserName || 'S').slice(0, 2).toUpperCase()}
                        </Avatar>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Tooltip title={item.loggedByUserId ? 'Click to view staff profile' : undefined}>
                              <Text
                                strong
                                style={{
                                  fontSize: 14,
                                  color: item.loggedByUserId ? '#1677ff' : '#262626',
                                  cursor: item.loggedByUserId ? 'pointer' : 'default',
                                }}
                              >
                                {item.loggedByUserName || 'Staff Member'}
                              </Text>
                            </Tooltip>
                            {item.loggedByUserRole && (
                              <Tag
                                color="blue"
                                style={{
                                  fontSize: 11,
                                  lineHeight: '18px',
                                  padding: '0 6px',
                                  borderRadius: 4,
                                }}
                              >
                                {roleLabels[item.loggedByUserRole as keyof typeof roleLabels] || item.loggedByUserRole}
                              </Tag>
                            )}
                          </div>
                          {item.loggedByUserEmail && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {item.loggedByUserEmail}
                            </Text>
                          )}
                        </div>
                      </Space>

                      {/* Right: Time stamp & Actions */}
                      <Space size={8} align="center">
                        <Space size={4} style={{ color: '#8c8c8c', fontSize: 12 }}>
                          <ClockCircleOutlined />
                          <span>{formattedDate}</span>
                        </Space>
                        <Tag style={{ margin: 0, fontSize: 11, background: '#f5f5f5', color: '#595959' }}>
                          {relative}
                        </Tag>
                        {(currentUser?.role === 'admin' ||
                          currentUser?.role === 'secretary' ||
                          currentUser?.id === item.loggedByUserId) && (
                          <Popconfirm
                            title="Delete Interaction"
                            description="Are you sure you want to remove this interaction record?"
                            onConfirm={() => handleDeleteInteraction(item.id, item.prospectName)}
                            okText="Yes, Delete"
                            cancelText="No"
                            okButtonProps={{ danger: true, size: 'small' }}
                            cancelButtonProps={{ size: 'small' }}
                          >
                            <Tooltip title="Delete this interaction log">
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                                style={{ width: 24, height: 24, padding: 0 }}
                              />
                            </Tooltip>
                          </Popconfirm>
                        )}
                      </Space>
                    </div>

                    {/* Target Prospect & Channel Row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <Space size={8} wrap>
                        <Tag
                          color="geekblue"
                          style={{
                            padding: '3px 8px',
                            borderRadius: 4,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                          onClick={() =>
                            navigate(
                              item.prospectSource === 'customer_service'
                                ? '/cs/prospects'
                                : `/marketing/prospects/${item.prospectId}`
                            )
                          }
                        >
                          <UserOutlined />
                          <span>
                            Prospect: <strong style={{ textDecoration: 'underline' }}>{item.prospectName || 'Prospective Client'}</strong>
                          </span>
                        </Tag>

                        {item.prospectPhone && (
                          <a
                            href={`tel:${item.prospectPhone}`}
                            style={{
                              fontSize: 12,
                              color: '#1677ff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#f0f5ff',
                              padding: '2px 8px',
                              borderRadius: 4,
                              border: '1px solid #adc6ff',
                            }}
                          >
                            <PhoneOutlined /> {item.prospectPhone}
                          </a>
                        )}

                        {item.prospectSource && (
                          <Tag color={item.prospectSource === 'marketing' ? 'purple' : 'green'} style={{ fontSize: 11 }}>
                            {item.prospectSource === 'marketing' ? 'Marketing Lead' : 'Customer Service'}
                          </Tag>
                        )}
                      </Space>

                      {/* Channel Badge */}
                      <Tag
                        style={{
                          backgroundColor: cfg.bg,
                          borderColor: cfg.border,
                          color: cfg.color,
                          fontWeight: 500,
                          fontSize: 12,
                          padding: '2px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        {cfg.icon} {cfg.label}
                      </Tag>
                    </div>

                    {/* Note / Discussion Outcome */}
                    <div
                      style={{
                        background: '#fbfbfb',
                        padding: '10px 14px',
                        borderRadius: 6,
                        borderLeft: `3px solid ${cfg.color}`,
                        marginTop: 4,
                      }}
                    >
                      <Paragraph
                        style={{
                          margin: 0,
                          color: '#262626',
                          fontSize: 13,
                          lineHeight: '1.6',
                          wordBreak: 'break-word',
                        }}
                      >
                        "{item.response}"
                      </Paragraph>
                    </div>

                    {/* ── Action Buttons Footer (Live & Functional) ────────────────── */}
                    <div
                      style={{
                        marginTop: 10,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 6,
                        borderTop: '1px dashed #f0f0f0',
                        paddingTop: 8,
                      }}
                    >
                      <Space size={6} wrap>
                        <Button
                          size="small"
                          type="link"
                          icon={<EyeOutlined />}
                          style={{ padding: 0, fontSize: 12 }}
                          onClick={() =>
                            navigate(
                              item.prospectSource === 'customer_service'
                                ? '/cs/prospects'
                                : `/marketing/prospects/${item.prospectId}`
                            )
                          }
                        >
                          View Details
                        </Button>
                        {item.prospectPhone && (
                          <>
                            <span style={{ color: '#d9d9d9' }}>|</span>
                            <Button
                              size="small"
                              type="text"
                              icon={<PhoneOutlined style={{ color: '#1677ff' }} />}
                              style={{ padding: '0 4px', fontSize: 12 }}
                              href={`tel:${item.prospectPhone}`}
                            >
                              Call
                            </Button>
                            <Button
                              size="small"
                              type="text"
                              icon={<WhatsAppOutlined style={{ color: '#52c41a' }} />}
                              style={{ padding: '0 4px', fontSize: 12 }}
                              onClick={() => {
                                const cleanPhone = item.prospectPhone?.replace(/[^\d+]/g, '');
                                const msg = encodeURIComponent(
                                  `Hello ${item.prospectName || 'there'}, following up on your inquiry with Omark Real Estate.`
                                );
                                window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
                              }}
                            >
                              WhatsApp
                            </Button>
                          </>
                        )}
                      </Space>

                      <Space size={6}>
                        <Button
                          size="small"
                          icon={<MessageOutlined />}
                          style={{ fontSize: 12 }}
                          onClick={() => {
                            const matchedP =
                              prospects.find((p) => p.id === item.prospectId) ||
                              ({
                                id: item.prospectId,
                                firstName: item.prospectName?.split(' ')[0] || 'Prospect',
                                lastName: item.prospectName?.split(' ').slice(1).join(' ') || '',
                                phoneNumber: item.prospectPhone || '',
                                source: item.prospectSource || 'marketing',
                              } as Prospect);
                            setTargetFollowUpProspect(matchedP);
                          }}
                        >
                          Log Follow-up
                        </Button>
                        <Button
                          size="small"
                          type="primary"
                          ghost
                          icon={<CalendarOutlined />}
                          style={{ fontSize: 12 }}
                          onClick={() => {
                            setAppointmentTarget(item);
                            appointmentForm.setFieldsValue({
                              scheduledFor: dayjs().add(1, 'day').set('hour', 10).set('minute', 0),
                              reason: `Follow-up meeting after ${cfg.label} with ${item.prospectName}`,
                            });
                            setAppointmentModalOpen(true);
                          }}
                        >
                          Book Appointment
                        </Button>
                      </Space>
                    </div>
                  </div>
                </Timeline.Item>
              );
            })}
          </Timeline>
        </div>
      )}

      {/* Log Interaction Modal Triggerable directly from Dashboard or Item */}
      <LogInteractionModal
        open={logModalOpen || !!targetFollowUpProspect}
        prospect={targetFollowUpProspect}
        onClose={() => {
          setLogModalOpen(false);
          setTargetFollowUpProspect(null);
        }}
        onLogged={() => refetch()}
      />

      {/* Quick Appointment Scheduler Modal */}
      <Modal
        title={
          <Space>
            <CalendarOutlined style={{ color: '#1677ff' }} />
            <span>Book Follow-Up Appointment — {appointmentTarget?.prospectName}</span>
          </Space>
        }
        open={appointmentModalOpen}
        onCancel={() => {
          setAppointmentModalOpen(false);
          setAppointmentTarget(null);
          appointmentForm.resetFields();
        }}
        onOk={() => appointmentForm.submit()}
        okText="Book Appointment"
        confirmLoading={createAppointmentMutation.isPending}
        destroyOnClose
      >
        <Form form={appointmentForm} layout="vertical" onFinish={handleCreateAppointment}>
          <Form.Item
            name="scheduledFor"
            label="Appointment Date & Time"
            rules={[{ required: true, message: 'Please select appointment date and time' }]}
          >
            <DatePicker
              showTime={{ format: 'hh:mm A' }}
              format="YYYY-MM-DD hh:mm A"
              style={{ width: '100%' }}
              disabledDate={(current) => current && current.isBefore(dayjs().startOf('day'))}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Purpose / Agenda"
            rules={[{ required: true, message: 'Please provide reason for appointment' }]}
          >
            <TextArea rows={3} placeholder="e.g. Site inspection and deed discussion" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
