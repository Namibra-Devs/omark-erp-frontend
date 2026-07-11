// src/pages/dashboard/SecretaryDashboardPage.tsx
import React, { useState } from 'react';
import { Card, Row, Col, Typography, Statistic, Table, Tag, Progress, Empty, Spin, Alert, Button, Space, Modal, Form, Input, DatePicker, message, Select } from 'antd';
import {
  DollarOutlined,
  FileTextOutlined,
  TeamOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  ExportOutlined,
  PlusOutlined,
  PhoneOutlined,
  MailOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSecretaryDashboardQuery } from '@/api/dashboard';
import { useCustomersQuery, useCreateCustomerMutation, useUpdateCustomerMutation } from '@/api/customers';
import { usePaymentPlansQuery, useCreatePaymentPlanMutation } from '@/api/paymentPlans';
import { usePropertiesQuery } from '@/api/properties';
import { roleLabels, progressBandLabels } from '@/constants/enums';
import { tokens } from '@/constants/tokens';
import { MoneyText } from '@/components/shared/MoneyText';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export const SecretaryDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // ── API Queries ────────────────────────────────────────────────────────────
  const { 
    data: dashboardData, 
    isLoading: dashboardLoading, 
    isError: dashboardError, 
    error: dashboardErrorDetails,
    refetch: refetchDashboard
  } = useSecretaryDashboardQuery();

  const { 
    data: customersData, 
    isLoading: customersLoading,
    refetch: refetchCustomers
  } = useCustomersQuery({ limit: 100 });

  const { 
    data: paymentPlansData,
    isLoading: paymentPlansLoading,
    refetch: refetchPaymentPlans
  } = usePaymentPlansQuery({ limit: 100 });

  const { 
    data: propertiesData,
    isLoading: propertiesLoading
  } = usePropertiesQuery({ limit: 100 });

  // ── API Mutations ──────────────────────────────────────────────────────────
  const createCustomer = useCreateCustomerMutation();
  const updateCustomer = useUpdateCustomerMutation();
  const createPaymentPlan = useCreatePaymentPlanMutation();

  // ── UI State ──────────────────────────────────────────────────────────────
  const [addCustomerModal, setAddCustomerModal] = useState(false);
  const [addPaymentModal, setAddPaymentModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [form] = Form.useForm();
  const [paymentForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // ── Data Extraction ──────────────────────────────────────────────────────
  const customers = customersData || [];
  const paymentPlans = paymentPlansData?.items || [];
  const properties = propertiesData || [];

  // ── Dashboard Data ──────────────────────────────────────────────────────
  const dashboard = {
    totalCustomers: dashboardData?.totalCustomers ?? 0,
    activePlans: dashboardData?.activePlans ?? 0,
    totalDeeds: dashboardData?.totalDeeds ?? 0,
    monthlyRevenue: dashboardData?.monthlyRevenue ?? 0,
    byBand: {
      red: dashboardData?.byBand?.red ?? 0,
      yellow: dashboardData?.byBand?.yellow ?? 0,
      light_green: dashboardData?.byBand?.light_green ?? 0,
      green: dashboardData?.byBand?.green ?? 0,
    },
    defaulters: dashboardData?.defaulters ?? [],
    dueSoon: dashboardData?.dueSoon ?? [],
  };

  const bandConfig = [
    { band: 'red' as const, label: progressBandLabels.red, color: tokens.band.red, icon: <WarningOutlined /> },
    { band: 'yellow' as const, label: progressBandLabels.yellow, color: tokens.band.yellow, icon: <ClockCircleOutlined /> },
    { band: 'light_green' as const, label: progressBandLabels.light_green, color: tokens.band.light_green, icon: <CheckCircleOutlined /> },
    { band: 'green' as const, label: progressBandLabels.green, color: tokens.band.green, icon: <CheckCircleOutlined /> },
  ];

  const activePlansForProgress = Math.max(dashboard.activePlans, 1);

  // ── Table Columns ──────────────────────────────────────────────────────────
  const defaulterColumns = [
    {
      title: 'Customer Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
        <a onClick={() => navigate(`/customers/${record.customerId}`)}>
          <Space>
            <UserOutlined />
            {name}
          </Space>
        </a>
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string) => <a href={`tel:${phone}`}><PhoneOutlined /> {phone}</a>,
    },
    {
      title: 'Overdue Amount',
      dataIndex: 'overdueAmountMinor',
      key: 'overdueAmountMinor',
      render: (value: number) => <MoneyText minor={value} />,
    },
    {
      title: 'Days Overdue',
      dataIndex: 'daysOverdue',
      key: 'daysOverdue',
      render: (days: number) => (
        <Tag color={days > 7 ? 'red' : days > 3 ? 'orange' : 'yellow'}>{days} days</Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Button 
          type="link" 
          size="small"
          onClick={() => {
            setSelectedCustomer(record);
            setAddPaymentModal(true);
          }}
        >
          Record Payment
        </Button>
      ),
    },
  ];

  const dueSoonColumns = [
    {
      title: 'Customer Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
        <a onClick={() => navigate(`/customers/${record.customerId}`)}>
          <Space>
            <UserOutlined />
            {name}
          </Space>
        </a>
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string) => <a href={`tel:${phone}`}><PhoneOutlined /> {phone}</a>,
    },
    {
      title: 'Amount Due',
      dataIndex: 'amountMinor',
      key: 'amountMinor',
      render: (value: number) => <MoneyText minor={value} />,
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date: string) => {
        const daysUntil = Math.ceil(
          (new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        return (
          <Tag color={daysUntil <= 2 ? 'red' : daysUntil <= 5 ? 'orange' : 'blue'}>
            {daysUntil <= 0 ? 'Overdue' : `${daysUntil} days`}
          </Tag>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Button 
          type="link" 
          size="small"
          onClick={() => {
            setSelectedCustomer(record);
            setAddPaymentModal(true);
          }}
        >
          Record Payment
        </Button>
      ),
    },
  ];

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddCustomer = async (values: any) => {
    try {
      setLoading(true);
      await createCustomer.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        phoneNumber: values.phoneNumber,
        email: values.email,
        address: values.address,
        type: 'payment_plan',
        propertyId: values.propertyId,
        notes: values.notes,
      });
      message.success('Customer added successfully!');
      setAddCustomerModal(false);
      form.resetFields();
      refetchCustomers();
      refetchDashboard();
    } catch (error: any) {
      message.error(error?.message || 'Failed to add customer');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async (values: any) => {
    try {
      setLoading(true);
      // Find the payment plan for this customer
      const plan = paymentPlans.find((p: any) => p.customerId === selectedCustomer?.customerId);
      
      if (!plan) {
        message.error('No active payment plan found for this customer');
        return;
      }

      await createPaymentPlan.mutateAsync({
        customerId: selectedCustomer.customerId,
        propertyId: plan.propertyId || '',
        totalAmountMinor: plan.totalAmountMinor || 0,
        downPaymentMinor: plan.downPaymentMinor || 0,
        balanceMinor: plan.balanceMinor || 0,
        numMonths: plan.numMonths || 12,
        monthlyAmountMinor: plan.monthlyAmountMinor || 0,
        currency: 'GHS',
        startDate: plan.startDate || dayjs().format('YYYY-MM-DD'),
        status: 'active',
        progressPercent: plan.progressPercent || 0,
        progressBand: plan.progressBand || 'red',
      });
      
      message.success('Payment recorded successfully!');
      setAddPaymentModal(false);
      paymentForm.resetFields();
      refetchPaymentPlans();
      refetchDashboard();
    } catch (error: any) {
      message.error(error?.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    refetchDashboard();
    refetchCustomers();
    refetchPaymentPlans();
    message.success('Dashboard refreshed!');
  };

  // ── Loading State ──────────────────────────────────────────────────────────
  if (dashboardLoading || customersLoading || paymentPlansLoading || propertiesLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <Spin size="large" tip="Loading dashboard..." />
      </div>
    );
  }

  // ── Error State ────────────────────────────────────────────────────────────
  if (dashboardError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Failed to load dashboard"
        description={(dashboardErrorDetails as any)?.message || 'Please try again later.'}
        style={{ margin: 24 }}
        action={
          <Button size="small" type="primary" onClick={handleRefresh}>
            Retry
          </Button>
        }
      />
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2}>Secretary Dashboard</Title>
          <Text type="secondary">Welcome back, {user?.firstName}! Here's your overview</Text>
        </div>
        <Space>
          <Button 
            icon={<PlusOutlined />} 
            type="primary"
            onClick={() => setAddCustomerModal(true)}
          >
            Add Customer
          </Button>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* ── Stats Cards ────────────────────────────────────────────────────── */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Customers"
              value={dashboard.totalCustomers}
              prefix={<TeamOutlined />}
              valueStyle={{ color: tokens.primary }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Active Payment Plans"
              value={dashboard.activePlans}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Deeds"
              value={dashboard.totalDeeds}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Monthly Revenue"
              value={dashboard.monthlyRevenue / 100}
              prefix="GHS"
              precision={2}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Progress Band Summary ──────────────────────────────────────────── */}
      <Title level={4} style={{ marginBottom: 16 }}>
        Payment Plan Progress
      </Title>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {bandConfig.map(band => (
          <Col xs={24} sm={12} lg={6} key={band.band}>
            <Card
              style={{
                borderTop: `4px solid ${band.color}`,
                cursor: 'pointer',
              }}
              onClick={() => navigate(`/payment-plans?band=${band.band}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {band.icon}
                <Text type="secondary">{band.label}</Text>
              </div>
              <div style={{ fontSize: 32, fontWeight: 'bold', marginTop: 8, color: band.color }}>
                {dashboard.byBand[band.band]}
              </div>
              <Progress
                percent={Math.round((dashboard.byBand[band.band] / activePlansForProgress) * 100)}
                strokeColor={band.color}
                size="small"
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Two side-by-side tables ────────────────────────────────────────── */}
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                <WarningOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                Defaulters
                <Badge count={dashboard.defaulters.length} style={{ marginLeft: 8 }} />
              </span>
            }
            extra={
              dashboard.defaulters.length > 0 && (
                <Button 
                  size="small" 
                  onClick={() => navigate('/customers?status=defaulted')}
                >
                  View All
                </Button>
              )
            }
          >
            {dashboard.defaulters.length > 0 ? (
              <Table
                columns={defaulterColumns}
                dataSource={dashboard.defaulters}
                rowKey="customerId"
                pagination={{ pageSize: 5 }}
                size="small"
              />
            ) : (
              <Empty
                description={
                  <span style={{ color: '#52c41a' }}>
                    <CheckCircleOutlined /> No defaulters — all payments on track
                  </span>
                }
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                <ClockCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
                Due Soon
                <Badge count={dashboard.dueSoon.length} style={{ marginLeft: 8 }} />
              </span>
            }
            extra={
              dashboard.dueSoon.length > 0 && (
                <Button 
                  size="small" 
                  onClick={() => navigate('/payment-plans?status=active')}
                >
                  View All
                </Button>
              )
            }
          >
            {dashboard.dueSoon.length > 0 ? (
              <Table
                columns={dueSoonColumns}
                dataSource={dashboard.dueSoon}
                rowKey="customerId"
                pagination={{ pageSize: 5 }}
                size="small"
              />
            ) : (
              <Empty description="No payments due soon" />
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Add Customer Modal ────────────────────────────────────────────── */}
      <Modal
        title="Add New Customer"
        open={addCustomerModal}
        onCancel={() => {
          setAddCustomerModal(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
        style={{ top: 20 }}
      >
        <Form form={form} layout="vertical" onFinish={handleAddCustomer}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="firstName"
                label="First Name"
                rules={[{ required: true, message: 'First name is required' }]}
              >
                <Input placeholder="First name" />
              </Form.Item>
            </Col>
            <Col span={12}>
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
            name="phoneNumber"
            label="Phone Number"
            rules={[{ required: true, message: 'Phone number is required' }]}
          >
            <PhoneInput />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[{ type: 'email', message: 'Please enter a valid email' }]}
          >
            <Input placeholder="Email address" />
          </Form.Item>

          <Form.Item
            name="address"
            label="Address"
            rules={[{ required: true, message: 'Address is required' }]}
          >
            <Input placeholder="Full address" />
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

          <Form.Item
            name="notes"
            label="Notes"
          >
            <TextArea rows={2} placeholder="Additional notes" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                Add Customer
              </Button>
              <Button onClick={() => {
                setAddCustomerModal(false);
                form.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Record Payment Modal ───────────────────────────────────────────── */}
      <Modal
        title="Record Payment"
        open={addPaymentModal}
        onCancel={() => {
          setAddPaymentModal(false);
          paymentForm.resetFields();
          setSelectedCustomer(null);
        }}
        footer={null}
        width={500}
        style={{ top: 20 }}
      >
        {selectedCustomer && (
          <Alert
            message={`Recording payment for ${selectedCustomer.name}`}
            description={`Customer ID: ${selectedCustomer.customerId}`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Form form={paymentForm} layout="vertical" onFinish={handleRecordPayment}>
          <Form.Item
            name="amount"
            label="Amount (GHS)"
            rules={[{ required: true, message: 'Please enter amount' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              prefix="GHS"
              precision={2}
              min={0.01}
              placeholder="Enter amount"
            />
          </Form.Item>

          <Form.Item
            name="paymentDate"
            label="Payment Date"
            rules={[{ required: true, message: 'Please select payment date' }]}
            initialValue={dayjs()}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item
            name="method"
            label="Payment Method"
            rules={[{ required: true, message: 'Please select payment method' }]}
          >
            <Select placeholder="Select method">
              <Option value="cash">Cash</Option>
              <Option value="bank_transfer">Bank Transfer</Option>
              <Option value="mobile_money">Mobile Money</Option>
              <Option value="cheque">Cheque</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="reference"
            label="Reference (Optional)"
          >
            <Input placeholder="Reference number" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                Record Payment
              </Button>
              <Button onClick={() => {
                setAddPaymentModal(false);
                paymentForm.resetFields();
                setSelectedCustomer(null);
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};