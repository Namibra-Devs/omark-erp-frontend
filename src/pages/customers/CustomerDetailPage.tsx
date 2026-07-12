// src/pages/customers/CustomerDetailPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import {
  Card, Row, Col, Typography, Tag, Button, Space, Tabs, Table,
  Descriptions, Avatar, Badge, Progress, Timeline, Modal, Form,
  Input, Select, DatePicker, message, Divider, Empty, Spin,
  Statistic, List, Tooltip, Popconfirm, InputNumber, Alert
} from 'antd';
import {
  ArrowLeftOutlined,
  PhoneOutlined,
  MailOutlined,
  HomeOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DollarOutlined,
  BankOutlined,
  FileOutlined,
  DownloadOutlined,
  PrinterOutlined,
  ShareAltOutlined,
  EnvironmentOutlined,
  IdcardOutlined,
  ReloadOutlined,
  CreditCardOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusTag } from '@/components/shared/StatusTag';
import { MoneyText } from '@/components/shared/MoneyText';
import { ProgressCell } from '@/components/shared/ProgressCell';
import { tokens } from '@/constants/tokens';
import { useCustomerQuery } from '@/api/customers';
import { usePaymentPlanQuery, useInstallmentsQuery } from '@/api/paymentPlans';
import { usePropertyQuery } from '@/api/properties';
import {
  useRecordPaymentMutation,
  usePaystackInitializeMutation,
  usePaystackVerifyMutation,
  getPaymentMethodConfig,
} from '@/api/payments';
import { useGenerateDeedMutation } from '@/api/deeds';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import advancedFormat from 'dayjs/plugin/advancedFormat';

dayjs.extend(relativeTime);
dayjs.extend(advancedFormat);

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [recordPaymentModal, setRecordPaymentModal] = useState(false);
  const [paystackModal, setPaystackModal] = useState(false);
  const [generateDeedModal, setGenerateDeedModal] = useState(false);
  const [form] = Form.useForm();
  const [paystackForm] = Form.useForm();
  const [deedForm] = Form.useForm();
  const [witnesses, setWitnesses] = useState<{ name: string; contact: string }[]>([
    { name: '', contact: '' },
    { name: '', contact: '' },
  ]);

  const paystackVerifyAttempted = useRef(false);

  // ── API Queries ────────────────────────────────────────────────────────────
  const {
    data: customerData,
    isLoading: customerLoading,
    error: customerError,
    refetch: refetchCustomer
  } = useCustomerQuery(id || '');

  const customer = customerData as any;

  // The real backend embeds the customer's active payment plan on the customer
  // detail response (`customer.plan`). Payment-plan-scoped endpoints (record
  // payment / Paystack initialize & verify / installments) need the plan's own
  // `id` — not the customer id — so we read it from there.
  const planId: string | undefined = customer?.plan?.id;

  const {
    data: paymentPlanData,
    isLoading: paymentPlanLoading,
    refetch: refetchPaymentPlan
  } = usePaymentPlanQuery(planId);

  const {
    data: installmentsData,
    isLoading: installmentsLoading,
    refetch: refetchInstallments
  } = useInstallmentsQuery(planId);

  const {
    data: propertyData,
    isLoading: propertyLoading
  } = usePropertyQuery(customer?.propertyId || '');

  // ── API Mutations ──────────────────────────────────────────────────────────
  const recordPayment = useRecordPaymentMutation(planId ?? '');
  const paystackInitialize = usePaystackInitializeMutation(planId ?? '');
  const paystackVerify = usePaystackVerifyMutation(planId ?? '');
  const generateDeed = useGenerateDeedMutation();

  // ── Extract Data ──────────────────────────────────────────────────────────
  // Prefer the dedicated payment-plan detail fetch (it may carry `installments`
  // / `recentPayments` embedded by the backend); fall back to the plan summary
  // already embedded on the customer response while that fetch is in flight.
  const paymentPlan = (paymentPlanData ?? customer?.plan ?? null) as any;
  const installments = installmentsData ?? paymentPlan?.installments ?? [];
  // There is no standalone GET /payments (list) endpoint on the real API — the
  // only "payment history" available is whatever the backend chooses to embed
  // on the payment plan detail response.
  const recentPayments = (paymentPlanData as any)?.recentPayments ?? paymentPlan?.payments ?? [];
  const property = propertyData as any;

  const isFullyPaid = customer?.type === 'fully_paid' || paymentPlan?.status === 'completed';

  // ── Paystack return-redirect verification ────────────────────────────────
  // Paystack redirects the customer back to this page with a `?reference=` (or
  // `?trxref=`) query param after checkout. Detect it, verify the payment
  // server-side, refresh the plan, and strip the param so it doesn't re-fire.
  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    if (!reference || !planId || paystackVerifyAttempted.current) {
      return;
    }
    paystackVerifyAttempted.current = true;

    paystackVerify.mutateAsync({ reference })
      .then(() => {
        message.success('Payment verified successfully!');
        refetchPaymentPlan();
        refetchInstallments();
        refetchCustomer();
      })
      .catch((error: any) => {
        message.error(
          error?.error?.message || error?.response?.data?.message || error?.message || 'Failed to verify Paystack payment'
        );
      })
      .finally(() => {
        navigate(location.pathname, { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, searchParams]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleRecordPayment = async (values: any) => {
    if (!planId) {
      message.error('This customer has no active payment plan.');
      return;
    }
    try {
      await recordPayment.mutateAsync({
        amountMinor: Math.round(values.amountGHS * 100),
        paidOn: values.paidOn.toISOString(),
        method: values.method,
        reference: values.reference || undefined,
      });

      message.success('Payment recorded successfully!');
      setRecordPaymentModal(false);
      form.resetFields();

      // Refresh data
      refetchPaymentPlan();
      refetchInstallments();
      refetchCustomer();
    } catch (error: any) {
      message.error(
        error?.error?.message || error?.response?.data?.message || error?.message || 'Failed to record payment'
      );
    }
  };

  const handlePaystackPay = async (values: any) => {
    if (!planId) {
      message.error('This customer has no active payment plan.');
      return;
    }
    try {
      const result = await paystackInitialize.mutateAsync({
        amountMinor: Math.round(values.amountGHS * 100),
        email: values.email,
      });

      message.success('Redirecting to Paystack checkout...');
      setPaystackModal(false);
      paystackForm.resetFields();
      window.location.href = result.authorizationUrl;
    } catch (error: any) {
      message.error(
        error?.error?.message || error?.response?.data?.message || error?.message || 'Failed to initialize Paystack payment'
      );
    }
  };

  // ── Witness management (Generate Deed modal) ─────────────────────────────
  const addWitness = () => {
    setWitnesses([...witnesses, { name: '', contact: '' }]);
  };

  const removeWitness = (index: number) => {
    if (witnesses.length <= 1) {
      message.warning('At least 1 witness is required');
      return;
    }
    setWitnesses(witnesses.filter((_, i) => i !== index));
  };

  const updateWitness = (index: number, field: 'name' | 'contact', value: string) => {
    const next = [...witnesses];
    next[index] = { ...next[index], [field]: value };
    setWitnesses(next);
  };

  const resetDeedForm = () => {
    deedForm.resetFields();
    setWitnesses([{ name: '', contact: '' }, { name: '', contact: '' }]);
  };

  const handleGenerateDeed = async (values: any) => {
    const validWitnesses = witnesses.filter(w => w.name.trim() && w.contact.trim());
    if (validWitnesses.length < 1) {
      message.error('At least 1 witness (name and contact) is required');
      return;
    }
    try {
      await generateDeed.mutateAsync({
        customerId: id || '',
        propertyId: customer?.propertyId || '',
        witnesses: validWitnesses,
        businessContacts: values.businessContacts,
      });

      message.success('Deed generated successfully!');
      setGenerateDeedModal(false);
      resetDeedForm();
    } catch (error: any) {
      message.error(
        error?.error?.message || error?.response?.data?.message || error?.message || 'Failed to generate deed'
      );
    }
  };

  const handleDownloadDeed = (deedId: string) => {
    // Will be implemented when deed document endpoint is ready
    message.info('Deed download coming soon!');
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (customerLoading || paymentPlanLoading || propertyLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" tip="Loading customer details..." />
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (customerError || !customer) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="Error Loading Customer"
          description="There was an error loading the customer details. Please try again."
          type="error"
          showIcon
          action={
            <Button size="small" type="primary" onClick={() => refetchCustomer()}>
              Retry
            </Button>
          }
        />
        <Button
          type="primary"
          onClick={() => navigate('/customers')}
          style={{ marginTop: 16 }}
        >
          Back to Customers
        </Button>
      </div>
    );
  }

  // ── Installments columns ──────────────────────────────────────────────────
  const installmentsColumns = [
    {
      title: '#',
      dataIndex: 'sequence',
      key: 'sequence',
      width: 80
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date: string) => dayjs(date).format('MMMM DD, YYYY'),
      sorter: (a: any, b: any) => dayjs(a.dueDate).unix() - dayjs(b.dueDate).unix(),
    },
    {
      title: 'Expected Amount',
      dataIndex: 'expectedAmountMinor',
      key: 'expectedAmountMinor',
      render: (value: number) => <MoneyText minor={value} />,
      sorter: (a: any, b: any) => a.expectedAmountMinor - b.expectedAmountMinor,
    },
    {
      title: 'Status',
      dataIndex: 'isPaid',
      key: 'isPaid',
      render: (isPaid: boolean, record: any) => (
        <Tag color={isPaid ? 'green' : 'red'}>
          {isPaid ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          {isPaid ? ' Paid' : ' Pending'}
        </Tag>
      ),
      filters: [
        { text: 'Paid', value: true },
        { text: 'Pending', value: false },
      ],
      onFilter: (value: any, record: any) => record.isPaid === value,
    },
    {
      title: 'Paid Date',
      dataIndex: 'paidAt',
      key: 'paidAt',
      render: (date: string) => date ? dayjs(date).format('MMMM DD, YYYY') : '-',
    },
  ];

  // ── Payments columns ──────────────────────────────────────────────────────
  const paymentsColumns = [
    {
      title: 'Date',
      dataIndex: 'paidOn',
      key: 'paidOn',
      render: (date: string) => dayjs(date).format('MMMM DD, YYYY HH:mm'),
      sorter: (a: any, b: any) => dayjs(a.paidOn).unix() - dayjs(b.paidOn).unix(),
    },
    {
      title: 'Amount',
      dataIndex: 'amountMinor',
      key: 'amountMinor',
      render: (value: number) => <MoneyText minor={value} />,
      sorter: (a: any, b: any) => a.amountMinor - b.amountMinor,
    },
    {
      title: 'Method',
      dataIndex: 'method',
      key: 'method',
      render: (method: any) => {
        const config = getPaymentMethodConfig(method);
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: 'Reference',
      dataIndex: 'reference',
      key: 'reference',
      render: (ref: string) => ref || '-',
    },
    {
      title: 'Recorded By',
      dataIndex: 'recordedByUserId',
      key: 'recordedByUserId',
      render: (recordedByUserId: string) => recordedByUserId || 'Unknown',
    },
  ];

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden', padding: '0 4px' }}>
      <PageHeader
        title={`${customer.firstName} ${customer.lastName}`}
        actions={[
          {
            label: 'Back',
            onClick: () => navigate('/customers'),
            icon: <ArrowLeftOutlined />,
          },
          {
            label: 'Record Payment',
            onClick: () => setRecordPaymentModal(true),
            icon: <PlusOutlined />,
            disabled: isFullyPaid || !planId,
          },
          {
            label: 'Pay Online (Paystack)',
            onClick: () => setPaystackModal(true),
            icon: <CreditCardOutlined />,
            disabled: isFullyPaid || !planId,
          },
          {
            label: 'Generate Deed',
            onClick: () => setGenerateDeedModal(true),
            icon: <FileOutlined />,
          },
          {
            label: 'Refresh',
            onClick: () => {
              refetchCustomer();
              refetchPaymentPlan();
              refetchInstallments();
              message.success('Refreshed!');
            },
            icon: <ReloadOutlined />,
          },
        ]}
      />

      {/* Customer Info Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card>
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: tokens.primary }} />
                <div style={{ marginTop: 8 }}>
                  <Title level={4} style={{ margin: 0 }}>{customer.firstName} {customer.lastName}</Title>
                  <Tag color={isFullyPaid ? 'green' : 'blue'}>
                    {isFullyPaid ? 'Fully Paid' : 'Payment Plan'}
                  </Tag>
                </div>
              </Col>
              <Col xs={24} sm={16}>
                <Descriptions column={2} size="small">
                  <Descriptions.Item label={<PhoneOutlined />}>
                    <a href={`tel:${customer.phoneNumber}`}>{customer.phoneNumber}</a>
                  </Descriptions.Item>
                  <Descriptions.Item label={<EnvironmentOutlined />}>
                    {customer.address}
                  </Descriptions.Item>
                  <Descriptions.Item label="Property">
                    {property ? `${property.houseNumber} - ${property.offerNumber}` : customer.propertyId || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Joined">
                    {dayjs(customer.createdAt).format('MMMM DD, YYYY')}
                  </Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <div>
                <Text type="secondary">Total Paid</Text>
                <div style={{ fontSize: 20, fontWeight: 'bold' }}>
                  {paymentPlan ? (
                    <MoneyText minor={paymentPlan.totalAmountMinor - paymentPlan.balanceMinor} />
                  ) : 'GHS 0.00'}
                </div>
              </div>
              <div>
                <Text type="secondary">Balance</Text>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: paymentPlan?.balanceMinor > 0 ? '#ff4d4f' : '#52c41a' }}>
                  {paymentPlan ? (
                    <MoneyText minor={paymentPlan.balanceMinor} />
                  ) : 'GHS 0.00'}
                </div>
              </div>
              <div>
                <Text type="secondary">Progress</Text>
                <div style={{ fontSize: 20, fontWeight: 'bold' }}>
                  {isFullyPaid ? '100%' : paymentPlan ? `${paymentPlan.progressPercent}%` : '0%'}
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'overview',
            label: 'Overview',
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card title="Payment Plan Details">
                    {isFullyPaid ? (
                      <div style={{ textAlign: 'center', padding: '20px' }}>
                        <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
                        <Title level={4} style={{ marginTop: 16 }}>Fully Paid</Title>
                        <Text type="secondary">This customer has fully paid for their property</Text>
                      </div>
                    ) : paymentPlan ? (
                      <div>
                        <div style={{ marginBottom: 16 }}>
                          <ProgressCell percent={paymentPlan.progressPercent} band={paymentPlan.progressBand} />
                        </div>
                        <Descriptions column={2} size="small" bordered>
                          <Descriptions.Item label="Total Amount" span={2}>
                            <MoneyText minor={paymentPlan.totalAmountMinor} />
                          </Descriptions.Item>
                          <Descriptions.Item label="Down Payment">
                            <MoneyText minor={paymentPlan.downPaymentMinor} />
                          </Descriptions.Item>
                          <Descriptions.Item label="Balance">
                            <MoneyText minor={paymentPlan.balanceMinor} />
                          </Descriptions.Item>
                          <Descriptions.Item label="Monthly Amount">
                            <MoneyText minor={paymentPlan.monthlyAmountMinor} />
                          </Descriptions.Item>
                          <Descriptions.Item label="Duration">
                            {paymentPlan.numMonths} months
                          </Descriptions.Item>
                          <Descriptions.Item label="Start Date">
                            {dayjs(paymentPlan.startDate).format('MMMM DD, YYYY')}
                          </Descriptions.Item>
                          <Descriptions.Item label="Status" span={2}>
                            <StatusTag status={paymentPlan.status} type="paymentPlan" />
                          </Descriptions.Item>
                          <Descriptions.Item label="Next Payment" span={2}>
                            {installments.filter((i: any) => !i.isPaid).length > 0 ? (
                              <>
                                <Text strong>
                                  {dayjs(installments.filter((i: any) => !i.isPaid)[0].dueDate).format('MMMM DD, YYYY')}
                                </Text>
                                <br />
                                <Text type="secondary">
                                  Amount: <MoneyText minor={installments.filter((i: any) => !i.isPaid)[0].expectedAmountMinor} />
                                </Text>
                              </>
                            ) : (
                              <Text type="secondary">All installments paid</Text>
                            )}
                          </Descriptions.Item>
                        </Descriptions>
                        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Button
                            type="primary"
                            icon={<DownloadOutlined />}
                            onClick={() => message.info('PDF generation coming soon!')}
                          >
                            Generate PDF
                          </Button>
                          <Button
                            icon={<FileOutlined />}
                            onClick={() => setGenerateDeedModal(true)}
                          >
                            Generate Deed
                          </Button>
                          <Button
                            icon={<PlusOutlined />}
                            onClick={() => setRecordPaymentModal(true)}
                            disabled={isFullyPaid || !planId}
                          >
                            Record Payment
                          </Button>
                          <Button
                            icon={<CreditCardOutlined />}
                            onClick={() => setPaystackModal(true)}
                            disabled={isFullyPaid || !planId}
                          >
                            Pay Online (Paystack)
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Empty description="No payment plan found" />
                    )}
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="Property Details">
                    {property ? (
                      <Descriptions column={1} size="small" bordered>
                        <Descriptions.Item label="House Number">
                          <Text strong>{property.houseNumber}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="Offer Number">
                          {property.offerNumber}
                        </Descriptions.Item>
                        <Descriptions.Item label="Price">
                          <MoneyText minor={property.priceMinor} />
                        </Descriptions.Item>
                        <Descriptions.Item label="Description">
                          {property.description || 'No description'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Added">
                          {dayjs(property.createdAt).format('MMMM DD, YYYY')}
                        </Descriptions.Item>
                      </Descriptions>
                    ) : (
                      <Empty description="No property assigned" />
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'installments',
            label: `Installments (${installments.filter((i: any) => !i.isPaid).length} pending)`,
            children: (
              <Card>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <Space>
                    <Text type="secondary">
                      Total: {installments.length} installments
                    </Text>
                    <Text type="secondary">
                      Paid: {installments.filter((i: any) => i.isPaid).length}
                    </Text>
                    <Text type="secondary">
                      Pending: {installments.filter((i: any) => !i.isPaid).length}
                    </Text>
                  </Space>
                  {installments.filter((i: any) => !i.isPaid).length > 0 && (
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setRecordPaymentModal(true)}
                      disabled={!planId}
                    >
                      Record Payment
                    </Button>
                  )}
                </div>
                <Spin spinning={installmentsLoading}>
                  <Table
                    columns={installmentsColumns}
                    dataSource={installments}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: paymentPlan ? 'No installments found' : 'No payment plan attached' }}
                  />
                </Spin>
              </Card>
            ),
          },
          {
            key: 'payments',
            label: `Payments (${recentPayments.length})`,
            children: (
              <Card>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <Space>
                    <Text type="secondary">
                      Total Payments: {recentPayments.length}
                    </Text>
                    <Text type="secondary">
                      Total Amount: <MoneyText minor={recentPayments.reduce((sum: number, p: any) => sum + p.amountMinor, 0)} />
                    </Text>
                  </Space>
                  <Space>
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() => setRecordPaymentModal(true)}
                      disabled={isFullyPaid || !planId}
                    >
                      Record Payment
                    </Button>
                    <Button
                      type="primary"
                      icon={<CreditCardOutlined />}
                      onClick={() => setPaystackModal(true)}
                      disabled={isFullyPaid || !planId}
                    >
                      Pay Online (Paystack)
                    </Button>
                  </Space>
                </div>
                <Spin spinning={paymentPlanLoading}>
                  <Table
                    columns={paymentsColumns}
                    dataSource={recentPayments}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    locale={{
                      emptyText: 'No payment history to show. The API does not expose a full payment history endpoint — only the most recent payments embedded in the payment plan (if any) appear here.'
                    }}
                  />
                </Spin>
              </Card>
            ),
          },
          {
            key: 'deeds',
            label: 'Deeds',
            children: (
              <Card>
                <div style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setGenerateDeedModal(true)}
                  >
                    Generate Deed
                  </Button>
                </div>
                <Empty description="No deeds generated yet">
                  <Button type="primary" onClick={() => setGenerateDeedModal(true)}>
                    Generate First Deed
                  </Button>
                </Empty>
              </Card>
            ),
          },
        ]}
      />

      {/* Record Payment Modal */}
      <Modal
        title={
          <Space>
            <PlusOutlined style={{ color: tokens.primary }} />
            <Text strong>Record Payment</Text>
          </Space>
        }
        open={recordPaymentModal}
        onCancel={() => {
          setRecordPaymentModal(false);
          form.resetFields();
        }}
        footer={null}
        width={500}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px' }}
      >
        <Form form={form} layout="vertical" onFinish={handleRecordPayment}>
          <Alert
            message={`Recording payment for ${customer.firstName} ${customer.lastName}`}
            description={
              paymentPlan ? (
                <>
                  Balance: <MoneyText minor={paymentPlan.balanceMinor} />
                  <br />
                  Next due: {installments.filter((i: any) => !i.isPaid).length > 0 ?
                    dayjs(installments.filter((i: any) => !i.isPaid)[0].dueDate).format('MMMM DD, YYYY') :
                    'All paid'
                  }
                </>
              ) : 'No active payment plan'
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            name="amountGHS"
            label="Amount (GHS)"
            rules={[
              { required: true, message: 'Please enter amount' },
              { type: 'number', min: 0.01, message: 'Amount must be greater than 0' }
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              prefix="GHS"
              precision={2}
              min={0.01}
              placeholder="Enter amount in GHS"
            />
          </Form.Item>

          <Form.Item
            name="paidOn"
            label="Payment Date"
            rules={[{ required: true, message: 'Please select payment date' }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item
            name="method"
            label="Payment Method"
            rules={[{ required: true, message: 'Please select payment method' }]}
          >
            <Select>
              <Option value="cash">Cash</Option>
              <Option value="bank_transfer">Bank Transfer</Option>
              <Option value="mobile_money">Mobile Money</Option>
              <Option value="cheque">Cheque</Option>
              <Option value="other">Other</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="reference"
            label="Reference (Optional)"
          >
            <Input placeholder="Enter reference number" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={recordPayment.isPending}
              >
                Record Payment
              </Button>
              <Button onClick={() => {
                setRecordPaymentModal(false);
                form.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Pay Online (Paystack) Modal */}
      <Modal
        title={
          <Space>
            <CreditCardOutlined style={{ color: tokens.primary }} />
            <Text strong>Pay Online (Paystack)</Text>
          </Space>
        }
        open={paystackModal}
        onCancel={() => {
          setPaystackModal(false);
          paystackForm.resetFields();
        }}
        footer={null}
        width={500}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px' }}
      >
        <Form form={paystackForm} layout="vertical" onFinish={handlePaystackPay}>
          <Alert
            message={`Paying online for ${customer.firstName} ${customer.lastName}`}
            description={
              paymentPlan ? (
                <>
                  Balance: <MoneyText minor={paymentPlan.balanceMinor} />
                  <br />
                  You will be redirected to Paystack to complete this payment securely.
                </>
              ) : 'No active payment plan'
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            name="amountGHS"
            label="Amount (GHS)"
            rules={[
              { required: true, message: 'Please enter amount' },
              { type: 'number', min: 0.01, message: 'Amount must be greater than 0' }
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              prefix="GHS"
              precision={2}
              min={0.01}
              placeholder="Enter amount in GHS"
            />
          </Form.Item>

          <Form.Item
            name="email"
            label="Customer Email"
            rules={[
              { required: true, message: 'Please enter an email for the Paystack receipt' },
              { type: 'email', message: 'Please enter a valid email address' },
            ]}
          >
            <Input placeholder="customer@example.com" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={paystackInitialize.isPending}
                icon={<CreditCardOutlined />}
              >
                Continue to Paystack
              </Button>
              <Button onClick={() => {
                setPaystackModal(false);
                paystackForm.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Generate Deed Modal */}
      <Modal
        title={
          <Space>
            <FileOutlined style={{ color: tokens.primary }} />
            <Text strong>Generate Deed</Text>
          </Space>
        }
        open={generateDeedModal}
        onCancel={() => {
          setGenerateDeedModal(false);
          resetDeedForm();
        }}
        footer={null}
        width={600}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px', maxHeight: '70vh', overflowY: 'auto' }}
      >
        <Form form={deedForm} layout="vertical" onFinish={handleGenerateDeed}>
          <Alert
            message={`Generating deed for ${customer.firstName} ${customer.lastName}`}
            description={
              property ? (
                <>
                  Property: {property.houseNumber} - {property.offerNumber}
                  <br />
                  Price: <MoneyText minor={property.priceMinor} />
                </>
              ) : 'No property assigned'
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Divider>Witnesses (minimum 1 required)</Divider>

          {witnesses.map((witness, index) => (
            <Row key={index} gutter={[8, 8]} style={{ marginBottom: 8 }}>
              <Col xs={24} sm={10}>
                <Form.Item
                  label={index === 0 ? 'Witness Name' : ''}
                  required={index === 0}
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
                  required={index === 0}
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
                    disabled={witnesses.length <= 1}
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
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={generateDeed.isPending}
              >
                Generate Deed
              </Button>
              <Button onClick={() => {
                setGenerateDeedModal(false);
                resetDeedForm();
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
