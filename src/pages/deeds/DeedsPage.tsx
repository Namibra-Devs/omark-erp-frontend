// src/pages/deeds/DeedsPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Space, Modal, Form, Input, Select, Row, Col, Table,
  Tag, message, Typography, Card, Avatar, Badge, Tooltip,
  DatePicker, Statistic, Divider, Empty, Dropdown, Popconfirm,
  Alert, Drawer, Descriptions, Timeline, Tabs, Progress,
  Radio, Switch, InputNumber, Upload, List, Collapse, Image
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
  CopyOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusTag } from '@/components/shared/StatusTag';
import { MoneyText } from '@/components/shared/MoneyText';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { tokens } from '@/constants/tokens';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import advancedFormat from 'dayjs/plugin/advancedFormat';

dayjs.extend(relativeTime);
dayjs.extend(advancedFormat);

const { Option } = Select;
const { TextArea } = Input;
const { Text, Title } = Typography;

// Mock Deeds Data
const mockDeeds = [
  {
    id: 'd1',
    customerId: 'c1',
    propertyId: 'prop1',
    witnesses: [
      { name: 'James Wilson', contact: '+233241234575' },
      { name: 'Mary Thompson', contact: '+233241234576' }
    ],
    businessContacts: 'Omark Real Estate Ltd. - Accra Office',
    documentUrl: '/deeds/deed-d1.pdf',
    generatedByUserId: '1',
    generatedAt: '2024-01-20T10:00:00Z',
    createdAt: '2024-01-20T10:00:00Z',
  },
  {
    id: 'd2',
    customerId: 'c3',
    propertyId: 'prop3',
    witnesses: [
      { name: 'Robert Adams', contact: '+233241234577' },
      { name: 'Susan Parker', contact: '+233241234578' }
    ],
    businessContacts: 'Omark Real Estate Ltd. - Kumasi Office',
    documentUrl: '/deeds/deed-d2.pdf',
    generatedByUserId: '1',
    generatedAt: '2024-01-18T14:30:00Z',
    createdAt: '2024-01-18T14:30:00Z',
  },
  {
    id: 'd3',
    customerId: 'c4',
    propertyId: 'prop4',
    witnesses: [
      { name: 'John Mensah', contact: '+233241234579' },
      { name: 'Grace Asante', contact: '+233241234580' }
    ],
    businessContacts: 'Omark Real Estate Ltd. - Tema Office',
    documentUrl: '/deeds/deed-d3.pdf',
    generatedByUserId: '1',
    generatedAt: '2024-01-15T09:00:00Z',
    createdAt: '2024-01-15T09:00:00Z',
  },
  {
    id: 'd4',
    customerId: 'c6',
    propertyId: 'prop6',
    witnesses: [
      { name: 'Daniel Quaye', contact: '+233241234581' },
      { name: 'Elizabeth Nkrumah', contact: '+233241234582' }
    ],
    businessContacts: 'Omark Real Estate Ltd. - Accra Office',
    documentUrl: '/deeds/deed-d4.pdf',
    generatedByUserId: '1',
    generatedAt: '2024-01-12T16:45:00Z',
    createdAt: '2024-01-12T16:45:00Z',
  },
];

// Mock Customers
const mockCustomers: Record<string, { name: string; phone: string; address: string }> = {
  'c1': { name: 'John Doe', phone: '+233241234567', address: '123 Main St, Accra' },
  'c3': { name: 'Michael Johnson', phone: '+233241234569', address: '789 Liberation Rd, Tema' },
  'c4': { name: 'Sarah Williams', phone: '+233241234570', address: '321 Castle Rd, Cape Coast' },
  'c6': { name: 'Emily Davis', phone: '+233241234572', address: '987 Park Ave, Accra' },
};

// Mock Properties
const mockProperties: Record<string, { houseNumber: string; offerNumber: string; priceMinor: number }> = {
  'prop1': { houseNumber: 'H-102', offerNumber: 'OF-2024-001', priceMinor: 15000000 },
  'prop3': { houseNumber: 'H-301', offerNumber: 'OF-2024-003', priceMinor: 20000000 },
  'prop4': { houseNumber: 'H-108', offerNumber: 'OF-2024-004', priceMinor: 10000000 },
  'prop6': { houseNumber: 'H-203', offerNumber: 'OF-2024-006', priceMinor: 12000000 },
};

export const DeedsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // States
  const [loading, setLoading] = useState(false);
  const [deeds, setDeeds] = useState<any[]>(mockDeeds);
  const [searchText, setSearchText] = useState('');
  const [selectedDeed, setSelectedDeed] = useState<any | null>(null);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [generateModal, setGenerateModal] = useState(false);
  const [form] = Form.useForm();
  const [witnesses, setWitnesses] = useState<{ name: string; contact: string }[]>([
    { name: '', contact: '' },
    { name: '', contact: '' }
  ]);

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

  const getCustomerAddress = (customerId: string) => {
    return mockCustomers[customerId]?.address || '';
  };

  const getPropertyDetails = (propertyId: string) => {
    return mockProperties[propertyId] || null;
  };

  // Filter deeds
  const filteredDeeds = deeds.filter(deed => {
    const customerName = getCustomerName(deed.customerId).toLowerCase();
    const property = getPropertyDetails(deed.propertyId);
    const propertySearch = property ? `${property.houseNumber} ${property.offerNumber}`.toLowerCase() : '';
    const matchesSearch = customerName.includes(searchText.toLowerCase()) ||
                          propertySearch.includes(searchText.toLowerCase()) ||
                          deed.id.toLowerCase().includes(searchText.toLowerCase());
    return matchesSearch;
  });

  // Stats
  const stats = {
    total: deeds.length,
    totalValue: deeds.reduce((sum, deed) => {
      const property = getPropertyDetails(deed.propertyId);
      return sum + (property?.priceMinor || 0);
    }, 0),
  };

  // Generate Deed
  const handleGenerateDeed = (values: any) => {
    setLoading(true);
    setTimeout(() => {
      const newDeed = {
        id: `d${Date.now()}`,
        customerId: values.customerId,
        propertyId: values.propertyId,
        witnesses: witnesses.filter(w => w.name && w.contact),
        businessContacts: values.businessContacts,
        documentUrl: `/deeds/deed-${Date.now()}.pdf`,
        generatedByUserId: user?.id || '1',
        generatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      setDeeds([newDeed, ...deeds]);
      setLoading(false);
      setGenerateModal(false);
      form.resetFields();
      setWitnesses([{ name: '', contact: '' }, { name: '', contact: '' }]);
      message.success('Deed generated successfully!');
    }, 1500);
  };

  // Download Deed
  const handleDownloadDeed = (deed: any) => {
    message.success(`Downloading deed ${deed.id}...`);
    // In production, this would download the actual PDF
    // window.open(deed.documentUrl, '_blank');
  };

  // Delete Deed
  const handleDeleteDeed = (id: string) => {
    setDeeds(deeds.filter(d => d.id !== id));
    message.success('Deed deleted successfully!');
  };

  // Add witness row
  const addWitness = () => {
    setWitnesses([...witnesses, { name: '', contact: '' }]);
  };

  // Remove witness row
  const removeWitness = (index: number) => {
    if (witnesses.length <= 2) {
      message.warning('Minimum 2 witnesses required');
      return;
    }
    const newWitnesses = witnesses.filter((_, i) => i !== index);
    setWitnesses(newWitnesses);
  };

  // Update witness
  const updateWitness = (index: number, field: string, value: string) => {
    const newWitnesses = [...witnesses];
    newWitnesses[index] = { ...newWitnesses[index], [field]: value };
    setWitnesses(newWitnesses);
  };

  // Export function
  const handleExport = () => {
    setExportLoading(true);
    const dataToExport = filteredDeeds.map(deed => {
      const customer = mockCustomers[deed.customerId];
      const property = getPropertyDetails(deed.propertyId);
      return {
        'Deed ID': deed.id,
        'Customer': customer?.name || 'Unknown',
        'Property': property ? `${property.houseNumber} - ${property.offerNumber}` : 'N/A',
        'Property Price': property ? `GHS ${(property.priceMinor / 100).toLocaleString()}` : 'N/A',
        'Witnesses': deed.witnesses.map((w: any) => `${w.name} (${w.contact})`).join('; '),
        'Business Contacts': deed.businessContacts,
        'Generated By': `User #${deed.generatedByUserId}`,
        'Generated At': dayjs(deed.generatedAt).format('YYYY-MM-DD HH:mm'),
        'Created': dayjs(deed.createdAt).format('YYYY-MM-DD'),
      };
    });

    let fileName = `deeds-${dayjs().format('YYYY-MM-DD-HHmmss')}`;
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
      message.success(`Exported ${dataToExport.length} deeds as ${exportFormat.toUpperCase()}!`);
    }, 1000);
  };

  // Table Columns
  const columns = [
    {
      title: 'Customer',
      key: 'customer',
      width: 200,
      render: (_: any, record: any) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: tokens.primary }} />
          <div>
            <Text strong>{getCustomerName(record.customerId)}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              <PhoneOutlined /> {getCustomerPhone(record.customerId)}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Property',
      key: 'property',
      width: 150,
      render: (_: any, record: any) => {
        const property = getPropertyDetails(record.propertyId);
        return property ? (
          <div>
            <Text strong>{property.houseNumber}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{property.offerNumber}</Text>
          </div>
        ) : 'N/A';
      },
    },
    {
      title: 'Property Price',
      key: 'price',
      width: 140,
      render: (_: any, record: any) => {
        const property = getPropertyDetails(record.propertyId);
        return property ? <MoneyText minor={property.priceMinor} /> : 'N/A';
      },
    },
    {
      title: 'Witnesses',
      key: 'witnesses',
      width: 200,
      render: (_: any, record: any) => (
        <div>
          {record.witnesses.map((w: any, idx: number) => (
            <div key={idx} style={{ fontSize: 12 }}>
              <UserOutlined /> {w.name}
              <br />
              <PhoneOutlined /> {w.contact}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Generated On',
      dataIndex: 'generatedAt',
      key: 'generatedAt',
      width: 160,
      render: (date: string) => (
        <Tooltip title={dayjs(date).format('MMMM DD, YYYY HH:mm')}>
          <div>
            <CalendarOutlined /> {dayjs(date).format('MMM DD, YYYY')}
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(date).format('HH:mm')}
            </Text>
          </div>
        </Tooltip>
      ),
      sorter: (a: any, b: any) => dayjs(a.generatedAt).unix() - dayjs(b.generatedAt).unix(),
    },
    {
      title: 'Generated By',
      key: 'generatedBy',
      width: 120,
      render: (_: any, record: any) => (
        <Tooltip title={`User ID: ${record.generatedByUserId}`}>
          <Badge status="processing" text={`User #${record.generatedByUserId}`} />
        </Tooltip>
      ),
    },
    {
      title: 'Download',
      key: 'download',
      width: 120,
      render: (_: any, record: any) => (
        <Tooltip title="Download PDF">
          <Button 
            type="primary" 
            icon={<DownloadOutlined />} 
            onClick={() => handleDownloadDeed(record)}
            size="small"
          >
            PDF
          </Button>
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title="View Details">
            <Button 
              type="primary"
              ghost
              icon={<EyeOutlined />} 
              onClick={() => {
                setSelectedDeed(record);
                setViewDrawerOpen(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Deed"
            description={`Are you sure you want to delete this deed?`}
            onConfirm={() => handleDeleteDeed(record.id)}
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
    if (!selectedDeed) return null;

    const customerName = getCustomerName(selectedDeed.customerId);
    const customerPhone = getCustomerPhone(selectedDeed.customerId);
    const customerAddress = getCustomerAddress(selectedDeed.customerId);
    const property = getPropertyDetails(selectedDeed.propertyId);

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
              icon={<FileProtectOutlined />} 
              style={{ backgroundColor: tokens.primary }}
            />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                Deed of Purchase
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <IdcardOutlined /> ID: {selectedDeed.id}
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

        {/* Deed Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 8,
          padding: '16px 20px',
          marginBottom: 24,
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space>
              <SafetyOutlined style={{ fontSize: 24 }} />
              <div>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Deed of Purchase</Text>
                <br />
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                  Generated on {dayjs(selectedDeed.generatedAt).format('MMMM DD, YYYY')}
                </Text>
              </div>
            </Space>
            <Badge 
              status="processing" 
              text={<span style={{ color: 'white' }}>Active</span>}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ marginBottom: 24 }}>
          <Space wrap>
            <Button 
              type="primary" 
              icon={<DownloadOutlined />}
              onClick={() => handleDownloadDeed(selectedDeed)}
            >
              Download PDF
            </Button>
            <Button icon={<PrinterOutlined />}>
              Print
            </Button>
            <Button icon={<ShareAltOutlined />}>
              Share
            </Button>
          </Space>
        </div>

        {/* Deed Details */}
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card size="small" title="Customer Information" bordered={false} style={{ background: '#fafafa' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label={<Space><UserOutlined /> Full Name</Space>}>
                  <Text strong>{customerName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Space><PhoneOutlined /> Phone</Space>}>
                  <a href={`tel:${customerPhone}`}>{customerPhone}</a>
                </Descriptions.Item>
                <Descriptions.Item label={<Space><EnvironmentOutlined /> Address</Space>}>
                  {customerAddress}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="Property Details" bordered={false} style={{ background: '#fafafa' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label={<Space><HomeOutlined /> House Number</Space>}>
                  {property?.houseNumber || 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label={<Space><IdcardOutlined /> Offer Number</Space>}>
                  {property?.offerNumber || 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label={<Space><DollarOutlined /> Price</Space>}>
                  {property ? <MoneyText minor={property.priceMinor} /> : 'N/A'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="Witnesses" bordered={false} style={{ background: '#fafafa' }}>
              {selectedDeed.witnesses.map((w: any, idx: number) => (
                <div key={idx} style={{ 
                  padding: '8px 12px', 
                  marginBottom: 8, 
                  background: '#f0f0f0', 
                  borderRadius: 6 
                }}>
                  <Space>
                    <UserOutlined />
                    <Text strong>{w.name}</Text>
                    <Divider type="vertical" />
                    <PhoneOutlined />
                    <Text>{w.contact}</Text>
                  </Space>
                </div>
              ))}
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="Business Contacts" bordered={false} style={{ background: '#fafafa' }}>
              <Text>{selectedDeed.businessContacts}</Text>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="Generation Info" bordered={false} style={{ background: '#fafafa' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label={<Space><UserOutlined /> Generated By</Space>}>
                  User #{selectedDeed.generatedByUserId}
                </Descriptions.Item>
                <Descriptions.Item label={<Space><CalendarOutlined /> Generated At</Space>}>
                  {dayjs(selectedDeed.generatedAt).format('MMMM DD, YYYY HH:mm')}
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
          <Space>
            <Button 
              type="primary" 
              icon={<DownloadOutlined />}
              onClick={() => handleDownloadDeed(selectedDeed)}
            >
              Download
            </Button>
            <Button 
              onClick={() => navigate(`/customers/${selectedDeed.customerId}`)}
            >
              View Customer
            </Button>
          </Space>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden', padding: '0 4px' }}>
      <PageHeader
        title="Deeds of Purchase"
        actions={[
          {
            label: 'Generate Deed',
            onClick: () => setGenerateModal(true),
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

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card size="small">
            <Statistic
              title="Total Deeds"
              value={stats.total}
              prefix={<FileProtectOutlined />}
              valueStyle={{ color: tokens.primary }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card size="small">
            <Statistic
              title="Total Property Value"
              value={`GHS ${(stats.totalValue / 100).toLocaleString()}`}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card size="small">
            <Statistic
              title="Active Deeds"
              value={stats.total}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Input
              placeholder="Search by customer, property, or deed ID"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="middle"
            />
          </Col>
          <Col xs={24} md={8}>
            <Text type="secondary" style={{ display: 'block', textAlign: 'right' }}>
              Total: {filteredDeeds.length} deeds
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <Table
          columns={columns}
          dataSource={filteredDeeds}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: 1300 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} deeds`,
            responsive: true,
          }}
        />
      </div>

      {/* Generate Deed Modal */}
      <Modal
        title={
          <Space>
            <FileProtectOutlined style={{ color: tokens.primary }} />
            <Text strong>Generate Deed of Purchase</Text>
          </Space>
        }
        open={generateModal}
        onCancel={() => {
          setGenerateModal(false);
          form.resetFields();
          setWitnesses([{ name: '', contact: '' }, { name: '', contact: '' }]);
        }}
        footer={null}
        width={700}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px', maxHeight: '70vh', overflowY: 'auto' }}
      >
        <Alert
          message="Deed Generation"
          description="Fill in the details below to generate a deed of purchase. All fields marked with * are required."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleGenerateDeed}
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
            name="propertyId"
            label="Property"
            rules={[{ required: true, message: 'Please select a property' }]}
          >
            <Select placeholder="Select property" showSearch>
              {Object.entries(mockProperties).map(([id, prop]) => (
                <Option key={id} value={id}>
                  {prop.houseNumber} - {prop.offerNumber} (GHS {(prop.priceMinor / 100).toLocaleString()})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Divider>Witnesses (Minimum 2)</Divider>

          {witnesses.map((witness, index) => (
            <Row key={index} gutter={[8, 8]} style={{ marginBottom: 8 }}>
              <Col xs={24} sm={10}>
                <Form.Item
                  label={index === 0 ? 'Witness Name' : ''}
                  required={index < 2}
                  style={{ marginBottom: 0 }}
                >
                  <Input
                    placeholder="Full name"
                    value={witness.name}
                    onChange={(e) => updateWitness(index, 'name', e.target.value)}
                    prefix={<UserOutlined />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={10}>
                <Form.Item
                  label={index === 0 ? 'Contact' : ''}
                  required={index < 2}
                  style={{ marginBottom: 0 }}
                >
                  <Input
                    placeholder="Phone number"
                    value={witness.contact}
                    onChange={(e) => updateWitness(index, 'contact', e.target.value)}
                    prefix={<PhoneOutlined />}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={4}>
                <Form.Item label={index === 0 ? 'Action' : ''} style={{ marginBottom: 0 }}>
                  <Button 
                    type="text" 
                    danger 
                    icon={<DeleteOutlined />}
                    onClick={() => removeWitness(index)}
                    disabled={witnesses.length <= 2}
                  />
                </Form.Item>
              </Col>
            </Row>
          ))}

          <Button 
            type="dashed" 
            onClick={addWitness} 
            icon={<PlusOutlined />}
            block
            style={{ marginTop: 8, marginBottom: 16 }}
          >
            Add Witness
          </Button>

          <Form.Item
            name="businessContacts"
            label="Business Contacts"
            rules={[{ required: true, message: 'Business contacts are required' }]}
          >
            <TextArea 
              rows={3} 
              placeholder="Enter business contact information (e.g., Omark Real Estate Ltd. - Accra Office, Phone: +233 20 123 4567)"
            />
          </Form.Item>

          <Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit" loading={loading}>
                <FileProtectOutlined /> Generate Deed
              </Button>
              <Button onClick={() => {
                setGenerateModal(false);
                form.resetFields();
                setWitnesses([{ name: '', contact: '' }, { name: '', contact: '' }]);
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
            <Text strong>Export Deeds</Text>
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
          message={`${filteredDeeds.length} deeds will be exported`}
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
            <InfoCircleOutlined /> The export will include all filtered deeds with their details.
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