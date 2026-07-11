// src/pages/notifications/NotificationsPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Space, Modal, Form, Input, Select, Row, Col, Table,
  Tag, message, Typography, Card, Avatar, Badge, Tooltip,
  DatePicker, Statistic, Divider, Empty, Dropdown, Popconfirm,
  Alert, Drawer, Descriptions, Timeline, Tabs, Progress,
  Radio, Switch, InputNumber, List, Collapse, Checkbox, Spin
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
  CustomerServiceOutlined,
  ReadOutlined,
  CheckCircleTwoTone,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusTag } from '@/components/shared/StatusTag';
import { MoneyText } from '@/components/shared/MoneyText';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { tokens } from '@/constants/tokens';
import { notificationStatusLabels, notificationTypeLabels } from '@/constants/enums';
import {
  useNotificationsQuery,
  useSendNotificationMutation,
  useResendNotificationMutation,
  useDeleteNotificationMutation,
  useSendTestSMSMutation,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  type Notification,
  type SendNotificationPayload
} from '@/api/notifications';
import { useCustomersQuery } from '@/api/customers';
import type { Customer } from '@/types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import advancedFormat from 'dayjs/plugin/advancedFormat';

dayjs.extend(relativeTime);
dayjs.extend(advancedFormat);

const { Option } = Select;
const { TextArea } = Input;
const { Text, Title } = Typography;

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // States
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [sendModal, setSendModal] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const [form] = Form.useForm();
  const [sendForm] = Form.useForm();
  const [testSMSSent, setTestSMSSent] = useState(false);

  // Export states
  const [exportModal, setExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv' | 'pdf' | 'json'>('excel');
  const [exportLoading, setExportLoading] = useState(false);

  // ── API Queries ────────────────────────────────────────────────────────────
  const { 
    data: notificationsData, 
    isLoading: notificationsLoading,
    error: notificationsError,
    refetch: refetchNotifications
  } = useNotificationsQuery({
    type: typeFilter !== 'all' ? typeFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const { data: customersData, isLoading: customersLoading } = useCustomersQuery({ limit: 100 });

  // ── API Mutations ──────────────────────────────────────────────────────────
  const sendNotification = useSendNotificationMutation();
  const resendNotification = useResendNotificationMutation();
  const deleteNotification = useDeleteNotificationMutation();
  const sendTestSMS = useSendTestSMSMutation();
  const markAsRead = useMarkAsReadMutation();
  const markAllAsRead = useMarkAllAsReadMutation();

  // ── Data Mapping ──────────────────────────────────────────────────────────
  // Extract data with proper fallbacks
  const notifications: Notification[] = React.useMemo(() => {
    if (!notificationsData) return [];
    const data = (notificationsData as any).data ?? notificationsData;
    if (Array.isArray(data)) return data;
    if (data?.items) return data.items;
    return [];
  }, [notificationsData]);

  const customers: Customer[] = React.useMemo(() => {
    if (!customersData) return [];
    const data = (customersData as any).data ?? customersData;
    if (Array.isArray(data)) return data;
    if (data?.items) return data.items;
    return [];
  }, [customersData]);

  // Create map for quick lookups
  const customerMap = React.useMemo(() => {
    return customers.reduce((acc, customer) => {
      acc[customer.id] = customer;
      return acc;
    }, {} as Record<string, Customer>);
  }, [customers]);

  // ── Helper Functions ──────────────────────────────────────────────────────
  const getCustomerName = (customerId: string) => {
    return customerMap[customerId] ? 
      `${customerMap[customerId].firstName} ${customerMap[customerId].lastName}` : 
      'Unknown Customer';
  };

  const getCustomerPhone = (customerId: string) => {
    return customerMap[customerId]?.phoneNumber || '';
  };

  // ── Filter Notifications ──────────────────────────────────────────────────
  const filteredNotifications = notifications.filter(notification => {
    const customerName = getCustomerName(notification.customerId).toLowerCase();
    const matchesSearch = customerName.includes(searchText.toLowerCase()) ||
                          notification.phoneNumber?.includes(searchText) ||
                          notification.id.toLowerCase().includes(searchText.toLowerCase()) ||
                          notification.messageBody?.toLowerCase().includes(searchText.toLowerCase());
    const matchesType = typeFilter === 'all' || notification.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || notification.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total: notifications.length,
    sent: notifications.filter(n => n.status === 'sent' || n.status === 'read').length,
    pending: notifications.filter(n => n.status === 'pending' || n.status === 'unread').length,
    failed: notifications.filter(n => n.status === 'failed').length,
    dueSoon: notifications.filter(n => n.type === 'contribution_due_soon').length,
    overdue: notifications.filter(n => n.type === 'contribution_overdue').length,
    unread: notifications.filter(n => n.status === 'pending' || n.status === 'unread').length,
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSendNotification = async (values: any) => {
    try {
      // Check if it's a test SMS
      if (values.isTest) {
        await handleSendTestSMS(values);
        return;
      }

      const customer = customerMap[values.customerId];
      if (!customer) {
        message.error('Customer not found');
        return;
      }

      const payload: SendNotificationPayload = {
        customerId: values.customerId,
        type: values.type,
        messageBody: values.messageBody,
        phoneNumber: customer.phoneNumber,
      };

      await sendNotification.mutateAsync(payload);
      message.success('Notification sent successfully!');
      setSendModal(false);
      sendForm.resetFields();
      setTestSMSSent(false);
      
      // Refetch with delay
      setTimeout(() => {
        refetchNotifications();
      }, 500);
    } catch (error: any) {
      message.error(error?.message || 'Failed to send notification');
    }
  };

  const handleSendTestSMS = async (values: any) => {
    try {
      const phoneNumber = values.testPhoneNumber || values.phoneNumber;
      if (!phoneNumber) {
        message.error('Phone number is required for test SMS');
        return;
      }

      await sendTestSMS.mutateAsync({
        phoneNumber: phoneNumber,
        message: values.messageBody,
      });
      message.success('Test SMS sent successfully!');
      setTestSMSSent(true);
      // Don't close modal so user can send another test
      
      // Refetch with delay
      setTimeout(() => {
        refetchNotifications();
      }, 500);
    } catch (error: any) {
      message.error(error?.message || 'Failed to send test SMS');
    }
  };

  const handleResendNotification = async (id: string) => {
    try {
      await resendNotification.mutateAsync(id);
      message.success('Notification resent successfully!');
      setTimeout(() => {
        refetchNotifications();
      }, 500);
    } catch (error: any) {
      message.error(error?.message || 'Failed to resend notification');
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteNotification.mutateAsync(id);
      message.success('Notification deleted successfully!');
      setTimeout(() => {
        refetchNotifications();
      }, 300);
    } catch (error: any) {
      message.error(error?.message || 'Failed to delete notification');
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead.mutateAsync(id);
      message.success('Notification marked as read');
      setTimeout(() => {
        refetchNotifications();
      }, 300);
    } catch (error: any) {
      message.error(error?.message || 'Failed to mark as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => n.status === 'pending' || n.status === 'unread').map(n => n.id);
      if (unreadIds.length === 0) {
        message.info('No unread notifications');
        return;
      }
      
      await markAllAsRead.mutateAsync();
      message.success('All notifications marked as read');
      setTimeout(() => {
        refetchNotifications();
      }, 500);
    } catch (error: any) {
      message.error(error?.message || 'Failed to mark all as read');
    }
  };

  // ── Bulk Send ─────────────────────────────────────────────────────────────
  const handleBulkSend = async () => {
    if (selectedNotifications.length === 0) {
      message.warning('Please select at least one notification');
      return;
    }

    try {
      const pendingIds = selectedNotifications.filter(id => {
        const notification = notifications.find(n => n.id === id);
        return notification?.status === 'pending' || notification?.status === 'failed';
      });

      if (pendingIds.length === 0) {
        message.warning('Selected notifications are already sent');
        return;
      }

      // Send each pending notification
      for (const id of pendingIds) {
        await resendNotification.mutateAsync(id);
      }

      message.success(`${pendingIds.length} notifications sent successfully!`);
      setSelectedNotifications([]);
      setTimeout(() => {
        refetchNotifications();
      }, 500);
    } catch (error: any) {
      message.error(error?.message || 'Failed to send bulk notifications');
    }
  };

  // ── Export function ──────────────────────────────────────────────────────
  const handleExport = () => {
    setExportLoading(true);
    const dataToExport = filteredNotifications.map(notification => ({
      'ID': notification.id,
      'Customer': getCustomerName(notification.customerId),
      'Phone': notification.phoneNumber || '',
      'Type': notificationTypeLabels[notification.type as keyof typeof notificationTypeLabels] || notification.type,
      'Message': notification.messageBody,
      'Status': notificationStatusLabels[notification.status as keyof typeof notificationStatusLabels] || notification.status,
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

  // ── Table Columns ─────────────────────────────────────────────────────────
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
      render: (_: any, record: Notification) => (
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
      title: 'Status',
      key: 'status',
      width: 80,
      render: (_: any, record: Notification) => {
        const isUnread = record.status === 'pending' || record.status === 'unread';
        return isUnread ? (
          <Badge dot status="processing" text={<Text type="secondary">Unread</Text>} />
        ) : (
          <CheckCircleTwoTone twoToneColor="#52c41a" />
        );
      },
    },
    {
      title: 'Customer',
      key: 'customer',
      width: 180,
      render: (_: any, record: Notification) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: tokens.primary }} />
          <div>
            <Text strong>{getCustomerName(record.customerId)}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              <PhoneOutlined /> {record.phoneNumber || 'N/A'}
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
        const config: Record<string, { color: string; icon: any; label: string }> = {
          contribution_due_soon: { color: 'blue', icon: <BellOutlined />, label: 'Due Soon' },
          contribution_overdue: { color: 'red', icon: <WarningOutlined />, label: 'Overdue' },
          payment_confirmation: { color: 'green', icon: <CheckCircleOutlined />, label: 'Payment Confirmed' },
          general: { color: 'default', icon: <NotificationOutlined />, label: 'General' },
        };
        const configs = config[type] || config.general;
        return <Tag color={configs.color} icon={configs.icon}>{configs.label}</Tag>;
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
          <Text>{text?.length > 100 ? `${text.substring(0, 100)}...` : text || 'No message'}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: string) => {
        const config: Record<string, { color: string; icon: any; label: string }> = {
          sent: { color: 'green', icon: <CheckCircleOutlined />, label: 'Sent' },
          pending: { color: 'blue', icon: <ClockCircleOutlined />, label: 'Pending' },
          failed: { color: 'red', icon: <CloseCircleOutlined />, label: 'Failed' },
          unread: { color: 'blue', icon: <ClockCircleOutlined />, label: 'Unread' },
          read: { color: 'green', icon: <CheckCircleOutlined />, label: 'Read' },
        };
        const configs = config[status] || config.pending;
        return <Tag color={configs.color} icon={configs.icon}>{configs.label}</Tag>;
      },
      filters: [
        { text: 'Sent', value: 'sent' },
        { text: 'Pending', value: 'pending' },
        { text: 'Failed', value: 'failed' },
        { text: 'Unread', value: 'unread' },
        { text: 'Read', value: 'read' },
      ],
      onFilter: (value: any, record: Notification) => record.status === value,
    },
    {
      title: 'Sent At',
      key: 'sentAt',
      width: 160,
      render: (_: any, record: Notification) => {
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
      sorter: (a: Notification, b: Notification) => {
        if (!a.sentAt) return 1;
        if (!b.sentAt) return -1;
        return dayjs(a.sentAt).unix() - dayjs(b.sentAt).unix();
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      fixed: 'right' as const,
      render: (_: any, record: Notification) => (
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
          {(record.status === 'pending' || record.status === 'unread') && (
            <Tooltip title="Mark as Read">
              <Button 
                icon={<ReadOutlined />} 
                onClick={() => handleMarkAsRead(record.id)}
                loading={markAsRead.isPending}
              />
            </Tooltip>
          )}
          {(record.status === 'pending' || record.status === 'failed') && (
            <Tooltip title="Resend">
              <Button 
                icon={<SendOutlined />} 
                onClick={() => handleResendNotification(record.id)}
                loading={resendNotification.isPending}
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

  // ── Loading state ─────────────────────────────────────────────────────────
  if (notificationsLoading || customersLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Spin size="large" tip="Loading notifications..." />
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (notificationsError) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="Error Loading Notifications"
          description="There was an error loading the notifications. Please try again."
          type="error"
          showIcon
          action={
            <Button size="small" type="primary" onClick={() => refetchNotifications()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  // ── Render Drawer Content ─────────────────────────────────────────────────
  const renderDrawerContent = () => {
    if (!selectedNotification) return null;

    const customerName = getCustomerName(selectedNotification.customerId);
    const customerPhone = getCustomerPhone(selectedNotification.customerId);
    const isUnread = selectedNotification.status === 'pending' || selectedNotification.status === 'unread';

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
          background: selectedNotification.status === 'sent' || selectedNotification.status === 'read' ? '#f6ffed' : 
                     selectedNotification.status === 'pending' || selectedNotification.status === 'unread' ? '#e6f7ff' : '#fff2e8',
          border: `1px solid ${selectedNotification.status === 'sent' || selectedNotification.status === 'read' ? '#b7eb8f' : 
                               selectedNotification.status === 'pending' || selectedNotification.status === 'unread' ? '#91d5ff' : '#ffccc7'}`,
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Space>
            {(selectedNotification.status === 'sent' || selectedNotification.status === 'read') && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
            {(selectedNotification.status === 'pending' || selectedNotification.status === 'unread') && <ClockCircleOutlined style={{ color: '#1890ff' }} />}
            {selectedNotification.status === 'failed' && <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            <Text strong>
              Status: {notificationStatusLabels[selectedNotification.status as keyof typeof notificationStatusLabels] || selectedNotification.status}
            </Text>
          </Space>
          <Badge 
            status={selectedNotification.status === 'sent' || selectedNotification.status === 'read' ? 'success' : 
                   selectedNotification.status === 'pending' || selectedNotification.status === 'unread' ? 'processing' : 'error'} 
            text={selectedNotification.status.toUpperCase()}
          />
        </div>

        {/* Quick Actions */}
        <div style={{ marginBottom: 24 }}>
          <Space wrap>
            {isUnread && (
              <Button 
                type="primary" 
                icon={<ReadOutlined />}
                onClick={() => {
                  handleMarkAsRead(selectedNotification.id);
                  setViewDrawerOpen(false);
                }}
                loading={markAsRead.isPending}
              >
                Mark as Read
              </Button>
            )}
            {(selectedNotification.status === 'pending' || selectedNotification.status === 'failed') && (
              <Button 
                type="primary" 
                icon={<SendOutlined />}
                onClick={() => handleResendNotification(selectedNotification.id)}
                loading={resendNotification.isPending}
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
                  <Tag color={selectedNotification.type === 'contribution_due_soon' ? 'blue' : 
                           selectedNotification.type === 'contribution_overdue' ? 'red' : 'default'}>
                    {notificationTypeLabels[selectedNotification.type as keyof typeof notificationTypeLabels] || selectedNotification.type}
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
                {selectedNotification.readAt && (
                  <Descriptions.Item label={<Space><ReadOutlined /> Read At</Space>}>
                    {dayjs(selectedNotification.readAt).format('MMMM DD, YYYY HH:mm')}
                  </Descriptions.Item>
                )}
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
          <Space>
            {isUnread && (
              <Button 
                type="primary" 
                icon={<ReadOutlined />}
                onClick={() => {
                  handleMarkAsRead(selectedNotification.id);
                  setViewDrawerOpen(false);
                }}
                loading={markAsRead.isPending}
              >
                Mark as Read
              </Button>
            )}
            {(selectedNotification.status === 'pending' || selectedNotification.status === 'failed') && (
              <Button 
                type="primary" 
                icon={<SendOutlined />}
                onClick={() => handleResendNotification(selectedNotification.id)}
                loading={resendNotification.isPending}
              >
                Resend
              </Button>
            )}
          </Space>
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
            label: 'Send Test SMS',
            onClick: () => {
              setSendModal(true);
              sendForm.setFieldsValue({ isTest: true });
            },
            icon: <PhoneOutlined />,
          },
          {
            label: 'Mark All as Read',
            onClick: handleMarkAllAsRead,
            icon: <ReadOutlined />,
            disabled: stats.unread === 0,
          },
          {
            label: 'Export',
            onClick: () => setExportModal(true),
            icon: <ExportOutlined />,
          },
          {
            label: 'Refresh',
            onClick: () => refetchNotifications(),
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
              title="Unread"
              value={stats.unread}
              prefix={<BellOutlined />}
              valueStyle={{ color: '#1890ff' }}
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
              valueStyle={{ color: '#faad14' }}
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
              <Option value="payment_confirmation">Payment Confirmed</Option>
              <Option value="general">General</Option>
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
              <Option value="unread">Unread</Option>
              <Option value="read">Read</Option>
            </Select>
          </Col>
          <Col xs={24} md={10}>
            <Space wrap>
              <Button 
                type="primary" 
                icon={<SendOutlined />}
                onClick={handleBulkSend}
                disabled={selectedNotifications.length === 0}
                loading={sendNotification.isPending}
              >
                Send Selected ({selectedNotifications.length})
              </Button>
              <Button 
                icon={<ReadOutlined />}
                onClick={handleMarkAllAsRead}
                disabled={stats.unread === 0}
                loading={markAllAsRead.isPending}
              >
                Mark All as Read
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
          loading={notificationsLoading}
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
            <Text strong>
              {sendForm.getFieldValue('isTest') ? 'Send Test SMS' : 'Send SMS Notification'}
            </Text>
          </Space>
        }
        open={sendModal}
        onCancel={() => {
          setSendModal(false);
          sendForm.resetFields();
          setTestSMSSent(false);
        }}
        footer={null}
        width={600}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px', maxHeight: '70vh', overflowY: 'auto' }}
      >
        <Alert
          message={sendForm.getFieldValue('isTest') ? "Send Test SMS" : "SMS Notification"}
          description={sendForm.getFieldValue('isTest') 
            ? "Send a test SMS to verify your phone number and message formatting. No customer will be notified." 
            : "Send an SMS notification to a customer about their payment status."}
          type={sendForm.getFieldValue('isTest') ? "warning" : "info"}
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={sendForm}
          layout="vertical"
          onFinish={handleSendNotification}
          initialValues={{ type: 'contribution_due_soon', isTest: false }}
        >
          <Form.Item
            name="isTest"
            label="Mode"
          >
            <Select 
              onChange={(value) => {
                setTestSMSSent(false);
                sendForm.setFieldsValue({ 
                  customerId: undefined,
                  testPhoneNumber: undefined,
                });
              }}
            >
              <Option value={false}>Send to Customer</Option>
              <Option value={true}>Send Test SMS</Option>
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.isTest !== curr.isTest}>
            {({ getFieldValue }) => {
              const isTest = getFieldValue('isTest');
              
              if (isTest) {
                return (
                  <Form.Item
                    name="testPhoneNumber"
                    label="Test Phone Number"
                    rules={[{ required: true, message: 'Please enter a phone number' }]}
                    extra="Enter a valid phone number to receive the test SMS"
                  >
                    <PhoneInput placeholder="Enter test phone number" />
                  </Form.Item>
                );
              }

              return (
                <Form.Item
                  name="customerId"
                  label="Select Customer"
                  rules={[{ required: true, message: 'Please select a customer' }]}
                >
                  <Select 
                    placeholder="Select customer" 
                    showSearch
                    optionFilterProp="children"
                  >
                    {customers.map(customer => (
                      <Option key={customer.id} value={customer.id}>
                        {customer.firstName} {customer.lastName} - {customer.phoneNumber}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item
            name="type"
            label="Notification Type"
            rules={[{ required: true, message: 'Please select notification type' }]}
          >
            <Select>
              <Option value="contribution_due_soon">Due Soon</Option>
              <Option value="contribution_overdue">Overdue</Option>
              <Option value="payment_confirmation">Payment Confirmed</Option>
              <Option value="general">General</Option>
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

          <Form.Item noStyle shouldUpdate={(prev, curr) => 
            prev.customerId !== curr.customerId || 
            prev.isTest !== curr.isTest ||
            prev.type !== curr.type ||
            prev.messageBody !== curr.messageBody ||
            prev.testPhoneNumber !== curr.testPhoneNumber
          }>
            {({ getFieldValue }) => {
              const isTest = getFieldValue('isTest');
              const customerId = getFieldValue('customerId');
              const testPhoneNumber = getFieldValue('testPhoneNumber');
              const messageBody = getFieldValue('messageBody');
              
              // For test mode, require phone number
              if (isTest && !testPhoneNumber) return null;
              
              // For customer mode, require customer
              if (!isTest && !customerId) return null;

              const customer = customerMap[customerId];
              const phoneNumber = isTest ? testPhoneNumber : customer?.phoneNumber;
              const customerName = isTest ? 'Test Number' : (customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown');
              
              return (
                <div style={{ 
                  background: isTest ? '#fff7e6' : '#f5f7fa', 
                  padding: 16, 
                  borderRadius: 8,
                  marginBottom: 16,
                  border: `1px solid ${isTest ? '#ffd591' : '#e8e8e8'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text strong>Message Preview</Text>
                    <Tag color={isTest ? 'orange' : 'blue'}>
                      {isTest ? '🔬 Test Mode' : '📤 Live'}
                    </Tag>
                  </div>
                  <div style={{ 
                    background: '#fff', 
                    padding: 12, 
                    borderRadius: 6,
                    border: '1px solid #e8e8e8'
                  }}>
                    <div style={{ marginBottom: 8 }}>
                      <Space>
                        <UserOutlined />
                        <Text>{customerName}</Text>
                      </Space>
                      <br />
                      <Space>
                        <PhoneOutlined />
                        <Text>{phoneNumber || 'N/A'}</Text>
                      </Space>
                    </div>
                    <Divider style={{ margin: '8px 0' }} />
                    <Text>{messageBody || 'Message will appear here...'}</Text>
                  </div>
                  {!isTest && customer && (
                    <div style={{ marginTop: 12 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <InfoCircleOutlined /> This message will be sent to {customer.firstName} {customer.lastName}
                      </Text>
                    </div>
                  )}
                  {isTest && (
                    <div style={{ marginTop: 12 }}>
                      <Text type="secondary" style={{ fontSize: 12, color: '#faad14' }}>
                        <WarningOutlined /> This is a test SMS. No customer will be notified.
                      </Text>
                    </div>
                  )}
                </div>
              );
            }}
          </Form.Item>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={sendNotification.isPending || sendTestSMS.isPending}
                icon={<SendOutlined />}
              >
                {sendForm.getFieldValue('isTest') ? 'Send Test SMS' : 'Send Notification'}
              </Button>
              <Button onClick={() => {
                setSendModal(false);
                sendForm.resetFields();
                setTestSMSSent(false);
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>

          {testSMSSent && (
            <Alert
              message="Test SMS Sent Successfully!"
              description="The test SMS has been sent to the provided phone number. Check your device for the message."
              type="success"
              showIcon
              closable
              style={{ marginTop: 16 }}
            />
          )}
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