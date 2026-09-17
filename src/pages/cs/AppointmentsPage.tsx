// src/pages/cs/AppointmentsPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Space, Modal, Form, Input, Select, Row, Col, Table,
  Tag, message, Typography, Card, Avatar, Badge, Tooltip,
  DatePicker, Statistic, Divider, Empty,
  Dropdown, Popconfirm, Alert, Drawer, Descriptions,
  Timeline, Segmented, Calendar, Radio, Spin, Switch,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
  ExportOutlined,
  PhoneOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  MessageOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  CodeOutlined,
  DownloadOutlined,
  CloseOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ShareAltOutlined,
  PrinterOutlined,
  GlobalOutlined,
  IdcardOutlined,
  UnorderedListOutlined,
  ExclamationCircleOutlined,
  FieldTimeOutlined,
  RedoOutlined,
  WhatsAppOutlined,
  MailOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useBranchesQuery } from '@/api/branches';
import { filterEntitiesByBranch, tagPayloadWithBranch } from '@/utils/branchIsolation';
import { PageHeader } from '@/components/shared/PageHeader';
import { PhotoUpload } from '@/components/shared/PhotoUpload';
import { tokens } from '@/constants/tokens';
import {
  useAppointmentsQuery,
  useCreateAppointmentMutation,
  useUpdateAppointmentMutation,
  type Appointment as ApiAppointment,
  type AppointmentStatus,
  type AppointmentSource,
  type CreateAppointmentPayload
} from '@/api/appointments';
import { useProspectsQuery, useLogInteractionMutation } from '@/api/prospects';
import { useCustomersQuery } from '@/api/customers';
import { useAllStaffInteractionsQuery } from '@/api/interactions';
import { saveStoredInteraction } from '@/utils/interactionStorage';
import { LogInteractionModal } from '@/components/shared/LogInteractionModal';
import { interactionChannelLabels } from '@/constants/enums';
import type { InteractionChannel, Prospect } from '@/types';

type Appointment = ApiAppointment & {
  date: string;
  time: string;
};
import { markSeen } from '@/utils/seenTracker';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import calendar from 'dayjs/plugin/calendar';
import advancedFormat from 'dayjs/plugin/advancedFormat';

dayjs.extend(relativeTime);
dayjs.extend(calendar);
dayjs.extend(advancedFormat);

const { Option } = Select;
const { TextArea } = Input;
const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

// Helper to get status config
const getStatusConfig = (status: string) => {
  const configs: Record<string, { color: string; icon: any; label: string }> = {
    scheduled: { color: '#1890ff', icon: <ClockCircleOutlined />, label: 'Scheduled' },
    completed: { color: '#722ed1', icon: <CheckCircleOutlined />, label: 'Completed' },
    canceled: { color: '#ff4d4f', icon: <CloseCircleOutlined />, label: 'Canceled' },
    no_show: { color: '#faad14', icon: <WarningOutlined />, label: 'No Show' },
    postponed: { color: '#fa8c16', icon: <FieldTimeOutlined />, label: 'Postponed' },
  };
  return configs[status] || configs.scheduled;
};

// Helper to get source config
const getSourceConfig = (source: string) => {
  const configs: Record<string, { color: string; icon: any; label: string }> = {
    staff: { color: '#1890ff', icon: <UserOutlined />, label: 'Staff Created' },
    website: { color: '#faad14', icon: <GlobalOutlined />, label: 'Website Booking' },
  };
  return configs[source] || configs.staff;
};

export const AppointmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // States
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [updateStatusModal, setUpdateStatusModal] = useState(false);
  const [statusForm] = Form.useForm();

  // Rebook states
  const [rebookModalOpen, setRebookModalOpen] = useState(false);
  const [rebookAppointment, setRebookAppointment] = useState<Appointment | null>(null);
  const [rebookForm] = Form.useForm();

  // Export states
  const [exportModal, setExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv' | 'pdf' | 'json'>('excel');
  const [exportLoading, setExportLoading] = useState(false);

  // Interaction integration states
  const [logInteractionModalOpen, setLogInteractionModalOpen] = useState(false);
  const [targetInteractionProspect, setTargetInteractionProspect] = useState<Prospect | null>(null);
  const { interactions: allInteractions, refetch: refetchInteractions } = useAllStaffInteractionsQuery();
  const logInteractionMutation = useLogInteractionMutation();

  // API Queries
  const { 
    data: appointmentsData, 
    isLoading: appointmentsLoading,
    refetch: refetchAppointments,
    error: appointmentsError
  } = useAppointmentsQuery({
    status: statusFilter !== 'all' ? statusFilter as AppointmentStatus : undefined,
  });

  const { data: branches = [] } = useBranchesQuery();
  const rawAppointments = appointmentsData?.items ?? [];
  const appointmentsList = React.useMemo(() => {
    return filterEntitiesByBranch(rawAppointments, user, branches);
  }, [rawAppointments, user, branches]);

  const { data: prospectsData, isLoading: prospectsLoading } = useProspectsQuery({ pageSize: 10000 });
  const { data: customersData, isLoading: customersLoading } = useCustomersQuery({ pageSize: 10000 });

  // Opening this page clears the "new appointments" nav badge (see NavMenu.tsx).
  useEffect(() => {
    if (user?.id) markSeen('appointments', user.id);
  }, [user?.id, appointmentsData]);

  // API Mutations
  const createAppointment = useCreateAppointmentMutation();
  const updateAppointment = useUpdateAppointmentMutation();

  // Combine prospects and customers safely for select dropdown with branch isolation
  const allEntities = React.useMemo(() => {
    const rawProspects = prospectsData?.items ?? [];
    const rawCustomers = customersData?.items ?? [];
    const prospects = filterEntitiesByBranch(rawProspects, user, branches);
    const customers = filterEntitiesByBranch(rawCustomers, user, branches);

    return [
      ...prospects.map((p) => ({
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
        phone: p.phoneNumber || '',
        type: 'prospect' as const,
      })),
      ...customers.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        phone: c.phoneNumber || '',
        type: 'customer' as const,
      })),
    ];
  }, [prospectsData, customersData, user, branches]);

  // Get entity details
  const getEntityDetails = (appointment: ApiAppointment) => {
    // Try to find in prospects or customers
    const entity = allEntities.find(e => e.id === appointment.prospectId || e.id === appointment.customerId);
    if (entity) {
      return { name: entity.name, phone: entity.phone };
    }
    return { name: 'Unknown', phone: '' };
  };

  // Handle create appointment with integrated booking interaction logging
  const handleAddAppointment = async (values: any) => {
    try {
      const reasonNotes = values.interactionNotes?.trim() || values.feedback?.trim() || undefined;
      const appointmentData: CreateAppointmentPayload = {
        prospectId: values.entityType === 'prospect' ? values.entityId : undefined,
        customerId: values.entityType === 'customer' ? values.entityId : undefined,
        scheduledFor: values.scheduledFor.toISOString(),
        reason: reasonNotes,
      };

      const created = await createAppointment.mutateAsync(tagPayloadWithBranch(appointmentData, user));
      const appointmentId = created?.id || `app_${Date.now()}`;

      // If interaction logging is enabled, record this booking discussion as an official staff interaction
      if (values.logBookingInteraction !== false) {
        const entity = allEntities.find((e) => e.id === values.entityId);
        const channel: InteractionChannel = values.interactionChannel || 'call';
        const discussion = values.interactionNotes?.trim() || values.feedback?.trim() || `Booked appointment for ${dayjs(values.scheduledFor).format('MMM D, YYYY h:mm A')}`;
        const staffFullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Staff Member';

        // 1. If prospect, attempt backend API logging
        if (values.entityType === 'prospect' && values.entityId) {
          try {
            await logInteractionMutation.mutateAsync({
              prospectId: values.entityId,
              channel,
              occurredAt: new Date().toISOString(),
              response: discussion,
            });
          } catch (apiErr) {
            console.warn('Backend interaction logging notice:', apiErr);
          }
        }

        // 2. Persist to synchronized interaction storage linked with this appointment
        saveStoredInteraction({
          id: `inter_book_${appointmentId}_${Date.now()}`,
          appointmentId,
          prospectId: values.entityType === 'prospect' ? values.entityId : undefined,
          customerId: values.entityType === 'customer' ? values.entityId : undefined,
          prospectName: entity?.name,
          prospectPhone: entity?.phone,
          prospectSource: values.entityType === 'prospect' ? 'marketing' : 'customer_service',
          channel,
          occurredAt: new Date().toISOString(),
          response: discussion,
          loggedByUserId: user?.id || '1',
          loggedByUserName: staffFullName,
          loggedByUserRole: user?.role || 'customer_service',
          loggedByUserEmail: user?.email || '',
          createdAt: new Date().toISOString(),
          interactionType: 'booking',
        });

        window.dispatchEvent(new Event('omark-interactions-changed'));
      }

      window.dispatchEvent(new Event('omark-appointments-changed'));
      message.success('Appointment created and booking interaction logged successfully!');
      setIsModalOpen(false);
      form.resetFields();
      refetchAppointments();
      refetchInteractions();
    } catch (error: any) {
      message.error(error?.message || 'Failed to create appointment');
    }
  };

  // Handle update status with audit trail interaction logging
  const handleUpdateStatus = async (values: {
    status: AppointmentStatus;
    feedback: string;
    rescheduleImmediately?: boolean;
    scheduledFor?: dayjs.Dayjs;
    rebookActionType?: 'reschedule' | 'rebook_new';
  }) => {
    if (!selectedAppointment) return;

    try {
      if (values.status === 'postponed' && values.rescheduleImmediately && values.scheduledFor) {
        if (values.rebookActionType === 'rebook_new') {
          // 1. Mark current appointment as postponed with notes
          await updateAppointment.mutateAsync({
            id: selectedAppointment.id,
            payload: {
              status: 'postponed',
              feedback: values.feedback 
                ? `${values.feedback} (Rebooked for ${values.scheduledFor.format('YYYY-MM-DD HH:mm')})`
                : `Postponed and rebooked for ${values.scheduledFor.format('YYYY-MM-DD HH:mm')}`,
            },
          });
          // 2. Create newly scheduled appointment
          const appointmentData: CreateAppointmentPayload = {
            prospectId: selectedAppointment.prospectId,
            customerId: selectedAppointment.customerId,
            scheduledFor: values.scheduledFor.toISOString(),
            reason: values.feedback || selectedAppointment.reason || 'Rebooked appointment',
          };
          await createAppointment.mutateAsync(tagPayloadWithBranch(appointmentData, user));
          message.success('Appointment marked as postponed and new appointment rebooked successfully!');
        } else {
          // Reschedule existing appointment date and set status to scheduled
          await updateAppointment.mutateAsync({
            id: selectedAppointment.id,
            payload: {
              status: 'scheduled',
              feedback: values.feedback || `Rescheduled on ${dayjs().format('YYYY-MM-DD')}`,
              scheduledFor: values.scheduledFor.toISOString(),
            },
          });
          message.success('Appointment rescheduled successfully!');
        }
      } else {
        // Standard status update
        await updateAppointment.mutateAsync({
          id: selectedAppointment.id,
          payload: {
            status: values.status,
            feedback: values.feedback,
            scheduledFor: (values.status === 'postponed' && values.scheduledFor)
              ? values.scheduledFor.toISOString()
              : undefined,
          },
        });
        message.success(`Appointment status updated to ${values.status}!`);
      }

      // Log status feedback note to communication audit trail
      if (values.feedback?.trim() && selectedAppointment) {
        const staffFullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Staff Member';
        const entity = getEntityDetails(selectedAppointment);
        saveStoredInteraction({
          id: `inter_status_${selectedAppointment.id}_${Date.now()}`,
          appointmentId: selectedAppointment.id,
          prospectId: selectedAppointment.prospectId,
          customerId: selectedAppointment.customerId,
          prospectName: entity.name,
          prospectPhone: entity.phone,
          prospectSource: selectedAppointment.prospectId ? 'marketing' : 'customer_service',
          channel: 'other',
          occurredAt: new Date().toISOString(),
          response: `[Status: ${values.status.toUpperCase()}] ${values.feedback.trim()}`,
          loggedByUserId: user?.id || '1',
          loggedByUserName: staffFullName,
          loggedByUserRole: user?.role || 'customer_service',
          loggedByUserEmail: user?.email || '',
          createdAt: new Date().toISOString(),
          interactionType: 'status_update',
        });
        window.dispatchEvent(new Event('omark-interactions-changed'));
      }

      window.dispatchEvent(new Event('omark-appointments-changed'));
      setUpdateStatusModal(false);
      setSelectedAppointment(null);
      statusForm.resetFields();
      refetchAppointments();
      refetchInteractions();
    } catch (error: any) {
      message.error(error?.message || 'Failed to update appointment status');
    }
  };

  // Helper to open interaction modal for appointment contact
  const handleOpenLogInteractionForAppointment = (appointment: Appointment) => {
    const matchedProspect = prospectsData?.items?.find((p) => p.id === appointment.prospectId) || ({
      id: appointment.prospectId || `pros_${appointment.id}`,
      firstName: getEntityDetails(appointment).name.split(' ')[0] || 'Client',
      lastName: getEntityDetails(appointment).name.split(' ').slice(1).join(' ') || '',
      phoneNumber: getEntityDetails(appointment).phone || '',
      source: appointment.prospectId ? 'marketing' : 'customer_service',
    } as Prospect);

    setTargetInteractionProspect(matchedProspect);
    setLogInteractionModalOpen(true);
  };

  // Rebook modal openers and handler
  const handleOpenRebookModal = (appointment: Appointment) => {
    setRebookAppointment(appointment);
    setRebookModalOpen(true);
    rebookForm.setFieldsValue({
      rebookMode: 'rebook_new',
      scheduledFor: appointment.scheduledFor ? dayjs(appointment.scheduledFor).add(1, 'day') : dayjs().add(1, 'day'),
      reason: appointment.reason || 'Client Consultation / Site Inspection',
      feedback: '',
    });
  };

  const handleRebookSubmit = async (values: {
    rebookMode: 'reschedule_existing' | 'rebook_new';
    scheduledFor: dayjs.Dayjs;
    reason?: string;
    feedback?: string;
  }) => {
    if (!rebookAppointment) return;

    try {
      if (values.rebookMode === 'rebook_new') {
        // 1. Mark original appointment as postponed if not already
        await updateAppointment.mutateAsync({
          id: rebookAppointment.id,
          payload: {
            status: 'postponed',
            feedback: values.feedback 
              ? `${values.feedback} (Rebooked for ${values.scheduledFor.format('MMM DD, YYYY HH:mm')})`
              : `Postponed and rebooked for ${values.scheduledFor.format('MMM DD, YYYY HH:mm')}`,
          },
        });
        // 2. Create the new appointment
        const appointmentData: CreateAppointmentPayload = {
          prospectId: rebookAppointment.prospectId,
          customerId: rebookAppointment.customerId,
          scheduledFor: values.scheduledFor.toISOString(),
          reason: values.reason || rebookAppointment.reason || 'Rebooked appointment',
        };
        await createAppointment.mutateAsync(tagPayloadWithBranch(appointmentData, user));
        message.success('Appointment rebooked successfully! A new appointment has been scheduled.');
      } else {
        // Reschedule existing appointment
        await updateAppointment.mutateAsync({
          id: rebookAppointment.id,
          payload: {
            status: 'scheduled',
            scheduledFor: values.scheduledFor.toISOString(),
            feedback: values.feedback || `Rescheduled from postponed on ${dayjs().format('MMM DD, YYYY')}`,
          },
        });
        message.success('Appointment rescheduled successfully!');
      }

      window.dispatchEvent(new Event('omark-appointments-changed'));
      setRebookModalOpen(false);
      setRebookAppointment(null);
      rebookForm.resetFields();
      if (viewDrawerOpen && selectedAppointment?.id === rebookAppointment.id) {
        setViewDrawerOpen(false);
      }
      refetchAppointments();
    } catch (error: any) {
      message.error(error?.message || 'Failed to rebook appointment');
    }
  };

  // Handle cancel appointment (closest supported semantic to "delete")
  const handleCancelAppointment = async (id: string) => {
    try {
      await updateAppointment.mutateAsync({
        id,
        payload: { status: 'canceled' },
      });
      message.success('Appointment canceled successfully!');
      refetchAppointments();
    } catch (error: any) {
      message.error(error?.message || 'Failed to cancel appointment');
    }
  };

  // Safely extract raw appointments
  const appointments: ApiAppointment[] = React.useMemo(() => {
    return appointmentsList;
  }, [appointmentsList]);

  // Map raw appointments to contain display-only date/time properties
  const mappedAppointments = React.useMemo(() => {
    return appointments.map((app) => {
      let date = '';
      let time = '';
      const d = dayjs(app.scheduledFor);
      if (d.isValid()) {
        date = d.format('YYYY-MM-DD');
        time = d.format('HH:mm');
      }
      return {
        ...app,
        date,
        time,
      } as Appointment;
    });
  }, [appointments]);

  // Filter appointments
  const filteredAppointments = React.useMemo(() => {
    return mappedAppointments.filter((app: Appointment) => {
      const entity = getEntityDetails(app);
      const name = entity.name.toLowerCase();
      const matchesSearch = name.includes(searchText.toLowerCase()) ||
                            entity.phone.includes(searchText);
      const matchesSource = sourceFilter === 'all' || app.source === sourceFilter;
      let matchesDate = true;
      if (dateRange) {
        const appDate = dayjs(`${app.date}T${app.time}`);
        matchesDate = appDate.isAfter(dateRange[0]) && appDate.isBefore(dateRange[1]);
      }
      return matchesSearch && matchesSource && matchesDate;
    });
  }, [mappedAppointments, searchText, sourceFilter, dateRange, allEntities]);

  // Status breakdown
  const statusBreakdown = React.useMemo(() => {
    return {
      total: mappedAppointments.length,
      scheduled: mappedAppointments.filter((a: Appointment) => a.status === 'scheduled').length,
      postponed: mappedAppointments.filter((a: Appointment) => a.status === 'postponed').length,
      completed: mappedAppointments.filter((a: Appointment) => a.status === 'completed').length,
      canceled: mappedAppointments.filter((a: Appointment) => a.status === 'canceled').length,
      noShow: mappedAppointments.filter((a: Appointment) => a.status === 'no_show').length,
    };
  }, [mappedAppointments]);

  // Source breakdown
  const sourceBreakdown = React.useMemo(() => {
    return {
      staff: mappedAppointments.filter((a: Appointment) => a.source === 'staff').length,
      website: mappedAppointments.filter((a: Appointment) => a.source === 'website').length,
    };
  }, [mappedAppointments]);

  // Export function
  const handleExport = () => {
    setExportLoading(true);
    const dataToExport = filteredAppointments.map((app: Appointment) => {
      const entity = getEntityDetails(app);
      return {
        'Customer/Prospect': entity.name,
        'Phone': entity.phone,
        'Date': dayjs(app.date).format('YYYY-MM-DD'),
        'Time': app.time,
        'Status': app.status,
        'Source': app.source,
        'Feedback': app.feedback || 'N/A',
        'Created': dayjs(app.createdAt).format('YYYY-MM-DD HH:mm'),
      };
    });

    const fileName = `appointments-${dayjs().format('YYYY-MM-DD-HHmmss')}`;
    
    try {
      const headers = ['Customer/Prospect', 'Phone', 'Date', 'Time', 'Status', 'Source', 'Feedback', 'Created'];
      const csvRows = [
        headers.join(','),
        ...dataToExport.map(row => 
          headers.map(header => {
            const val = row[header as keyof typeof row] || '';
            return `"${val.replace(/"/g, '""')}"`;
          }).join(',')
        )
      ];
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      message.success(`Exported ${dataToExport.length} appointments!`);
    } catch (err) {
      console.error('Export failed:', err);
      message.error('Export failed');
    } finally {
      setExportLoading(false);
      setExportModal(false);
    }
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
        user: appointment.source === 'website' ? 'Website Client' : 'Staff Member',
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

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case 'call':
        return { icon: <PhoneOutlined />, color: '#1677ff', bg: '#e6f4ff', label: 'Call' };
      case 'whatsapp':
        return { icon: <WhatsAppOutlined />, color: '#52c41a', bg: '#f6ffed', label: 'WhatsApp' };
      case 'in_person':
        return { icon: <UserOutlined />, color: '#722ed1', bg: '#f9f0ff', label: 'In-Person' };
      case 'email':
        return { icon: <MailOutlined />, color: '#faad14', bg: '#fffbe6', label: 'Email' };
      default:
        return { icon: <MessageOutlined />, color: '#8c8c8c', bg: '#f5f5f5', label: 'Note' };
    }
  };

  // Render Drawer Content
  const renderDrawerContent = () => {
    if (!selectedAppointment) return null;
    const entity = getEntityDetails(selectedAppointment);
    const statusConfig = getStatusConfig(selectedAppointment.status);
    const sourceConfig = getSourceConfig(selectedAppointment.source);
    const appointmentHistory = getAppointmentHistory(selectedAppointment);

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
              icon={<CalendarOutlined />} 
              style={{ backgroundColor: tokens.primary }}
            />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {`Appointment with ${entity.name}`}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <IdcardOutlined /> ID: {selectedAppointment.id}
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
          background: `${statusConfig.color}15`,
          border: `1px solid ${statusConfig.color}50`,
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Space>
            {statusConfig.icon}
            <Text strong>Status: {statusConfig.label}</Text>
          </Space>
          <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
        </div>

        {/* Action Buttons */}
        <div style={{ marginBottom: 24 }}>
          <Space wrap>
            {selectedAppointment.status === 'postponed' && (
              <Button
                type="primary"
                icon={<RedoOutlined />}
                style={{ backgroundColor: '#fa8c16', borderColor: '#fa8c16' }}
                onClick={() => {
                  handleOpenRebookModal(selectedAppointment);
                }}
              >
                Rebook / Reschedule
              </Button>
            )}
            <Button 
              type="primary" 
              icon={<EditOutlined />}
              onClick={() => {
                setUpdateStatusModal(true);
                statusForm.setFieldsValue({
                  status: selectedAppointment.status,
                  feedback: selectedAppointment.feedback || '',
                  rescheduleImmediately: false,
                  rebookActionType: 'rebook_new',
                });
                setViewDrawerOpen(false);
              }}
            >
              Update Status
            </Button>
            <Button
              icon={<MessageOutlined style={{ color: '#1677ff' }} />}
              onClick={() => {
                handleOpenLogInteractionForAppointment(selectedAppointment);
              }}
            >
              Log Interaction
            </Button>
            <Popconfirm
              title="Cancel Appointment"
              description="Are you sure you want to cancel this appointment?"
              onConfirm={() => {
                handleCancelAppointment(selectedAppointment.id);
                setViewDrawerOpen(false);
              }}
              okText="Yes"
              cancelText="No"
              disabled={selectedAppointment.status === 'canceled' || selectedAppointment.status === 'completed'}
            >
              <Button
                danger
                icon={<CloseCircleOutlined />}
                disabled={selectedAppointment.status === 'canceled' || selectedAppointment.status === 'completed'}
              >
                Cancel Appointment
              </Button>
            </Popconfirm>
          </Space>
        </div>

        {/* Appointment Details */}
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card size="small" title="Schedule Information" bordered={false} style={{ background: '#fafafa' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label={<Space><CalendarOutlined /> Date</Space>}>
                  <Text strong>{dayjs(selectedAppointment.date).format('MMMM DD, YYYY')}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Space><ClockCircleOutlined /> Time</Space>}>
                  <Text strong>{selectedAppointment.time}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Space><GlobalOutlined /> Booking Source</Space>}>
                  <Tag color={sourceConfig.color} icon={sourceConfig.icon}>
                    {sourceConfig.label}
                  </Tag>
                </Descriptions.Item>
                {selectedAppointment.reason && (
                  <Descriptions.Item label="Purpose / Agenda">
                    <Text strong style={{ color: '#1e293b' }}>{selectedAppointment.reason}</Text>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="Client Information" bordered={false} style={{ background: '#fafafa' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label={<Space><UserOutlined /> Name</Space>}>
                  <Text strong>{entity.name}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Space><PhoneOutlined /> Phone</Space>}>
                  {entity.phone ? (
                    <Space size={6}>
                      <a href={`tel:${entity.phone}`}>{entity.phone}</a>
                      <Button
                        size="small"
                        type="text"
                        icon={<WhatsAppOutlined style={{ color: '#52c41a' }} />}
                        onClick={() => {
                          const clean = entity.phone?.replace(/[^\d+]/g, '');
                          window.open(`https://wa.me/${clean}?text=${encodeURIComponent(`Hello ${entity.name}, regarding your appointment with Omark Real Estate.`)}`, '_blank');
                        }}
                      />
                    </Space>
                  ) : 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Relation">
                  <Tag color={selectedAppointment.prospectId ? 'blue' : 'green'}>
                    {selectedAppointment.prospectId ? 'Prospect' : 'Customer'}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {/* Aggregated Chronological Communication Record & Audit Trail */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card
              size="small"
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 8 }}>
                  <Space>
                    <HistoryOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                    <Text strong>Communication History & Chronological Audit Trail</Text>
                    <Badge
                      count={appointmentHistory.length}
                      style={{ backgroundColor: appointmentHistory.length > 0 ? '#1890ff' : '#d9d9d9' }}
                    />
                  </Space>
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => handleOpenLogInteractionForAppointment(selectedAppointment)}
                  >
                    Log Interaction
                  </Button>
                </div>
              }
              bordered={false}
              style={{ background: '#ffffff', border: '1px solid #f0f0f0', borderRadius: 8 }}
            >
              {appointmentHistory.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No interactions or communication history recorded yet for this appointment contact."
                >
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => handleOpenLogInteractionForAppointment(selectedAppointment)}
                  >
                    Log First Interaction
                  </Button>
                </Empty>
              ) : (
                <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: 8, paddingTop: 8 }}>
                  <Timeline mode="left">
                    {appointmentHistory.map((item) => {
                      const cfg = getChannelBadge(item.channel);
                      return (
                        <Timeline.Item
                          key={item.id}
                          dot={
                            <div
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: '50%',
                                backgroundColor: cfg.bg || '#e6f4ff',
                                border: `1.5px solid ${cfg.color}`,
                                color: cfg.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                              }}
                            >
                              {cfg.icon}
                            </div>
                          }
                          style={{ paddingBottom: 18 }}
                        >
                          <div
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: 8,
                              padding: '10px 12px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                              <Space size={6} wrap>
                                <Tag color={cfg.color} style={{ fontSize: 11, margin: 0 }}>
                                  {item.title}
                                </Tag>
                                <Text strong style={{ fontSize: 12 }}>
                                  {item.user}
                                </Text>
                                {item.role && (
                                  <Tag style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>
                                    {item.role}
                                  </Tag>
                                )}
                              </Space>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                <ClockCircleOutlined style={{ marginRight: 4 }} />
                                {dayjs(item.timestamp).format('MMM D, YYYY · h:mm A')} ({dayjs(item.timestamp).fromNow()})
                              </Text>
                            </div>
                            <div style={{ fontSize: 13, color: '#1e293b', marginTop: 4, lineHeight: '1.5' }}>
                              "{item.note}"
                            </div>
                          </div>
                        </Timeline.Item>
                      );
                    })}
                  </Timeline>
                </div>
              )}
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="System Info" bordered={false} style={{ background: '#fafafa' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Created At">
                  {dayjs(selectedAppointment.createdAt).format('MMMM DD, YYYY HH:mm')}
                </Descriptions.Item>
                <Descriptions.Item label="Last Updated">
                  {dayjs(selectedAppointment.updatedAt).format('MMMM DD, YYYY HH:mm')}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  // Table columns
  const columns = [
    {
      title: 'Customer/Prospect',
      key: 'entity',
      width: 200,
      render: (_: any, record: Appointment) => {
        const entity = getEntityDetails(record);
        return (
          <Space>
            {record.customerId ? (
              <PhotoUpload entityType="customer" entityId={record.customerId} size={32} editable={false} />
            ) : record.prospectId ? (
              <PhotoUpload entityType="prospect" entityId={record.prospectId} size={32} editable={false} />
            ) : (
              <Avatar icon={<UserOutlined />} style={{ backgroundColor: tokens.primary }} />
            )}
            <div>
              <Text strong>{entity.name}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                <PhoneOutlined /> {entity.phone}
              </Text>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Scheduled For',
      key: 'date',
      width: 180,
      render: (_: any, record: Appointment) => (
        <Space direction="vertical" size={0}>
          <Text strong>{dayjs(record.date).format('MMM DD, YYYY')}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <ClockCircleOutlined /> {record.time}
          </Text>
        </Space>
      ),
      sorter: (a: Appointment, b: Appointment) => 
        dayjs(`${a.date}T${a.time}`).unix() - dayjs(`${b.date}T${b.time}`).unix(),
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 150,
      render: (source: string) => {
        const config = getSourceConfig(source);
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status: string) => {
        const config = getStatusConfig(status);
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: 'Communication History',
      key: 'interactions',
      width: 220,
      render: (_: any, record: Appointment) => {
        const history = allInteractions.filter(
          (i) =>
            (record.id && i.appointmentId === record.id) ||
            (record.prospectId && i.prospectId === record.prospectId) ||
            (record.customerId && i.customerId === record.customerId)
        );
        const lastInteraction = history[0];
        const calls = history.filter((i) => i.channel === 'call').length;
        const whatsapp = history.filter((i) => i.channel === 'whatsapp').length;
        const visits = history.filter((i) => i.channel === 'in_person').length;

        return (
          <div
            style={{ cursor: 'pointer' }}
            onClick={() => {
              setSelectedAppointment(record);
              setViewDrawerOpen(true);
            }}
          >
            <Space wrap size={4}>
              <Badge
                count={history.length}
                overflowCount={99}
                style={{ backgroundColor: history.length > 0 ? '#1890ff' : '#d9d9d9' }}
              />
              <Text strong style={{ fontSize: 12, color: '#1890ff' }}>
                {history.length === 1 ? '1 interaction' : `${history.length} interactions`}
              </Text>
            </Space>
            {history.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {calls > 0 && <Tag color="blue" style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>📞 {calls}</Tag>}
                {whatsapp > 0 && <Tag color="green" style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>💬 {whatsapp}</Tag>}
                {visits > 0 && <Tag color="purple" style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>🏢 {visits}</Tag>}
              </div>
            )}
            {lastInteraction && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                <ClockCircleOutlined style={{ marginRight: 3 }} />
                {dayjs(lastInteraction.occurredAt).fromNow()}:{' '}
                <Text type="secondary" ellipsis style={{ maxWidth: 140, verticalAlign: 'bottom' }}>
                  {lastInteraction.response}
                </Text>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Feedback',
      dataIndex: 'feedback',
      key: 'feedback',
      width: 180,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <Text>{text || 'No feedback'}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => (
        <Tooltip title={dayjs(date).format('MMMM DD, YYYY HH:mm')}>
          {dayjs(date).fromNow()}
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 230,
      fixed: 'right' as const,
      render: (_: any, record: Appointment) => (
        <Space>
          {record.status === 'postponed' && (
            <Tooltip title="Rebook Postponed Appointment">
              <Button
                type="primary"
                ghost
                icon={<RedoOutlined />}
                style={{
                  color: '#fa8c16',
                  borderColor: '#fa8c16',
                  fontWeight: 600,
                  fontSize: 12,
                  padding: '0 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                onClick={() => handleOpenRebookModal(record)}
              >
                Rebook
              </Button>
            </Tooltip>
          )}
          <Tooltip title="View Details">
            <Button 
              type="primary"
              ghost
              icon={<EyeOutlined />} 
              onClick={() => {
                setSelectedAppointment(record);
                setViewDrawerOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Update Status">
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setSelectedAppointment(record);
                setUpdateStatusModal(true);
                statusForm.setFieldsValue({
                  status: record.status,
                  feedback: record.feedback || '',
                  rescheduleImmediately: false,
                  rebookActionType: 'rebook_new',
                });
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Cancel Appointment"
            description={`Are you sure you want to cancel this appointment?`}
            onConfirm={() => handleCancelAppointment(record.id)}
            okText="Yes"
            cancelText="No"
            disabled={record.status === 'canceled' || record.status === 'completed'}
          >
            <Tooltip title="Cancel">
              <Button
                danger
                icon={<CloseCircleOutlined />}
                disabled={record.status === 'canceled' || record.status === 'completed'}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Calendar view
  const renderCalendarView = () => {
    const getAppointmentsForDate = (date: dayjs.Dayjs) => {
      return filteredAppointments.filter((app: Appointment) => 
        dayjs(app.date).format('YYYY-MM-DD') === date.format('YYYY-MM-DD')
      );
    };

    const dateCellRender = (date: dayjs.Dayjs) => {
      const dayApps = getAppointmentsForDate(date);
      if (dayApps.length === 0) return null;
      
      return (
        <div style={{ marginTop: 4 }}>
          {dayApps.slice(0, 3).map((app: Appointment) => {
            const config = getStatusConfig(app.status);
            const entity = getEntityDetails(app);
            return (
              <div 
                key={app.id}
                style={{
                  padding: '2px 4px',
                  marginBottom: 2,
                  background: `${config.color}20`,
                  borderRadius: 4,
                  fontSize: 11,
                  cursor: 'pointer',
                  borderLeft: `2px solid ${config.color}`,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                onClick={() => {
                  setSelectedAppointment(app);
                  setViewDrawerOpen(true);
                }}
              >
                <Text style={{ fontSize: 10 }}>
                  {app.time} - {entity.name}
                </Text>
              </div>
            );
          })}
          {dayApps.length > 3 && (
            <Text type="secondary" style={{ fontSize: 10 }}>
              +{dayApps.length - 3} more
            </Text>
          )}
        </div>
      );
    };

    return (
      <Card>
        <Calendar 
          dateCellRender={dateCellRender}
          headerRender={({ value, onChange }) => (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '8px 16px',
              background: '#fafafa',
              borderRadius: 8,
              marginBottom: 16
            }}>
              <Button 
                icon={<ArrowLeftOutlined />} 
                onClick={() => onChange(value.clone().subtract(1, 'month'))}
              />
              <Title level={4} style={{ margin: 0 }}>
                {value.format('MMMM YYYY')}
              </Title>
              <Button 
                icon={<ArrowRightOutlined />} 
                onClick={() => onChange(value.clone().add(1, 'month'))}
              />
            </div>
          )}
        />
      </Card>
    );
  };



  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden', padding: '0 4px' }}>
      <PageHeader
        title="Appointments"
        actions={[
          {
            label: 'Client Check-Ins',
            onClick: () => navigate('/cs/check-ins'),
            icon: <IdcardOutlined />,
          },
          {
            label: 'Add Appointment',
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
            onClick: () => refetchAppointments(),
            icon: <ReloadOutlined />,
          },
        ]}
      />

      {/* Status Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={6} lg={3} style={{ flex: '1 1 140px' }}>
          <Card size="small">
            <Statistic
              title="Total"
              value={statusBreakdown.total}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: tokens.primary }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={3} style={{ flex: '1 1 140px' }}>
          <Card size="small">
            <Statistic
              title="Scheduled"
              value={statusBreakdown.scheduled}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={3} style={{ flex: '1 1 140px' }}>
          <Card size="small">
            <Statistic
              title="Postponed"
              value={statusBreakdown.postponed}
              prefix={<FieldTimeOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={3} style={{ flex: '1 1 140px' }}>
          <Card size="small">
            <Statistic
              title="Completed"
              value={statusBreakdown.completed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={3} style={{ flex: '1 1 140px' }}>
          <Card size="small">
            <Statistic
              title="Canceled"
              value={statusBreakdown.canceled}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={3} style={{ flex: '1 1 140px' }}>
          <Card size="small">
            <Statistic
              title="No Show"
              value={statusBreakdown.noShow}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={3} style={{ flex: '1 1 140px' }}>
          <Card size="small">
            <Statistic
              title="Website Bookings"
              value={sourceBreakdown.website}
              prefix={<GlobalOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters and View Controls */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Input
              placeholder="Search by name or phone"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="middle"
            />
          </Col>
          <Col xs={12} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Filter by status"
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
              size="middle"
            >
              <Option value="all">All Statuses</Option>
              <Option value="scheduled">Scheduled</Option>
              <Option value="postponed">Postponed</Option>
              <Option value="completed">Completed</Option>
              <Option value="canceled">Canceled</Option>
              <Option value="no_show">No Show</Option>
            </Select>
          </Col>
          <Col xs={12} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Filter by source"
              value={sourceFilter}
              onChange={setSourceFilter}
              allowClear
              size="middle"
            >
              <Option value="all">All Sources</Option>
              <Option value="staff">Staff Created</Option>
              <Option value="website">Website Booking</Option>
            </Select>
          </Col>
          <Col xs={24} md={6}>
            <RangePicker 
              style={{ width: '100%' }}
              onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
              size="middle"
              placeholder={['Start Date', 'End Date']}
            />
          </Col>
          <Col xs={12} md={4}>
            <Segmented
              style={{ width: '100%' }}
              value={viewMode}
              onChange={(value) => setViewMode(value as 'list' | 'calendar')}
              options={[
                { value: 'list', icon: <UnorderedListOutlined />, label: 'List' },
                { value: 'calendar', icon: <CalendarOutlined />, label: 'Calendar' },
              ]}
              block
            />
          </Col>
        </Row>
      </Card>

      {/* View Content */}
      {viewMode === 'list' ? (
        <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
          <Table
            columns={columns}
            dataSource={filteredAppointments}
            rowKey="id"
            loading={appointmentsLoading}
            size="middle"
            scroll={{ x: 1200 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} appointments`,
              responsive: true,
            }}
            expandable={{
              expandedRowRender: (record: Appointment) => {
                const history = getAppointmentHistory(record);
                if (history.length === 0) {
                  return (
                    <div style={{ padding: '8px 16px', background: '#fafafa', borderRadius: 6 }}>
                      <Text type="secondary">No logged communications recorded for this appointment contact yet. </Text>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => handleOpenLogInteractionForAppointment(record)}
                      >
                        + Log First Interaction
                      </Button>
                    </div>
                  );
                }
                return (
                  <div style={{ padding: '12px 18px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                      <Space>
                        <HistoryOutlined style={{ color: '#1890ff' }} />
                        <Text strong style={{ fontSize: 13 }}>
                          Chronological Communication Audit Trail ({history.length} events)
                        </Text>
                      </Space>
                      <Space>
                        <Button
                          size="small"
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() => handleOpenLogInteractionForAppointment(record)}
                        >
                          Log Interaction
                        </Button>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => {
                            setSelectedAppointment(record);
                            setViewDrawerOpen(true);
                          }}
                        >
                          Open Full Details Drawer →
                        </Button>
                      </Space>
                    </div>
                    <Timeline mode="left">
                      {history.slice(0, 3).map((item) => {
                        const cfg = getChannelBadge(item.channel);
                        return (
                          <Timeline.Item
                            key={item.id}
                            dot={
                              <div
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: '50%',
                                  backgroundColor: cfg.bg,
                                  border: `1.5px solid ${cfg.color}`,
                                  color: cfg.color,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 10,
                                }}
                              >
                                {cfg.icon}
                              </div>
                            }
                          >
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <Tag color={cfg.color} style={{ margin: 0, fontSize: 11 }}>{item.title}</Tag>
                              <Text strong style={{ fontSize: 12 }}>{item.user}</Text>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                {dayjs(item.timestamp).format('MMM D, h:mm A')} ({dayjs(item.timestamp).fromNow()})
                              </Text>
                            </div>
                            <div style={{ fontSize: 12, marginTop: 3, color: '#334155' }}>
                              "{item.note}"
                            </div>
                          </Timeline.Item>
                        );
                      })}
                    </Timeline>
                  </div>
                );
              },
            }}
          />
        </div>
      ) : (
        renderCalendarView()
      )}

      {/* Add Appointment Modal */}
      <Modal
        title={
          <Space>
            <PlusOutlined style={{ color: tokens.primary }} />
            <Text strong>Add Appointment & Log Booking Interaction</Text>
          </Space>
        }
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
          onFinish={handleAddAppointment}
          initialValues={{
            logBookingInteraction: true,
            interactionChannel: 'call',
          }}
        >
          <Form.Item
            name="entityType"
            label="Appointment With"
            rules={[{ required: true, message: 'Please select entity type' }]}
          >
            <Select placeholder="Select type">
              <Option value="prospect">Prospect</Option>
              <Option value="customer">Customer</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="entityId"
            label="Select Person"
            rules={[{ required: true, message: 'Please select a person' }]}
          >
            <Select 
              placeholder="Search by name" 
              showSearch
              optionFilterProp="children"
            >
              {allEntities.map(entity => (
                <Option key={`${entity.type}-${entity.id}`} value={entity.id}>
                  {entity.name} - {entity.phone} ({entity.type})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="scheduledFor"
            label="Date & Time"
            rules={[{ required: true, message: 'Please select date and time' }]}
          >
            <DatePicker 
              showTime 
              format="YYYY-MM-DD HH:mm" 
              style={{ width: '100%' }}
              placeholder="Select date and time"
            />
          </Form.Item>

          <Form.Item
            name="feedback"
            label="Appointment Purpose / Agenda"
          >
            <TextArea rows={2} placeholder="e.g. Site inspection and deed discussion" />
          </Form.Item>

          {/* Integrated Booking Interaction Logging */}
          <Card
            size="small"
            style={{
              marginBottom: 16,
              background: '#f0f7ff',
              border: '1px solid #bae0ff',
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Space>
                <MessageOutlined style={{ color: '#1677ff', fontSize: 16 }} />
                <div>
                  <Text strong style={{ color: '#0958d9' }}>Log Booking Interaction Record</Text>
                  <div style={{ fontSize: 12, color: '#595959' }}>
                    Record communication details directly as you schedule this meeting
                  </div>
                </div>
              </Space>
              <Form.Item name="logBookingInteraction" valuePropName="checked" noStyle initialValue={true}>
                <Switch defaultChecked checkedChildren="YES" unCheckedChildren="NO" />
              </Form.Item>
            </div>

            <Form.Item
              noStyle
              shouldUpdate={(prev, cur) => prev.logBookingInteraction !== cur.logBookingInteraction}
            >
              {({ getFieldValue }) => {
                const isLogging = getFieldValue('logBookingInteraction') !== false;
                if (!isLogging) return null;

                return (
                  <div style={{ paddingTop: 10, borderTop: '1px dashed #bae0ff' }}>
                    <Form.Item
                      name="interactionChannel"
                      label="Communication Channel"
                      initialValue="call"
                      rules={[{ required: true, message: 'Please select communication channel' }]}
                    >
                      <Select placeholder="Select channel">
                        <Option value="call">📞 Phone Call</Option>
                        <Option value="whatsapp">💬 WhatsApp Message</Option>
                        <Option value="in_person">🏢 In-Person / Office Consultation</Option>
                        <Option value="email">✉️ Email</Option>
                        <Option value="sms">📱 SMS</Option>
                      </Select>
                    </Form.Item>

                    <Form.Item
                      name="interactionNotes"
                      label="Discussion Notes & Client Response"
                      rules={[{ required: true, message: 'Please provide conversation notes for this booking' }]}
                    >
                      <TextArea
                        rows={3}
                        placeholder="e.g. Client confirmed telephone inquiry. Agreed to attend site visit on Friday. Mentioned preference for 2-bedroom executive plots."
                      />
                    </Form.Item>
                  </div>
                );
              }}
            </Form.Item>
          </Card>

          <Form.Item>
            <Space wrap>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={createAppointment.isPending}
              >
                Create Appointment & Record Log
              </Button>
              <Button onClick={() => {
                setIsModalOpen(false);
                form.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Update Status Modal */}
      <Modal
        title="Update Appointment Status"
        open={updateStatusModal}
        onCancel={() => {
          setUpdateStatusModal(false);
          setSelectedAppointment(null);
          statusForm.resetFields();
        }}
        footer={null}
        width={500}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px' }}
      >
        <Form
          form={statusForm}
          layout="vertical"
          onFinish={handleUpdateStatus}
          initialValues={{
            rescheduleImmediately: false,
            rebookActionType: 'rebook_new',
          }}
        >
          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Please select a status' }]}
          >
            <Select placeholder="Select new status">
              <Option value="scheduled">Scheduled</Option>
              <Option value="postponed">Postponed</Option>
              <Option value="completed">Completed</Option>
              <Option value="canceled">Canceled</Option>
              <Option value="no_show">No Show</Option>
            </Select>
          </Form.Item>

          {/* If postponed is selected, offer immediate rescheduling/rebooking option */}
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.status !== cur.status}
          >
            {({ getFieldValue }) => {
              const currentStatus = getFieldValue('status');
              if (currentStatus !== 'postponed') return null;

              return (
                <div
                  style={{
                    background: '#fffbe6',
                    border: '1px solid #ffe58f',
                    borderRadius: 8,
                    padding: 14,
                    marginBottom: 16,
                  }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FieldTimeOutlined style={{ color: '#fa8c16', fontSize: 16 }} />
                      <Text strong style={{ color: '#d46b08' }}>
                        Postponed Appointment Action
                      </Text>
                    </div>
                    <Text style={{ fontSize: 12, color: '#8c6b00' }}>
                      Marking as postponed pauses this appointment. You can pick a new date now to immediately reschedule or rebook, or postpone it now and rebook later.
                    </Text>

                    <Form.Item
                      name="rescheduleImmediately"
                      valuePropName="value"
                      style={{ marginBottom: 8, marginTop: 4 }}
                    >
                      <Radio.Group>
                        <Space direction="vertical">
                          <Radio value={false}>Keep postponed (rebook later)</Radio>
                          <Radio value={true}>Reschedule / Rebook right now</Radio>
                        </Space>
                      </Radio.Group>
                    </Form.Item>

                    <Form.Item
                      noStyle
                      shouldUpdate={(p, c) => p.rescheduleImmediately !== c.rescheduleImmediately}
                    >
                      {({ getFieldValue: getInnerField }) => {
                        if (!getInnerField('rescheduleImmediately')) return null;

                        return (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #ffd591' }}>
                            <Form.Item
                              name="rebookActionType"
                              label={<Text strong style={{ fontSize: 12 }}>Action Type</Text>}
                              style={{ marginBottom: 12 }}
                            >
                              <Radio.Group size="small">
                                <Radio.Button value="rebook_new">
                                  Rebook as New Appointment (Keep Audit Trail)
                                </Radio.Button>
                                <Radio.Button value="reschedule">
                                  Update Existing Date
                                </Radio.Button>
                              </Radio.Group>
                            </Form.Item>

                            <Form.Item
                              name="scheduledFor"
                              label={<Text strong style={{ fontSize: 12 }}>New Date & Time</Text>}
                              rules={[{ required: true, message: 'Please choose the new date & time' }]}
                              style={{ marginBottom: 0 }}
                            >
                              <DatePicker
                                showTime={{ format: 'hh:mm A' }}
                                format="YYYY-MM-DD hh:mm A"
                                style={{ width: '100%' }}
                                placeholder="Select rescheduled date and time"
                                disabledDate={(current) => current && current < dayjs().startOf('day')}
                              />
                            </Form.Item>
                          </div>
                        );
                      }}
                    </Form.Item>
                  </Space>
                </div>
              );
            }}
          </Form.Item>

          <Form.Item
            name="feedback"
            label="Notes / Reason for Postponement or Update"
          >
            <TextArea rows={3} placeholder="Add reason for postponement or any notes..." />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space wrap>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateAppointment.isPending || createAppointment.isPending}
              >
                Update Status
              </Button>
              <Button onClick={() => {
                setUpdateStatusModal(false);
                setSelectedAppointment(null);
                statusForm.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Dedicated Rebook Postponed Appointment Modal */}
      <Modal
        title={
          <Space>
            <RedoOutlined style={{ color: '#fa8c16' }} />
            <Text strong>Rebook Postponed Appointment</Text>
          </Space>
        }
        open={rebookModalOpen}
        onCancel={() => {
          setRebookModalOpen(false);
          setRebookAppointment(null);
          rebookForm.resetFields();
        }}
        footer={null}
        destroyOnClose
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '20px' }}
      >
        {rebookAppointment && (() => {
          const entity = getEntityDetails(rebookAppointment);
          return (
            <div>
              {/* Header card with client info */}
              <div
                style={{
                  background: '#f6ffed',
                  border: '1px solid #b7eb8f',
                  borderRadius: 8,
                  padding: '12px 16px',
                  marginBottom: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div>
                  <Text strong style={{ fontSize: 15, display: 'block' }}>
                    {entity.name}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <PhoneOutlined /> {entity.phone || 'No phone'} ·{' '}
                    <Tag color={rebookAppointment.prospectId ? 'blue' : 'green'} style={{ margin: 0 }}>
                      {rebookAppointment.prospectId ? 'Prospect' : 'Customer'}
                    </Tag>
                  </Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                    Original Scheduled:
                  </Text>
                  <Tag color="orange" icon={<FieldTimeOutlined />}>
                    {dayjs(rebookAppointment.scheduledFor).format('MMM D, YYYY · h:mm A')}
                  </Tag>
                </div>
              </div>

              <Form
                form={rebookForm}
                layout="vertical"
                onFinish={handleRebookSubmit}
                initialValues={{
                  rebookMode: 'rebook_new',
                  scheduledFor: dayjs().add(1, 'day').hour(10).minute(0),
                  reason: rebookAppointment.reason || '',
                  feedback: '',
                }}
              >
                <Form.Item
                  name="rebookMode"
                  label={<Text strong>Rebooking Method</Text>}
                  rules={[{ required: true }]}
                >
                  <Radio.Group style={{ width: '100%' }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Radio value="rebook_new" style={{ alignItems: 'flex-start' }}>
                        <div>
                          <Text strong>Rebook as New Appointment (Recommended)</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Creates a new scheduled appointment while maintaining the original record marked as Postponed for history/audit tracking.
                          </Text>
                        </div>
                      </Radio>
                      <Radio value="reschedule_existing" style={{ alignItems: 'flex-start', marginTop: 8 }}>
                        <div>
                          <Text strong>Reschedule Existing Appointment</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Updates this appointment's date/time directly and restores its status to Scheduled.
                          </Text>
                        </div>
                      </Radio>
                    </Space>
                  </Radio.Group>
                </Form.Item>

                <Form.Item
                  name="scheduledFor"
                  label={<Text strong>New Appointment Date & Time</Text>}
                  rules={[{ required: true, message: 'Please pick the new date and time' }]}
                >
                  <DatePicker
                    showTime={{ format: 'hh:mm A' }}
                    format="YYYY-MM-DD hh:mm A"
                    style={{ width: '100%' }}
                    placeholder="Select new appointment date and time"
                    disabledDate={(current) => current && current < dayjs().startOf('day')}
                  />
                </Form.Item>

                <Form.Item
                  name="reason"
                  label={<Text strong>Appointment Agenda / Reason</Text>}
                >
                  <Input placeholder="e.g., Client Consultation, Site Inspection, Follow-up" />
                </Form.Item>

                <Form.Item
                  name="feedback"
                  label={<Text strong>Rebooking Notes / Reason for Postponement</Text>}
                >
                  <TextArea
                    rows={2}
                    placeholder="Optional notes explaining why the appointment was rescheduled/rebooked..."
                  />
                </Form.Item>

                <Form.Item style={{ marginBottom: 0, marginTop: 20 }}>
                  <Space wrap style={{ width: '100%', justifyContent: 'flex-end' }}>
                    <Button
                      onClick={() => {
                        setRebookModalOpen(false);
                        setRebookAppointment(null);
                        rebookForm.resetFields();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<RedoOutlined />}
                      loading={createAppointment.isPending || updateAppointment.isPending}
                      style={{ background: '#fa8c16', borderColor: '#fa8c16' }}
                    >
                      Confirm Rebook / Reschedule
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </div>
          );
        })()}
      </Modal>

      {/* Export Modal */}
      <Modal
        title={
          <Space>
            <ExportOutlined style={{ color: tokens.primary }} />
            <Text strong>Export Appointments</Text>
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
          message={`${filteredAppointments.length} appointments will be exported`}
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
            <InfoCircleOutlined /> The export will include all filtered appointments with their current status and details.
          </Text>
        </div>
      </Modal>

      {/* Premium Drawer */}
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
        {selectedAppointment && renderDrawerContent()}
      </Drawer>

      {/* Log Interaction Modal */}
      <LogInteractionModal
        open={logInteractionModalOpen}
        prospect={targetInteractionProspect}
        appointmentId={selectedAppointment?.id}
        customerId={selectedAppointment?.customerId}
        onClose={() => {
          setLogInteractionModalOpen(false);
          setTargetInteractionProspect(null);
        }}
        onLogged={() => {
          refetchInteractions();
          refetchAppointments();
        }}
      />
    </div>
  );
};