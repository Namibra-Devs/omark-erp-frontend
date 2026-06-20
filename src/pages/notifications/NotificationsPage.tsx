// src/pages/notifications/NotificationsPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Space, Modal, Form, Input, Select, Row, Col, Table,
  Tag, message, Typography, Card, Avatar, Badge, Tooltip,
  DatePicker, Statistic, Divider, Empty, Dropdown, Popconfirm,
  Alert, Drawer, Descriptions, Timeline, Tabs, Progress,
  Radio, Switch, InputNumber, List, Collapse, Checkbox
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
  ExportOutlined,
  PhoneOutlined,
  MailOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  EditOutlined,
  DeleteOutlined,
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
  HomeOutlined,
  DollarOutlined,
  FileOutlined,
  TeamOutlined,
  BankOutlined,
  PercentageOutlined,
  StarOutlined,
  StarFilled,
  HeartOutlined,
  HeartFilled,
  MessageOutlined,
  WhatsAppOutlined,
  EnvironmentOutlined,
  BuildOutlined,
  CarOutlined,
  ShopOutlined,
  ApartmentOutlined,
  FundOutlined,
  PieChartOutlined,
  LineChartOutlined,
  BarChartOutlined,
  FileProtectOutlined,
  SafetyOutlined,
  VerifiedOutlined,
  CopyOutlined,
  NotificationOutlined,
  BellOutlined,
  SendOutlined,
  RetweetOutlined,
  FilterOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  SoundOutlined,
  CustomerServiceOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusTag } from '@/components/shared/StatusTag';
import { MoneyText } from '@/components/shared/MoneyText';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { tokens } from '@/constants/tokens';
import { notificationStatusLabels, notificationTypeLabels } from '@/constants/enums';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import advancedFormat from 'dayjs/plugin/advancedFormat';

dayjs.extend(relativeTime);
dayjs.extend(advancedFormat);

const { Option } = Select;
const { TextArea } = Input;
const { Text, Title } = Typography;

// Mock Notifications Data
const mockNotifications = [
  {
    id: 'n1',
    customerId: 'c1',
    phoneNumber: '+233241234567',
    type: 'contribution_due_soon',
    messageBody: 'Dear John Doe, your monthly contribution of GHS 1,000.00 is due on 2024-02-15. Please make payment to avoid late fees.',
    status: 'sent',
    providerMessageId: 'SMS-123456789',
    sentAt: '2024-01-15T08:00:00Z',
    createdAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 'n2',
    customerId: 'c3',
    phoneNumber: '+233241234569',
    type: 'contribution_overdue',
    messageBody: 'Dear Michael Johnson, your monthly contribution of GHS 625.00 is overdue by 5 days. Please make immediate payment.',
    status: 'pending',
    providerMessageId: null,
    sentAt: null,
    createdAt: '2024-01-20T10:30:00Z',
  },
  {
    id: 'n3',
    customerId: 'c4',
    phoneNumber: '+233241234570',
    type: 'contribution_due_soon',
    messageBody: 'Dear Sarah Williams, your monthly contribution of GHS 800.00 is due on 2024-02-10. Please make payment to avoid late fees.',
    status: 'sent',
    providerMessageId: 'SMS-987654321',
    sentAt: '2024-01-18T09:00:00Z',
    createdAt: '2024-01-18T09:00:00Z',
  },
  {
    id: 'n4',
    customerId: 'c6',
    phoneNumber: '+233241234572',
    type: 'contribution_overdue',
    messageBody: 'Dear Emily Davis, your monthly contribution of GHS 533,333.00 is overdue by 12 days. Immediate payment required.',
    status: 'failed',
    providerMessageId: 'SMS-456789123',
    sentAt: '2024-01-16T14:00:00Z',
    createdAt: '2024-01-16T14:00:00Z',
  },
  {
    id: 'n5',
    customerId: 'c7',
    phoneNumber: '+233241234573',
    type: 'contribution_due_soon',
    messageBody: 'Dear David Wilson, your monthly contribution of GHS 800.00 is due on 2024-02-20. Please make payment to avoid late fees.',
    status: 'pending',
    providerMessageId: null,
    sentAt: null,
    createdAt: '2024-01-22T11:15:00Z',
  },
  {
    id: 'n6',
    customerId: 'c8',
    phoneNumber: '+233241234574',
    type: 'contribution_overdue',
    messageBody: 'Dear Lisa Taylor, your monthly contribution of GHS 583,333.00 is overdue by 3 days. Please make payment.',
    status: 'sent',
    providerMessageId: 'SMS-789456123',
    sentAt: '2024-01-19T16:30:00Z',
    createdAt: '2024-01-19T16:30:00Z',
  },
  {
    id: 'n7',
    customerId: 'c1',
    phoneNumber: '+233241234567',
    type: 'contribution_due_soon',
    messageBody: 'Dear John Doe, your monthly contribution of GHS 1,000.00 is due on 2024-02-15. Please make payment to avoid late fees.',
    status: 'sent',
    providerMessageId: 'SMS-321654987',
    sentAt: '2024-01-14T07:00:00Z',
    createdAt: '2024-01-14T07:00:00Z',
  },
  {
    id: 'n8',
    customerId: 'c3',
    phoneNumber: '+233241234569',
    type: 'contribution_due_soon',
    messageBody: 'Dear Michael Johnson, your monthly contribution of GHS 625.00 is due on 2024-02-08. Please make payment.',
    status: 'sent',
    providerMessageId: 'SMS-654987321',
    sentAt: '2024-01-12T10:00:00Z',
    createdAt: '2024-01-12T10:00:00Z',
  },
];

// Mock Customers
const mockCustomers: Record<string, { name: string; phone: string }> = {
  'c1': { name: 'John Doe', phone: '+233241234567' },
  'c3': { name: 'Michael Johnson', phone: '+233241234569' },
  'c4': { name: 'Sarah Williams', phone: '+233241234570' },
  'c6': { name: 'Emily Davis', phone: '+233241234572' },
  'c7': { name: 'David Wilson', phone: '+233241234573' },
  'c8': { name: 'Lisa Taylor', phone: '+233241234574' },
};

// Mock Payment Plans for reference
const mockPaymentPlans: Record<string, { amount: number; dueDate: string }> = {
  'c1': { amount: 100000, dueDate: '2024-02-15' },
  'c3': { amount: 62500, dueDate: '2024-02-08' },
  'c4': { amount: 80000, dueDate: '2024-02-10' },
  'c6': { amount: 53333, dueDate: '2024-01-15' },
  'c7': { amount: 80000, dueDate: '2024-02-20' },
  'c8': { amount: 58333, dueDate: '2024-01-22' },
};

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // States
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>(mockNotifications);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedNotification, setSelectedNotification] = useState<any | null>(null);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [sendModal, setSendModal] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const [form] = Form.useForm();
  const [sendForm] = Form.useForm();

  // Export states
  const [exportModal, setExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv' | 'pdf' | 'json'>('excel');
  const [exportLoading, setExportLoading] = useState(false);

  // Get customer name
  const getCustomerName = (customerId: string) => {
    return mockCustomers[customerId]?.name || 'Unknown Customer';
  };

  const getCustomerPhone = (customerId: string) => {
    return mockCustomers[customerId]?.phone || '';
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(notification => {
    const customerName = getCustomerName(notification.customerId).toLowerCase();
    const matchesSearch = customerName.includes(searchText.toLowerCase()) ||
                          notification.phoneNumber.includes(searchText) ||
                          notification.id.toLowerCase().includes(searchText.toLowerCase()) ||
                          notification.messageBody.toLowerCase().includes(searchText.toLowerCase());
    const matchesType = typeFilter === 'all' || notification.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || notification.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Stats
  const stats = {
    total: notifications.length,
    sent: notifications.filter(n => n.status === 'sent').length,
    pending: notifications.filter(n => n.status === 'pending').length,
    failed: notifications.filter(n => n.status === 'failed').length,
    dueSoon: notifications.filter(n => n.type === 'contribution_due_soon').length,
    overdue: notifications.filter(n => n.type === 'contribution_overdue').length,
  };

  // Send notification
  const handleSendNotification = (values: any) => {
    setLoading(true);
    setTimeout(() => {
      const newNotification = {
        id: `n${Date.now()}`,
        customerId: values.customerId,
        phoneNumber: mockCustomers[values.customerId]?.phone || '',
        type: values.type,
        messageBody: values.messageBody,
        status: 'sent',
        providerMessageId: `SMS-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      setNotifications([newNotification, ...notifications]);
      setLoading(false);
      setSendModal(false);
      sendForm.resetFields();
      message.success('Notification sent successfully!');
    }, 1000);
  };

  // Resend notification
  const handleResendNotification = (id: string) => {
    setLoading(true);
    setTimeout(() => {
      setNotifications(notifications.map(n => 
        n.id === id 
          ? { 
              ...n, 
              status: 'sent', 
              sentAt: new Date().toISOString(),
              providerMessageId: `SMS-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
            }
          : n
      ));
      setLoading(false);
      message.success('Notification resent successfully!');
    }, 800);
  };

  // Delete notification
  const handleDeleteNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
    message.success('Notification deleted successfully!');
  };

  // Bulk send selected notifications
  const handleBulkSend = () => {
    if (selectedNotifications.length === 0) {
      message.warning('Please select at least one notification');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setNotifications(notifications.map(n => 
        selectedNotifications.includes(n.id) && n.status === 'pending'
          ? { 
              ...n, 
              status: 'sent', 
              sentAt: new Date().toISOString(),
              providerMessageId: `SMS-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
            }
          : n
      ));
      setSelectedNotifications([]);
      setLoading(false);
      message.success(`${selectedNotifications.length} notifications sent successfully!`);
    }, 1500);
  };

  // Export function
  const handleExport = () => {
    setExportLoading(true);
    const dataToExport = filteredNotifications.map(notification => ({
      'ID': notification.id,
      'Customer': getCustomerName(notification.customerId),
      'Phone': notification.phoneNumber,
      'Type': notificationTypeLabels[notification.type as keyof typeof notificationTypeLabels],
      'Message': notification.messageBody,
      'Status': notificationStatusLabels[notification.status as keyof typeof notificationStatusLabels],
      'Provider ID': notification.providerMessageId || 'N/A',
      'Sent At': notification.sentAt ? dayjs(notification.sentAt).format('YYYY-MM-DD HH:mm') : 'N/A',
      'Created': dayjs(notification.createdAt).format('YYYY-MM-DD HH:mm'),
    }));

    let fileName = `notifications-${dayjs().format('YYYY-MM-DD-HHmmss')}`;
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
      message.success(`Exported ${dataToExport.length} notifications as ${exportFormat.toUpperCase()}!`);
    }, 1000);
  };

  // Table Columns
  const columns = [
    {
      title: (
        <Checkbox
          checked={selectedNotifications.length === filteredNotifications.length && filteredNotifications.length > 0}
          indeterminate={selectedNotifications.length > 0 && selectedNotifications.length < filteredNotifications.length}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedNotifications(filteredNotifications.map(n => n.id));
            } else {
              setSelectedNotifications([]);
            }
          }}
        />
      ),
      key: 'select',
      width: 50,
      render: (_: any, record: any) => (
        <Checkbox
          checked={selectedNotifications.includes(record.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedNotifications([...selectedNotifications, record.id]);
            } else {
              setSelectedNotifications(selectedNotifications.filter(id => id !== record.id));
            }
          }}
        />
      ),
    },
    {
      title: 'Customer',
      key: 'customer',
      width: 180,
      render: (_: any, record: any) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: tokens.primary }} />
          <div>
            <Text strong>{getCustomerName(record.customerId)}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              <PhoneOutlined /> {record.phoneNumber}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (type: string) => {
        const config = {
          contribution_due_soon: { color: 'blue', icon: <BellOutlined />, label: 'Due Soon' },
          contribution_overdue: { color: 'red', icon: <WarningOutlined />, label: 'Overdue' },
        };
        const { color, icon, label } = config[type as keyof typeof config] || config.contribution_due_soon;
        return <Tag color={color} icon={icon}>{label}</Tag>;
      },
    },
    {
      title: 'Message',
      dataIndex: 'messageBody',
      key: 'messageBody',
      width: 300,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <Text>{text.length > 100 ? `${text.substring(0, 100)}...` : text}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: string) => {
        const config = {
          sent: { color: 'green', icon: <CheckCircleOutlined />, label: 'Sent' },
          pending: { color: 'blue', icon: <ClockCircleOutlined />, label: 'Pending' },
          failed: { color: 'red', icon: <CloseCircleOutlined />, label: 'Failed' },
        };
        const { color, icon, label } = config[status as keyof typeof config] || config.pending;
        return <Tag color={color} icon={icon}>{label}</Tag>;
      },
      filters: [
        { text: 'Sent', value: 'sent' },
        { text: 'Pending', value: 'pending' },
        { text: 'Failed', value: 'failed' },
      ],
      onFilter: (value: any, record: any) => record.status === value,
    },
    {
      title: 'Sent At',
      key: 'sentAt',
      width: 160,
      render: (_: any, record: any) => {
        if (!record.sentAt) {
          return <Tag color="blue">Pending</Tag>;
        }
        return (
          <Tooltip title={dayjs(record.sentAt).format('MMMM DD, YYYY HH:mm')}>
            <div>
              <CalendarOutlined /> {dayjs(record.sentAt).fromNow()}
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {dayjs(record.sentAt).format('MMM DD, HH:mm')}
              </Text>
            </div>
          </Tooltip>
        );
      },
      sorter: (a: any, b: any) => {
        if (!a.sentAt) return 1;
        if (!b.sentAt) return -1;
        return dayjs(a.sentAt).unix() - dayjs(b.sentAt).unix();
      },
    },
    {
      title: 'Provider ID',
      dataIndex: 'providerMessageId',
      key: 'providerMessageId',
      width: 120,
      render: (id: string) => id || <Tag color="default">N/A</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title="View Details">
            <Button 
              type="primary"
              ghost
              icon={<EyeOutlined />} 
              onClick={() => {
                setSelectedNotification(record);
                setViewDrawerOpen(true);
              }}
            />
          </Tooltip>
          {record.status !== 'sent' && (
            <Tooltip title="Resend">
              <Button 
                icon={<SendOutlined />} 
                onClick={() => handleResendNotification(record.id)}
                loading={loading}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="Delete Notification"
            description={`Are you sure you want to delete this notification?`}
            onConfirm={() => handleDeleteNotification(record.id)}
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

  // Render Drawer Content
  const renderDrawerContent = () => {
    if (!selectedNotification) return null;

    const customerName = getCustomerName(selectedNotification.customerId);
    const customerPhone = getCustomerPhone(selectedNotification.customerId);

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
              icon={<NotificationOutlined />} 
              style={{ backgroundColor: tokens.primary }}
            />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                Notification Details
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <IdcardOutlined /> ID: {selectedNotification.id}
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
          background: selectedNotification.status === 'sent' ? '#f6ffed' : 
                     selectedNotification.status === 'pending' ? '#e6f7ff' : '#fff2e8',
          border: `1px solid ${selectedNotification.status === 'sent' ? '#b7eb8f' : 
                               selectedNotification.status === 'pending' ? '#91d5ff' : '#ffccc7'}`,
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Space>
            {selectedNotification.status === 'sent' && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
            {selectedNotification.status === 'pending' && <ClockCircleOutlined style={{ color: '#1890ff' }} />}
            {selectedNotification.status === 'failed' && <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            <Text strong>
              Status: {notificationStatusLabels[selectedNotification.status as keyof typeof notificationStatusLabels]}
            </Text>
          </Space>
          <Badge 
            status={selectedNotification.status === 'sent' ? 'success' : 
                   selectedNotification.status === 'pending' ? 'processing' : 'error'} 
            text={selectedNotification.status.toUpperCase()}
          />
        </div>

        {/* Quick Actions */}
        <div style={{ marginBottom: 24 }}>
          <Space wrap>
            {selectedNotification.status !== 'sent' && (
              <Button 
                type="primary" 
                icon={<SendOutlined />}
                onClick={() => handleResendNotification(selectedNotification.id)}
                loading={loading}
              >
                Resend Notification
              </Button>
            )}
            <Button icon={<PrinterOutlined />}>
              Print
            </Button>
            <Button icon={<ShareAltOutlined />}>
              Share
            </Button>
          </Space>
        </div>

        {/* Notification Details */}
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card size="small" title="Customer Information" bordered={false} style={{ background: '#fafafa' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label={<Space><UserOutlined /> Customer</Space>}>
                  <Text strong>{customerName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Space><PhoneOutlined /> Phone</Space>}>
                  <a href={`tel:${customerPhone}`}>{customerPhone}</a>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="Notification Details" bordered={false} style={{ background: '#fafafa' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label={<Space><BellOutlined /> Type</Space>}>
                  <Tag color={selectedNotification.type === 'contribution_due_soon' ? 'blue' : 'red'}>
                    {notificationTypeLabels[selectedNotification.type as keyof typeof notificationTypeLabels]}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label={<Space><MessageOutlined /> Message</Space>}>
                  <div style={{ 
                    padding: 12, 
                    background: '#f0f0f0', 
                    borderRadius: 6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {selectedNotification.messageBody}
                  </div>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="Delivery Information" bordered={false} style={{ background: '#fafafa' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label={<Space><IdcardOutlined /> Provider ID</Space>}>
                  {selectedNotification.providerMessageId || <Tag color="default">N/A</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label={<Space><CalendarOutlined /> Sent At</Space>}>
                  {selectedNotification.sentAt ? (
                    dayjs(selectedNotification.sentAt).format('MMMM DD, YYYY HH:mm')
                  ) : (
                    <Tag color="blue">Pending</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label={<Space><ClockCircleOutlined /> Created</Space>}>
                  {dayjs(selectedNotification.createdAt).format('MMMM DD, YYYY HH:mm')}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {/* Footer */}
        <div style={{ 
          marginTop: 24, 
          paddingTop: 16, 
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <Space>
            <Button icon={<PrinterOutlined />}>Print</Button>
            <Button icon={<ShareAltOutlined />}>Share</Button>
          </Space>
          {selectedNotification.status !== 'sent' && (
            <Button 
              type="primary" 
              icon={<SendOutlined />}
              onClick={() => handleResendNotification(selectedNotification.id)}
              loading={loading}
            >
              Resend
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden', padding: '0 4px' }}>
      <PageHeader
        title="SMS Notification Log"
        actions={[
          {
            label: 'Send Notification',
            onClick: () => setSendModal(true),
            icon: <SendOutlined />,
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

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Total Notifications"
              value={stats.total}
              prefix={<NotificationOutlined />}
              valueStyle={{ color: tokens.primary }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Sent"
              value={stats.sent}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Pending"
              value={stats.pending}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Failed"
              value={stats.failed}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Due Soon"
              value={stats.dueSoon}
              prefix={<BellOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Overdue"
              value={stats.overdue}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Bulk Actions and Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Input
              placeholder="Search by customer, phone, or message"
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
              placeholder="Filter by type"
              value={typeFilter}
              onChange={setTypeFilter}
              allowClear
              size="middle"
            >
              <Option value="all">All Types</Option>
              <Option value="contribution_due_soon">Due Soon</Option>
              <Option value="contribution_overdue">Overdue</Option>
            </Select>
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
              <Option value="sent">Sent</Option>
              <Option value="pending">Pending</Option>
              <Option value="failed">Failed</Option>
            </Select>
          </Col>
          <Col xs={24} md={10}>
            <Space wrap>
              <Button 
                type="primary" 
                icon={<SendOutlined />}
                onClick={handleBulkSend}
                disabled={selectedNotifications.length === 0}
                loading={loading}
              >
                Send Selected ({selectedNotifications.length})
              </Button>
              <Button 
                icon={<ReloadOutlined />}
                onClick={() => setSelectedNotifications([])}
                disabled={selectedNotifications.length === 0}
              >
                Clear Selection
              </Button>
              <Text type="secondary" style={{ marginLeft: 'auto' }}>
                Total: {filteredNotifications.length} notifications
              </Text>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <Table
          columns={columns}
          dataSource={filteredNotifications}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: 1400 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} notifications`,
            responsive: true,
          }}
        />
      </div>

      {/* Send Notification Modal */}
      <Modal
        title={
          <Space>
            <SendOutlined style={{ color: tokens.primary }} />
            <Text strong>Send SMS Notification</Text>
          </Space>
        }
        open={sendModal}
        onCancel={() => {
          setSendModal(false);
          sendForm.resetFields();
        }}
        footer={null}
        width={600}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px', maxHeight: '70vh', overflowY: 'auto' }}
      >
        <Alert
          message="SMS Notification"
          description="Send an SMS notification to a customer about their payment status."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={sendForm}
          layout="vertical"
          onFinish={handleSendNotification}
          initialValues={{ type: 'contribution_due_soon' }}
        >
          <Form.Item
            name="customerId"
            label="Customer"
            rules={[{ required: true, message: 'Please select a customer' }]}
          >
            <Select placeholder="Select customer" showSearch>
              {Object.entries(mockCustomers).map(([id, data]) => (
                <Option key={id} value={id}>
                  {data.name} - {data.phone}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="type"
            label="Notification Type"
            rules={[{ required: true, message: 'Please select notification type' }]}
          >
            <Select>
              <Option value="contribution_due_soon">Due Soon</Option>
              <Option value="contribution_overdue">Overdue</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="messageBody"
            label="Message"
            rules={[
              { required: true, message: 'Please enter a message' },
              { max: 160, message: 'Message must be less than 160 characters for SMS' }
            ]}
          >
            <TextArea 
              rows={4} 
              placeholder="Enter your SMS message (max 160 characters)"
              showCount
              maxLength={160}
            />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.customerId !== curr.customerId || prev.type !== curr.type}>
            {({ getFieldValue }) => {
              const customerId = getFieldValue('customerId');
              const type = getFieldValue('type');
              if (!customerId) return null;

              const customer = mockCustomers[customerId];
              const plan = mockPaymentPlans[customerId];
              
              return (
                <div style={{ 
                  background: '#f5f7fa', 
                  padding: 12, 
                  borderRadius: 8,
                  marginBottom: 16,
                  border: '1px solid #e8e8e8'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text strong>Message Preview</Text>
                    <Tag color="blue">Auto-generated</Tag>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <UserOutlined /> {customer.name}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <PhoneOutlined /> {customer.phone}
                  </Text>
                  {plan && (
                    <>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <DollarOutlined /> Monthly Amount: GHS {(plan.amount / 100).toLocaleString()}
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <CalendarOutlined /> Due Date: {dayjs(plan.dueDate).format('MMMM DD, YYYY')}
                      </Text>
                    </>
                  )}
                </div>
              );
            }}
          </Form.Item>

          <Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit" loading={loading}>
                <SendOutlined /> Send Notification
              </Button>
              <Button onClick={() => {
                setSendModal(false);
                sendForm.resetFields();
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
            <Text strong>Export Notifications</Text>
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
          message={`${filteredNotifications.length} notifications will be exported`}
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
            <InfoCircleOutlined /> The export will include all filtered notifications with their details.
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