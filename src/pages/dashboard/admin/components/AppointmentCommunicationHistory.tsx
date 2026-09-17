// src/pages/dashboard/admin/components/AppointmentCommunicationHistory.tsx
import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Input,
  Select,
  Badge,
  Avatar,
  Timeline,
  Drawer,
  Row,
  Col,
  Statistic,
  Tooltip,
  Divider,
  Empty,
  Typography,
  Switch,
  Alert,
} from 'antd';
import {
  CalendarOutlined,
  PhoneOutlined,
  WhatsAppOutlined,
  MailOutlined,
  EyeOutlined,
  MessageOutlined,
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ShopOutlined,
  HistoryOutlined,
  TeamOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAppointmentsQuery, appointmentsKeys } from '@/api/appointments';
import { useAllStaffInteractionsQuery } from '@/api/interactions';
import { useProspectsQuery } from '@/api/prospects';
import { useCustomersQuery } from '@/api/customers';
import { useUsersQuery, getUserFullName } from '@/api/users';
import { LogInteractionModal } from '@/components/shared/LogInteractionModal';
import { StatusTag } from '@/components/shared/StatusTag';
import { interactionChannelLabels } from '@/constants/enums';
import type { Appointment, AppointmentStatus, Prospect, Customer, InteractionChannel } from '@/types';
import type { StaffInteraction } from '@/utils/interactionStorage';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface AppointmentCommunicationHistoryProps {
  title?: string;
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
    icon: <ShopOutlined />,
    color: '#722ed1',
    bg: '#f9f0ff',
    border: '#d3adf7',
    label: 'In-Person Visit',
  },
  email: {
    icon: <MailOutlined />,
    color: '#fa8c16',
    bg: '#fff7e6',
    border: '#ffd591',
    label: 'Email',
  },
  sms: {
    icon: <MessageOutlined />,
    color: '#13c2c2',
    bg: '#e6fffb',
    border: '#87e8de',
    label: 'SMS',
  },
  other: {
    icon: <HistoryOutlined />,
    color: '#595959',
    bg: '#f5f5f5',
    border: '#d9d9d9',
    label: 'Note / Update',
  },
};

export const AppointmentCommunicationHistory: React.FC<AppointmentCommunicationHistoryProps> = ({
  title = 'Appointment Communication History & Audit Trail',
  style,
}) => {
  // ── Search & Filter States ──────────────────────────────────────────────────
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [onlyWithLogs, setOnlyWithLogs] = useState<boolean>(false);

  // ── Drawer & Modal States ───────────────────────────────────────────────────
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [targetAppointmentForLog, setTargetAppointmentForLog] = useState<Appointment | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const {
    data: appointmentsData,
    isLoading: appointmentsLoading,
    refetch: refetchAppointments,
  } = useAppointmentsQuery({ pageSize: 200 });

  const {
    interactions: allInteractions,
    isLoading: interactionsLoading,
    refetch: refetchInteractions,
  } = useAllStaffInteractionsQuery();

  const { data: prospectsData } = useProspectsQuery({ pageSize: 500 });
  const { data: customersData } = useCustomersQuery({ pageSize: 500 });
  const { data: usersData } = useUsersQuery();

  const allProspects: Prospect[] = useMemo(() => prospectsData?.items ?? [], [prospectsData]);
  const allCustomers: Customer[] = useMemo(() => customersData?.items ?? [], [customersData]);
  const allUsers = useMemo(() => (Array.isArray(usersData) ? usersData : []), [usersData]);

  // Listen to system events for live real-time sync
  useEffect(() => {
    const handleAppointmentsChange = () => {
      refetchAppointments();
    };
    const handleInteractionsChange = () => {
      refetchInteractions();
    };
    window.addEventListener('omark-appointments-changed', handleAppointmentsChange);
    window.addEventListener('omark-interactions-changed', handleInteractionsChange);
    return () => {
      window.removeEventListener('omark-appointments-changed', handleAppointmentsChange);
      window.removeEventListener('omark-interactions-changed', handleInteractionsChange);
    };
  }, [refetchAppointments, refetchInteractions]);

  // Raw list of appointments
  const appointmentsList: Appointment[] = useMemo(() => {
    const items = appointmentsData?.items;
    if (Array.isArray(items)) return items;
    if (Array.isArray(appointmentsData)) return appointmentsData;
    return [];
  }, [appointmentsData]);

  // Helper to map entity details (client/prospect/customer)
  const getEntityDetails = (app: Appointment) => {
    if (app.prospectId) {
      const p = allProspects.find((item) => item.id === app.prospectId);
      if (p) {
        return {
          id: p.id,
          name: `${p.firstName} ${p.lastName}`.trim(),
          phone: p.phoneNumber || 'N/A',
          email: (p as any).email || 'N/A',
          type: 'prospect' as const,
          source: p.source || 'N/A',
          prospect: p,
        };
      }
    }
    if (app.customerId) {
      const c = allCustomers.find((item) => item.id === app.customerId);
      if (c) {
        return {
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          phone: c.phoneNumber || 'N/A',
          email: (c as any).email || 'N/A',
          type: 'customer' as const,
          source: 'Customer',
          customer: c,
        };
      }
    }
    return {
      id: app.id,
      name: (app as any).clientName || (app as any).customerName || 'Direct Client',
      phone: (app as any).phoneNumber || (app as any).phone || 'N/A',
      email: (app as any).email || 'N/A',
      type: 'direct' as const,
      source: app.source || 'Direct',
    };
  };

  // Helper to resolve staff user who logged or created
  const getStaffName = (userId?: string, fallback = 'Staff Member') => {
    if (!userId) return fallback;
    const found = allUsers.find((u) => u.id === userId);
    return found ? getUserFullName(found) : fallback;
  };

  // Helper to compile appointment history and chronological audit trail
  const getAppointmentHistory = (appointment: Appointment) => {
    const linked = allInteractions.filter(
      (i) =>
        (appointment.id && i.appointmentId === appointment.id) ||
        (appointment.prospectId && i.prospectId === appointment.prospectId) ||
        (appointment.customerId && i.customerId === appointment.customerId)
    );

    const events: Array<{
      id: string;
      channel: string;
      title: string;
      note: string;
      timestamp: string;
      user: string;
      role?: string;
      type: 'interaction' | 'booking' | 'status_update';
    }> = [];

    linked.forEach((item) => {
      events.push({
        id: item.id,
        channel: item.channel,
        title:
          item.interactionType === 'booking'
            ? 'Appointment Booked'
            : item.interactionType === 'status_update'
            ? 'Status Update Note'
            : `${interactionChannelLabels[item.channel as InteractionChannel] || item.channel} Log`,
        note: item.response,
        timestamp: item.occurredAt || item.createdAt,
        user: item.loggedByUserName || 'Staff Member',
        role: item.loggedByUserRole ? String(item.loggedByUserRole) : undefined,
        type: (item.interactionType as any) || 'interaction',
      });
    });

    const hasBookingEvent = events.some((e) => e.type === 'booking' || e.id.includes(appointment.id));
    if (!hasBookingEvent && appointment.createdAt) {
      events.push({
        id: `initial_create_${appointment.id}`,
        channel: appointment.source === 'website' ? 'other' : 'call',
        title: appointment.source === 'website' ? 'Website Online Booking' : 'Staff Booking Scheduled',
        note: appointment.reason || 'Appointment scheduled by client/staff',
        timestamp: appointment.createdAt,
        user: appointment.source === 'website' ? 'Website Client' : getStaffName((appointment as any).userId || appointment.createdByUserId),
        role: appointment.source === 'website' ? 'Client' : 'Staff',
        type: 'booking',
      });
    }

    if (appointment.feedback && !events.some((e) => e.note.includes(appointment.feedback!))) {
      events.push({
        id: `feedback_${appointment.id}`,
        channel: 'other',
        title: `Appointment Feedback (${appointment.status.toUpperCase()})`,
        note: appointment.feedback,
        timestamp: appointment.updatedAt || appointment.createdAt,
        user: 'Staff Member',
        type: 'status_update',
      });
    }

    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  // Staff list for filtering
  const staffFilterOptions = useMemo(() => {
    const staffSet = new Map<string, string>();
    allInteractions.forEach((i) => {
      if (i.loggedByUserId && i.loggedByUserName) {
        staffSet.set(i.loggedByUserId, i.loggedByUserName);
      }
    });
    allUsers.forEach((u) => {
      staffSet.set(u.id, getUserFullName(u));
    });
    return Array.from(staffSet.entries()).map(([id, name]) => ({ id, name }));
  }, [allInteractions, allUsers]);

  // Filtered appointments list
  const filteredAppointments = useMemo(() => {
    return appointmentsList.filter((app) => {
      const entity = getEntityDetails(app);
      const history = getAppointmentHistory(app);
      const interactions = history.filter((h) => h.type === 'interaction');

      // Filter: only with logs
      if (onlyWithLogs && interactions.length === 0) {
        return false;
      }

      // Filter: Status
      if (statusFilter !== 'all' && app.status !== statusFilter) {
        return false;
      }

      // Filter: Channel
      if (channelFilter !== 'all') {
        const hasChannel = history.some(
          (h) => h.channel.toLowerCase() === channelFilter.toLowerCase()
        );
        if (!hasChannel) return false;
      }

      // Filter: Staff member
      if (staffFilter !== 'all') {
        const matchesStaff =
          (app as any).userId === staffFilter ||
          app.createdByUserId === staffFilter ||
          history.some((h) => h.user.toLowerCase().includes(staffFilter.toLowerCase()));
        if (!matchesStaff) return false;
      }

      // Search text
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        const matchesEntity =
          entity.name.toLowerCase().includes(q) ||
          entity.phone.toLowerCase().includes(q) ||
          entity.email.toLowerCase().includes(q);
        const matchesReason = (app.reason || '').toLowerCase().includes(q);
        const matchesHistory = history.some(
          (h) => h.note.toLowerCase().includes(q) || h.user.toLowerCase().includes(q)
        );
        if (!matchesEntity && !matchesReason && !matchesHistory) {
          return false;
        }
      }

      return true;
    });
  }, [
    appointmentsList,
    allInteractions,
    allProspects,
    allCustomers,
    searchText,
    statusFilter,
    channelFilter,
    staffFilter,
    onlyWithLogs,
  ]);

  // Overall statistics for KPI cards
  const stats = useMemo(() => {
    const total = appointmentsList.length;
    let withLogsCount = 0;
    let totalInteractionsLogged = 0;
    let scheduledCount = 0;
    let completedCount = 0;

    appointmentsList.forEach((app) => {
      const hist = getAppointmentHistory(app);
      const comms = hist.filter((h) => h.type === 'interaction');
      if (comms.length > 0) {
        withLogsCount += 1;
        totalInteractionsLogged += comms.length;
      }
      if (app.status === 'scheduled') scheduledCount += 1;
      if (app.status === 'completed') completedCount += 1;
    });

    const percentWithLogs = total > 0 ? Math.round((withLogsCount / total) * 100) : 0;

    return {
      total,
      withLogsCount,
      percentWithLogs,
      totalInteractionsLogged,
      scheduledCount,
      completedCount,
    };
  }, [appointmentsList, allInteractions]);

  // Table Columns
  const columns = [
    {
      title: 'Client / Contact',
      key: 'client',
      width: 230,
      render: (_: any, record: Appointment) => {
        const entity = getEntityDetails(record);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar
              style={{
                backgroundColor: entity.type === 'prospect' ? '#1890ff' : '#52c41a',
                verticalAlign: 'middle',
                flexShrink: 0,
              }}
            >
              {entity.name.charAt(0).toUpperCase()}
            </Avatar>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#262626' }}>{entity.name}</div>
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>{entity.phone}</div>
              <Space size={4} style={{ marginTop: 2 }}>
                <Tag
                  color={entity.type === 'prospect' ? 'blue' : 'green'}
                  style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}
                >
                  {entity.type.toUpperCase()}
                </Tag>
                {record.source === 'website' && (
                  <Tag color="cyan" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
                    WEB
                  </Tag>
                )}
              </Space>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Appointment Details',
      key: 'details',
      width: 210,
      render: (_: any, record: Appointment) => {
        const dateObj = dayjs(record.scheduledFor || (record as any).date);
        return (
          <div>
            <Space size={6}>
              <CalendarOutlined style={{ color: '#1890ff', fontSize: 13 }} />
              <Text strong style={{ fontSize: 13 }}>
                {dateObj.isValid() ? dateObj.format('MMM D, YYYY') : 'Date N/A'}
              </Text>
            </Space>
            <div style={{ fontSize: 12, color: '#595959', marginTop: 2 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {dateObj.isValid() ? dateObj.format('h:mm A') : (record as any).time || 'Time N/A'}
            </div>
            {record.reason && (
              <div
                style={{
                  fontSize: 11,
                  color: '#8c8c8c',
                  marginTop: 3,
                  maxWidth: 200,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={record.reason}
              >
                📝 {record.reason}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: AppointmentStatus) => (
        <StatusTag status={status} type="appointment" />
      ),
    },
    {
      title: 'Communication History & Notes',
      key: 'history',
      render: (_: any, record: Appointment) => {
        const history = getAppointmentHistory(record);
        const comms = history.filter((h) => h.type === 'interaction');
        const latestComm = comms[0];

        // Channel breakdown
        const callCount = comms.filter((c) => c.channel === 'call' || c.channel === 'phone_call').length;
        const waCount = comms.filter((c) => c.channel === 'whatsapp').length;
        const visitCount = comms.filter((c) => c.channel === 'in_person').length;
        const emailCount = comms.filter((c) => c.channel === 'email').length;

        if (comms.length === 0) {
          return (
            <div style={{ padding: '4px 0' }}>
              <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic', display: 'block' }}>
                No communication logged yet
              </Text>
              <Button
                type="link"
                size="small"
                icon={<PlusOutlined />}
                style={{ padding: 0, fontSize: 12, height: 'auto', marginTop: 4 }}
                onClick={() => {
                  setTargetAppointmentForLog(record);
                  setLogModalOpen(true);
                }}
              >
                Log Contact Note
              </Button>
            </div>
          );
        }

        return (
          <div style={{ minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              <Badge
                count={`${comms.length} log${comms.length === 1 ? '' : 's'}`}
                style={{
                  backgroundColor: '#e6f7ff',
                  color: '#1890ff',
                  borderColor: '#91d5ff',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
              {callCount > 0 && (
                <Tag color="blue" style={{ fontSize: 11, margin: 0, padding: '0 5px' }}>
                  📞 {callCount}
                </Tag>
              )}
              {waCount > 0 && (
                <Tag color="green" style={{ fontSize: 11, margin: 0, padding: '0 5px' }}>
                  💬 {waCount}
                </Tag>
              )}
              {visitCount > 0 && (
                <Tag color="purple" style={{ fontSize: 11, margin: 0, padding: '0 5px' }}>
                  🏢 {visitCount}
                </Tag>
              )}
              {emailCount > 0 && (
                <Tag color="orange" style={{ fontSize: 11, margin: 0, padding: '0 5px' }}>
                  ✉️ {emailCount}
                </Tag>
              )}
            </div>

            {latestComm && (
              <div
                style={{
                  background: '#fafafa',
                  borderRadius: 6,
                  padding: '6px 8px',
                  border: '1px solid #f0f0f0',
                  marginTop: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ fontSize: 11, color: '#595959' }}>
                    {latestComm.user}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    {dayjs(latestComm.timestamp).fromNow()}
                  </Text>
                </div>
                <Paragraph
                  ellipsis={{ rows: 2 }}
                  style={{ margin: '2px 0 0', fontSize: 11, color: '#262626' }}
                >
                  {latestComm.note}
                </Paragraph>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Booked By',
      key: 'staff',
      width: 140,
      render: (_: any, record: Appointment) => {
        const staffName = getStaffName((record as any).userId || record.createdByUserId, record.source === 'website' ? 'Website Online' : 'Staff');
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#87d068' }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#262626' }}>{staffName}</div>
              <div style={{ fontSize: 10, color: '#8c8c8c' }}>
                {record.source === 'website' ? 'Client Self-Book' : 'Staff Assigned'}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      render: (_: any, record: Appointment) => (
        <Space size={6}>
          <Tooltip title="View complete chronological audit trail & logs">
            <Button
              type="primary"
              ghost
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedAppointment(record);
                setDrawerOpen(true);
              }}
            >
              History
            </Button>
          </Tooltip>
          <Tooltip title="Log staff interaction note for this appointment">
            <Button
              size="small"
              icon={<MessageOutlined style={{ color: '#52c41a' }} />}
              onClick={() => {
                setTargetAppointmentForLog(record);
                setLogModalOpen(true);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Drawer Content for Selected Appointment
  const renderDrawerContent = () => {
    if (!selectedAppointment) return null;
    const entity = getEntityDetails(selectedAppointment);
    const history = getAppointmentHistory(selectedAppointment);
    const comms = history.filter((h) => h.type === 'interaction');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Client & Appointment Header Card */}
        <Card
          style={{
            borderRadius: 10,
            background: 'linear-gradient(135deg, #f6ffed 0%, #e6f7ff 100%)',
            border: '1px solid #d9f7be',
          }}
          bodyStyle={{ padding: 16 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar size={48} style={{ backgroundColor: '#1890ff', fontSize: 18, fontWeight: 'bold' }}>
                {entity.name.charAt(0).toUpperCase()}
              </Avatar>
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {entity.name}
                </Title>
                <div style={{ color: '#595959', fontSize: 13 }}>
                  <span>📞 {entity.phone}</span>
                  {entity.email !== 'N/A' && <span style={{ marginLeft: 12 }}>✉️ {entity.email}</span>}
                </div>
                <Space size={6} style={{ marginTop: 4 }}>
                  <Tag color={entity.type === 'prospect' ? 'blue' : 'green'}>{entity.type.toUpperCase()}</Tag>
                  <StatusTag status={selectedAppointment.status} type="appointment" />
                  <Tag color="purple">
                    <CalendarOutlined /> {dayjs(selectedAppointment.scheduledFor).format('MMM D, YYYY h:mm A')}
                  </Tag>
                </Space>
              </div>
            </div>

            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setTargetAppointmentForLog(selectedAppointment);
                setLogModalOpen(true);
              }}
              style={{ borderRadius: 6 }}
            >
              Log Interaction Note
            </Button>
          </div>

          {selectedAppointment.reason && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.85)', borderRadius: 6 }}>
              <Text strong style={{ fontSize: 12, color: '#595959' }}>
                Appointment Purpose / Reason:
              </Text>
              <div style={{ fontSize: 13, color: '#262626', marginTop: 2 }}>{selectedAppointment.reason}</div>
            </div>
          )}
        </Card>

        {/* Audit Trail & Communication Timeline */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Space>
                <HistoryOutlined style={{ color: '#1890ff' }} />
                <span>Complete Chronological Audit Trail & Communication History</span>
              </Space>
              <Badge count={`${history.length} events`} style={{ backgroundColor: '#52c41a' }} />
            </div>
          }
          style={{ borderRadius: 10 }}
        >
          {history.length === 0 ? (
            <Empty description="No communication or status history recorded yet." />
          ) : (
            <Timeline
              items={history.map((event) => {
                const conf = CHANNEL_CONFIG[event.channel] || CHANNEL_CONFIG.other;
                return {
                  color: conf.color,
                  dot: (
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: conf.bg,
                        border: `2px solid ${conf.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        color: conf.color,
                      }}
                    >
                      {conf.icon}
                    </div>
                  ),
                  children: (
                    <div
                      style={{
                        background: '#fafafa',
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: '1px solid #f0f0f0',
                        marginBottom: 6,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        <div>
                          <Text strong style={{ fontSize: 13, color: '#262626' }}>
                            {event.title}
                          </Text>
                          <Space size={6} style={{ marginLeft: 8 }}>
                            <Tag
                              color={conf.color}
                              style={{ margin: 0, fontSize: 10, lineHeight: '18px', padding: '0 4px' }}
                            >
                              {conf.label}
                            </Tag>
                            {event.role && (
                              <Tag style={{ margin: 0, fontSize: 10, lineHeight: '18px', padding: '0 4px' }}>
                                {event.role}
                              </Tag>
                            )}
                          </Space>
                        </div>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {dayjs(event.timestamp).format('MMM D, YYYY h:mm A')} ({dayjs(event.timestamp).fromNow()})
                        </Text>
                      </div>

                      <div
                        style={{
                          fontSize: 13,
                          color: '#434343',
                          marginTop: 6,
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.5,
                        }}
                      >
                        {event.note}
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 11,
                          color: '#8c8c8c',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <UserOutlined style={{ fontSize: 10 }} />
                        <span>Logged by: {event.user}</span>
                      </div>
                    </div>
                  ),
                };
              })}
            />
          )}
        </Card>
      </div>
    );
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CalendarOutlined style={{ color: '#1677ff', fontSize: 20 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{title}</div>
              <div style={{ fontSize: 12, fontWeight: 400, color: '#8c8c8c' }}>
                Track staff communication logs, booking interactions, and complete audit trails across all appointments
              </div>
            </div>
          </div>
          <Space>
            <Button
              icon={<ReloadOutlined spin={appointmentsLoading || interactionsLoading} />}
              onClick={() => {
                refetchAppointments();
                refetchInteractions();
              }}
              size="small"
            >
              Sync Live Data
            </Button>
          </Space>
        </div>
      }
    >
      {/* ── KPI Summary Cards ──────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ background: '#f6ffed', borderColor: '#b7eb8f', borderRadius: 8 }}>
            <Statistic
              title={<span style={{ color: '#389e0d', fontSize: 12 }}>Total Appointments</span>}
              value={stats.total}
              prefix={<CalendarOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ background: '#e6f4ff', borderColor: '#91caff', borderRadius: 8 }}>
            <Statistic
              title={<span style={{ color: '#0958d9', fontSize: 12 }}>With Communication Logs</span>}
              value={stats.withLogsCount}
              suffix={<span style={{ fontSize: 12, color: '#8c8c8c' }}>({stats.percentWithLogs}%)</span>}
              prefix={<MessageOutlined style={{ color: '#1677ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ background: '#f9f0ff', borderColor: '#d3adf7', borderRadius: 8 }}>
            <Statistic
              title={<span style={{ color: '#531dab', fontSize: 12 }}>Total Staff Notes Logged</span>}
              value={stats.totalInteractionsLogged}
              prefix={<HistoryOutlined style={{ color: '#722ed1' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ background: '#fff7e6', borderColor: '#ffd591', borderRadius: 8 }}>
            <Statistic
              title={<span style={{ color: '#d46b08', fontSize: 12 }}>Upcoming / Scheduled</span>}
              value={stats.scheduledCount}
              prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Search and Filter Controls ─────────────────────────────────────── */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Input
            placeholder="Search by client name, phone, notes, or staff..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
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
            <Option value="all">⚡ All Statuses</Option>
            <Option value="scheduled">Scheduled</Option>
            <Option value="confirmed">Confirmed</Option>
            <Option value="completed">Completed</Option>
            <Option value="postponed">Postponed</Option>
            <Option value="canceled">Canceled</Option>
            <Option value="no_show">No Show</Option>
          </Select>
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Select
            style={{ width: '100%' }}
            value={channelFilter}
            onChange={setChannelFilter}
            placeholder="Filter channel"
          >
            <Option value="all">📱 All Channels</Option>
            <Option value="call">📞 Phone Call</Option>
            <Option value="whatsapp">💬 WhatsApp</Option>
            <Option value="in_person">🏢 In-Person Visit</Option>
            <Option value="email">✉️ Email</Option>
            <Option value="sms">📱 SMS</Option>
          </Select>
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Select
            style={{ width: '100%' }}
            value={staffFilter}
            onChange={setStaffFilter}
            showSearch
            optionFilterProp="children"
            placeholder="Filter by staff"
          >
            <Option value="all">👥 All Staff</Option>
            {staffFilterOptions.map((s) => (
              <Option key={s.id} value={s.id}>
                {s.name}
              </Option>
            ))}
          </Select>
        </Col>
        <Col xs={12} sm={6} md={4} style={{ display: 'flex', alignItems: 'center' }}>
          <Space>
            <Switch
              checked={onlyWithLogs}
              onChange={setOnlyWithLogs}
              size="small"
              id="onlyWithLogsSwitch"
            />
            <label
              htmlFor="onlyWithLogsSwitch"
              style={{ fontSize: 12, cursor: 'pointer', color: '#595959', userSelect: 'none' }}
            >
              Only with logs ({stats.withLogsCount})
            </label>
          </Space>
        </Col>
      </Row>

      {/* ── Table of Appointments with Live History ────────────────────────── */}
      <Table
        dataSource={filteredAppointments}
        columns={columns}
        rowKey="id"
        loading={appointmentsLoading || interactionsLoading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          showTotal: (total) => `Showing ${total} appointments`,
        }}
        expandable={{
          expandedRowRender: (record) => {
            const history = getAppointmentHistory(record);
            return (
              <div style={{ padding: '10px 20px', background: '#fafafa', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text strong style={{ fontSize: 13 }}>
                    <HistoryOutlined style={{ marginRight: 6, color: '#1890ff' }} />
                    Chronological Timeline & Staff Notes ({history.length} records)
                  </Text>
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setTargetAppointmentForLog(record);
                      setLogModalOpen(true);
                    }}
                  >
                    Add Note to Appointment
                  </Button>
                </div>
                {history.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No interaction logs recorded yet" />
                ) : (
                  <Timeline
                    items={history.map((h) => {
                      const conf = CHANNEL_CONFIG[h.channel] || CHANNEL_CONFIG.other;
                      return {
                        color: conf.color,
                        children: (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Tag color={conf.color} style={{ margin: 0, fontSize: 11 }}>
                                {conf.label}
                              </Tag>
                              <Text strong style={{ fontSize: 12 }}>
                                {h.title}
                              </Text>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                {dayjs(h.timestamp).format('MMM D, YYYY h:mm A')}
                              </Text>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                • by {h.user}
                              </Text>
                            </div>
                            <div style={{ fontSize: 12, color: '#434343', marginTop: 3 }}>{h.note}</div>
                          </div>
                        ),
                      };
                    })}
                  />
                )}
              </div>
            );
          },
          rowExpandable: () => true,
        }}
        size="middle"
        locale={{
          emptyText: (
            <Empty
              description="No appointments found matching your filters"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
      />

      {/* ── Side Drawer for Detailed History ───────────────────────────────── */}
      <Drawer
        title="Appointment Communication & Audit Trail"
        placement="right"
        width={650}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedAppointment(null);
        }}
        styles={{ body: { padding: 20, background: '#f5f7fa' } }}
      >
        {renderDrawerContent()}
      </Drawer>

      {/* ── Modal to Log Interaction Directly on Selected Appointment ────── */}
      {targetAppointmentForLog && (
        <LogInteractionModal
          open={logModalOpen}
          prospect={getEntityDetails(targetAppointmentForLog).prospect || null}
          appointmentId={targetAppointmentForLog.id}
          customerId={targetAppointmentForLog.customerId}
          onClose={() => {
            setLogModalOpen(false);
            setTargetAppointmentForLog(null);
          }}
          onLogged={() => {
            refetchAppointments();
            refetchInteractions();
          }}
        />
      )}
    </Card>
  );
};
