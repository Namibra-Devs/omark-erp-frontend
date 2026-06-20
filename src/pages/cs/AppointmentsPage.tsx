// src/pages/cs/AppointmentsPage.tsx (Fixed version)
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Space, Modal, Form, Input, Select, Row, Col, Table,
  Tag, message, Typography, Card, Avatar, Badge, Tooltip,
  DatePicker, Statistic, Divider, Empty,
  Dropdown, Popconfirm, Alert, Drawer, Descriptions,
  Timeline, Segmented, Calendar, Radio
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
import type { Appointment, AppointmentStatus } from '@/types';
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

// Mock data for appointments
const mockAppointments: Appointment[] = [
  {
    id: 'app1',
    prospectId: 'cs1',
    customerId: undefined,
    source: 'staff',
    scheduledFor: '2024-01-20T10:00:00Z',
    status: 'scheduled',
    feedback: 'Initial consultation about property maintenance',
    createdByUserId: '4',
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 'app2',
    prospectId: 'cs2',
    customerId: undefined,
    source: 'website',
    scheduledFor: '2024-01-21T14:30:00Z',
    status: 'scheduled',
    feedback: 'Online booking for property documentation inquiry',
    createdByUserId: '4',
    createdAt: '2024-01-14T10:30:00Z',
    updatedAt: '2024-01-14T10:30:00Z',
  },
  {
    id: 'app3',
    prospectId: undefined,
    customerId: 'c1',
    source: 'staff',
    scheduledFor: '2024-01-18T09:00:00Z',
    status: 'completed',
    feedback: 'Property inspection completed successfully. Customer satisfied.',
    createdByUserId: '4',
    createdAt: '2024-01-13T11:00:00Z',
    updatedAt: '2024-01-18T09:30:00Z',
  },
  {
    id: 'app4',
    prospectId: 'cs4',
    customerId: undefined,
    source: 'website',
    scheduledFor: '2024-01-19T15:00:00Z',
    status: 'canceled',
    feedback: 'Customer canceled due to emergency',
    createdByUserId: '4',
    createdAt: '2024-01-12T14:00:00Z',
    updatedAt: '2024-01-19T08:00:00Z',
  },
  {
    id: 'app5',
    prospectId: 'cs5',
    customerId: undefined,
    source: 'staff',
    scheduledFor: '2024-01-22T11:30:00Z',
    status: 'scheduled',
    feedback: 'Follow-up meeting about property upgrade',
    createdByUserId: '4',
    createdAt: '2024-01-11T09:00:00Z',
    updatedAt: '2024-01-11T09:00:00Z',
  },
  {
    id: 'app6',
    prospectId: undefined,
    customerId: 'c2',
    source: 'website',
    scheduledFor: '2024-01-17T13:00:00Z',
    status: 'no_show',
    feedback: 'Customer did not show up for appointment',
    createdByUserId: '4',
    createdAt: '2024-01-10T16:00:00Z',
    updatedAt: '2024-01-17T14:00:00Z',
  },
];

// Mock customer/prospect names for display
const mockNames: Record<string, { name: string; phone: string }> = {
  'cs1': { name: 'Alice Johnson', phone: '+233241234580' },
  'cs2': { name: 'Robert Williams', phone: '+233241234581' },
  'cs3': { name: 'Maria Garcia', phone: '+233241234582' },
  'cs4': { name: 'James Brown', phone: '+233241234583' },
  'cs5': { name: 'Patricia Davis', phone: '+233241234584' },
  'c1': { name: 'John Doe', phone: '+233241234567' },
  'c2': { name: 'Jane Smith', phone: '+233241234568' },
};

export const AppointmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // States
  const [loading, setLoading] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  
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
  const [exportData, setExportData] = useState<any[]>([]);

  // Add appointment
  const handleAddAppointment = (values: any) => {
    setLoading(true);
    setTimeout(() => {
      const entityId = values.entityId;
      const entityData = mockNames[entityId];
      
      const newAppointment: Appointment = {
        id: `app${Date.now()}`,
        prospectId: values.entityType === 'prospect' ? entityId : undefined,
        customerId: values.entityType === 'customer' ? entityId : undefined,
        source: 'staff',
        scheduledFor: values.scheduledFor.toISOString(),
        status: 'scheduled',
        feedback: values.feedback || '',
        createdByUserId: user?.id || '4',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setAppointments([newAppointment, ...appointments]);
      setLoading(false);
      setIsModalOpen(false);
      form.resetFields();
      message.success(`Appointment created with ${entityData.name}!`);
    }, 800);
  };

  // Update appointment status
  const handleUpdateStatus = (values: { status: AppointmentStatus; feedback: string }) => {
    if (!selectedAppointment) return;
    
    setLoading(true);
    setTimeout(() => {
      setAppointments(appointments.map(app => 
        app.id === selectedAppointment.id 
          ? { ...app, status: values.status, feedback: values.feedback, updatedAt: new Date().toISOString() }
          : app
      ));
      setLoading(false);
      setUpdateStatusModal(false);
      setSelectedAppointment(null);
      statusForm.resetFields();
      message.success(`Appointment status updated to ${values.status}!`);
    }, 500);
  };

  // Delete appointment
  const handleDeleteAppointment = (id: string) => {
    setAppointments(appointments.filter(app => app.id !== id));
    message.success('Appointment deleted successfully!');
  };

  // Get customer/prospect name
  const getEntityName = (appointment: Appointment) => {
    if (appointment.customerId && mockNames[appointment.customerId]) {
      return mockNames[appointment.customerId].name;
    }
    if (appointment.prospectId && mockNames[appointment.prospectId]) {
      return mockNames[appointment.prospectId].name;
    }
    return 'Unknown';
  };

  const getEntityPhone = (appointment: Appointment) => {
    if (appointment.customerId && mockNames[appointment.customerId]) {
      return mockNames[appointment.customerId].phone;
    }
    if (appointment.prospectId && mockNames[appointment.prospectId]) {
      return mockNames[appointment.prospectId].phone;
    }
    return '';
  };

  // Filter appointments
  const filteredAppointments = appointments.filter(app => {
    const name = getEntityName(app).toLowerCase();
    const matchesSearch = name.includes(searchText.toLowerCase()) ||
                          getEntityPhone(app).includes(searchText);
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || app.source === sourceFilter;
    let matchesDate = true;
    if (dateRange) {
      const appDate = dayjs(app.scheduledFor);
      matchesDate = appDate.isAfter(dateRange[0]) && appDate.isBefore(dateRange[1]);
    }
    return matchesSearch && matchesStatus && matchesSource && matchesDate;
  });

  // Export function
  const handleExport = () => {
    setExportLoading(true);
    const dataToExport = filteredAppointments.map(app => ({
      'Customer/Prospect': getEntityName(app),
      'Phone': getEntityPhone(app),
      'Scheduled For': dayjs(app.scheduledFor).format('YYYY-MM-DD HH:mm'),
      'Status': app.status,
      'Source': app.source,
      'Feedback': app.feedback || 'N/A',
      'Created': dayjs(app.createdAt).format('YYYY-MM-DD HH:mm'),
    }));

    let fileName = `appointments-${dayjs().format('YYYY-MM-DD-HHmmss')}`;
    let blob: Blob;

    setTimeout(() => {
      switch (exportFormat) {
        case 'json':
          blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
          fileName += '.json';
          break;
        case 'csv': {
          const headers = Object.keys(dataToExport[0] || {});
          const csvRows = [
            headers.join(','),
            ...dataToExport.map(row => 
              headers.map(header => {
                const value = row[header as keyof typeof row] || '';
                return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
              }).join(',')
            )
          ];
          blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
          fileName += '.csv';
          break;
        }
        case 'excel': {
          const headers = Object.keys(dataToExport[0] || {});
          const excelRows = [
            headers.join('\t'),
            ...dataToExport.map(row => 
              headers.map(header => {
                const value = row[header as keyof typeof row] || '';
                return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
              }).join('\t')
            )
          ];
          blob = new Blob([excelRows.join('\n')], { type: 'application/vnd.ms-excel' });
          fileName += '.xls';
          break;
        }
        case 'pdf': {
          const pdfContent = dataToExport.map(row => 
            Object.entries(row).map(([key, value]) => `${key}: ${value}`).join('\n')
          ).join('\n\n---\n\n');
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
      message.success(`Exported ${dataToExport.length} appointments as ${exportFormat.toUpperCase()}!`);
    }, 1000);
  };

  // Status breakdown
  const statusBreakdown = {
    total: appointments.length,
    scheduled: appointments.filter(a => a.status === 'scheduled').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    canceled: appointments.filter(a => a.status === 'canceled').length,
    no_show: appointments.filter(a => a.status === 'no_show').length,
  };

  // Source breakdown
  const sourceBreakdown = {
    staff: appointments.filter(a => a.source === 'staff').length,
    website: appointments.filter(a => a.source === 'website').length,
  };

  // Get status config
  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; icon: any; label: string }> = {
      scheduled: { color: '#1890ff', icon: <ClockCircleOutlined />, label: 'Scheduled' },
      completed: { color: '#52c41a', icon: <CheckCircleOutlined />, label: 'Completed' },
      canceled: { color: '#ff4d4f', icon: <CloseCircleOutlined />, label: 'Canceled' },
      no_show: { color: '#faad14', icon: <ExclamationCircleOutlined />, label: 'No Show' },
    };
    return configs[status] || configs.scheduled;
  };

  // Get source config
  const getSourceConfig = (source: string) => {
    const configs: Record<string, { color: string; icon: any; label: string }> = {
      staff: { color: '#1890ff', icon: <UserOutlined />, label: 'Staff Created' },
      website: { color: '#faad14', icon: <GlobalOutlined />, label: 'Website Booking' },
    };
    return configs[source] || configs.staff;
  };

  // Table columns
  const columns = [
    {
      title: 'Customer/Prospect',
      key: 'entity',
      width: 200,
      render: (_: any, record: Appointment) => {
        const name = getEntityName(record);
        const phone = getEntityPhone(record);
        return (
          <Space>
            <Avatar icon={<UserOutlined />} style={{ backgroundColor: tokens.primary }} />
            <div>
              <Text strong>{name}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                <PhoneOutlined /> {phone}
              </Text>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Scheduled For',
      dataIndex: 'scheduledFor',
      key: 'scheduledFor',
      width: 180,
      render: (date: string) => (
        <Space direction="vertical" size={0}>
          <Text strong>{dayjs(date).format('MMM DD, YYYY')}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <ClockCircleOutlined /> {dayjs(date).format('hh:mm A')}
          </Text>
        </Space>
      ),
      sorter: (a: Appointment, b: Appointment) => 
        dayjs(a.scheduledFor).unix() - dayjs(b.scheduledFor).unix(),
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
          <Text>{text || 'No feedback yet'}</Text>
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
            title="Delete Appointment"
            description={`Are you sure you want to delete this appointment?`}
            onConfirm={() => handleDeleteAppointment(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete">
              <Button danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Calendar view
  const renderCalendarView = () => {
    const getAppointmentsForDate = (date: dayjs.Dayjs) => {
      return filteredAppointments.filter(app => 
        dayjs(app.scheduledFor).format('YYYY-MM-DD') === date.format('YYYY-MM-DD')
      );
    };

    const dateCellRender = (date: dayjs.Dayjs) => {
      const dayApps = getAppointmentsForDate(date);
      if (dayApps.length === 0) return null;
      
      return (
        <div style={{ marginTop: 4 }}>
          {dayApps.slice(0, 3).map(app => {
            const config = getStatusConfig(app.status);
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
                  {dayjs(app.scheduledFor).format('hh:mm A')} - {getEntityName(app)}
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

  // Premium Drawer Content
  const renderDrawerContent = () => {
    if (!selectedAppointment) return null;

    const statusConfig = getStatusConfig(selectedAppointment.status);
    const sourceConfig = getSourceConfig(selectedAppointment.source);
    const entityName = getEntityName(selectedAppointment);
    const entityPhone = getEntityPhone(selectedAppointment);
    const isPast = dayjs(selectedAppointment.scheduledFor).isBefore(dayjs());
    const isToday = dayjs(selectedAppointment.scheduledFor).isSame(dayjs(), 'day');

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
                Appointment with {entityName}
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

        {/* Status & Time Banner */}
        <div style={{
          background: `${statusConfig.color}15`,
          border: `1px solid ${statusConfig.color}`,
          borderRadius: 8,
          padding: '16px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8
        }}>
          <Space>
            {statusConfig.icon}
            <Text strong>Status: {statusConfig.label}</Text>
            {isPast && (
              <Tag color="default">Past</Tag>
            )}
            {isToday && (
              <Tag color="processing">Today</Tag>
            )}
          </Space>
          <Badge 
            status={selectedAppointment.status === 'completed' ? 'success' : 
                   selectedAppointment.status === 'canceled' ? 'error' :
                   selectedAppointment.status === 'no_show' ? 'warning' : 'processing'} 
            text={selectedAppointment.status === 'scheduled' ? 'Upcoming' : 
                  selectedAppointment.status === 'completed' ? 'Done' :
                  selectedAppointment.status === 'canceled' ? 'Canceled' : 'No Show'}
          />
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
            <Button icon={<PhoneOutlined />}>
              Call
            </Button>
            <Button icon={<MessageOutlined />}>
              Message
            </Button>
            <Button icon={<CalendarOutlined />}>
              Reschedule
            </Button>
          </Space>
        </div>

        {/* Info Cards */}
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card size="small" title="Appointment Details" bordered={false} style={{ background: '#fafafa' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label={<Space><UserOutlined /> Customer/Prospect</Space>}>
                  <Text strong>{entityName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Space><PhoneOutlined /> Contact</Space>}>
                  <a href={`tel:${entityPhone}`}>{entityPhone}</a>
                </Descriptions.Item>
                <Descriptions.Item label={<Space><CalendarOutlined /> Scheduled For</Space>}>
                  <Space direction="vertical" size={0}>
                    <Text strong>{dayjs(selectedAppointment.scheduledFor).format('dddd, MMMM DD, YYYY')}</Text>
                    <Text type="secondary">
                      <ClockCircleOutlined /> {dayjs(selectedAppointment.scheduledFor).format('hh:mm A')}
                    </Text>
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label={<Space><GlobalOutlined /> Source</Space>}>
                  <Tag color={sourceConfig.color}>{sourceConfig.label}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={<Space><UserOutlined /> Created By</Space>}>
                  User #{selectedAppointment.createdByUserId}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {/* Feedback */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="Feedback / Notes" bordered={false} style={{ background: '#fafafa' }}>
              <Text>{selectedAppointment.feedback || 'No feedback provided yet'}</Text>
            </Card>
          </Col>
        </Row>

        {/* Timeline */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="Activity Timeline" bordered={false} style={{ background: '#fafafa' }}>
              <Timeline>
                <Timeline.Item color="blue">
                  <Text>Appointment created</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(selectedAppointment.createdAt).format('MMMM DD, YYYY HH:mm')}
                  </Text>
                </Timeline.Item>
                <Timeline.Item color={statusConfig.color}>
                  <Text>Status: {statusConfig.label}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Last updated {dayjs(selectedAppointment.updatedAt).fromNow()}
                  </Text>
                </Timeline.Item>
                <Timeline.Item color="gray">
                  <Text>Scheduled for {dayjs(selectedAppointment.scheduledFor).format('MMMM DD, YYYY HH:mm')}</Text>
                </Timeline.Item>
              </Timeline>
            </Card>
          </Col>
        </Row>

        {/* Footer */}
        <div style={{ 
          marginTop: 24, 
          paddingTop: 16, 
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8
        }}>
          <Space>
            <Button icon={<PrinterOutlined />}>Print</Button>
            <Button icon={<ShareAltOutlined />}>Share</Button>
          </Space>
          <Popconfirm
            title="Delete Appointment"
            description="Are you sure you want to delete this appointment?"
            onConfirm={() => {
              handleDeleteAppointment(selectedAppointment.id);
              setViewDrawerOpen(false);
            }}
            okText="Yes"
            cancelText="No"
          >
            <Button danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </div>
      </div>
    );
  };

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
            onClick: () => {
              setLoading(true);
              setTimeout(() => {
                setLoading(false);
                message.success('Refreshed!');
              }, 500);
            },
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
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="No Show"
              value={statusBreakdown.no_show}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#faad14' }}
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
            loading={loading}
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
            <Select placeholder="Search by name" showSearch>
              {Object.entries(mockNames).map(([id, data]) => (
                <Option key={id} value={id}>
                  {data.name} - {data.phone}
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
              <Button type="primary" htmlType="submit" loading={loading}>
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
            label="Feedback / Notes"
          >
            <TextArea rows={3} placeholder="Add any feedback or notes" />
          </Form.Item>

          <Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit" loading={loading}>
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
        {renderDrawerContent()}
      </Drawer>
    </div>
  );
};