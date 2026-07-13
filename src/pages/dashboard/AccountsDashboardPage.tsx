// src/pages/dashboard/AccountsDashboardPage.tsx
//
// Distinct from SecretaryDashboardPage — same underlying customer/payment
// data where it's genuinely shared, but framed around collections and
// revenue rather than customer service, and adds the real Analytics view
// (GET /dashboard/analytics), which this role has access to and Secretary
// does not. A couple of sections below are explicitly-labeled placeholders
// for finance features (expense tracking, reconciliation) that don't have
// a backend endpoint yet — real endpoints are expected soon per the business.
import React, { useState } from 'react';
import {
  Card, Row, Col, Typography, Statistic, Table, Tag, Progress, Empty, Spin, Alert,
  Button, Space, Modal, Form, InputNumber, DatePicker, Select, Input, message, Badge, List, Tooltip,
} from 'antd';
import {
  DollarOutlined,
  TeamOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  PhoneOutlined,
  UserOutlined,
  RiseOutlined,
  ExperimentOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSecretaryDashboardQuery, useAnalyticsDashboardQuery } from '@/api/dashboard';
import { usePaymentPlansQuery } from '@/api/paymentPlans';
import { useRecordPaymentMutation } from '@/api/payments';
import { progressBandLabels } from '@/constants/enums';
import { tokens } from '@/constants/tokens';
import { MoneyText } from '@/components/shared/MoneyText';
import { AnalyticsSection } from './admin/components/AnalyticsSection';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export const AccountsDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── API Queries ──────────────────────────────────────────────────────────
  // Shared with Secretary — real, live data (progress bands, defaulters, due
  // soon). GET /dashboard/analytics below is the part Secretary doesn't get.
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    isError: dashboardError,
    error: dashboardErrorDetails,
    refetch: refetchDashboard,
  } = useSecretaryDashboardQuery();

  const {
    data: paymentPlansData,
    isLoading: paymentPlansLoading,
    refetch: refetchPaymentPlans,
  } = usePaymentPlansQuery({ pageSize: 100 });

  const { data: analyticsData, isLoading: analyticsLoading } = useAnalyticsDashboardQuery();

  // ── UI State ─────────────────────────────────────────────────────────────
  const [addPaymentModal, setAddPaymentModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [paymentForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const paymentPlans = paymentPlansData?.items ?? [];
  const selectedPlan = paymentPlans.find((p: any) => p.customerId === selectedCustomer?.customerId);
  const recordPayment = useRecordPaymentMutation(selectedPlan?.id ?? '');

  const dashboard = {
    activePlans: dashboardData?.activePlans ?? 0,
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

  // Outstanding balance across all payment plans — real, summed client-side
  // from the live payment-plans list (no single endpoint returns this total).
  const totalOutstandingMinor = paymentPlans.reduce((sum: number, p: any) => sum + (p.balanceMinor ?? 0), 0);

  const bandConfig = [
    { band: 'red' as const, label: progressBandLabels.red, color: tokens.band.red, icon: <WarningOutlined /> },
    { band: 'yellow' as const, label: progressBandLabels.yellow, color: tokens.band.yellow, icon: <ClockCircleOutlined /> },
    { band: 'light_green' as const, label: progressBandLabels.light_green, color: tokens.band.light_green, icon: <CheckCircleOutlined /> },
    { band: 'green' as const, label: progressBandLabels.green, color: tokens.band.green, icon: <CheckCircleOutlined /> },
  ];
  const activePlansForProgress = Math.max(dashboard.activePlans, 1);

  const handleRecordPayment = async (values: any) => {
    if (!selectedPlan) {
      message.error('No active payment plan found for this customer');
      return;
    }
    try {
      setLoading(true);
      await recordPayment.mutateAsync({
        amountMinor: Math.round(values.amount * 100),
        paidOn: values.paymentDate.format('YYYY-MM-DD'),
        method: values.method,
        reference: values.reference || undefined,
      });
      message.success('Payment recorded successfully!');
      setAddPaymentModal(false);
      paymentForm.resetFields();
      refetchPaymentPlans();
      refetchDashboard();
    } catch (error: any) {
      message.error(error?.error?.message || error?.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    refetchDashboard();
    refetchPaymentPlans();
    message.success('Dashboard refreshed!');
  };

  const defaulterColumns = [
    {
      title: 'Customer Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
        <a onClick={() => navigate(`/customers/${record.customerId}`)}>
          <Space><UserOutlined />{name}</Space>
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
      render: (days: number) => <Tag color={days > 7 ? 'red' : days > 3 ? 'orange' : 'yellow'}>{days} days</Tag>,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Button type="link" size="small" onClick={() => { setSelectedCustomer(record); setAddPaymentModal(true); }}>
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
          <Space><UserOutlined />{name}</Space>
        </a>
      ),
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
        const daysUntil = Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return <Tag color={daysUntil <= 2 ? 'red' : daysUntil <= 5 ? 'orange' : 'blue'}>{daysUntil <= 0 ? 'Overdue' : `${daysUntil} days`}</Tag>;
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Button type="link" size="small" onClick={() => { setSelectedCustomer(record); setAddPaymentModal(true); }}>
          Record Payment
        </Button>
      ),
    },
  ];

  if (dashboardLoading || paymentPlansLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <Spin size="large" tip="Loading dashboard..." />
      </div>
    );
  }

  if (dashboardError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Failed to load dashboard"
        description={(dashboardErrorDetails as any)?.message || 'Please try again later.'}
        style={{ margin: 24 }}
        action={<Button size="small" type="primary" onClick={handleRefresh}>Retry</Button>}
      />
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2}>Finance & Accounts Dashboard</Title>
          <Text type="secondary">Welcome back, {user?.firstName}! Collections and revenue overview</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={handleRefresh}>Refresh</Button>
      </div>

      {/* ── Stats Cards ──────────────────────────────────────────────────── */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
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
              title="Outstanding Balance"
              value={totalOutstandingMinor / 100}
              prefix="GHS"
              precision={2}
              valueStyle={{ color: '#ff4d4f' }}
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
        <Col xs={24} sm={12} lg={6}>
          <Card loading={analyticsLoading}>
            <Statistic
              title="Conversion Rate (12mo)"
              value={analyticsData?.conversionRate ?? 0}
              suffix="%"
              precision={1}
              prefix={<RiseOutlined />}
              valueStyle={{ color: tokens.primary }}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Progress Band Summary ───────────────────────────────────────── */}
      <Title level={4} style={{ marginBottom: 16 }}>Payment Plan Progress</Title>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {bandConfig.map(band => (
          <Col xs={24} sm={12} lg={6} key={band.band}>
            <Card
              style={{ borderTop: `4px solid ${band.color}`, cursor: 'pointer' }}
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

      {/* ── Defaulters / Due Soon ───────────────────────────────────────── */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card
            title={<span><WarningOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />Defaulters<Badge count={dashboard.defaulters.length} style={{ marginLeft: 8 }} /></span>}
          >
            {dashboard.defaulters.length > 0 ? (
              <Table columns={defaulterColumns} dataSource={dashboard.defaulters} rowKey="customerId" pagination={{ pageSize: 5 }} size="small" />
            ) : (
              <Empty description={<span style={{ color: '#52c41a' }}><CheckCircleOutlined /> No defaulters — all payments on track</span>} />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={<span><ClockCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />Due Soon<Badge count={dashboard.dueSoon.length} style={{ marginLeft: 8 }} /></span>}
          >
            {dashboard.dueSoon.length > 0 ? (
              <Table columns={dueSoonColumns} dataSource={dashboard.dueSoon} rowKey="customerId" pagination={{ pageSize: 5 }} size="small" />
            ) : (
              <Empty description="No payments due soon" />
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Analytics (real — GET /dashboard/analytics, not available to Secretary) ── */}
      <Title level={4} style={{ marginBottom: 16 }}>Revenue Analytics</Title>
      <div style={{ marginBottom: 24 }}>
        <AnalyticsSection />
      </div>

      {/* ── Placeholder: features with no backend endpoint yet ──────────── */}
      <Title level={4} style={{ marginBottom: 16 }}>
        Coming Soon
        <Tag color="gold" style={{ marginLeft: 12, fontWeight: 'normal' }}>Preview — sample data, not live</Tag>
      </Title>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card
            title={<span><ExperimentOutlined style={{ marginRight: 8 }} />Expense Tracking</span>}
            style={{ borderStyle: 'dashed', opacity: 0.85 }}
          >
            <Alert
              type="warning"
              showIcon
              message="Not yet connected to a backend endpoint"
              description="Expense tracking will show real data once the corresponding API is available. The rows below are illustrative only."
              style={{ marginBottom: 12 }}
            />
            <List
              size="small"
              dataSource={[
                { label: 'Office Supplies', amount: 'GHS 1,200.00' },
                { label: 'Staff Transport', amount: 'GHS 850.00' },
                { label: 'Utilities', amount: 'GHS 2,300.00' },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <Text type="secondary">{item.label}</Text>
                  <Text type="secondary">{item.amount}</Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={<span><BankOutlined style={{ marginRight: 8 }} />Bank Reconciliation</span>}
            style={{ borderStyle: 'dashed', opacity: 0.85 }}
          >
            <Alert
              type="warning"
              showIcon
              message="Not yet connected to a backend endpoint"
              description="Once a reconciliation endpoint exists, this card will compare recorded payments against bank statement imports."
              style={{ marginBottom: 12 }}
            />
            <Tooltip title="Sample only — not a real reconciliation status">
              <Statistic title="Unreconciled Transactions (sample)" value={0} valueStyle={{ color: '#bbb' }} />
            </Tooltip>
          </Card>
        </Col>
      </Row>

      {/* ── Record Payment Modal ─────────────────────────────────────────── */}
      <Modal
        title="Record Payment"
        open={addPaymentModal}
        onCancel={() => { setAddPaymentModal(false); paymentForm.resetFields(); setSelectedCustomer(null); }}
        footer={null}
        width={500}
        style={{ top: 20 }}
      >
        {selectedCustomer && (
          <Alert
            message={`Recording payment for ${selectedCustomer.name}`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Form form={paymentForm} layout="vertical" onFinish={handleRecordPayment}>
          <Form.Item name="amount" label="Amount (GHS)" rules={[{ required: true, message: 'Please enter amount' }]}>
            <InputNumber style={{ width: '100%' }} prefix="GHS" precision={2} min={0.01} placeholder="Enter amount" />
          </Form.Item>
          <Form.Item name="paymentDate" label="Payment Date" rules={[{ required: true, message: 'Please select payment date' }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="method" label="Payment Method" rules={[{ required: true, message: 'Please select payment method' }]}>
            <Select placeholder="Select method">
              <Option value="cash">Cash</Option>
              <Option value="bank_transfer">Bank Transfer</Option>
              <Option value="mobile_money">Mobile Money</Option>
              <Option value="cheque">Cheque</Option>
            </Select>
          </Form.Item>
          <Form.Item name="reference" label="Reference (Optional)">
            <Input placeholder="Reference number" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>Record Payment</Button>
              <Button onClick={() => { setAddPaymentModal(false); paymentForm.resetFields(); setSelectedCustomer(null); }}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
