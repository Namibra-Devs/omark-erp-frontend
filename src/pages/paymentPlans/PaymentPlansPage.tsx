// src/pages/paymentPlans/PaymentPlansPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Space, Modal, Form, Input, Select, Row, Col, Table,
  Tag, message, Typography, Card, Avatar, Badge, Tooltip,
  DatePicker, Statistic, Divider, Empty, Dropdown, Popconfirm,
  Alert, Drawer, Descriptions, Timeline, Tabs, Progress,
  Radio, Switch, InputNumber, Upload, List, Collapse, Spin
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
  BarChartOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusTag } from '@/components/shared/StatusTag';
import { MoneyText } from '@/components/shared/MoneyText';
import { ProgressCell } from '@/components/shared/ProgressCell';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { tokens } from '@/constants/tokens';
import { paymentPlanStatusLabels, progressBandLabels } from '@/constants/enums';
import {
  usePaymentPlansQuery,
  useCreatePaymentPlanMutation,
  useUpdatePaymentPlanMutation,
  useDeletePaymentPlanMutation,
  getProgressBand,
  type PaymentPlan,
  type ProgressBand,
  type CreatePaymentPlanPayload,
  type UpdatePaymentPlanPayload
} from '@/api/paymentPlans';
import { useCustomersQuery } from '@/api/customers';
import { usePropertiesQuery } from '@/api/properties';
import type { Customer } from '@/types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import advancedFormat from 'dayjs/plugin/advancedFormat';

dayjs.extend(relativeTime);
dayjs.extend(advancedFormat);

const { Option } = Select;
const { TextArea } = Input;
const { Text, Title } = Typography;

export const PaymentPlansPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // States
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bandFilter, setBandFilter] = useState<string>('all');
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlan | null>(null);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [form] = Form.useForm();
  const [addForm] = Form.useForm();

  // Export states
  const [exportModal, setExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv' | 'pdf' | 'json'>('excel');
  const [exportLoading, setExportLoading] = useState(false);

  // ── API Queries ────────────────────────────────────────────────────────────
  const { 
    data: paymentPlansData, 
    isLoading: paymentPlansLoading,
    error: paymentPlansError,
    refetch: refetchPaymentPlans
  } = usePaymentPlansQuery({
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const { data: customersData, isLoading: customersLoading } = useCustomersQuery({ limit: 100 });
  const { data: propertiesData, isLoading: propertiesLoading } = usePropertiesQuery({ limit: 100 });

  // ── API Mutations ──────────────────────────────────────────────────────────
  const createPaymentPlan = useCreatePaymentPlanMutation();
  const updatePaymentPlan = useUpdatePaymentPlanMutation();
  const deletePaymentPlan = useDeletePaymentPlanMutation();

  // ── Data Mapping ──────────────────────────────────────────────────────────
  // hooks return data directly (already unwrapped by the query functions)
  const paymentPlans: PaymentPlan[] = paymentPlansData?.items ?? [];
  const customers: Customer[] = Array.isArray(customersData) ? customersData : [];
  const properties = propertiesData?.items ?? [];

  // Create maps for quick lookups
  const customerMap = React.useMemo(() => {
    return customers.reduce((acc, customer) => {
      acc[customer.id] = customer;
      return acc;
    }, {} as Record<string, Customer>);
  }, [customers]);

  const propertyMap = React.useMemo(() => {
    return properties.reduce((acc, prop) => {
      acc[prop.id] = prop;
      return acc;
    }, {} as Record<string, any>);
  }, [properties]);

  // ── Helper Functions ──────────────────────────────────────────────────────
  const getCustomerName = (customerId: string) => {
    return customerMap[customerId] ? 
      `${customerMap[customerId].firstName} ${customerMap[customerId].lastName}` : 
      'Unknown Customer';
  };

  const getCustomerPhone = (customerId: string) => {
    return customerMap[customerId]?.phoneNumber || '';
  };

  const getCustomerProperty = (customerId: string) => {
    const customer = customerMap[customerId];
    if (!customer) return 'N/A';
    const property = propertyMap[customer.propertyId];
    return property ? property.houseNumber : 'N/A';
  };

  const getPropertyDetails = (propertyId: string) => {
    return propertyMap[propertyId] || null;
  };

  // ── Filter Payment Plans ──────────────────────────────────────────────────
  const filteredPlans = paymentPlans.filter(plan => {
    const customerName = getCustomerName(plan.customerId).toLowerCase();
    const property = getCustomerProperty(plan.customerId).toLowerCase();
    const matchesSearch = customerName.includes(searchText.toLowerCase()) ||
                          plan.id.toLowerCase().includes(searchText.toLowerCase()) ||
                          property.includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === 'all' || plan.status === statusFilter;
    const matchesBand = bandFilter === 'all' || plan.progressBand === bandFilter;
    return matchesSearch && matchesStatus && matchesBand;
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total: paymentPlans.length,
    active: paymentPlans.filter(p => p.status === 'active').length,
    completed: paymentPlans.filter(p => p.status === 'completed').length,
    defaulted: paymentPlans.filter(p => p.status === 'defaulted').length,
    cancelled: paymentPlans.filter(p => p.status === 'cancelled').length,
    totalValue: paymentPlans.reduce((sum, p) => sum + p.totalAmountMinor, 0),
    totalBalance: paymentPlans.reduce((sum, p) => sum + p.balanceMinor, 0),
  };

  const bandBreakdown = {
    red: paymentPlans.filter(p => p.progressBand === 'red').length,
    yellow: paymentPlans.filter(p => p.progressBand === 'yellow').length,
    light_green: paymentPlans.filter(p => p.progressBand === 'light_green').length,
    green: paymentPlans.filter(p => p.progressBand === 'green').length,
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddPlan = async (values: any) => {
    try {
      const totalAmountMinor = Math.round((values.totalAmount || 0) * 100);
      const downPaymentMinor = Math.round((values.downPayment || 0) * 100);
      const balanceMinor = totalAmountMinor - downPaymentMinor;
      const numMonths = values.numMonths || 0;
      const monthlyAmountMinor = numMonths > 0 ? Math.ceil(balanceMinor / numMonths) : 0;
      const progressPercent = totalAmountMinor > 0 ? Math.round((downPaymentMinor / totalAmountMinor) * 100) : 0;
      const progressBand = getProgressBand(progressPercent);

      const payload: CreatePaymentPlanPayload = {
        customerId: values.customerId,
        propertyId: values.propertyId,
        totalAmountMinor,
        downPaymentMinor,
        balanceMinor,
        numMonths,
        monthlyAmountMinor,
        currency: 'GHS',
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        status: values.status || 'active',
        progressPercent,
        progressBand,
      };

      await createPaymentPlan.mutateAsync(payload);
      message.success('Payment plan created successfully!');
      setAddModal(false);
      addForm.resetFields();
      refetchPaymentPlans();
    } catch (error: any) {
      message.error(error?.message || 'Failed to create payment plan');
    }
  };

  const handleEditPlan = async (values: any) => {
    if (!selectedPlan) return;

    try {
      const totalAmountMinor = Math.round((values.totalAmount || 0) * 100);
      const downPaymentMinor = Math.round((values.downPayment || 0) * 100);
      const balanceMinor = totalAmountMinor - downPaymentMinor;
      const numMonths = values.numMonths || 0;
      const monthlyAmountMinor = numMonths > 0 ? Math.ceil(balanceMinor / numMonths) : 0;
      const progressPercent = totalAmountMinor > 0 ? Math.round((downPaymentMinor / totalAmountMinor) * 100) : 0;
      const progressBand = getProgressBand(progressPercent);

      const payload: UpdatePaymentPlanPayload = {
        totalAmountMinor,
        downPaymentMinor,
        balanceMinor,
        numMonths,
        monthlyAmountMinor,
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : selectedPlan.startDate,
        status: values.status || selectedPlan.status,
        progressPercent,
        progressBand,
      };

      await updatePaymentPlan.mutateAsync({
        id: selectedPlan.id,
        data: payload,
      });

      message.success('Payment plan updated successfully!');
      setEditModal(false);
      setSelectedPlan(null);
      form.resetFields();
      refetchPaymentPlans();
    } catch (error: any) {
      message.error(error?.message || 'Failed to update payment plan');
    }
  };

  const handleDeletePlan = async (id: string) => {
    try {
      await deletePaymentPlan.mutateAsync(id);
      message.success('Payment plan deleted successfully!');
      refetchPaymentPlans();
    } catch (error: any) {
      message.error(error?.message || 'Failed to delete payment plan');
    }
  };

  // ── Export function ──────────────────────────────────────────────────────
  const handleExport = () => {
    setExportLoading(true);
    const dataToExport = filteredPlans.map(plan => ({
      'Customer': getCustomerName(plan.customerId),
      'Property': getCustomerProperty(plan.customerId),
      'Total Amount': `GHS ${(plan.totalAmountMinor / 100).toLocaleString()}`,
      'Down Payment': `GHS ${(plan.downPaymentMinor / 100).toLocaleString()}`,
      'Balance': `GHS ${(plan.balanceMinor / 100).toLocaleString()}`,
      'Monthly Amount': `GHS ${(plan.monthlyAmountMinor / 100).toLocaleString()}`,
      'Months': plan.numMonths,
      'Progress': `${plan.progressPercent}%`,
      'Status': paymentPlanStatusLabels[plan.status] || plan.status,
      'Start Date': plan.startDate,
      'Created': dayjs(plan.createdAt).format('YYYY-MM-DD'),
    }));

    let fileName = `payment-plans-${dayjs().format('YYYY-MM-DD-HHmmss')}`;
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
      message.success(`Exported ${dataToExport.length} payment plans as ${exportFormat.toUpperCase()}!`);
    }, 1000);
  };

  // ── Table Columns ─────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Customer',
      key: 'customer',
      width: 200,
      render: (_: any, record: PaymentPlan) => (
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
      width: 120,
      render: (_: any, record: PaymentPlan) => (
        <div>
          <Text strong>{getCustomerProperty(record.customerId)}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>ID: {record.id.slice(0, 8)}</Text>
        </div>
      ),
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmountMinor',
      key: 'totalAmountMinor',
      width: 140,
      render: (value: number) => <MoneyText minor={value} />,
      sorter: (a: PaymentPlan, b: PaymentPlan) => a.totalAmountMinor - b.totalAmountMinor,
    },
    {
      title: 'Monthly Amount',
      dataIndex: 'monthlyAmountMinor',
      key: 'monthlyAmountMinor',
      width: 140,
      render: (value: number) => <MoneyText minor={value} />,
      sorter: (a: PaymentPlan, b: PaymentPlan) => a.monthlyAmountMinor - b.monthlyAmountMinor,
    },
    {
      title: 'Balance',
      dataIndex: 'balanceMinor',
      key: 'balanceMinor',
      width: 140,
      render: (value: number, record: PaymentPlan) => {
        if (record.status === 'completed' || value === 0) {
          return <Tag color="green">GHS 0.00</Tag>;
        }
        return <MoneyText minor={value} />;
      },
      sorter: (a: PaymentPlan, b: PaymentPlan) => a.balanceMinor - b.balanceMinor,
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 180,
      render: (_: any, record: PaymentPlan) => (
        <ProgressCell 
          percent={record.progressPercent} 
          band={record.progressBand} 
        />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: string) => <StatusTag status={status} type="paymentPlan" />,
      filters: [
        { text: 'Active', value: 'active' },
        { text: 'Completed', value: 'completed' },
        { text: 'Defaulted', value: 'defaulted' },
        { text: 'Cancelled', value: 'cancelled' },
      ],
      onFilter: (value: any, record: PaymentPlan) => record.status === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      fixed: 'right' as const,
      render: (_: any, record: PaymentPlan) => (
        <Space>
          <Tooltip title="View Details">
            <Button 
              type="primary"
              ghost
              icon={<EyeOutlined />} 
              onClick={() => {
                setSelectedPlan(record);
                setViewDrawerOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button 
              icon={<EditOutlined />} 
              onClick={() => {
                setSelectedPlan(record);
                setEditModal(true);
                form.setFieldsValue({
                  totalAmount: record.totalAmountMinor / 100,
                  downPayment: record.downPaymentMinor / 100,
                  numMonths: record.numMonths,
                  monthlyAmount: record.monthlyAmountMinor / 100,
                  startDate: dayjs(record.startDate),
                  status: record.status,
                });
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Payment Plan"
            description={`Are you sure you want to delete this payment plan?`}
            onConfirm={() => handleDeletePlan(record.id)}
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
  if (paymentPlansLoading || customersLoading || propertiesLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Spin size="large" tip="Loading payment plans..." />
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (paymentPlansError) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="Error Loading Payment Plans"
          description="There was an error loading the payment plans. Please try again."
          type="error"
          showIcon
          action={
            <Button size="small" type="primary" onClick={() => refetchPaymentPlans()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  // ── Render Drawer Content ─────────────────────────────────────────────────
  const renderDrawerContent = () => {
    if (!selectedPlan) return null;

    const customerName = getCustomerName(selectedPlan.customerId);
    const customerPhone = getCustomerPhone(selectedPlan.customerId);
    const property = getCustomerProperty(selectedPlan.customerId);
    const isFullyPaid = selectedPlan.balanceMinor === 0;

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
                Payment Plan - {customerName}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <IdcardOutlined /> ID: {selectedPlan.id}
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
          background: selectedPlan.status === 'active' ? '#e6f7ff' : 
                     selectedPlan.status === 'completed' ? '#f6ffed' :
                     selectedPlan.status === 'defaulted' ? '#fff2e8' : '#fafafa',
          border: `1px solid ${selectedPlan.status === 'active' ? '#91d5ff' : 
                               selectedPlan.status === 'completed' ? '#b7eb8f' :
                               selectedPlan.status === 'defaulted' ? '#ffccc7' : '#d9d9d9'}`,
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Space>
            {selectedPlan.status === 'active' && <ClockCircleOutlined style={{ color: '#1890ff' }} />}
            {selectedPlan.status === 'completed' && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
            {selectedPlan.status === 'defaulted' && <WarningOutlined style={{ color: '#ff4d4f' }} />}
            {selectedPlan.status === 'cancelled' && <CloseCircleOutlined style={{ color: '#d9d9d9' }} />}
            <Text strong>Status: {paymentPlanStatusLabels[selectedPlan.status] || selectedPlan.status}</Text>
          </Space>
          <Badge 
            status={selectedPlan.status === 'active' ? 'processing' : 
                   selectedPlan.status === 'completed' ? 'success' :
                   selectedPlan.status === 'defaulted' ? 'error' : 'default'} 
            text={selectedPlan.status === 'active' ? 'Active' : 
                  selectedPlan.status === 'completed' ? 'Completed' :
                  selectedPlan.status === 'defaulted' ? 'Defaulted' : 'Cancelled'}
          />
        </div>

        {/* Quick Actions */}
        <div style={{ marginBottom: 24 }}>
          <Space wrap>
            <Button 
              type="primary" 
              icon={<EditOutlined />}
              onClick={() => {
                setEditModal(true);
                form.setFieldsValue({
                  totalAmount: selectedPlan.totalAmountMinor / 100,
                  downPayment: selectedPlan.downPaymentMinor / 100,
                  numMonths: selectedPlan.numMonths,
                  monthlyAmount: selectedPlan.monthlyAmountMinor / 100,
                  startDate: dayjs(selectedPlan.startDate),
                  status: selectedPlan.status,
                });
                setViewDrawerOpen(false);
              }}
            >
              Edit Plan
            </Button>
            <Button icon={<FileOutlined />}>
              Generate PDF
            </Button>
            <Button icon={<PrinterOutlined />}>
              Print
            </Button>
          </Space>
        </div>

        {/* Plan Details */}
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card size="small" title="Plan Information" bordered={false} style={{ background: '#fafafa' }}>
              <div style={{ marginBottom: 16 }}>
                <ProgressCell percent={selectedPlan.progressPercent} band={selectedPlan.progressBand} />
              </div>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Customer">
                  <Text strong>{customerName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Property">
                  {property}
                </Descriptions.Item>
                <Descriptions.Item label="Total Amount">
                  <MoneyText minor={selectedPlan.totalAmountMinor} />
                </Descriptions.Item>
                <Descriptions.Item label="Down Payment">
                  <MoneyText minor={selectedPlan.downPaymentMinor} />
                </Descriptions.Item>
                <Descriptions.Item label="Balance">
                  {isFullyPaid ? (
                    <Tag color="green">Fully Paid</Tag>
                  ) : (
                    <MoneyText minor={selectedPlan.balanceMinor} />
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Monthly Amount">
                  <MoneyText minor={selectedPlan.monthlyAmountMinor} />
                </Descriptions.Item>
                <Descriptions.Item label="Duration">
                  {selectedPlan.numMonths} months
                </Descriptions.Item>
                <Descriptions.Item label="Start Date">
                  {dayjs(selectedPlan.startDate).format('MMMM DD, YYYY')}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {/* Timeline */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="Activity Timeline" bordered={false} style={{ background: '#fafafa' }}>
              <Timeline>
                <Timeline.Item color="blue">
                  <Text>Payment plan created</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(selectedPlan.createdAt).format('MMMM DD, YYYY HH:mm')}
                  </Text>
                </Timeline.Item>
                <Timeline.Item color={selectedPlan.status === 'active' ? 'green' : 'red'}>
                  <Text>Status: {paymentPlanStatusLabels[selectedPlan.status] || selectedPlan.status}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {selectedPlan.progressPercent}% complete
                  </Text>
                </Timeline.Item>
                <Timeline.Item color="gray">
                  <Text>Last updated {dayjs(selectedPlan.updatedAt).fromNow()}</Text>
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
          <Button 
            type="primary" 
            onClick={() => navigate(`/customers/${selectedPlan.customerId}`)}
          >
            View Customer
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden', padding: '0 4px' }}>
      <PageHeader
        title="Payment Plans"
        actions={[
          {
            label: 'Add Payment Plan',
            onClick: () => setAddModal(true),
            icon: <PlusOutlined />,
          },
          {
            label: 'Export',
            onClick: () => setExportModal(true),
            icon: <ExportOutlined />,
          },
          {
            label: 'Refresh',
            onClick: () => refetchPaymentPlans(),
            icon: <ReloadOutlined />,
          },
        ]}
      />

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Total Plans"
              value={stats.total}
              prefix={<BankOutlined />}
              valueStyle={{ color: tokens.primary }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Active"
              value={stats.active}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Completed"
              value={stats.completed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Defaulted"
              value={stats.defaulted}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Total Value"
              value={`GHS ${(stats.totalValue / 100).toLocaleString()}`}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Total Balance"
              value={`GHS ${(stats.totalBalance / 100).toLocaleString()}`}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Band Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card 
            size="small" 
            style={{ borderLeft: `4px solid ${tokens.band.red}` }}
            onClick={() => setBandFilter('red')}
            className="cursor-pointer"
          >
            <Statistic
              title={<span style={{ color: tokens.band.red }}>🔴 Red</span>}
              value={bandBreakdown.red}
              valueStyle={{ color: tokens.band.red }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>Starting Out</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card 
            size="small" 
            style={{ borderLeft: `4px solid ${tokens.band.yellow}` }}
            onClick={() => setBandFilter('yellow')}
            className="cursor-pointer"
          >
            <Statistic
              title={<span style={{ color: tokens.band.yellow }}>🟡 Yellow</span>}
              value={bandBreakdown.yellow}
              valueStyle={{ color: tokens.band.yellow }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>Making Progress</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card 
            size="small" 
            style={{ borderLeft: `4px solid ${tokens.band.light_green}` }}
            onClick={() => setBandFilter('light_green')}
            className="cursor-pointer"
          >
            <Statistic
              title={<span style={{ color: tokens.band.light_green }}>🟢 Light Green</span>}
              value={bandBreakdown.light_green}
              valueStyle={{ color: tokens.band.light_green }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>Nearly There</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card 
            size="small" 
            style={{ borderLeft: `4px solid ${tokens.band.green}` }}
            onClick={() => setBandFilter('green')}
            className="cursor-pointer"
          >
            <Statistic
              title={<span style={{ color: tokens.band.green }}>✅ Green</span>}
              value={bandBreakdown.green}
              valueStyle={{ color: tokens.band.green }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>Almost/Fully Complete</Text>
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Input
              placeholder="Search by customer or property"
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
              placeholder="Filter by status"
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
              size="middle"
            >
              <Option value="all">All Statuses</Option>
              <Option value="active">Active</Option>
              <Option value="completed">Completed</Option>
              <Option value="defaulted">Defaulted</Option>
              <Option value="cancelled">Cancelled</Option>
            </Select>
          </Col>
          <Col xs={12} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="Filter by band"
              value={bandFilter}
              onChange={setBandFilter}
              allowClear
              size="middle"
            >
              <Option value="all">All Bands</Option>
              <Option value="red">🔴 Red</Option>
              <Option value="yellow">🟡 Yellow</Option>
              <Option value="light_green">🟢 Light Green</Option>
              <Option value="green">✅ Green</Option>
            </Select>
          </Col>
          <Col xs={24} md={8}>
            <Text type="secondary" style={{ display: 'block', textAlign: 'right' }}>
              Total: {filteredPlans.length} payment plans
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <Table
          columns={columns}
          dataSource={filteredPlans}
          rowKey="id"
          loading={paymentPlansLoading}
          size="middle"
          scroll={{ x: 1400 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} payment plans`,
            responsive: true,
          }}
        />
      </div>

      {/* Add Payment Plan Modal */}
      <Modal
        title={
          <Space>
            <PlusOutlined style={{ color: tokens.primary }} />
            <Text strong>Add Payment Plan</Text>
          </Space>
        }
        open={addModal}
        onCancel={() => {
          setAddModal(false);
          addForm.resetFields();
        }}
        footer={null}
        width={600}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px', maxHeight: '70vh', overflowY: 'auto' }}
      >
        <Form
          form={addForm}
          layout="vertical"
          onFinish={handleAddPlan}
          initialValues={{ status: 'active' }}
        >
          <Form.Item
            name="customerId"
            label="Customer"
            rules={[{ required: true, message: 'Please select a customer' }]}
          >
            <Select placeholder="Select customer" showSearch>
              {customers.map(customer => (
                <Option key={customer.id} value={customer.id}>
                  {customer.firstName} {customer.lastName} - {getCustomerProperty(customer.id)}
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
              {properties.map((prop: any) => (
                <Option key={prop.id} value={prop.id}>
                  {prop.houseNumber} - {prop.offerNumber} (GHS {(prop.priceMinor / 100).toLocaleString()})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={[8, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="totalAmount"
                label="Total Amount (GHS)"
                rules={[{ required: true, message: 'Total amount is required' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  prefix="GHS"
                  precision={2}
                  placeholder="e.g., 150000"
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="downPayment"
                label="Down Payment (GHS)"
                rules={[{ required: true, message: 'Down payment is required' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  prefix="GHS"
                  precision={2}
                  placeholder="e.g., 30000"
                  min={0}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="numMonths"
            label="Number of Months"
            rules={[{ required: true, message: 'Number of months is required' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              max={360}
              placeholder="e.g., 12"
            />
          </Form.Item>

          <Form.Item
            name="startDate"
            label="Start Date"
            rules={[{ required: true, message: 'Start date is required' }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Status is required' }]}
          >
            <Select>
              <Option value="active">Active</Option>
              <Option value="completed">Completed</Option>
              <Option value="defaulted">Defaulted</Option>
              <Option value="cancelled">Cancelled</Option>
            </Select>
          </Form.Item>

          {/* Live Preview */}
          <Form.Item noStyle shouldUpdate={(prev, curr) => 
            prev.totalAmount !== curr.totalAmount || 
            prev.downPayment !== curr.downPayment ||
            prev.numMonths !== curr.numMonths
          }>
            {({ getFieldValue }) => {
              const totalAmount = getFieldValue('totalAmount') || 0;
              const downPayment = getFieldValue('downPayment') || 0;
              const numMonths = getFieldValue('numMonths') || 1;
              const totalMinor = Math.round(totalAmount * 100);
              const downMinor = Math.round(downPayment * 100);
              const balanceMinor = totalMinor - downMinor;
              const monthlyMinor = numMonths > 0 ? Math.ceil(balanceMinor / numMonths) : 0;
              const progressPercent = totalMinor > 0 ? Math.round((downMinor / totalMinor) * 100) : 0;
              const band = getProgressBand(progressPercent);

              return (
                <div style={{ 
                  background: '#f5f7fa', 
                  padding: 16, 
                  borderRadius: 8,
                  marginTop: 8,
                  border: '1px solid #e8e8e8'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text strong>Payment Plan Preview</Text>
                    <Tag color="blue">Auto-calculated</Tag>
                  </div>
                  <Row gutter={[8, 8]}>
                    <Col span={12}>
                      <Text type="secondary">Balance</Text>
                      <div><MoneyText minor={balanceMinor} /></div>
                    </Col>
                    <Col span={12}>
                      <Text type="secondary">Monthly Amount</Text>
                      <div><MoneyText minor={monthlyMinor} /></div>
                    </Col>
                    <Col span={12}>
                      <Text type="secondary">Progress</Text>
                      <div>
                        <Progress 
                          percent={progressPercent} 
                          strokeColor={tokens.band[band]}
                          size="small"
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {progressPercent}% - {band.toUpperCase()}
                        </Text>
                      </div>
                    </Col>
                  </Row>
                </div>
              );
            }}
          </Form.Item>

          <Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit" loading={createPaymentPlan.isPending}>
                Create Payment Plan
              </Button>
              <Button onClick={() => {
                setAddModal(false);
                addForm.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Payment Plan Modal */}
      <Modal
        title={
          <Space>
            <EditOutlined style={{ color: tokens.primary }} />
            <Text strong>Edit Payment Plan</Text>
          </Space>
        }
        open={editModal}
        onCancel={() => {
          setEditModal(false);
          setSelectedPlan(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px', maxHeight: '70vh', overflowY: 'auto' }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleEditPlan}
        >
          <Row gutter={[8, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="totalAmount"
                label="Total Amount (GHS)"
                rules={[{ required: true, message: 'Total amount is required' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  prefix="GHS"
                  precision={2}
                  placeholder="e.g., 150000"
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="downPayment"
                label="Down Payment (GHS)"
                rules={[{ required: true, message: 'Down payment is required' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  prefix="GHS"
                  precision={2}
                  placeholder="e.g., 30000"
                  min={0}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="numMonths"
            label="Number of Months"
            rules={[{ required: true, message: 'Number of months is required' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              max={360}
              placeholder="e.g., 12"
            />
          </Form.Item>

          <Form.Item
            name="startDate"
            label="Start Date"
            rules={[{ required: true, message: 'Start date is required' }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Status is required' }]}
          >
            <Select>
              <Option value="active">Active</Option>
              <Option value="completed">Completed</Option>
              <Option value="defaulted">Defaulted</Option>
              <Option value="cancelled">Cancelled</Option>
            </Select>
          </Form.Item>

          {/* Live Preview */}
          <Form.Item noStyle shouldUpdate={(prev, curr) => 
            prev.totalAmount !== curr.totalAmount || 
            prev.downPayment !== curr.downPayment ||
            prev.numMonths !== curr.numMonths
          }>
            {({ getFieldValue }) => {
              const totalAmount = getFieldValue('totalAmount') || 0;
              const downPayment = getFieldValue('downPayment') || 0;
              const numMonths = getFieldValue('numMonths') || 1;
              const totalMinor = Math.round(totalAmount * 100);
              const downMinor = Math.round(downPayment * 100);
              const balanceMinor = totalMinor - downMinor;
              const monthlyMinor = numMonths > 0 ? Math.ceil(balanceMinor / numMonths) : 0;
              const progressPercent = totalMinor > 0 ? Math.round((downMinor / totalMinor) * 100) : 0;
              const band = getProgressBand(progressPercent);

              return (
                <div style={{ 
                  background: '#f5f7fa', 
                  padding: 16, 
                  borderRadius: 8,
                  marginTop: 8,
                  border: '1px solid #e8e8e8'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text strong>Payment Plan Preview</Text>
                    <Tag color="blue">Auto-calculated</Tag>
                  </div>
                  <Row gutter={[8, 8]}>
                    <Col span={12}>
                      <Text type="secondary">Balance</Text>
                      <div><MoneyText minor={balanceMinor} /></div>
                    </Col>
                    <Col span={12}>
                      <Text type="secondary">Monthly Amount</Text>
                      <div><MoneyText minor={monthlyMinor} /></div>
                    </Col>
                    <Col span={12}>
                      <Text type="secondary">Progress</Text>
                      <div>
                        <Progress 
                          percent={progressPercent} 
                          strokeColor={tokens.band[band]}
                          size="small"
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {progressPercent}% - {band.toUpperCase()}
                        </Text>
                      </div>
                    </Col>
                  </Row>
                </div>
              );
            }}
          </Form.Item>

          <Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit" loading={updatePaymentPlan.isPending}>
                Update Payment Plan
              </Button>
              <Button onClick={() => {
                setEditModal(false);
                setSelectedPlan(null);
                form.resetFields();
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
            <Text strong>Export Payment Plans</Text>
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
          message={`${filteredPlans.length} payment plans will be exported`}
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
            <InfoCircleOutlined /> The export will include all filtered payment plans with their details.
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