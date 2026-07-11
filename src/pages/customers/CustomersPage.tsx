// src/pages/customers/CustomersPage.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCustomersQuery,
  useDeleteCustomerMutation,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
} from '@/api/customers';
import { usePaymentPlansQuery, useCreatePaymentPlanMutation, useUpdatePaymentPlanMutation, useDeletePaymentPlanMutation } from '@/api/paymentPlans';
import { usePropertiesQuery } from '@/api/properties';
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
  const queryClient = useQueryClient();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // ── Live API data ─────────────────────────────────────────────────────────
  const { 
    data: customersResponse, 
    isLoading: customersLoading, 
    refetch: refetchCustomers,
    error: customersError
  } = useCustomersQuery({
    type: (typeFilter !== 'all' ? typeFilter : undefined) as any,
    q: searchText || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const { data: paymentPlansResponse, isLoading: paymentPlansLoading, refetch: refetchPaymentPlans } = usePaymentPlansQuery({
    limit: 100,
  });

  const { data: propertiesResponse, isLoading: propertiesLoading } = usePropertiesQuery({
    limit: 100,
  });

  // API Mutations
  const createCustomer = useCreateCustomerMutation();
  const updateCustomer = useUpdateCustomerMutation();
  const deleteCustomer = useDeleteCustomerMutation();
  const createPaymentPlan = useCreatePaymentPlanMutation();
  const updatePaymentPlan = useUpdatePaymentPlanMutation();
  const deletePaymentPlan = useDeletePaymentPlanMutation();

  // Extract data from responses with proper fallbacks
  const customers: Customer[] = React.useMemo(() => {
    if (!customersResponse) return [];
    // Handle both wrapped and unwrapped responses
    const data = (customersResponse as any).data ?? customersResponse;
    if (Array.isArray(data)) return data;
    if (data?.items) return data.items;
    return [];
  }, [customersResponse]);

  const customersMeta = React.useMemo(() => {
    if (!customersResponse) return { total: 0 };
    const data = (customersResponse as any).data ?? customersResponse;
    return {
      total: data?.total ?? data?.length ?? 0,
    };
  }, [customersResponse]);

  const paymentPlans: PaymentPlan[] = React.useMemo(() => {
    if (!paymentPlansResponse) return [];
    const data = (paymentPlansResponse as any).data ?? paymentPlansResponse;
    if (Array.isArray(data)) return data;
    if (data?.items) return data.items;
    return [];
  }, [paymentPlansResponse]);

  const properties = React.useMemo(() => {
    if (!propertiesResponse) return [];
    const data = (propertiesResponse as any).data ?? propertiesResponse;
    if (Array.isArray(data)) return data;
    if (data?.items) return data.items;
    return [];
  }, [propertiesResponse]);

  // Log data for debugging
  useEffect(() => {
    console.log('📊 Customers Response:', customersResponse);
    console.log('📊 Extracted Customers:', customers);
    console.log('📊 Customers Meta:', customersMeta);
  }, [customersResponse, customers, customersMeta]);

  // Create maps for quick lookups
  const paymentPlanMap = React.useMemo(() => {
    return paymentPlans.reduce((acc, plan) => {
      acc[plan.customerId] = plan;
      return acc;
    }, {} as Record<string, PaymentPlan>);
  }, [paymentPlans]);

  const propertyMap = React.useMemo(() => {
    return properties.reduce((acc, prop) => {
      acc[prop.id] = prop;
      return acc;
    }, {} as Record<string, any>);
  }, [properties]);

  // UI States
  const [loading, setLoading] = useState(false);
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
    return paymentPlanMap[customerId] || null;
  };

  // Get property details
  const getPropertyDetails = (propertyId: string) => {
    return propertyMap[propertyId] || null;
  };



// ── Add Customer ──────────────────────────────────────────────────────────
const handleAddCustomer = async (values: any) => {
  try {
    setLoading(true);
    
    // Base customer data
    const customerData: any = {
      firstName: values.firstName,
      lastName: values.lastName,
      phoneNumber: values.phoneNumber,
      address: values.address,
      type: values.type,
      propertyId: values.propertyId,
    };

    // Add optional fields
    if (values.email) {
      customerData.email = values.email;
    }
    if (values.prospectId) {
      customerData.prospectId = values.prospectId;
    }
    if (values.notes) {
      customerData.notes = values.notes;
    }

    // If payment plan, add createPlan object
    if (values.type === 'payment_plan' && values.totalAmount > 0) {
      const planData = calculatePaymentPlan(values);
      
      // Determine plan basis
      let planBasis: 'months' | 'monthly_amount' = 'months';
      if (values.paymentBasis === 'monthly') {
        planBasis = 'monthly_amount';
      }

      customerData.createPlan = {
        totalAmountMinor: planData.totalAmountMinor,
        downPaymentMinor: planData.downPaymentMinor,
        planBasis: planBasis,
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      };

      // Add the appropriate field based on plan basis
      if (planBasis === 'months') {
        customerData.createPlan.numMonths = planData.numMonths;
      } else {
        customerData.createPlan.monthlyAmountMinor = planData.monthlyAmountMinor;
      }
    }

    console.log('📤 Creating customer with payload:', customerData);

    const newCustomer = await createCustomer.mutateAsync(customerData);
    message.success('Customer created successfully!');

    setAddModal(false);
    addForm.resetFields();
    
    // Refetch data with delay
    setTimeout(() => {
      refetchCustomers();
      refetchPaymentPlans();
    }, 500);
  } catch (error: any) {
    console.error('Error creating customer:', error);
    const errorMsg = error?.response?.data?.message || error?.message || 'Failed to create customer';
    message.error(errorMsg);
  } finally {
    setLoading(false);
  }
};

  // ── Update Customer ──────────────────────────────────────────────────────
  const handleUpdateCustomer = async (values: any) => {
    if (!selectedCustomer) return;

    try {
      setLoading(true);

      // Update customer
      const customerData = {
        firstName: values.firstName,
        lastName: values.lastName,
        phoneNumber: values.phoneNumber,
        email: values.email,
        address: values.address,
        type: values.type,
        propertyId: values.propertyId,
      };

      await updateCustomer.mutateAsync({
        id: selectedCustomer.id,
        data: customerData,
      });

      // Handle payment plan
      if (values.type === 'fully_paid') {
        // Remove payment plan if exists
        const existingPlan = getPaymentPlan(selectedCustomer.id);
        if (existingPlan) {
          await deletePaymentPlan.mutateAsync(existingPlan.id);
        }
        message.success('Customer marked as Fully Paid!');
      } else if (values.type === 'payment_plan') {
        const existingPlan = getPaymentPlan(selectedCustomer.id);
        const planData = calculatePaymentPlan(values);
        const planStatus = planData.balanceMinor === 0 ? 'completed' : (values.planStatus || 'active');

        if (existingPlan) {
          // Update existing plan
          await updatePaymentPlan.mutateAsync({
            id: existingPlan.id,
            data: {
              totalAmountMinor: planData.totalAmountMinor,
              downPaymentMinor: planData.downPaymentMinor,
              balanceMinor: planData.balanceMinor,
              numMonths: planData.numMonths,
              monthlyAmountMinor: planData.monthlyAmountMinor,
              startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : existingPlan.startDate,
              status: planStatus,
              progressPercent: planData.progressPercent,
              progressBand: planData.progressBand,
            },
          });
          message.success('Payment plan updated successfully!');
        } else {
          // Create new plan
          await createPaymentPlan.mutateAsync({
            customerId: selectedCustomer.id,
            propertyId: values.propertyId,
            totalAmountMinor: planData.totalAmountMinor,
            downPaymentMinor: planData.downPaymentMinor,
            balanceMinor: planData.balanceMinor,
            numMonths: planData.numMonths,
            monthlyAmountMinor: planData.monthlyAmountMinor,
            currency: 'GHS',
            startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
            status: planStatus,
            progressPercent: planData.progressPercent,
            progressBand: planData.progressBand,
          });
          message.success('Payment plan created successfully!');
        }
      }

      setEditModal(false);
      setSelectedCustomer(null);
      setEditPaymentPlan(null);
      form.resetFields();
      
      setTimeout(() => {
        refetchCustomers();
        refetchPaymentPlans();
      }, 500);
    } catch (error: any) {
      console.error('Error updating customer:', error);
      message.error(error?.message || 'Failed to update customer');
    } finally {
      setLoading(false);
    }
  };

  // ── Delete Customer ──────────────────────────────────────────────────────
  const handleDeleteCustomer = (id: string) => {
    Modal.confirm({
      title: 'Delete Customer',
      content: 'Are you sure you want to delete this customer? This action cannot be undone.',
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          // Delete payment plan first if exists
          const plan = getPaymentPlan(id);
          if (plan) {
            await deletePaymentPlan.mutateAsync(plan.id);
          }
          
          await deleteCustomer.mutateAsync(id);
          message.success('Customer deleted successfully!');
          
          setTimeout(() => {
            refetchCustomers();
            refetchPaymentPlans();
          }, 500);
        } catch (error: any) {
          message.error(error?.message || 'Failed to delete customer');
        }
      },
    });
  };

  // ── Export ────────────────────────────────────────────────────────────────
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

  // Client-side tab filter
  const filteredCustomers = customers.filter(customer => {
    const matchesTab = activeTab === 'all' || customer.type === activeTab;
    return matchesTab;
  });

  // Stats
  const stats = {
    total: customersMeta?.total ?? customers.length,
    paymentPlan: customers.filter(c => c.type === 'payment_plan').length,
    fullyPaid: customers.filter(c => c.type === 'fully_paid').length,
    activePlans: paymentPlans.filter(p => p.status === 'active').length,
    defaultedPlans: paymentPlans.filter(p => p.status === 'defaulted').length,
    completedPlans: paymentPlans.filter(p => p.status === 'completed').length,
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
            onConfirm={() => handleDeleteCustomer(record.id)}
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

  // Loading state
  if (customersLoading || paymentPlansLoading || propertiesLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Spin size="large" tip="Loading customers..." />
      </div>
    );
  }

  // Error state
  if (customersError) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="Error Loading Customers"
          description="There was an error loading the customers. Please try again."
          type="error"
          showIcon
          action={
            <Button size="small" type="primary" onClick={() => refetchCustomers()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

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
              refetchCustomers();
              refetchPaymentPlans();
              message.success('Refreshed!');
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

      {/* ── Add Customer Modal ────────────────────────────────────────────── */}
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
            name="email"
            label="Email (Optional)"
            rules={[{ type: 'email', message: 'Please enter a valid email' }]}
          >
            <Input placeholder="Email address" />
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
            <Select 
              placeholder="Select property"
              showSearch
              optionFilterProp="children"
            >
              {properties.map((prop: any) => (
                <Option key={prop.id} value={prop.id}>
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
                return (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <CheckCircleOutlined style={{ fontSize: 32, color: '#52c41a' }} />
                    <Title level={5} style={{ marginTop: 8 }}>Fully Paid Customer</Title>
                    <Text type="secondary">No payment plan required</Text>
                  </div>
                );
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

          <Form.Item>
            <Space wrap>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={createCustomer.isPending || loading}
              >
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

      {/* ── Edit Modal ────────────────────────────────────────────────────── */}
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
          onFinish={handleUpdateCustomer}
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
                        {properties.map((prop: any) => (
                          <Option key={prop.id} value={prop.id}>
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
                            Modal.confirm({
                              title: 'Mark as Fully Paid',
                              content: 'This will remove the payment plan and mark the customer as fully paid. Continue?',
                              okText: 'Yes, Mark as Fully Paid',
                              okType: 'primary',
                              cancelText: 'Cancel',
                              onOk: () => {
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
              <Button type="primary" htmlType="submit" loading={updateCustomer.isPending || loading}>
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
                      onOk: async () => {
                        if (selectedCustomer) {
                          try {
                            const plan = getPaymentPlan(selectedCustomer.id);
                            if (plan) {
                              await deletePaymentPlan.mutateAsync(plan.id);
                              await updateCustomer.mutateAsync({
                                id: selectedCustomer.id,
                                data: { type: 'fully_paid' },
                              });
                              message.success('Payment plan removed successfully!');
                              refetchCustomers();
                              refetchPaymentPlans();
                            }
                          } catch (error: any) {
                            message.error(error?.message || 'Failed to remove payment plan');
                          }
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

      {/* ── Export Modal ───────────────────────────────────────────────────── */}
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

      {/* ── View Drawer ───────────────────────────────────────────────────── */}
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
        {selectedCustomer && (
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
              background: selectedCustomer.type === 'fully_paid' ? '#f6ffed' : '#e6f7ff',
              border: `1px solid ${selectedCustomer.type === 'fully_paid' ? '#b7eb8f' : '#91d5ff'}`,
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <Space>
                {selectedCustomer.type === 'fully_paid' ? (
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <BankOutlined style={{ color: '#1890ff' }} />
                )}
                <Text strong>
                  {selectedCustomer.type === 'fully_paid' ? 'Fully Paid Customer' : 'Payment Plan Customer'}
                </Text>
              </Space>
              {selectedCustomer.type === 'payment_plan' && (
                <Tag color={getPaymentPlan(selectedCustomer.id)?.status === 'active' ? 'green' : 'red'}>
                  {paymentPlanStatusLabels[getPaymentPlan(selectedCustomer.id)?.status || 'active']}
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
                {selectedCustomer.type === 'payment_plan' && getPaymentPlan(selectedCustomer.id) && (
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
                      {getPropertyDetails(selectedCustomer.propertyId)?.houseNumber || 'N/A'}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            </Row>

            {/* Payment Plan Details */}
            {selectedCustomer.type === 'payment_plan' && getPaymentPlan(selectedCustomer.id) && (
              <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={24}>
                  <Card size="small" title="Payment Plan Details" bordered={false} style={{ background: '#fafafa' }}>
                    <div style={{ marginBottom: 16 }}>
                      <ProgressCell 
                        percent={getPaymentPlan(selectedCustomer.id)?.progressPercent || 0} 
                        band={getPaymentPlan(selectedCustomer.id)?.progressBand || 'red'} 
                      />
                    </div>
                    <Descriptions column={2} size="small">
                      <Descriptions.Item label="Total Amount">
                        <MoneyText minor={getPaymentPlan(selectedCustomer.id)?.totalAmountMinor || 0} />
                      </Descriptions.Item>
                      <Descriptions.Item label="Down Payment">
                        <MoneyText minor={getPaymentPlan(selectedCustomer.id)?.downPaymentMinor || 0} />
                      </Descriptions.Item>
                      <Descriptions.Item label="Balance">
                        <MoneyText minor={getPaymentPlan(selectedCustomer.id)?.balanceMinor || 0} />
                      </Descriptions.Item>
                      <Descriptions.Item label="Monthly Amount">
                        <MoneyText minor={getPaymentPlan(selectedCustomer.id)?.monthlyAmountMinor || 0} />
                      </Descriptions.Item>
                      <Descriptions.Item label="Duration">
                        {getPaymentPlan(selectedCustomer.id)?.numMonths || 0} months
                      </Descriptions.Item>
                      <Descriptions.Item label="Start Date">
                        {dayjs(getPaymentPlan(selectedCustomer.id)?.startDate).format('MMMM DD, YYYY')}
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
                    {getPaymentPlan(selectedCustomer.id) && (
                      <Timeline.Item color="green">
                        <Text>Payment plan {getPaymentPlan(selectedCustomer.id)?.status}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {getPaymentPlan(selectedCustomer.id)?.progressPercent || 0}% complete
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
        )}
      </Drawer>
    </div>
  );
};