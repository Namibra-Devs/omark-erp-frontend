// src/pages/customers/CustomerDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card, Row, Col, Typography, Tag, Button, Space, Tabs, Table,
  Descriptions, Avatar, Badge, Progress, Timeline, Modal, Form,
  Input, Select, DatePicker, message, Divider, Empty, Spin,
  Statistic, List, Tooltip, Popconfirm, InputNumber
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
  IdcardOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusTag } from '@/components/shared/StatusTag';
import { MoneyText } from '@/components/shared/MoneyText';
import { ProgressCell } from '@/components/shared/ProgressCell';
import { tokens } from '@/constants/tokens';
import { paymentPlanStatusLabels } from '@/constants/enums';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import advancedFormat from 'dayjs/plugin/advancedFormat';

dayjs.extend(relativeTime);
dayjs.extend(advancedFormat);

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// Mock data for customer detail
const mockCustomerDetail = {
  id: 'c1',
  firstName: 'John',
  lastName: 'Doe',
  phoneNumber: '+233241234567',
  address: '123 Main St, Accra, Ghana',
  type: 'payment_plan' as const,
  propertyId: 'prop1',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-20T14:30:00Z',
};

const mockPaymentPlan = {
  id: 'pp1',
  customerId: 'c1',
  propertyId: 'prop1',
  totalAmountMinor: 15000000,
  downPaymentMinor: 3000000,
  balanceMinor: 12000000,
  numMonths: 12,
  monthlyAmountMinor: 1000000,
  currency: 'GHS',
  startDate: '2024-01-15',
  status: 'active' as const,
  progressPercent: 25,
  progressBand: 'red' as const,
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-20T14:30:00Z',
};

const mockInstallments = [
  { id: 'i1', sequence: 1, dueDate: '2024-02-15', expectedAmountMinor: 1000000, isPaid: true, paidAt: '2024-02-15T10:00:00Z' },
  { id: 'i2', sequence: 2, dueDate: '2024-03-15', expectedAmountMinor: 1000000, isPaid: true, paidAt: '2024-03-15T10:00:00Z' },
  { id: 'i3', sequence: 3, dueDate: '2024-04-15', expectedAmountMinor: 1000000, isPaid: false },
  { id: 'i4', sequence: 4, dueDate: '2024-05-15', expectedAmountMinor: 1000000, isPaid: false },
];

const mockPayments = [
  { id: 'p1', amountMinor: 1000000, paidOn: '2024-02-15T10:00:00Z', method: 'bank_transfer', reference: 'TRX-001', recordedByUserId: '1', createdAt: '2024-02-15T10:00:00Z' },
  { id: 'p2', amountMinor: 1000000, paidOn: '2024-03-15T10:00:00Z', method: 'mobile_money', reference: 'MM-002', recordedByUserId: '1', createdAt: '2024-03-15T10:00:00Z' },
];

const mockProperty = {
  id: 'prop1',
  houseNumber: 'H-102',
  offerNumber: 'OF-2024-001',
  priceMinor: 15000000,
  currency: 'GHS',
  description: 'Beautiful 3-bedroom house in Accra',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<any>(null);
  const [paymentPlan, setPaymentPlan] = useState<any>(null);
  const [installments, setInstallments] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [property, setProperty] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [recordPaymentModal, setRecordPaymentModal] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setCustomer(mockCustomerDetail);
      setPaymentPlan(mockPaymentPlan);
      setInstallments(mockInstallments);
      setPayments(mockPayments);
      setProperty(mockProperty);
      setLoading(false);
    }, 800);
  }, [id]);

  const handleRecordPayment = (values: any) => {
    const newPayment = {
      id: `p${Date.now()}`,
      amountMinor: values.amountMinor,
      paidOn: values.paidOn.toISOString(),
      method: values.method,
      reference: values.reference || '',
      recordedByUserId: user?.id || '1',
      createdAt: new Date().toISOString(),
    };
    setPayments([newPayment, ...payments]);
    setRecordPaymentModal(false);
    form.resetFields();
    message.success('Payment recorded successfully!');
  };

  const handleGenerateDeed = () => {
    message.info('Deed generation coming soon!');
  };

  const handleGeneratePDF = () => {
    message.info('PDF generation coming soon!');
  };

  // ── Loading / not found states ────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" tip="Loading customer details..." />
      </div>
    );
  }

  if (!customer) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Empty description="Customer not found" />
        <Button type="primary" onClick={() => navigate('/customers')} style={{ marginTop: 16 }}>
          Back to Customers
        </Button>
      </div>
    );
  }

  const isFullyPaid = customer.type === 'fully_paid';

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
            disabled: isFullyPaid || !plan,
          },
          {
            label: 'Generate Deed',
            onClick: handleGenerateDeed,
            icon: <FileOutlined />,
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
                    {customer.propertyId || 'N/A'}
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
                  {plan ? (
                    <MoneyText minor={plan.totalAmountMinor - plan.balanceMinor} />
                  ) : 'GHS 0.00'}
                </div>
              </div>
              <div>
                <Text type="secondary">Balance</Text>
                <div style={{ fontSize: 20, fontWeight: 'bold' }}>
                  {plan ? (
                    <MoneyText minor={plan.balanceMinor} />
                  ) : 'GHS 0.00'}
                </div>
              </div>
              <div>
                <Text type="secondary">Progress</Text>
                <div style={{ fontSize: 20, fontWeight: 'bold' }}>
                  {isFullyPaid ? '100%' : plan ? `${plan.progressPercent}%` : '0%'}
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
                    ) : plan ? (
                      <div>
                        <div style={{ marginBottom: 16 }}>
                          <ProgressCell percent={plan.progressPercent} band={plan.progressBand} />
                        </div>
                        <Descriptions column={2} size="small" bordered>
                          <Descriptions.Item label="Total Amount" span={2}>
                            <MoneyText minor={plan.totalAmountMinor} />
                          </Descriptions.Item>
                          <Descriptions.Item label="Down Payment">
                            <MoneyText minor={plan.downPaymentMinor} />
                          </Descriptions.Item>
                          <Descriptions.Item label="Balance">
                            <MoneyText minor={plan.balanceMinor} />
                          </Descriptions.Item>
                          <Descriptions.Item label="Monthly Amount">
                            <MoneyText minor={plan.monthlyAmountMinor} />
                          </Descriptions.Item>
                          <Descriptions.Item label="Duration">
                            {plan.numMonths} months
                          </Descriptions.Item>
                          <Descriptions.Item label="Start Date">
                            {dayjs(plan.startDate).format('MMMM DD, YYYY')}
                          </Descriptions.Item>
                          <Descriptions.Item label="Status" span={2}>
                            <StatusTag status={plan.status} type="paymentPlan" />
                          </Descriptions.Item>
                        </Descriptions>
                        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                          <Button type="primary" icon={<DownloadOutlined />} onClick={handleGeneratePDF}>
                            Generate PDF
                          </Button>
                          <Button icon={<FileOutlined />} onClick={handleGenerateDeed}>
                            Generate Deed
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Empty description="No payment plan found" />
                    )}
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="Customer Details">
                    <Descriptions column={1} size="small" bordered>
                      <Descriptions.Item label="Full Name">
                        <Text strong>{customer.firstName} {customer.lastName}</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Phone">
                        <a href={`tel:${customer.phoneNumber}`}>{customer.phoneNumber}</a>
                      </Descriptions.Item>
                      <Descriptions.Item label="Address">
                        {customer.address}
                      </Descriptions.Item>
                      <Descriptions.Item label="Property ID">
                        {customer.propertyId || 'N/A'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Customer Since">
                        {dayjs(customer.createdAt).format('MMMM DD, YYYY')}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'installments',
            label: 'Installments',
            children: (
              <Card>
                <Spin spinning={installmentsLoading}>
                  <Table
                    columns={[
                      { title: '#', dataIndex: 'sequence', key: 'sequence', width: 80 },
                      {
                        title: 'Due Date',
                        dataIndex: 'dueDate',
                        key: 'dueDate',
                        render: (date: string) => dayjs(date).format('MMMM DD, YYYY'),
                      },
                      {
                        title: 'Expected Amount',
                        dataIndex: 'expectedAmountMinor',
                        key: 'expectedAmountMinor',
                        render: (value: number) => <MoneyText minor={value} />,
                      },
                      {
                        title: 'Status',
                        dataIndex: 'isPaid',
                        key: 'isPaid',
                        render: (isPaid: boolean) => (
                          <Tag color={isPaid ? 'green' : 'red'}>
                            {isPaid ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                            {isPaid ? ' Paid' : ' Pending'}
                          </Tag>
                        ),
                      },
                      {
                        title: 'Paid Date',
                        dataIndex: 'paidAt',
                        key: 'paidAt',
                        render: (date: string) => date ? dayjs(date).format('MMMM DD, YYYY') : '-',
                      },
                    ]}
                    dataSource={installments as any[]}
                    rowKey="id"
                    pagination={false}
                    locale={{ emptyText: plan ? 'No installments found' : 'No payment plan attached' }}
                  />
                </Spin>
              </Card>
            ),
          },
          {
            key: 'payments',
            label: 'Payments',
            children: (
              <Card>
                <div style={{ marginBottom: 16 }}>
                  <Button 
                    type="primary" 
                    icon={<PlusOutlined />}
                    onClick={() => setRecordPaymentModal(true)}
                    disabled={isFullyPaid}
                  >
                    Record Payment
                  </Button>
                </div>
                <Table
                  columns={[
                    {
                      title: 'Date',
                      dataIndex: 'paidOn',
                      key: 'paidOn',
                      render: (date: string) => dayjs(date).format('MMMM DD, YYYY'),
                    },
                    {
                      title: 'Amount',
                      dataIndex: 'amountMinor',
                      key: 'amountMinor',
                      render: (value: number) => <MoneyText minor={value} />,
                    },
                    {
                      title: 'Method',
                      dataIndex: 'method',
                      key: 'method',
                      render: (method: string) => (
                        <Tag color={method === 'bank_transfer' ? 'blue' : method === 'mobile_money' ? 'green' : 'default'}>
                          {method.replace('_', ' ').toUpperCase()}
                        </Tag>
                      ),
                    },
                    { title: 'Reference', dataIndex: 'reference', key: 'reference' },
                    {
                      title: 'Recorded By',
                      dataIndex: 'recordedByUserId',
                      key: 'recordedByUserId',
                      render: (id: string) => `User #${id}`,
                    },
                  ]}
                  dataSource={plan?.payments || []}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                />
              </Card>
            ),
          },
          {
            key: 'deeds',
            label: 'Deeds',
            children: (
              <Card>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={handleGenerateDeed}
                  style={{ marginBottom: 16 }}
                >
                  Generate Deed
                </Button>
                <Empty description="No deeds generated yet">
                  <Button type="primary" onClick={handleGenerateDeed}>
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
        title="Record Payment"
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
          <Form.Item
            name="amountGHS"
            label="Amount (GHS)"
            rules={[{ required: true, message: 'Please enter amount' }]}
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
            <DatePicker style={{ width: '100%' }} />
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
                loading={recordPaymentMutation.isPending}
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
    </div>
  );
};