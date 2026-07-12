// src/pages/cs/AppointmentsPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Space, Modal, Form, Input, Select, Row, Col, Table,
  Tag, message, Typography, Card, Avatar, Badge, Tooltip,
  DatePicker, Statistic, Divider, Empty,
  Dropdown, Popconfirm, Alert, Drawer, Descriptions,
  Timeline, Segmented, Calendar, Radio, Spin
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
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
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

type Appointment = ApiAppointment & {
  date: string;
  time: string;
};
import { useProspectsQuery } from '@/api/prospects';
import { useCustomersQuery } from '@/api/customers';
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

  // Export states
  const [exportModal, setExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv' | 'pdf' | 'json'>('excel');
  const [exportLoading, setExportLoading] = useState(false);

  // API Queries
  const { 
    data: appointmentsData, 
    isLoading: appointmentsLoading,
    refetch: refetchAppointments,
    error: appointmentsError
  } = useAppointmentsQuery({
    status: statusFilter !== 'all' ? statusFilter as AppointmentStatus : undefined,
  });

  const { data: prospectsData, isLoading: prospectsLoading } = useProspectsQuery({ pageSize: 100 });
  const { data: customersData, isLoading: customersLoading } = useCustomersQuery({ pageSize: 100 });

  // API Mutations
  const createAppointment = useCreateAppointmentMutation();
  const updateAppointment = useUpdateAppointmentMutation();

  // Combine prospects and customers safely for select dropdown
  const allEntities = React.useMemo(() => {
    const prospects = prospectsData?.items ?? [];
    const customers = customersData?.items ?? [];

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
  }, [prospectsData, customersData]);

  // Get entity details
  const getEntityDetails = (appointment: ApiAppointment) => {
    // Try to find in prospects or customers
    const entity = allEntities.find(e => e.id === appointment.prospectId || e.id === appointment.customerId);
    if (entity) {
      return { name: entity.name, phone: entity.phone };
    }
    return { name: 'Unknown', phone: '' };
  };

  // Handle create appointment
  const handleAddAppointment = async (values: any) => {
    try {
      const appointmentData: CreateAppointmentPayload = {
        prospectId: values.entityType === 'prospect' ? values.entityId : undefined,
        customerId: values.entityType === 'customer' ? values.entityId : undefined,
        scheduledFor: values.scheduledFor.toISOString(),
        reason: values.feedback || undefined,
      };

      await createAppointment.mutateAsync(appointmentData);
      message.success('Appointment created successfully!');
      setIsModalOpen(false);
      form.resetFields();
      refetchAppointments();
    } catch (error: any) {
      message.error(error?.message || 'Failed to create appointment');
    }
  };

  // Handle update status
  const handleUpdateStatus = async (values: { status: AppointmentStatus; feedback: string }) => {
    if (!selectedAppointment) return;

    try {
      await updateAppointment.mutateAsync({
        id: selectedAppointment.id,
        payload: {
          status: values.status,
          feedback: values.feedback,
        },
      });
      message.success(`Appointment status updated to ${values.status}!`);
      setUpdateStatusModal(false);
      setSelectedAppointment(null);
      statusForm.resetFields();
      refetchAppointments();
    } catch (error: any) {
      message.error(error?.message || 'Failed to update appointment status');
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
    return appointmentsData?.items ?? [];
  }, [appointmentsData]);

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

  // Render Drawer Content
  const renderDrawerContent = () => {
    if (!selectedAppointment) return null;
    const entity = getEntityDetails(selectedAppointment);
    const statusConfig = getStatusConfig(selectedAppointment.status);
    const sourceConfig = getSourceConfig(selectedAppointment.source);

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

        {/* Quick Actions */}
        <div style={{ marginBottom: 24 }}>
          <Space wrap>
            <Button 
              type="primary" 
              icon={<EditOutlined />}
              onClick={() => {
                setUpdateStatusModal(true);
                statusForm.setFieldsValue({
                  status: selectedAppointment.status,
                  feedback: selectedAppointment.feedback || '',
                });
                setViewDrawerOpen(false);
              }}
            >
              Update Status
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
                  {entity.phone ? <a href={`tel:${entity.phone}`}>{entity.phone}</a> : 'N/A'}
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

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="Notes & Feedback" bordered={false} style={{ background: '#fafafa' }}>
              <Text>{selectedAppointment.feedback || 'No notes or feedback registered for this appointment.'}</Text>
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
            <Avatar icon={<UserOutlined />} style={{ backgroundColor: tokens.primary }} />
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
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: Appointment) => (
        <Space>
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

  // Handle loading state
  if (appointmentsLoading || prospectsLoading || customersLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Spin size="large" tip="Loading appointments..." />
      </div>
    );
  }

  // Handle error state
  if (appointmentsError) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="Error Loading Appointments"
          description={
            (appointmentsError as any)?.error?.message ||
            (appointmentsError as any)?.message ||
            'There was an error loading the appointments. Please try again.'
          }
          type="error"
          showIcon
          action={
            <Button size="small" type="primary" onClick={() => refetchAppointments()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden', padding: '0 4px' }}>
      <PageHeader
        title="Appointments"
        actions={[
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
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Total"
              value={statusBreakdown.total}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: tokens.primary }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Scheduled"
              value={statusBreakdown.scheduled}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Completed"
              value={statusBreakdown.completed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Canceled"
              value={statusBreakdown.canceled}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="No Show"
              value={statusBreakdown.noShow}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
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
            <Text strong>Add Appointment</Text>
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
            label="Notes / Purpose"
          >
            <TextArea rows={3} placeholder="Describe the purpose of this appointment" />
          </Form.Item>

          <Form.Item>
            <Space wrap>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={createAppointment.isPending}
              >
                Create Appointment
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
        >
          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Please select a status' }]}
          >
            <Select placeholder="Select new status">
              <Option value="scheduled">Scheduled</Option>
              <Option value="completed">Completed</Option>
              <Option value="canceled">Canceled</Option>
              <Option value="no_show">No Show</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="feedback"
            label="Notes / Feedback"
          >
            <TextArea rows={3} placeholder="Add any feedback or notes" />
          </Form.Item>

          <Form.Item>
            <Space wrap>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateAppointment.isPending}
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
    </div>
  );
};