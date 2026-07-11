// src/pages/cs/CSProspectsPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Button, Space, Modal, Form, Input, Select, Row, Col, Table, 
  Tag, message, Typography, Card, Avatar, Badge, Tooltip, 
  DatePicker, Progress, Statistic, Divider, Tabs, Empty,
  Dropdown, Popconfirm, Radio, Alert, Drawer, Descriptions,
  Timeline, Steps, Rate, Switch, Spin
} from 'antd';
import { 
  PlusOutlined, 
  EyeOutlined, 
  SearchOutlined, 
  FilterOutlined,
  ReloadOutlined,
  ExportOutlined,
  PhoneOutlined,
  MailOutlined,
  HomeOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
  MessageOutlined,
  WhatsAppOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  CodeOutlined,
  DownloadOutlined,
  CloseOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  HeartOutlined,
  HeartFilled,
  ShareAltOutlined,
  PrinterOutlined,
  FlagOutlined,
  GlobalOutlined,
  EnvironmentOutlined,
  IdcardOutlined,
  CustomerServiceOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { StatusTag } from '@/components/shared/StatusTag';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { PageHeader } from '@/components/shared/PageHeader';
import { prospectStatusLabels, prospectSourceLabels } from '@/constants/enums';
import { tokens } from '@/constants/tokens';
import type { Prospect, ProspectStatus, ProspectSource } from '@/types';
import { 
  useProspectsQuery, 
  useCreateProspectMutation, 
  useUpdateProspectMutation,
  useDeleteProspectMutation,
  useProspectQuery
} from '@/api/prospects';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Option } = Select;
const { TextArea } = Input;
const { Text, Title } = Typography;

export const CSProspectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  
  // Export states
  const [exportModal, setExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv' | 'pdf' | 'json'>('excel');
  const [exportLoading, setExportLoading] = useState(false);

  // ── API Queries ────────────────────────────────────────────────────────────
  const { 
    data: prospectsData, 
    isLoading: prospectsLoading,
    refetch: refetchProspects,
    error: prospectsError
  } = useProspectsQuery({
    source: 'customer_service',
    status: statusFilter !== 'all' ? statusFilter : undefined,
    q: searchText || undefined,
  });

  // ── API Mutations ──────────────────────────────────────────────────────────
  const createProspect = useCreateProspectMutation();
  const updateProspect = useUpdateProspectMutation();
  const deleteProspect = useDeleteProspectMutation();

  // ── Data Extraction ──────────────────────────────────────────────────────
  const prospects: Prospect[] = React.useMemo(() => {
    if (!prospectsData) return [];
    const data = (prospectsData as any).data ?? prospectsData;
    if (Array.isArray(data)) return data;
    if (data?.items) return data.items;
    return [];
  }, [prospectsData]);

  // ── Filter prospects by tab ─────────────────────────────────────────────
  const filteredProspects = prospects.filter(prospect => {
    const matchesTab = activeTab === 'all' || 
      (activeTab === 'active' && prospect.status !== 'purchased' && prospect.status !== 'canceled') ||
      (activeTab === 'completed' && (prospect.status === 'purchased' || prospect.status === 'canceled'));
    return matchesTab;
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const statusBreakdown = {
    total: prospects.length,
    new: prospects.filter(p => p.status === 'new').length,
    meetingScheduled: prospects.filter(p => p.status === 'meeting_scheduled').length,
    meetingCompleted: prospects.filter(p => p.status === 'meeting_completed').length,
    purchased: prospects.filter(p => p.status === 'purchased').length,
    canceled: prospects.filter(p => p.status === 'canceled').length,
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddProspect = async (values: any) => {
    try {
      const payload = {
        ...values,
        source: 'customer_service' as ProspectSource,
        assignedUserId: user?.id || '4',
        status: 'new' as ProspectStatus,
      };

      await createProspect.mutateAsync(payload);
      message.success('Customer Service prospect added successfully!');
      setIsModalOpen(false);
      form.resetFields();
      
      setTimeout(() => {
        refetchProspects();
      }, 500);
    } catch (error: any) {
      message.error(error?.message || 'Failed to add prospect');
    }
  };

  const handleStatusChange = async (id: string, newStatus: ProspectStatus) => {
    try {
      await updateProspect.mutateAsync({
        id,
        data: { status: newStatus },
      });
      message.success(`Status updated to ${prospectStatusLabels[newStatus]}`);
      
      setTimeout(() => {
        refetchProspects();
      }, 300);
    } catch (error: any) {
      message.error(error?.message || 'Failed to update status');
    }
  };

  const handleDeleteProspect = async (id: string) => {
    try {
      await deleteProspect.mutateAsync(id);
      message.success('Prospect deleted successfully!');
      
      setTimeout(() => {
        refetchProspects();
      }, 300);
    } catch (error: any) {
      message.error(error?.message || 'Failed to delete prospect');
    }
  };

  // ── Export function ──────────────────────────────────────────────────────
  const handleExport = () => {
    setExportLoading(true);
    setTimeout(() => {
      const dataToExport = filteredProspects.map(p => ({
        'Full Name': `${p.firstName} ${p.lastName}`,
        'Phone': p.phoneNumber,
        'Address': p.address,
        'Status': prospectStatusLabels[p.status as keyof typeof prospectStatusLabels],
        'Source': prospectSourceLabels[p.source as keyof typeof prospectSourceLabels],
        'Reason': p.reasonForContact,
        'Notes': p.notes || '',
        'Created': dayjs(p.createdAt).format('YYYY-MM-DD HH:mm'),
        'Updated': dayjs(p.updatedAt).format('YYYY-MM-DD HH:mm'),
      }));

      let fileName = `cs-prospects-${dayjs().format('YYYY-MM-DD-HHmmss')}`;
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
      message.success(`Exported ${dataToExport.length} prospects as ${exportFormat.toUpperCase()}!`);
    }, 1000);
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (prospectsLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Spin size="large" tip="Loading prospects..." />
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (prospectsError) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="Error Loading Prospects"
          description="There was an error loading the prospects. Please try again."
          type="error"
          showIcon
          action={
            <Button size="small" type="primary" onClick={() => refetchProspects()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  // ── Table Columns ─────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Customer',
      key: 'customer',
      width: 200,
      render: (_: any, record: Prospect) => (
        <Space>
          <Avatar 
            icon={<UserOutlined />} 
            style={{ backgroundColor: tokens.primary }}
          />
          <div>
            <Text strong>{record.firstName} {record.lastName}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              <PhoneOutlined /> {record.phoneNumber}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Address',
      dataIndex: 'address',
      key: 'address',
      width: 180,
      ellipsis: true,
      render: (address: string) => (
        <Tooltip title={address}>
          <HomeOutlined /> {address}
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
          <Text>{text}</Text>
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
          {prospectSourceLabels[source as keyof typeof prospectSourceLabels]}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => (
        <Tooltip title={dayjs(date).format('MMMM DD, YYYY')}>
          {dayjs(date).fromNow()}
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: Prospect) => (
        <Space>
          <Tooltip title="View Details">
            <Button 
              type="primary"
              ghost
              icon={<EyeOutlined />} 
              onClick={() => {
                setSelectedProspect(record);
                setViewDrawerOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Edit Status">
            <Dropdown 
              menu={{ 
                items: [
                  { key: 'new', label: 'New', onClick: () => handleStatusChange(record.id, 'new') },
                  { key: 'meeting_scheduled', label: 'Meeting Scheduled', onClick: () => handleStatusChange(record.id, 'meeting_scheduled') },
                  { key: 'meeting_completed', label: 'Meeting Completed', onClick: () => handleStatusChange(record.id, 'meeting_completed') },
                  { key: 'suspended', label: 'Suspended', onClick: () => handleStatusChange(record.id, 'suspended') },
                  { key: 'postponed', label: 'Postponed', onClick: () => handleStatusChange(record.id, 'postponed') },
                  { key: 'canceled', label: 'Canceled', onClick: () => handleStatusChange(record.id, 'canceled') },
                ]
              }} 
              trigger={['click']}
            >
              <Button icon={<EditOutlined />} />
            </Dropdown>
          </Tooltip>
          <Popconfirm
            title="Delete Prospect"
            description={`Are you sure you want to delete ${record.firstName} ${record.lastName}?`}
            onConfirm={() => handleDeleteProspect(record.id)}
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

  // ── Drawer Content ──────────────────────────────────────────────────────
  const renderDrawerContent = () => {
    if (!selectedProspect) return null;

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
                {selectedProspect.firstName} {selectedProspect.lastName}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <IdcardOutlined /> ID: {selectedProspect.id}
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
          background: `${getStatusColor(selectedProspect.status)}10`,
          border: `1px solid ${getStatusColor(selectedProspect.status)}`,
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Space>
            {getStatusIcon(selectedProspect.status)}
            <Text strong>Status: {prospectStatusLabels[selectedProspect.status as keyof typeof prospectStatusLabels]}</Text>
          </Space>
          <Badge 
            status={selectedProspect.status === 'purchased' ? 'success' : 'default'}
            text={selectedProspect.status === 'purchased' ? 'Active' : 'Inactive'}
          />
        </div>

        {/* Quick Actions */}
        <div style={{ marginBottom: 24 }}>
          <Space wrap>
            <Button type="primary" icon={<EditOutlined />}>
              Update Status
            </Button>
            <Button icon={<MessageOutlined />}>
              Send Message
            </Button>
            <Button icon={<PhoneOutlined />}>
              Call
            </Button>
            <Button icon={<ShareAltOutlined />}>
              Share
            </Button>
          </Space>
        </div>

        {/* Main Info Cards */}
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card size="small" title="Personal Information" bordered={false} style={{ background: '#fafafa' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label={<Space><UserOutlined /> Full Name</Space>}>
                  <Text strong>{selectedProspect.firstName} {selectedProspect.lastName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Space><PhoneOutlined /> Phone</Space>}>
                  <a href={`tel:${selectedProspect.phoneNumber}`}>
                    {selectedProspect.phoneNumber}
                  </a>
                </Descriptions.Item>
                <Descriptions.Item label={<Space><EnvironmentOutlined /> Address</Space>}>
                  {selectedProspect.address}
                </Descriptions.Item>
                <Descriptions.Item label={<Space><GlobalOutlined /> Source</Space>}>
                  <Tag color="green">Customer Service</Tag>
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
                  <Tag color="blue">User #{selectedProspect.assignedUserId}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Created">
                  {dayjs(selectedProspect.createdAt).format('MMMM DD, YYYY')}
                </Descriptions.Item>
                <Descriptions.Item label="Last Updated" span={2}>
                  {dayjs(selectedProspect.updatedAt).format('MMMM DD, YYYY')}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {/* Reason & Notes */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="Reason for Contact" bordered={false} style={{ background: '#fafafa' }}>
              <Text>{selectedProspect.reasonForContact}</Text>
            </Card>
          </Col>
        </Row>

        {selectedProspect.notes && (
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={24}>
              <Card size="small" title="Notes" bordered={false} style={{ background: '#fafafa' }}>
                <Text>{selectedProspect.notes}</Text>
              </Card>
            </Col>
          </Row>
        )}

        {/* Timeline */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="Activity Timeline" bordered={false} style={{ background: '#fafafa' }}>
              <Timeline>
                <Timeline.Item color="green">
                  <Text>Prospect created</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(selectedProspect.createdAt).format('MMMM DD, YYYY HH:mm')}
                  </Text>
                </Timeline.Item>
                <Timeline.Item color="blue">
                  <Text>Status: {prospectStatusLabels[selectedProspect.status as keyof typeof prospectStatusLabels]}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Updated {dayjs(selectedProspect.updatedAt).fromNow()}
                  </Text>
                </Timeline.Item>
                <Timeline.Item color="gray">
                  <Text>Awaiting further action</Text>
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
          justifyContent: 'space-between'
        }}>
          <Space>
            <Button icon={<PrinterOutlined />}>Print</Button>
            <Button icon={<ShareAltOutlined />}>Share</Button>
          </Space>
          <Space>
            <Button 
              type="primary" 
              onClick={() => {
                setViewDrawerOpen(false);
                navigate(`/cs/prospects/${selectedProspect.id}`);
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
    <div style={{ maxWidth: '100%', overflow: 'hidden', padding: '0 4px' }}>
      <PageHeader
        title="Customer Service Prospects"
        actions={[
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
              refetchProspects();
              message.success('Refreshed!');
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
              prefix={<UserOutlined />}
              valueStyle={{ color: tokens.primary }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="New"
              value={statusBreakdown.new}
              prefix={<Badge status="processing" />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Meeting Scheduled"
              value={statusBreakdown.meetingScheduled}
              prefix={<Badge status="warning" />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Meeting Completed"
              value={statusBreakdown.meetingCompleted}
              prefix={<Badge status="success" />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Purchased"
              value={statusBreakdown.purchased}
              prefix={<Badge status="success" />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Canceled"
              value={statusBreakdown.canceled}
              prefix={<Badge status="error" />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabs and Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Input
              placeholder="Search by name, phone, or address"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="middle"
            />
          </Col>
          <Col xs={12} md={6}>
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
          <Col xs={12} md={6}>
            <Select
              style={{ width: '100%' }}
              value={activeTab}
              onChange={setActiveTab}
              size="middle"
            >
              <Option value="all">All Prospects</Option>
              <Option value="active">Active</Option>
              <Option value="completed">Completed</Option>
            </Select>
          </Col>
          <Col xs={24} md={4}>
            <Text type="secondary" style={{ display: 'block', textAlign: 'right' }}>
              Total: {filteredProspects.length} prospects
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <Table
          columns={columns}
          dataSource={filteredProspects}
          rowKey="id"
          loading={prospectsLoading}
          size="middle"
          scroll={{ x: 1000 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} prospects`,
            responsive: true,
          }}
        />
      </div>

      {/* Add Prospect Modal */}
      <Modal
        title={
          <Space>
            <PlusOutlined style={{ color: tokens.primary }} />
            <Text strong>Add Customer Service Prospect</Text>
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
          onFinish={handleAddProspect}
        >
          <Row gutter={[8, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="firstName"
                label="First Name"
                rules={[{ required: true, message: 'First name is required' }]}
              >
                <Input placeholder="First name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="lastName"
                label="Last Name"
                rules={[{ required: true, message: 'Last name is required' }]}
              >
                <Input placeholder="Last name" />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            name="address"
            label="Address"
            rules={[{ required: true, message: 'Address is required' }]}
          >
            <Input.TextArea rows={2} placeholder="Full address" />
          </Form.Item>
          
          <Form.Item
            name="phoneNumber"
            label="Phone Number"
            rules={[{ required: true, message: 'Phone number is required' }]}
          >
            <PhoneInput />
          </Form.Item>
          
          <Form.Item
            name="reasonForContact"
            label="Reason for Contact"
            rules={[{ required: true, message: 'Reason for contact is required' }]}
          >
            <TextArea rows={3} placeholder="Describe the reason for contact" />
          </Form.Item>
          
          <Form.Item
            name="notes"
            label="Additional Notes"
          >
            <TextArea rows={3} placeholder="Any additional notes" />
          </Form.Item>
          
          <Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit" loading={createProspect.isPending}>
                Create Prospect
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
          message={`${filteredProspects.length} prospects will be exported`}
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
    </div>
  );
};