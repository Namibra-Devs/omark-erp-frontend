// src/pages/dashboard/AccountsDashboardPage.tsx
import React, { useState } from 'react';
import {
  Card, Row, Col, Typography, Statistic, Table, Tag, Progress, Empty, Spin, Alert,
  Button, Space, Modal, Form, InputNumber, DatePicker, Select, Input, message, Badge, List, Divider,
} from 'antd';
import {
  DollarOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  PhoneOutlined,
  UserOutlined,
  RiseOutlined,
  ExperimentOutlined,
  BankOutlined,
  PlusOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSecretaryDashboardQuery, useAnalyticsDashboardQuery } from '@/api/dashboard';
import { usePaymentPlansQuery } from '@/api/paymentPlans';
import { useRecordPaymentMutation } from '@/api/payments';
import { useExpensesQuery, useCreateExpenseMutation } from '@/api/expenses';
import { usePayrollQuery } from '@/api/payroll';
import { progressBandLabels } from '@/constants/enums';
import { tokens } from '@/constants/tokens';
import { MoneyText } from '@/components/shared/MoneyText';
import { AnalyticsSection } from './admin/components/AnalyticsSection';
import { useBranchContext } from '@/contexts/BranchContext';
import { useUnmatchedBankEntriesQuery, useImportBankStatementMutation, type BankReconciliationSummary } from '@/api/bankReconciliation';
import { filterEntitiesByBranch } from '@/utils/branchIsolation';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export const AccountsDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── API Queries ──────────────────────────────────────────────────────────
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
  const { data: expensesData, refetch: refetchExpenses } = useExpensesQuery();
  const { data: payrollData } = usePayrollQuery();
  const payroll = payrollData?.items ?? [];
  const createExpenseMutation = useCreateExpenseMutation();

  // ── Bank Reconciliation API ────────────────────────────────────────────────
  const { data: unmatchedBankEntries = [], refetch: refetchUnmatchedBank } = useUnmatchedBankEntriesQuery();
  const importBankMutation = useImportBankStatementMutation();

  // ── UI State ─────────────────────────────────────────────────────────────
  const [addPaymentModal, setAddPaymentModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [paymentForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [addExpenseModal, setAddExpenseModal] = useState(false);
  const [expenseForm] = Form.useForm();
  const [importBankModal, setImportBankModal] = useState(false);
  const [bankForm] = Form.useForm();
  const [reconciliationResult, setReconciliationResult] = useState<BankReconciliationSummary | null>(null);

  const { branches } = useBranchContext();
  const rawExpenses = expensesData?.items ?? [];
  const rawPaymentPlans = paymentPlansData?.items ?? [];

  const expenses = filterEntitiesByBranch(rawExpenses, user, branches);
  const paymentPlans = filterEntitiesByBranch(rawPaymentPlans, user, branches);

  const internalExpensesMinor = expenses.filter((e) => e.type === 'internal').reduce((sum, e) => sum + e.amountMinor, 0);
  const externalExpensesMinor = expenses.filter((e) => e.type === 'external').reduce((sum, e) => sum + e.amountMinor, 0);
  const totalBonusesMinor = payroll.reduce((sum, p) => sum + (p.bonusMinor || 0), 0);
  const pendingPayrollCount = payroll.filter((p) => p.status === 'pending').length;

  const handleAddExpense = async (values: { branchId?: string; category: string; description?: string; amountGHS: number; type: 'internal' | 'external'; date: dayjs.Dayjs }) => {
    try {
      await createExpenseMutation.mutateAsync({
        branchId: values.branchId,
        category: values.category,
        description: values.description,
        amountMinor: Math.round(values.amountGHS * 100),
        type: values.type,
        incurredOn: values.date.format('YYYY-MM-DD'),
      });
      message.success('Expense recorded successfully');
      expenseForm.resetFields();
      setAddExpenseModal(false);
      refetchExpenses();
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Failed to record expense');
    }
  };

  const selectedPlan = paymentPlans.find((p: any) => p.customerId === selectedCustomer?.customerId);
  const recordPayment = useRecordPaymentMutation(selectedPlan?.id ?? '');

  const rawDefaulters = dashboardData?.defaulters ?? [];
  const rawDueSoon = dashboardData?.dueSoon ?? [];
  const defaulters = filterEntitiesByBranch(rawDefaulters, user, branches);
  const dueSoon = filterEntitiesByBranch(rawDueSoon, user, branches);

  const activePlansCount = paymentPlans.length;
  const calculatedMonthlyRevenue = paymentPlans.reduce(
    (sum: number, p: any) => sum + (p.monthlyInstallmentMinor || Math.round((p.totalAmountMinor || 1200000) / (p.numMonths || 12))),
    0
  );

  const redCount = paymentPlans.filter((p: any) => p.progressBand === 'red' || (p.balanceMinor && p.balanceMinor > 2000000)).length;
  const yellowCount = paymentPlans.filter((p: any) => p.progressBand === 'yellow' || (p.balanceMinor && p.balanceMinor > 1000000 && p.balanceMinor <= 2000000)).length;
  const lightGreenCount = paymentPlans.filter((p: any) => p.progressBand === 'light_green' || (p.balanceMinor && p.balanceMinor > 500000 && p.balanceMinor <= 1000000)).length;
  const greenCount = paymentPlans.filter((p: any) => p.progressBand === 'green' || p.balanceMinor === 0).length;

  const dashboard = {
    activePlans: activePlansCount,
    monthlyRevenue: calculatedMonthlyRevenue > 0 ? calculatedMonthlyRevenue : (dashboardData?.monthlyRevenue ?? 0),
    byBand: {
      red: redCount,
      yellow: yellowCount,
      light_green: lightGreenCount,
      green: greenCount,
    },
    defaulters,
    dueSoon,
  };

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
    refetchExpenses();
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
          <Title level={2} style={{ marginBottom: 4 }}>Finance & Accounts Dashboard</Title>
          <Text type="secondary">Welcome back, {user?.firstName}! Collections, expenses and revenue overview</Text>
        </div>
        <Space wrap>
          <Button 
            icon={<DollarOutlined />}
            type="primary"
            onClick={() => navigate('/accounts/expenses')}
          >
            Expenses Hub
          </Button>
          <Button 
            icon={<IdcardOutlined />}
            onClick={() => navigate('/accounts/payroll')}
          >
            Bonuses & Salaries
          </Button>
          <Button 
            icon={<PlusOutlined />}
            onClick={() => setAddExpenseModal(true)}
          >
            Quick Expense
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
            Refresh
          </Button>
        </Space>
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

      {/* ── Analytics ── */}
      <Title level={4} style={{ marginBottom: 16 }}>Revenue Analytics</Title>
      <div style={{ marginBottom: 24 }}>
        <AnalyticsSection />
      </div>

      {/* ── Finance tools ── */}
      <Title level={4} style={{ marginBottom: 16 }}>
        Finance Tools
      </Title>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={8}>
          <Card
            title={<span><ExperimentOutlined style={{ marginRight: 8 }} />Expenses</span>}
            extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setAddExpenseModal(true)}>Record</Button>}
          >
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col span={12}><Statistic title="Internal" value={internalExpensesMinor / 100} prefix="GHS" precision={2} valueStyle={{ fontSize: 16 }} /></Col>
              <Col span={12}><Statistic title="External" value={externalExpensesMinor / 100} prefix="GHS" precision={2} valueStyle={{ fontSize: 16 }} /></Col>
            </Row>
            <List
              size="small"
              dataSource={expenses.slice(0, 5)}
              locale={{ emptyText: 'No expenses recorded yet.' }}
              renderItem={(item) => (
                <List.Item>
                  <Space direction="vertical" size={0}>
                    <Text style={{ fontSize: 13 }}>{item.category}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {item.code || 'EXP'} · {item.incurredOn}
                    </Text>
                  </Space>
                  <Space direction="vertical" size={0} style={{ textAlign: 'right' }}>
                    <Text strong style={{ fontSize: 13 }}>GHS {(item.amountMinor / 100).toLocaleString()}</Text>
                    <Tag color={item.type === 'internal' ? 'blue' : 'purple'} style={{ fontSize: 10 }}>{item.type}</Tag>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={<span><IdcardOutlined style={{ marginRight: 8 }} />Bonuses & Salaries</span>}
            extra={<Button size="small" onClick={() => navigate('/accounts/payroll')}>Manage</Button>}
          >
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col span={12}><Statistic title="Bonuses Paid" value={totalBonusesMinor / 100} prefix="GHS" precision={2} valueStyle={{ fontSize: 16, color: '#52c41a' }} /></Col>
              <Col span={12}><Statistic title="Pending Runs" value={pendingPayrollCount} valueStyle={{ fontSize: 16, color: pendingPayrollCount > 0 ? '#faad14' : '#52c41a' }} /></Col>
            </Row>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Run payroll, add bonuses, and track payment status per branch from the full Bonuses & Salaries page.
            </Text>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={<span><BankOutlined style={{ marginRight: 8 }} />Bank Reconciliation</span>}
            extra={<Button size="small" type="primary" onClick={() => { setReconciliationResult(null); bankForm.resetFields(); setImportBankModal(true); }}>Import Statement</Button>}
          >
            <Statistic
              title="Unmatched Statement Entries"
              value={unmatchedBankEntries.length}
              valueStyle={{ color: unmatchedBankEntries.length > 0 ? '#faad14' : '#52c41a' }}
            />
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
              Entries imported from bank statements requiring payment reconciliation.
            </Text>
            {unmatchedBankEntries.length > 0 && (
              <List
                size="small"
                style={{ marginTop: 12 }}
                dataSource={unmatchedBankEntries.slice(0, 3)}
                renderItem={(item: any) => (
                  <List.Item>
                    <Space direction="vertical" size={0}>
                      <Text style={{ fontSize: 12 }}>{item.description || item.reference || 'Bank Entry'}</Text>
                      <Text type="secondary" style={{ fontSize: 10 }}>{item.date?.split('T')[0]}</Text>
                    </Space>
                    <Text strong style={{ fontSize: 12 }}>GHS {(item.amountMinor / 100).toLocaleString()}</Text>
                  </List.Item>
                )}
              />
            )}
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

      {/* ── Record Expense Modal ─────────────────────────────────────────── */}
      <Modal
        title="Record Expense"
        open={addExpenseModal}
        onCancel={() => { setAddExpenseModal(false); expenseForm.resetFields(); }}
        footer={null}
        width={480}
      >
        <Form form={expenseForm} layout="vertical" onFinish={handleAddExpense} initialValues={{ type: 'internal', date: dayjs() }}>
          <Form.Item name="branchId" label="Branch">
            <Select allowClear placeholder="Select branch (Optional)" options={branches.map((b) => ({ value: b.id, label: b.name }))} />
          </Form.Item>
          <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Please enter a category' }]}>
            <Input placeholder="e.g. Office Supplies, Legal Fees" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input placeholder="Optional detail" />
          </Form.Item>
          <Form.Item name="amountGHS" label="Amount (GHS)" rules={[{ required: true, message: 'Please enter amount' }]}>
            <InputNumber style={{ width: '100%' }} prefix="GHS" precision={2} min={0.01} placeholder="Enter amount" />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select>
              <Option value="internal">Internal</Option>
              <Option value="external">External</Option>
            </Select>
          </Form.Item>
          <Form.Item name="date" label="Date" rules={[{ required: true, message: 'Please select a date' }]}>
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createExpenseMutation.isPending}>Record Expense</Button>
              <Button onClick={() => { setAddExpenseModal(false); expenseForm.resetFields(); }}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Import Bank Statement Modal ───────────────────────────────────── */}
      <Modal
        title="Import & Reconcile Bank Statement"
        open={importBankModal}
        onCancel={() => { setImportBankModal(false); bankForm.resetFields(); setReconciliationResult(null); }}
        footer={null}
        width={640}
      >
        {reconciliationResult ? (
          <div>
            <Alert
              type="success"
              showIcon
              message="Bank Statement Reconciliation Complete"
              description={`Total Imported: ${reconciliationResult.totalImported} | Matched: ${reconciliationResult.matchedCount} | Unmatched: ${reconciliationResult.unmatchedCount}`}
              style={{ marginBottom: 16 }}
            />
            {reconciliationResult.matched.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Text strong>Matched Payments ({reconciliationResult.matched.length}):</Text>
                <List
                  size="small"
                  bordered
                  dataSource={reconciliationResult.matched}
                  renderItem={(m) => (
                    <List.Item>
                      <Space direction="vertical" size={0}>
                        <Text strong>Ref: {m.transaction.reference || m.payment.reference || 'N/A'}</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>Date: {m.payment.paidOn?.split('T')[0]}</Text>
                      </Space>
                      <Tag color="green">GHS {(m.payment.amountMinor / 100).toLocaleString()}</Tag>
                    </List.Item>
                  )}
                />
              </div>
            )}
            <Button
              type="primary"
              onClick={() => {
                setReconciliationResult(null);
                bankForm.resetFields();
              }}
            >
              Import Another
            </Button>
          </div>
        ) : (
          <Form
            form={bankForm}
            layout="vertical"
            onFinish={async (values) => {
              try {
                let transactions: any[] = [];
                if (values.jsonText) {
                  transactions = JSON.parse(values.jsonText);
                } else {
                  transactions = [
                    {
                      date: values.date ? values.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
                      amountMinor: Math.round((values.amountGHS || 0) * 100),
                      reference: values.reference || undefined,
                      description: values.description || undefined,
                    },
                  ];
                }
                const summary = await importBankMutation.mutateAsync({ transactions });
                setReconciliationResult(summary);
                message.success(`Processed statement! ${summary.matchedCount} matched, ${summary.unmatchedCount} unmatched.`);
                refetchUnmatchedBank();
              } catch (error: any) {
                message.error(error?.error?.message || error?.message || 'Failed to import bank statement');
              }
            }}
            initialValues={{ date: dayjs() }}
          >
            <Form.Item name="date" label="Transaction Date">
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="amountGHS" label="Amount (GHS)" rules={[{ required: true, message: 'Please enter amount' }]}>
              <InputNumber style={{ width: '100%' }} prefix="GHS" precision={2} min={0.01} placeholder="1200.00" />
            </Form.Item>
            <Form.Item name="reference" label="Reference Code">
              <Input placeholder="e.g. MOM-88321" />
            </Form.Item>
            <Form.Item name="description" label="Description">
              <Input placeholder="e.g. MTN Mobile Money Cashin" />
            </Form.Item>

            <Divider>OR Paste JSON Array of Transactions</Divider>

            <Form.Item name="jsonText" label="JSON Transactions">
              <Input.TextArea
                rows={4}
                placeholder={`[{"date": "2026-08-20T00:00:00.000Z", "amountMinor": 120000, "reference": "MOM-88321", "description": "MTN Cashin GHS 1200"}]`}
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={importBankMutation.isPending}>
                  Import & Reconcile
                </Button>
                <Button onClick={() => setImportBankModal(false)}>Cancel</Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};
