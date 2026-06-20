// src/pages/customers/CustomersPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Space, Modal, Form, Input, Select, Row, Col, Table,
  Tag, message, Typography, Card, Avatar, Badge, Tooltip,
  DatePicker, Statistic, Divider, Empty, Dropdown, Popconfirm,
  Alert, Drawer, Descriptions, Timeline, Tabs, Progress,
  Radio, Switch, InputNumber, Upload, List, Collapse
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
  ApartmentOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusTag } from '@/components/shared/StatusTag';
import { MoneyText } from '@/components/shared/MoneyText';
import { ProgressCell } from '@/components/shared/ProgressCell';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { tokens } from '@/constants/tokens';
import { customerTypeLabels, paymentPlanStatusLabels } from '@/constants/enums';
import type { Customer, PaymentPlan, CustomerType, ProgressBand } from '@/types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import advancedFormat from 'dayjs/plugin/advancedFormat';

dayjs.extend(relativeTime);
dayjs.extend(advancedFormat);

const { Option } = Select;
const { TextArea } = Input;
const { Text, Title } = Typography;

// Mock Customers Data
const mockCustomers: Customer[] = [
  {
    id: 'c1',
    prospectId: 'p1',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+233241234567',
    address: '123 Main St, Accra, Ghana',
    type: 'payment_plan',
    propertyId: 'prop1',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z',
  },
  {
    id: 'c2',
    prospectId: 'p2',
    firstName: 'Jane',
    lastName: 'Smith',
    phoneNumber: '+233241234568',
    address: '456 Independence Ave, Kumasi, Ghana',
    type: 'fully_paid',
    propertyId: 'prop2',
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-01-18T16:20:00Z',
  },
  {
    id: 'c3',
    prospectId: 'p3',
    firstName: 'Michael',
    lastName: 'Johnson',
    phoneNumber: '+233241234569',
    address: '789 Liberation Rd, Tema, Ghana',
    type: 'payment_plan',
    propertyId: 'prop3',
    createdAt: '2024-01-08T11:30:00Z',
    updatedAt: '2024-01-15T08:45:00Z',
  },
  {
    id: 'c4',
    prospectId: 'p4',
    firstName: 'Sarah',
    lastName: 'Williams',
    phoneNumber: '+233241234570',
    address: '321 Castle Rd, Cape Coast, Ghana',
    type: 'payment_plan',
    propertyId: 'prop4',
    createdAt: '2024-01-05T14:15:00Z',
    updatedAt: '2024-01-12T10:00:00Z',
  },
  {
    id: 'c5',
    prospectId: 'p5',
    firstName: 'Robert',
    lastName: 'Brown',
    phoneNumber: '+233241234571',
    address: '654 Ocean Dr, Takoradi, Ghana',
    type: 'fully_paid',
    propertyId: 'prop5',
    createdAt: '2024-01-03T08:00:00Z',
    updatedAt: '2024-01-10T11:30:00Z',
  },
  {
    id: 'c6',
    prospectId: 'p6',
    firstName: 'Emily',
    lastName: 'Davis',
    phoneNumber: '+233241234572',
    address: '987 Park Ave, Accra, Ghana',
    type: 'payment_plan',
    propertyId: 'prop6',
    createdAt: '2024-01-01T16:45:00Z',
    updatedAt: '2024-01-08T09:15:00Z',
  },
];

// Mock Payment Plans
const mockPaymentPlans: Record<string, PaymentPlan> = {
  'c1': {
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
    status: 'active',
    progressPercent: 25,
    progressBand: 'red',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z',
  },
  'c3': {
    id: 'pp3',
    customerId: 'c3',
    propertyId: 'prop3',
    totalAmountMinor: 20000000,
    downPaymentMinor: 5000000,
    balanceMinor: 15000000,
    numMonths: 24,
    monthlyAmountMinor: 625000,
    currency: 'GHS',
    startDate: '2024-01-08',
    status: 'active',
    progressPercent: 15,
    progressBand: 'red',
    createdAt: '2024-01-08T11:30:00Z',
    updatedAt: '2024-01-15T08:45:00Z',
  },
  'c4': {
    id: 'pp4',
    customerId: 'c4',
    propertyId: 'prop4',
    totalAmountMinor: 10000000,
    downPaymentMinor: 2000000,
    balanceMinor: 8000000,
    numMonths: 10,
    monthlyAmountMinor: 800000,
    currency: 'GHS',
    startDate: '2024-01-05',
    status: 'active',
    progressPercent: 60,
    progressBand: 'yellow',
    createdAt: '2024-01-05T14:15:00Z',
    updatedAt: '2024-01-12T10:00:00Z',
  },
  'c6': {
    id: 'pp6',
    customerId: 'c6',
    propertyId: 'prop6',
    totalAmountMinor: 12000000,
    downPaymentMinor: 2400000,
    balanceMinor: 9600000,
    numMonths: 18,
    monthlyAmountMinor: 533333,
    currency: 'GHS',
    startDate: '2024-01-01',
    status: 'defaulted',
    progressPercent: 30,
    progressBand: 'red',
    createdAt: '2024-01-01T16:45:00Z',
    updatedAt: '2024-01-08T09:15:00Z',
  },
};

// Mock Properties
const mockProperties: Record<string, { houseNumber: string; offerNumber: string; priceMinor: number }> = {
  'prop1': { houseNumber: 'H-102', offerNumber: 'OF-2024-001', priceMinor: 15000000 },
  'prop2': { houseNumber: 'H-205', offerNumber: 'OF-2024-002', priceMinor: 18000000 },
  'prop3': { houseNumber: 'H-301', offerNumber: 'OF-2024-003', priceMinor: 20000000 },
  'prop4': { houseNumber: 'H-108', offerNumber: 'OF-2024-004', priceMinor: 10000000 },
  'prop5': { houseNumber: 'H-412', offerNumber: 'OF-2024-005', priceMinor: 25000000 },
  'prop6': { houseNumber: 'H-203', offerNumber: 'OF-2024-006', priceMinor: 12000000 },
};

// Mock Prospects for dropdown
const mockProspects = [
  { id: 'p1', name: 'John Doe (Prospect)', phone: '+233241234567' },
  { id: 'p2', name: 'Jane Smith (Prospect)', phone: '+233241234568' },
  { id: 'p3', name: 'Michael Johnson (Prospect)', phone: '+233241234569' },
];

// Helper function to calculate progress band
const getProgressBand = (percent: number): ProgressBand => {
  if (percent >= 90) return 'green';
  if (percent >= 70) return 'light_green';
  if (percent >= 50) return 'yellow';
  return 'red';
};

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // States
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>(mockCustomers);
  const [paymentPlans, setPaymentPlans] = useState<Record<string, PaymentPlan>>(mockPaymentPlans);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [editPaymentPlan, setEditPaymentPlan] = useState<PaymentPlan | null>(null);
  const [editPaymentBasis, setEditPaymentBasis] = useState<'months' | 'monthly'>('months');
  const [form] = Form.useForm();
  const [addForm] = Form.useForm();

  // Export states
  const [exportModal, setExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv' | 'pdf' | 'json'>('excel');
  const [exportLoading, setExportLoading] = useState(false);

  // Calculate payment plan details dynamically
  const calculatePaymentPlan = (values: any) => {
    const totalAmountMinor = Math.round((values.totalAmount || 0) * 100);
    const downPaymentMinor = Math.round((values.downPayment || 0) * 100);
    const balanceMinor = totalAmountMinor - downPaymentMinor;
    let numMonths = values.numMonths || 0;
    let monthlyAmountMinor = 0;

    if (values.paymentBasis === 'months') {
      numMonths = values.numMonths || 1;
      monthlyAmountMinor = Math.ceil(balanceMinor / numMonths);
    } else {
      monthlyAmountMinor = Math.round((values.monthlyAmount || 0) * 100);
      numMonths = Math.ceil(balanceMinor / monthlyAmountMinor);
    }

    // Calculate progress based on down payment
    const paidSoFar = downPaymentMinor;
    const progressPercent = Math.round((paidSoFar / totalAmountMinor) * 100);
    const progressBand = getProgressBand(progressPercent);

    return {
      totalAmountMinor,
      downPaymentMinor,
      balanceMinor,
      numMonths,
      monthlyAmountMinor,
      progressPercent,
      progressBand,
    };
  };

  // Get customer type display
  const getCustomerTypeDisplay = (type: CustomerType) => {
    return customerTypeLabels[type] || type;
  };

  const getCustomerTypeColor = (type: CustomerType) => {
    return type === 'payment_plan' ? 'blue' : 'green';
  };

  // Get payment plan for customer
  const getPaymentPlan = (customerId: string): PaymentPlan | null => {
    return paymentPlans[customerId] || null;
  };

  // Get property details
  const getPropertyDetails = (propertyId: string) => {
    return mockProperties[propertyId] || null;
  };

  // Add Customer with Payment Plan
  const handleAddCustomer = (values: any) => {
    setLoading(true);
    setTimeout(() => {
      const customerId = `c${Date.now()}`;
      
      // Create customer
      const newCustomer: Customer = {
        id: customerId,
        prospectId: values.prospectId || `p${Date.now()}`,
        firstName: values.firstName,
        lastName: values.lastName,
        phoneNumber: values.phoneNumber,
        address: values.address,
        type: values.type,
        propertyId: values.propertyId || 'prop1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // If payment plan, create payment plan
      if (values.type === 'payment_plan') {
        const planData = calculatePaymentPlan(values);
        const newPlan: PaymentPlan = {
          id: `pp${Date.now()}`,
          customerId: customerId,
          propertyId: values.propertyId || 'prop1',
          totalAmountMinor: planData.totalAmountMinor,
          downPaymentMinor: planData.downPaymentMinor,
          balanceMinor: planData.balanceMinor,
          numMonths: planData.numMonths,
          monthlyAmountMinor: planData.monthlyAmountMinor,
          currency: 'GHS',
          startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
          status: 'active',
          progressPercent: planData.progressPercent,
          progressBand: planData.progressBand,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setPaymentPlans({ ...paymentPlans, [customerId]: newPlan });
      }

      setCustomers([newCustomer, ...customers]);
      setLoading(false);
      setAddModal(false);
      addForm.resetFields();
      message.success(`Customer ${newCustomer.firstName} ${newCustomer.lastName} added successfully!`);
    }, 800);
  };

  // Export function
  const handleExport = () => {
    setExportLoading(true);
    const dataToExport = filteredCustomers.map(customer => {
      const plan = getPaymentPlan(customer.id);
      const property = getPropertyDetails(customer.propertyId);
      return {
        'Full Name': `${customer.firstName} ${customer.lastName}`,
        'Phone': customer.phoneNumber,
        'Address': customer.address,
        'Type': getCustomerTypeDisplay(customer.type),
        'Property': property ? `${property.houseNumber} - ${property.offerNumber}` : 'N/A',
        'Property Price': property ? `GHS ${(property.priceMinor / 100).toLocaleString()}` : 'N/A',
        'Plan Status': plan ? paymentPlanStatusLabels[plan.status] : 'N/A',
        'Progress': plan ? `${plan.progressPercent}%` : 'N/A',
        'Total Amount': plan ? `GHS ${(plan.totalAmountMinor / 100).toLocaleString()}` : 'N/A',
        'Down Payment': plan ? `GHS ${(plan.downPaymentMinor / 100).toLocaleString()}` : 'N/A',
        'Balance': plan ? `GHS ${(plan.balanceMinor / 100).toLocaleString()}` : 'N/A',
        'Monthly Amount': plan ? `GHS ${(plan.monthlyAmountMinor / 100).toLocaleString()}` : 'N/A',
        'Months': plan ? plan.numMonths : 'N/A',
        'Start Date': plan ? plan.startDate : 'N/A',
        'Created': dayjs(customer.createdAt).format('YYYY-MM-DD'),
      };
    });

    let fileName = `customers-${dayjs().format('YYYY-MM-DD-HHmmss')}`;
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
      message.success(`Exported ${dataToExport.length} customers as ${exportFormat.toUpperCase()}!`);
    }, 1000);
  };

  // Filter customers
  const filteredCustomers = customers.filter(customer => {
    const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchText.toLowerCase()) ||
                          customer.phoneNumber.includes(searchText) ||
                          customer.address.toLowerCase().includes(searchText.toLowerCase());
    const matchesType = typeFilter === 'all' || customer.type === typeFilter;
    const matchesTab = activeTab === 'all' || customer.type === activeTab;
    return matchesSearch && matchesType && matchesTab;
  });

  // Stats
  const stats = {
    total: customers.length,
    paymentPlan: customers.filter(c => c.type === 'payment_plan').length,
    fullyPaid: customers.filter(c => c.type === 'fully_paid').length,
    activePlans: Object.values(paymentPlans).filter(p => p.status === 'active').length,
    defaultedPlans: Object.values(paymentPlans).filter(p => p.status === 'defaulted').length,
    completedPlans: Object.values(paymentPlans).filter(p => p.status === 'completed').length,
  };

  // Table Columns
  const columns = [
    {
      title: 'Customer',
      key: 'customer',
      width: 220,
      render: (_: any, record: Customer) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: tokens.primary }} />
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
      title: 'Property',
      key: 'property',
      width: 150,
      render: (_: any, record: Customer) => {
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
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 130,
      render: (type: CustomerType) => (
        <Tag color={getCustomerTypeColor(type)}>
          {getCustomerTypeDisplay(type)}
        </Tag>
      ),
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 180,
      render: (_: any, record: Customer) => {
        if (record.type === 'fully_paid') {
          return <Tag color="green"><CheckCircleOutlined /> Fully Paid</Tag>;
        }
        const plan = getPaymentPlan(record.id);
        if (plan) {
          return (
            <ProgressCell 
              percent={plan.progressPercent} 
              band={plan.progressBand} 
            />
          );
        }
        return <Text type="secondary">No plan</Text>;
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 140,
      render: (_: any, record: Customer) => {
        if (record.type === 'fully_paid') {
          return <Tag color="green">Completed</Tag>;
        }
        const plan = getPaymentPlan(record.id);
        if (plan) {
          return <StatusTag status={plan.status} type="paymentPlan" />;
        }
        return <Tag>No plan</Tag>;
      },
    },
    {
      title: 'Monthly Amount',
      key: 'monthlyAmount',
      width: 140,
      render: (_: any, record: Customer) => {
        if (record.type === 'fully_paid') {
          return <Text type="secondary">N/A</Text>;
        }
        const plan = getPaymentPlan(record.id);
        if (plan) {
          return <MoneyText minor={plan.monthlyAmountMinor} />;
        }
        return <Text type="secondary">N/A</Text>;
      },
    },
    {
      title: 'Balance',
      key: 'balance',
      width: 140,
      render: (_: any, record: Customer) => {
        if (record.type === 'fully_paid') {
          return <Text type="secondary">N/A</Text>;
        }
        const plan = getPaymentPlan(record.id);
        if (plan) {
          return <MoneyText minor={plan.balanceMinor} />;
        }
        return <Text type="secondary">N/A</Text>;
      },
    },
    {
      title: 'Joined',
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
      width: 160,
      fixed: 'right' as const,
      render: (_: any, record: Customer) => (
        <Space>
          <Tooltip title="View Details">
            <Button 
              type="primary"
              ghost
              icon={<EyeOutlined />} 
              onClick={() => {
                setSelectedCustomer(record);
                setViewDrawerOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button 
              icon={<EditOutlined />} 
              onClick={() => {
                setSelectedCustomer(record);
                const plan = getPaymentPlan(record.id);
                setEditPaymentPlan(plan || null);
                
                // Set form values
                form.setFieldsValue({
                  firstName: record.firstName,
                  lastName: record.lastName,
                  phoneNumber: record.phoneNumber,
                  address: record.address,
                  type: record.type,
                  propertyId: record.propertyId,
                });
                
                // If payment plan exists, set payment plan values
                if (plan) {
                  form.setFieldsValue({
                    totalAmount: plan.totalAmountMinor / 100,
                    downPayment: plan.downPaymentMinor / 100,
                    paymentBasis: 'months',
                    numMonths: plan.numMonths,
                    monthlyAmount: plan.monthlyAmountMinor / 100,
                    startDate: dayjs(plan.startDate),
                    planStatus: plan.status,
                  });
                  setEditPaymentBasis('months');
                }
                
                setEditModal(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Customer"
            description={`Are you sure you want to delete ${record.firstName} ${record.lastName}?`}
            onConfirm={() => {
              setCustomers(customers.filter(c => c.id !== record.id));
              // Also remove payment plan if exists
              const newPaymentPlans = { ...paymentPlans };
              delete newPaymentPlans[record.id];
              setPaymentPlans(newPaymentPlans);
              message.success('Customer deleted successfully!');
            }}
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
    if (!selectedCustomer) return null;

    const plan = getPaymentPlan(selectedCustomer.id);
    const property = getPropertyDetails(selectedCustomer.propertyId);
    const isFullyPaid = selectedCustomer.type === 'fully_paid';

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
                {selectedCustomer.firstName} {selectedCustomer.lastName}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <IdcardOutlined /> ID: {selectedCustomer.id}
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

        {/* Customer Type Banner */}
        <div style={{
          background: isFullyPaid ? '#f6ffed' : '#e6f7ff',
          border: `1px solid ${isFullyPaid ? '#b7eb8f' : '#91d5ff'}`,
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Space>
            {isFullyPaid ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <BankOutlined style={{ color: '#1890ff' }} />}
            <Text strong>{isFullyPaid ? 'Fully Paid Customer' : 'Payment Plan Customer'}</Text>
          </Space>
          {!isFullyPaid && plan && (
            <Tag color={plan.status === 'active' ? 'green' : plan.status === 'defaulted' ? 'red' : 'default'}>
              {paymentPlanStatusLabels[plan.status]}
            </Tag>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ marginBottom: 24 }}>
          <Space wrap>
            <Button 
              type="primary" 
              icon={<EditOutlined />}
              onClick={() => {
                setEditModal(true);
                const plan = getPaymentPlan(selectedCustomer.id);
                setEditPaymentPlan(plan || null);
                form.setFieldsValue({
                  firstName: selectedCustomer.firstName,
                  lastName: selectedCustomer.lastName,
                  phoneNumber: selectedCustomer.phoneNumber,
                  address: selectedCustomer.address,
                  type: selectedCustomer.type,
                  propertyId: selectedCustomer.propertyId,
                });
                if (plan) {
                  form.setFieldsValue({
                    totalAmount: plan.totalAmountMinor / 100,
                    downPayment: plan.downPaymentMinor / 100,
                    paymentBasis: 'months',
                    numMonths: plan.numMonths,
                    monthlyAmount: plan.monthlyAmountMinor / 100,
                    startDate: dayjs(plan.startDate),
                    planStatus: plan.status,
                  });
                }
                setViewDrawerOpen(false);
              }}
            >
              Edit Customer
            </Button>
            <Button icon={<PhoneOutlined />}>
              Call
            </Button>
            <Button icon={<MessageOutlined />}>
              Message
            </Button>
            {!isFullyPaid && plan && (
              <Button icon={<FileOutlined />}>
                View Plan
              </Button>
            )}
          </Space>
        </div>

        {/* Customer Info */}
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card size="small" title="Personal Information" bordered={false} style={{ background: '#fafafa' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label={<Space><UserOutlined /> Full Name</Space>}>
                  <Text strong>{selectedCustomer.firstName} {selectedCustomer.lastName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Space><PhoneOutlined /> Phone</Space>}>
                  <a href={`tel:${selectedCustomer.phoneNumber}`}>
                    {selectedCustomer.phoneNumber}
                  </a>
                </Descriptions.Item>
                <Descriptions.Item label={<Space><EnvironmentOutlined /> Address</Space>}>
                  {selectedCustomer.address}
                </Descriptions.Item>
                <Descriptions.Item label={<Space><HomeOutlined /> Property</Space>}>
                  {property ? `${property.houseNumber} - ${property.offerNumber}` : 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label={<Space><DollarOutlined /> Price</Space>}>
                  {property ? <MoneyText minor={property.priceMinor} /> : 'N/A'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {/* Payment Plan Details */}
        {plan && (
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={24}>
              <Card size="small" title="Payment Plan Details" bordered={false} style={{ background: '#fafafa' }}>
                <div style={{ marginBottom: 16 }}>
                  <ProgressCell percent={plan.progressPercent} band={plan.progressBand} />
                </div>
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="Total Amount">
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
                </Descriptions>
              </Card>
            </Col>
          </Row>
        )}

        {/* Timeline */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card size="small" title="Activity Timeline" bordered={false} style={{ background: '#fafafa' }}>
              <Timeline>
                <Timeline.Item color="blue">
                  <Text>Customer created</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(selectedCustomer.createdAt).format('MMMM DD, YYYY HH:mm')}
                  </Text>
                </Timeline.Item>
                {plan && (
                  <Timeline.Item color={plan.status === 'active' ? 'green' : 'red'}>
                    <Text>Payment plan {plan.status}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {plan.progressPercent}% complete
                    </Text>
                  </Timeline.Item>
                )}
                <Timeline.Item color="gray">
                  <Text>Last updated {dayjs(selectedCustomer.updatedAt).fromNow()}</Text>
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
            onClick={() => navigate(`/customers/${selectedCustomer.id}`)}
          >
            View Full Details
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden', padding: '0 4px' }}>
      <PageHeader
        title="Customers"
        actions={[
          {
            label: 'Add Customer',
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
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Total Customers"
              value={stats.total}
              prefix={<UserOutlined />}
              valueStyle={{ color: tokens.primary }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Payment Plans"
              value={stats.paymentPlan}
              prefix={<BankOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Fully Paid"
              value={stats.fullyPaid}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Active Plans"
              value={stats.activePlans}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Defaulted"
              value={stats.defaultedPlans}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card size="small">
            <Statistic
              title="Completed"
              value={stats.completedPlans}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabs and Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Input
              placeholder="Search by name, phone, or address"
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
              <Option value="payment_plan">Payment Plan</Option>
              <Option value="fully_paid">Fully Paid</Option>
            </Select>
          </Col>
          <Col xs={12} md={10}>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                { key: 'all', label: 'All' },
                { key: 'payment_plan', label: 'Payment Plans' },
                { key: 'fully_paid', label: 'Fully Paid' },
              ]}
            />
          </Col>
          <Col xs={24} md={4}>
            <Text type="secondary" style={{ display: 'block', textAlign: 'right' }}>
              Total: {filteredCustomers.length} customers
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <Table
          columns={columns}
          dataSource={filteredCustomers}
          rowKey="id"
          loading={loading}
          size="middle"
          scroll={{ x: 1300 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} customers`,
            responsive: true,
          }}
        />
      </div>

      {/* Add Customer Modal with Payment Plan */}
      <Modal
        title={
          <Space>
            <PlusOutlined style={{ color: tokens.primary }} />
            <Text strong>Add New Customer</Text>
          </Space>
        }
        open={addModal}
        onCancel={() => {
          setAddModal(false);
          addForm.resetFields();
        }}
        footer={null}
        width={700}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px', maxHeight: '70vh', overflowY: 'auto' }}
      >
        <Form
          form={addForm}
          layout="vertical"
          onFinish={handleAddCustomer}
          initialValues={{ type: 'payment_plan', paymentBasis: 'months' }}
        >
          <Form.Item
            name="prospectId"
            label="Convert from Prospect (Optional)"
          >
            <Select placeholder="Select a prospect to convert" allowClear>
              {mockProspects.map(p => (
                <Option key={p.id} value={p.id}>
                  {p.name} - {p.phone}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Divider>Customer Information</Divider>

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
            name="phoneNumber"
            label="Phone Number"
            rules={[{ required: true, message: 'Phone number is required' }]}
          >
            <PhoneInput />
          </Form.Item>

          <Form.Item
            name="address"
            label="Address"
            rules={[{ required: true, message: 'Address is required' }]}
          >
            <TextArea rows={2} placeholder="Full address" />
          </Form.Item>

          <Form.Item
            name="type"
            label="Customer Type"
            rules={[{ required: true, message: 'Customer type is required' }]}
          >
            <Select placeholder="Select customer type">
              <Option value="payment_plan">Payment Plan</Option>
              <Option value="fully_paid">Fully Paid</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="propertyId"
            label="Property"
            rules={[{ required: true, message: 'Property is required' }]}
          >
            <Select placeholder="Select property">
              {Object.entries(mockProperties).map(([id, prop]) => (
                <Option key={id} value={id}>
                  {prop.houseNumber} - {prop.offerNumber} (GHS {(prop.priceMinor / 100).toLocaleString()})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Divider>Payment Plan Details</Divider>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.type !== curr.type}>
            {({ getFieldValue }) => {
              const type = getFieldValue('type');
              if (type !== 'payment_plan') {
                return null;
              }
              return (
                <>
                  <Row gutter={[8, 0]}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        name="totalAmount"
                        label="Total Property Price (GHS)"
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
                    name="paymentBasis"
                    label="Payment Basis"
                    rules={[{ required: true, message: 'Please select payment basis' }]}
                  >
                    <Select>
                      <Option value="months">Fixed Number of Months</Option>
                      <Option value="monthly">Fixed Monthly Amount</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item noStyle shouldUpdate={(prev, curr) => prev.paymentBasis !== curr.paymentBasis}>
                    {({ getFieldValue }) => {
                      const basis = getFieldValue('paymentBasis');
                      if (basis === 'months') {
                        return (
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
                        );
                      }
                      return (
                        <Form.Item
                          name="monthlyAmount"
                          label="Monthly Amount (GHS)"
                          rules={[{ required: true, message: 'Monthly amount is required' }]}
                        >
                          <InputNumber
                            style={{ width: '100%' }}
                            prefix="GHS"
                            precision={2}
                            placeholder="e.g., 10000"
                            min={0}
                          />
                        </Form.Item>
                      );
                    }}
                  </Form.Item>

                  <Form.Item
                    name="startDate"
                    label="Start Date"
                    rules={[{ required: true, message: 'Start date is required' }]}
                  >
                    <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                  </Form.Item>

                  <Form.Item noStyle shouldUpdate={(prev, curr) => 
                    prev.totalAmount !== curr.totalAmount || 
                    prev.downPayment !== curr.downPayment ||
                    prev.paymentBasis !== curr.paymentBasis ||
                    prev.numMonths !== curr.numMonths ||
                    prev.monthlyAmount !== curr.monthlyAmount
                  }>
                    {({ getFieldValue }) => {
                      const totalAmount = getFieldValue('totalAmount') || 0;
                      const downPayment = getFieldValue('downPayment') || 0;
                      const totalMinor = Math.round(totalAmount * 100);
                      const downMinor = Math.round(downPayment * 100);
                      const balanceMinor = totalMinor - downMinor;
                      const basis = getFieldValue('paymentBasis');
                      let numMonths = 0;
                      let monthlyMinor = 0;

                      if (basis === 'months') {
                        numMonths = getFieldValue('numMonths') || 0;
                        monthlyMinor = numMonths > 0 ? Math.ceil(balanceMinor / numMonths) : 0;
                      } else {
                        monthlyMinor = Math.round((getFieldValue('monthlyAmount') || 0) * 100);
                        numMonths = monthlyMinor > 0 ? Math.ceil(balanceMinor / monthlyMinor) : 0;
                      }

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
                              <Text type="secondary">Total Amount</Text>
                              <div><MoneyText minor={totalMinor} /></div>
                            </Col>
                            <Col span={12}>
                              <Text type="secondary">Down Payment</Text>
                              <div><MoneyText minor={downMinor} /></div>
                            </Col>
                            <Col span={12}>
                              <Text type="secondary">Balance</Text>
                              <div><MoneyText minor={balanceMinor} /></div>
                            </Col>
                            <Col span={12}>
                              <Text type="secondary">Monthly Amount</Text>
                              <div><MoneyText minor={monthlyMinor} /></div>
                            </Col>
                            <Col span={12}>
                              <Text type="secondary">Number of Months</Text>
                              <div><Text strong>{numMonths}</Text></div>
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
                </>
              );
            }}
          </Form.Item>

          <Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit" loading={loading}>
                Add Customer
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

      {/* Enhanced Edit Modal with Fully Paid Handling */}
      <Modal
        title={
          <Space>
            <EditOutlined style={{ color: tokens.primary }} />
            <Text strong>Edit Customer & Payment Plan</Text>
          </Space>
        }
        open={editModal}
        onCancel={() => {
          setEditModal(false);
          setSelectedCustomer(null);
          setEditPaymentPlan(null);
          form.resetFields();
        }}
        footer={null}
        width={700}
        style={{ maxWidth: '95%', top: 20 }}
        bodyStyle={{ padding: '16px', maxHeight: '70vh', overflowY: 'auto' }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            if (selectedCustomer) {
              // Update customer
              const updatedCustomer = {
                ...selectedCustomer,
                ...values,
                updatedAt: new Date().toISOString(),
              };
              
              // If customer type is fully_paid, remove payment plan and set to completed
              if (values.type === 'fully_paid') {
                // Remove payment plan if exists
                const newPaymentPlans = { ...paymentPlans };
                delete newPaymentPlans[selectedCustomer.id];
                setPaymentPlans(newPaymentPlans);
                setEditPaymentPlan(null);
                
                // Update customer
                setCustomers(customers.map(c => 
                  c.id === selectedCustomer.id ? updatedCustomer : c
                ));
                
                setEditModal(false);
                setSelectedCustomer(null);
                setEditPaymentPlan(null);
                form.resetFields();
                message.success('Customer marked as Fully Paid! Payment plan removed.');
                return;
              }
              
              // If payment plan exists and type is payment_plan, update it
              if (values.type === 'payment_plan') {
                // Check if we have a payment plan, if not create one
                const totalAmountMinor = Math.round((values.totalAmount || 0) * 100);
                const downPaymentMinor = Math.round((values.downPayment || 0) * 100);
                const balanceMinor = totalAmountMinor - downPaymentMinor;
                let numMonths = values.numMonths || 0;
                let monthlyAmountMinor = 0;

                if (values.paymentBasis === 'months') {
                  numMonths = values.numMonths || 1;
                  monthlyAmountMinor = Math.ceil(balanceMinor / numMonths);
                } else {
                  monthlyAmountMinor = Math.round((values.monthlyAmount || 0) * 100);
                  numMonths = Math.ceil(balanceMinor / monthlyAmountMinor);
                }

                const paidSoFar = downPaymentMinor;
                const progressPercent = Math.round((paidSoFar / totalAmountMinor) * 100);
                const progressBand = getProgressBand(progressPercent);

                // If balance is 0, mark as completed
                const planStatus = balanceMinor === 0 ? 'completed' : (values.planStatus || 'active');

                if (editPaymentPlan) {
                  // Update existing plan
                  const updatedPlan: PaymentPlan = {
                    ...editPaymentPlan,
                    totalAmountMinor,
                    downPaymentMinor,
                    balanceMinor,
                    numMonths,
                    monthlyAmountMinor,
                    startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : editPaymentPlan.startDate,
                    status: planStatus,
                    progressPercent,
                    progressBand,
                    updatedAt: new Date().toISOString(),
                  };
                  setPaymentPlans({ ...paymentPlans, [selectedCustomer.id]: updatedPlan });
                } else {
                  // Create new plan
                  const newPlan: PaymentPlan = {
                    id: `pp${Date.now()}`,
                    customerId: selectedCustomer.id,
                    propertyId: selectedCustomer.propertyId,
                    totalAmountMinor,
                    downPaymentMinor,
                    balanceMinor,
                    numMonths,
                    monthlyAmountMinor,
                    currency: 'GHS',
                    startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
                    status: planStatus,
                    progressPercent,
                    progressBand,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };
                  setPaymentPlans({ ...paymentPlans, [selectedCustomer.id]: newPlan });
                }
              }

              setCustomers(customers.map(c => 
                c.id === selectedCustomer.id ? updatedCustomer : c
              ));

              setEditModal(false);
              setSelectedCustomer(null);
              setEditPaymentPlan(null);
              form.resetFields();
              message.success('Customer updated successfully!');
            }
          }}
          initialValues={{
            firstName: selectedCustomer?.firstName,
            lastName: selectedCustomer?.lastName,
            phoneNumber: selectedCustomer?.phoneNumber,
            address: selectedCustomer?.address,
            type: selectedCustomer?.type,
            propertyId: selectedCustomer?.propertyId,
          }}
        >
          <Tabs
            items={[
              {
                key: 'customer',
                label: 'Customer Information',
                children: (
                  <>
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
                      name="phoneNumber"
                      label="Phone Number"
                      rules={[{ required: true, message: 'Phone number is required' }]}
                    >
                      <PhoneInput />
                    </Form.Item>

                    <Form.Item
                      name="address"
                      label="Address"
                      rules={[{ required: true, message: 'Address is required' }]}
                    >
                      <TextArea rows={2} placeholder="Full address" />
                    </Form.Item>

                    <Form.Item
                      name="propertyId"
                      label="Property"
                      rules={[{ required: true, message: 'Property is required' }]}
                    >
                      <Select placeholder="Select property">
                        {Object.entries(mockProperties).map(([id, prop]) => (
                          <Option key={id} value={id}>
                            {prop.houseNumber} - {prop.offerNumber} (GHS {(prop.priceMinor / 100).toLocaleString()})
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>

                    <Form.Item
                      name="type"
                      label="Customer Type"
                      rules={[{ required: true, message: 'Customer type is required' }]}
                    >
                      <Select 
                        placeholder="Select customer type"
                        onChange={(value) => {
                          if (value === 'fully_paid') {
                            // If switching to fully paid, show confirmation
                            Modal.confirm({
                              title: 'Mark as Fully Paid',
                              content: 'This will remove the payment plan and mark the customer as fully paid. Continue?',
                              okText: 'Yes, Mark as Fully Paid',
                              okType: 'primary',
                              cancelText: 'Cancel',
                              onOk: () => {
                                // Clear payment plan fields
                                form.setFieldsValue({
                                  totalAmount: undefined,
                                  downPayment: undefined,
                                  paymentBasis: 'months',
                                  numMonths: undefined,
                                  monthlyAmount: undefined,
                                  startDate: undefined,
                                  planStatus: undefined,
                                });
                                setEditPaymentPlan(null);
                                message.info('Customer will be marked as fully paid');
                              },
                            });
                          } else if (value === 'payment_plan' && selectedCustomer) {
                            // If switching to payment plan, load existing or create new
                            const existingPlan = getPaymentPlan(selectedCustomer.id);
                            if (existingPlan) {
                              setEditPaymentPlan(existingPlan);
                              form.setFieldsValue({
                                totalAmount: existingPlan.totalAmountMinor / 100,
                                downPayment: existingPlan.downPaymentMinor / 100,
                                paymentBasis: 'months',
                                numMonths: existingPlan.numMonths,
                                monthlyAmount: existingPlan.monthlyAmountMinor / 100,
                                startDate: dayjs(existingPlan.startDate),
                                planStatus: existingPlan.status,
                              });
                            } else {
                              // Create default plan
                              const defaultPlan: PaymentPlan = {
                                id: `pp${Date.now()}`,
                                customerId: selectedCustomer.id,
                                propertyId: selectedCustomer.propertyId,
                                totalAmountMinor: 0,
                                downPaymentMinor: 0,
                                balanceMinor: 0,
                                numMonths: 12,
                                monthlyAmountMinor: 0,
                                currency: 'GHS',
                                startDate: dayjs().format('YYYY-MM-DD'),
                                status: 'active',
                                progressPercent: 0,
                                progressBand: 'red',
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                              };
                              setEditPaymentPlan(defaultPlan);
                            }
                          }
                        }}
                      >
                        <Option value="payment_plan">Payment Plan</Option>
                        <Option value="fully_paid">Fully Paid</Option>
                      </Select>
                    </Form.Item>
                  </>
                ),
              },
              {
                key: 'payment',
                label: 'Payment Plan',
                children: (
                  <Form.Item noStyle shouldUpdate={(prev, curr) => prev.type !== curr.type}>
                    {({ getFieldValue }) => {
                      const type = getFieldValue('type');
                      if (type !== 'payment_plan') {
                        return (
                          <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
                            <Title level={4} style={{ marginTop: 16 }}>Fully Paid Customer</Title>
                            <Text type="secondary">No payment plan required for fully paid customers</Text>
                            <div style={{ marginTop: 16 }}>
                              <Tag color="green" style={{ fontSize: 16, padding: '4px 16px' }}>
                                <CheckCircleOutlined /> Status: Fully Paid
                              </Tag>
                            </div>
                          </div>
                        );
                      }

                      // If no payment plan exists, create a default one
                      if (!editPaymentPlan && selectedCustomer) {
                        const defaultPlan = {
                          id: `pp${Date.now()}`,
                          customerId: selectedCustomer.id,
                          propertyId: selectedCustomer.propertyId,
                          totalAmountMinor: 0,
                          downPaymentMinor: 0,
                          balanceMinor: 0,
                          numMonths: 12,
                          monthlyAmountMinor: 0,
                          currency: 'GHS',
                          startDate: dayjs().format('YYYY-MM-DD'),
                          status: 'active' as const,
                          progressPercent: 0,
                          progressBand: 'red' as const,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        };
                        setEditPaymentPlan(defaultPlan);
                      }

                      return (
                        <>
                          <div style={{ 
                            background: '#e6f7ff', 
                            padding: '12px 16px', 
                            borderRadius: 8,
                            marginBottom: 16,
                            border: '1px solid #91d5ff'
                          }}>
                            <Space>
                              <InfoCircleOutlined style={{ color: '#1890ff' }} />
                              <Text>Update the payment plan details below. All calculations are automatic.</Text>
                            </Space>
                          </div>

                          <Row gutter={[8, 0]}>
                            <Col xs={24} sm={12}>
                              <Form.Item
                                name="totalAmount"
                                label="Total Property Price (GHS)"
                                rules={[{ required: true, message: 'Total amount is required' }]}
                              >
                                <InputNumber
                                  style={{ width: '100%' }}
                                  prefix="GHS"
                                  precision={2}
                                  placeholder="e.g., 150000"
                                  min={0}
                                  onChange={() => {
                                    // Trigger recalculation
                                    const total = form.getFieldValue('totalAmount') || 0;
                                    const down = form.getFieldValue('downPayment') || 0;
                                    if (total > 0 && down > 0) {
                                      const totalMinor = Math.round(total * 100);
                                      const downMinor = Math.round(down * 100);
                                      const progress = Math.round((downMinor / totalMinor) * 100);
                                      const band = getProgressBand(progress);
                                      if (editPaymentPlan) {
                                        setEditPaymentPlan({
                                          ...editPaymentPlan,
                                          totalAmountMinor: totalMinor,
                                          downPaymentMinor: downMinor,
                                          balanceMinor: totalMinor - downMinor,
                                          progressPercent: progress,
                                          progressBand: band,
                                        });
                                      }
                                    }
                                  }}
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
                                  onChange={() => {
                                    // Trigger recalculation
                                    const total = form.getFieldValue('totalAmount') || 0;
                                    const down = form.getFieldValue('downPayment') || 0;
                                    if (total > 0 && down > 0) {
                                      const totalMinor = Math.round(total * 100);
                                      const downMinor = Math.round(down * 100);
                                      const progress = Math.round((downMinor / totalMinor) * 100);
                                      const band = getProgressBand(progress);
                                      if (editPaymentPlan) {
                                        setEditPaymentPlan({
                                          ...editPaymentPlan,
                                          totalAmountMinor: totalMinor,
                                          downPaymentMinor: downMinor,
                                          balanceMinor: totalMinor - downMinor,
                                          progressPercent: progress,
                                          progressBand: band,
                                        });
                                      }
                                    }
                                  }}
                                />
                              </Form.Item>
                            </Col>
                          </Row>

                          <Form.Item
                            name="paymentBasis"
                            label="Payment Basis"
                            rules={[{ required: true, message: 'Please select payment basis' }]}
                          >
                            <Select 
                              onChange={(value) => {
                                setEditPaymentBasis(value);
                                if (value === 'months') {
                                  form.setFieldsValue({ monthlyAmount: undefined });
                                } else {
                                  form.setFieldsValue({ numMonths: undefined });
                                }
                              }}
                            >
                              <Option value="months">Fixed Number of Months</Option>
                              <Option value="monthly">Fixed Monthly Amount</Option>
                            </Select>
                          </Form.Item>

                          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.paymentBasis !== curr.paymentBasis}>
                            {({ getFieldValue }) => {
                              const basis = getFieldValue('paymentBasis');
                              if (basis === 'months') {
                                return (
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
                                      onChange={(value) => {
                                        if (editPaymentPlan && value) {
                                          const total = form.getFieldValue('totalAmount') || 0;
                                          const down = form.getFieldValue('downPayment') || 0;
                                          const totalMinor = Math.round(total * 100);
                                          const downMinor = Math.round(down * 100);
                                          const balanceMinor = totalMinor - downMinor;
                                          const monthlyMinor = Math.ceil(balanceMinor / value);
                                          setEditPaymentPlan({
                                            ...editPaymentPlan,
                                            numMonths: value,
                                            monthlyAmountMinor: monthlyMinor,
                                            balanceMinor: balanceMinor,
                                          });
                                        }
                                      }}
                                    />
                                  </Form.Item>
                                );
                              }
                              return (
                                <Form.Item
                                  name="monthlyAmount"
                                  label="Monthly Amount (GHS)"
                                  rules={[{ required: true, message: 'Monthly amount is required' }]}
                                >
                                  <InputNumber
                                    style={{ width: '100%' }}
                                    prefix="GHS"
                                    precision={2}
                                    placeholder="e.g., 10000"
                                    min={0}
                                    onChange={(value) => {
                                      if (editPaymentPlan && value) {
                                        const total = form.getFieldValue('totalAmount') || 0;
                                        const down = form.getFieldValue('downPayment') || 0;
                                        const totalMinor = Math.round(total * 100);
                                        const downMinor = Math.round(down * 100);
                                        const balanceMinor = totalMinor - downMinor;
                                        const monthlyMinor = Math.round(value * 100);
                                        const numMonths = Math.ceil(balanceMinor / monthlyMinor);
                                        setEditPaymentPlan({
                                          ...editPaymentPlan,
                                          monthlyAmountMinor: monthlyMinor,
                                          numMonths: numMonths,
                                          balanceMinor: balanceMinor,
                                        });
                                      }
                                    }}
                                  />
                                </Form.Item>
                              );
                            }}
                          </Form.Item>

                          <Row gutter={[8, 0]}>
                            <Col xs={24} sm={12}>
                              <Form.Item
                                name="startDate"
                                label="Start Date"
                                rules={[{ required: true, message: 'Start date is required' }]}
                              >
                                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                              </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                              <Form.Item
                                name="planStatus"
                                label="Plan Status"
                                rules={[{ required: true, message: 'Plan status is required' }]}
                              >
                                <Select placeholder="Select status">
                                  <Option value="active">Active</Option>
                                  <Option value="completed">Completed</Option>
                                  <Option value="defaulted">Defaulted</Option>
                                  <Option value="cancelled">Cancelled</Option>
                                </Select>
                              </Form.Item>
                            </Col>
                          </Row>

                          {/* Live Preview */}
                          <Form.Item noStyle shouldUpdate={(prev, curr) => 
                            prev.totalAmount !== curr.totalAmount || 
                            prev.downPayment !== curr.downPayment ||
                            prev.paymentBasis !== curr.paymentBasis ||
                            prev.numMonths !== curr.numMonths ||
                            prev.monthlyAmount !== curr.monthlyAmount
                          }>
                            {({ getFieldValue }) => {
                              const totalAmount = getFieldValue('totalAmount') || 0;
                              const downPayment = getFieldValue('downPayment') || 0;
                              const totalMinor = Math.round(totalAmount * 100);
                              const downMinor = Math.round(downPayment * 100);
                              const balanceMinor = totalMinor - downMinor;
                              const basis = getFieldValue('paymentBasis');
                              let numMonths = 0;
                              let monthlyMinor = 0;

                              if (basis === 'months') {
                                numMonths = getFieldValue('numMonths') || 0;
                                monthlyMinor = numMonths > 0 ? Math.ceil(balanceMinor / numMonths) : 0;
                              } else {
                                monthlyMinor = Math.round((getFieldValue('monthlyAmount') || 0) * 100);
                                numMonths = monthlyMinor > 0 ? Math.ceil(balanceMinor / monthlyMinor) : 0;
                              }

                              const progressPercent = totalMinor > 0 ? Math.round((downMinor / totalMinor) * 100) : 0;
                              const band = getProgressBand(progressPercent);
                              const isFullyPaid = balanceMinor === 0;

                              return (
                                <div style={{ 
                                  background: isFullyPaid ? '#f6ffed' : '#f5f7fa', 
                                  padding: 16, 
                                  borderRadius: 8,
                                  marginTop: 8,
                                  border: `1px solid ${isFullyPaid ? '#b7eb8f' : '#e8e8e8'}`
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Text strong>Payment Plan Preview</Text>
                                    {isFullyPaid ? (
                                      <Tag color="green">Fully Paid ✓</Tag>
                                    ) : (
                                      <Tag color="blue">Auto-calculated</Tag>
                                    )}
                                  </div>
                                  <Row gutter={[8, 8]}>
                                    <Col span={12}>
                                      <Text type="secondary">Total Amount</Text>
                                      <div><MoneyText minor={totalMinor} /></div>
                                    </Col>
                                    <Col span={12}>
                                      <Text type="secondary">Down Payment</Text>
                                      <div><MoneyText minor={downMinor} /></div>
                                    </Col>
                                    <Col span={12}>
                                      <Text type="secondary">Balance</Text>
                                      <div>
                                        {isFullyPaid ? (
                                          <Tag color="green">GHS 0.00</Tag>
                                        ) : (
                                          <MoneyText minor={balanceMinor} />
                                        )}
                                      </div>
                                    </Col>
                                    <Col span={12}>
                                      <Text type="secondary">Monthly Amount</Text>
                                      <div>
                                        {isFullyPaid ? (
                                          <Tag color="green">N/A</Tag>
                                        ) : (
                                          <MoneyText minor={monthlyMinor} />
                                        )}
                                      </div>
                                    </Col>
                                    <Col span={12}>
                                      <Text type="secondary">Number of Months</Text>
                                      <div>
                                        {isFullyPaid ? (
                                          <Tag color="green">0</Tag>
                                        ) : (
                                          <Text strong>{numMonths}</Text>
                                        )}
                                      </div>
                                    </Col>
                                    <Col span={12}>
                                      <Text type="secondary">Progress</Text>
                                      <div>
                                        <Progress 
                                          percent={isFullyPaid ? 100 : progressPercent} 
                                          strokeColor={isFullyPaid ? '#52c41a' : tokens.band[band]}
                                          size="small"
                                        />
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                          {isFullyPaid ? '100% - COMPLETE' : `${progressPercent}% - ${band.toUpperCase()}`}
                                        </Text>
                                      </div>
                                    </Col>
                                  </Row>
                                </div>
                              );
                            }}
                          </Form.Item>
                        </>
                      );
                    }}
                  </Form.Item>
                ),
              },
            ]}
          />

          <Divider />
          
          <Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit" loading={loading}>
                Save Changes
              </Button>
              <Button onClick={() => {
                setEditModal(false);
                setSelectedCustomer(null);
                setEditPaymentPlan(null);
                form.resetFields();
              }}>
                Cancel
              </Button>
              {selectedCustomer && getPaymentPlan(selectedCustomer.id) && (
                <Button 
                  danger 
                  onClick={() => {
                    Modal.confirm({
                      title: 'Remove Payment Plan',
                      content: 'Are you sure you want to remove this payment plan? This action cannot be undone.',
                      okText: 'Yes, Remove',
                      okType: 'danger',
                      cancelText: 'No, Keep',
                      onOk: () => {
                        if (selectedCustomer) {
                          const newPaymentPlans = { ...paymentPlans };
                          delete newPaymentPlans[selectedCustomer.id];
                          setPaymentPlans(newPaymentPlans);
                          setEditPaymentPlan(null);
                          // Update customer type to fully paid
                          setCustomers(customers.map(c => 
                            c.id === selectedCustomer.id 
                              ? { ...c, type: 'fully_paid', updatedAt: new Date().toISOString() }
                              : c
                          ));
                          message.success('Payment plan removed successfully!');
                        }
                      },
                    });
                  }}
                >
                  Remove Payment Plan
                </Button>
              )}
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Export Modal */}
      <Modal
        title={
          <Space>
            <ExportOutlined style={{ color: tokens.primary }} />
            <Text strong>Export Customers</Text>
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
          message={`${filteredCustomers.length} customers will be exported`}
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
            <InfoCircleOutlined /> The export will include all filtered customers with their payment plan details.
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