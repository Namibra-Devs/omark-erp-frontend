// src/pages/notifications/NotificationsPage.tsx
import React, { useState } from 'react';
import {
  Button, Space, Modal, Form, Input, Select, Row, Col, Table,
  Tag, message, Typography, Card, Avatar, Tooltip,
  Statistic, Divider,
  Alert, Drawer, Descriptions, Radio, Spin
} from 'antd';
import {
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
  FileExcelOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  CodeOutlined,
  DownloadOutlined,
  CloseOutlined,
  ShareAltOutlined,
  PrinterOutlined,
  IdcardOutlined,
  MessageOutlined,
  NotificationOutlined,
  BellOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/shared/PageHeader';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { tokens } from '@/constants/tokens';
import { notificationStatusLabels, notificationTypeLabels } from '@/constants/enums';
import {
  useNotificationsQuery,
  useSendTestSMSMutation,
  type NotificationLog,
  type NotificationType,
  type NotificationStatus,
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
  // States
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | NotificationType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | NotificationStatus>('all');
  const [selectedNotification, setSelectedNotification] = useState<NotificationLog | null>(null);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [testSMSModal, setTestSMSModal] = useState(false);
  const [testSMSForm] = Form.useForm();
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

  const { data: customersData, isLoading: customersLoading } = useCustomersQuery({ pageSize: 100 });

  // ── API Mutations ──────────────────────────────────────────────────────────
  const sendTestSMS = useSendTestSMSMutation();

  // ── Data Mapping ──────────────────────────────────────────────────────────
  const notifications: NotificationLog[] = notificationsData?.items ?? [];
  const customers: Customer[] = customersData?.items ?? [];

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
    sent: notifications.filter(n => n.status === 'sent').length,
    pending: notifications.filter(n => n.status === 'pending').length,
    failed: notifications.filter(n => n.status === 'failed').length,
    dueSoon: notifications.filter(n => n.type === 'contribution_due_soon').length,
    overdue: notifications.filter(n => n.type === 'contribution_overdue').length,
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSendTestSMS = async (values: any) => {
    try {
      await sendTestSMS.mutateAsync({
        phoneNumber: values.phoneNumber,
        message: values.message,
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

  // ── Export function ──────────────────────────────────────────────────────
  const handleExport = () => {
    setExportLoading(true);
    const dataToExport = filteredNotifications.map(notification => ({
      'ID': notification.id,
      'Customer': getCustomerName(notification.customerId),
      'Phone': notification.phoneNumber || '',
      'Type': notificationTypeLabels[notification.type] || notification.type,
      'Message': notification.messageBody,
      'Status': notificationStatusLabels[notification.status] || notification.status,
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
      title: 'Customer',
      key: 'customer',
      width: 200,
      render: (_: any, record: NotificationLog) => (
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
      render: (type: NotificationType) => {
        const config: Record<NotificationType, { color: string; icon: any; label: string }> = {
          contribution_due_soon: { color: 'blue', icon: <BellOutlined />, label: 'Due Soon' },
          contribution_overdue: { color: 'red', icon: <WarningOutlined />, label: 'Overdue' },
        };
        const configs = config[type];
        return <Tag color={configs.color} icon={configs.icon}>{configs.label}</Tag>;
      },
      filters: [
        { text: 'Due Soon', value: 'contribution_due_soon' },
        { text: 'Overdue', value: 'contribution_overdue' },
      ],
      onFilter: (value: any, record: NotificationLog) => record.type === value,
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
      render: (status: NotificationStatus) => {
        const config: Record<NotificationStatus, { color: string; icon: any; label: string }> = {
          sent: { color: 'green', icon: <CheckCircleOutlined />, label: 'Sent' },
          pending: { color: 'blue', icon: <ClockCircleOutlined />, label: 'Pending' },
          failed: { color: 'red', icon: <CloseCircleOutlined />, label: 'Failed' },
        };
        const configs = config[status];
        return <Tag color={configs.color} icon={configs.icon}>{configs.label}</Tag>;
      },
      filters: [
        { text: 'Sent', value: 'sent' },
        { text: 'Pending', value: 'pending' },
        { text: 'Failed', value: 'failed' },
      ],
      onFilter: (value: any, record: NotificationLog) => record.status === value,
    },
    {
      title: 'Sent At',
      key: 'sentAt',
      width: 160,
      render: (_: any, record: NotificationLog) => {
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
      sorter: (a: NotificationLog, b: NotificationLog) => {
        if (!a.sentAt) return 1;
        if (!b.sentAt) return -1;
        return dayjs(a.sentAt).unix() - dayjs(b.sentAt).unix();
      },
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (createdAt: string) => (
        <Tooltip title={dayjs(createdAt).format('MMMM DD, YYYY HH:mm')}>
          <Text type="secondary">{dayjs(createdAt).format('MMM DD, HH:mm')}</Text>
        </Tooltip>
      ),
      sorter: (a: NotificationLog, b: NotificationLog) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: NotificationLog) => (
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
              Status: {notificationStatusLabels[selectedNotification.status] || selectedNotification.status}
            </Text>
          </Space>
        </div>

        {/* Quick Actions */}
        <div style={{ marginBottom: 24 }}>
          <Space wrap>
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
                    {notificationTypeLabels[selectedNotification.type] || selectedNotification.type}
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
          justifyContent: 'flex-start'
        }}>
          <Space>
            <Button icon={<PrinterOutlined />}>Print</Button>
            <Button icon={<ShareAltOutlined />}>Share</Button>
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
            label: 'Send Test SMS',
            onClick: () => setTestSMSModal(true),
            icon: <PhoneOutlined />,
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

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Input
              placeholder="Search by customer, phone, or message"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="middle"
            />
          </Col>
          <Col xs={12} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="Filter by type"
              value={typeFilter}
              onChange={setTypeFilter}
              size="middle"
            >
              <Option value="all">All Types</Option>
              <Option value="contribution_due_soon">Due Soon</Option>
              <Option value="contribution_overdue">Overdue</Option>
            </Select>
          </Col>
          <Col xs={12} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="Filter by status"
              value={statusFilter}
              onChange={setStatusFilter}
              size="middle"
            >
              <Option value="all">All Statuses</Option>
              <Option value="sent">Sent</Option>
              <Option value="pending">Pending</Option>
              <Option value="failed">Failed</Option>
            </Select>
          </Col>
          <Col xs={24} md={6}>
            <Text type="secondary">
              Total: {filteredNotifications.length} notifications
            </Text>
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
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} notifications`,
            responsive: true,
          }}
        />
      </div>

      {/* Send Test SMS Modal */}
      <Modal
        title={
          <Space>
            <SendOutlined style={{ color: tokens.primary }} />
            <Text strong>Send Test SMS</Text>
          </Space>
        }
        open={testSMSModal}
        onCancel={() => {
          setTestSMSModal(false);
          testSMSForm.resetFields();
          setTestSMSSent(false);
        }}
        footer={null}
        width={500}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px', maxHeight: '70vh', overflowY: 'auto' }}
      >
        <Alert
          message="Send Test SMS"
          description="Send a test SMS to verify your phone number and message formatting. No customer will be notified."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={testSMSForm}
          layout="vertical"
          onFinish={handleSendTestSMS}
        >
          <Form.Item
            name="phoneNumber"
            label="Test Phone Number"
            rules={[{ required: true, message: 'Please enter a phone number' }]}
            extra="Enter a valid phone number to receive the test SMS"
          >
            <PhoneInput placeholder="Enter test phone number" />
          </Form.Item>

          <Form.Item
            name="message"
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

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={sendTestSMS.isPending}
                icon={<SendOutlined />}
              >
                Send Test SMS
              </Button>
              <Button onClick={() => {
                setTestSMSModal(false);
                testSMSForm.resetFields();
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

      {/* Detail Drawer */}
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
