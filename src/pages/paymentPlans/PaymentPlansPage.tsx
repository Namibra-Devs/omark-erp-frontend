// src/pages/paymentPlans/PaymentPlansPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  BarChartOutlined,
  FileProtectOutlined,
} from '@ant-design/icons';
import { LandPurchaseAgreementModal } from '@/components/paymentPlan/LandPurchaseAgreementModal';
import { useAuth } from '@/contexts/AuthContext';
import { useBranchesQuery } from '@/api/branches';
import { filterEntitiesByBranch } from '@/utils/branchIsolation';
import { PageHeader } from '@/components/shared/PageHeader';
import { PhotoUpload } from '@/components/shared/PhotoUpload';
import { StatusTag } from '@/components/shared/StatusTag';
import { MoneyText } from '@/components/shared/MoneyText';
import { ProgressCell } from '@/components/shared/ProgressCell';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { tokens } from '@/constants/tokens';
import { paymentPlanStatusLabels, progressBandLabels } from '@/constants/enums';
import {
  usePaymentPlansQuery,
  useCreatePaymentPlanMutation,
  getProgressBand,
  type PaymentPlan,
  type PaymentPlanStatus,
  type ProgressBand,
  type CreatePaymentPlanPayload,
} from '@/api/paymentPlans';
import { useSecretaryDashboardQuery } from '@/api/dashboard';
import { getStoredNotifications, type SystemNotification } from '@/utils/activityNotificationEngine';
import { PaymentPlanScheduleTable } from '@/components/paymentPlan/PaymentPlanScheduleTable';
import {
  buildPaymentPlanSchedule,
  getPlanPaymentOverrides,
  usePaymentPlanScheduleListener
} from '@/utils/paymentPlanSchedule';
import { getCachedCustomer } from '@/utils/customerPortalCache';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  // Listen for real-time payment schedule updates from any screen
  usePaymentPlanScheduleListener();
  
  // URL Param synchronization
  const urlStatus = searchParams.get('status') || searchParams.get('filter') || 'all';
  const urlBand = searchParams.get('band') || 'all';

  // States
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(urlStatus);
  const [bandFilter, setBandFilter] = useState<string>(urlBand);
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlan | null>(null);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [agreementModalOpen, setAgreementModalOpen] = useState(false);
  const [agreementPlan, setAgreementPlan] = useState<PaymentPlan | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [addForm] = Form.useForm();

  // Sync state if URL query params change
  useEffect(() => {
    const s = searchParams.get('status') || searchParams.get('filter') || 'all';
    const b = searchParams.get('band') || 'all';
    setStatusFilter(s);
    setBandFilter(b);
  }, [searchParams]);

  const handleStatusFilterChange = (val: string) => {
    const nextStatus = val || 'all';
    setStatusFilter(nextStatus);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (nextStatus !== 'all') {
        next.set('status', nextStatus);
      } else {
        next.delete('status');
        next.delete('filter');
      }
      return next;
    });
  };

  const handleBandFilterChange = (val: string) => {
    const nextBand = val || 'all';
    setBandFilter(nextBand);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (nextBand !== 'all') {
        next.set('band', nextBand);
      } else {
        next.delete('band');
      }
      return next;
    });
  };

  // Export states
  const [exportModal, setExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv' | 'pdf' | 'json'>('excel');
  const [exportLoading, setExportLoading] = useState(false);

  // ── API Queries ────────────────────────────────────────────────────────────
  // Fetch full list so client-side filtering and synthesis provide full active & completed data
  const { 
    data: paymentPlansData, 
    isLoading: paymentPlansLoading,
    error: paymentPlansError,
    refetch: refetchPaymentPlans
  } = usePaymentPlansQuery({
    pageSize: 100,
  });

  const { data: customersData, isLoading: customersLoading } = useCustomersQuery({ pageSize: 100 });
  const { data: propertiesData, isLoading: propertiesLoading } = usePropertiesQuery({ pageSize: 100 });
  const { data: secretaryDashboardData } = useSecretaryDashboardQuery();

  // ── API Mutations ──────────────────────────────────────────────────────────
  const createPaymentPlan = useCreatePaymentPlanMutation();

  // ── Data Mapping with Branch Isolation ────────────────────────────────────
  const { data: branches = [] } = useBranchesQuery();
  const rawPaymentPlans: PaymentPlan[] = paymentPlansData?.items ?? [];
  const rawCustomers: Customer[] = customersData?.items ?? [];
  const properties = propertiesData?.items ?? [];

  // Create lookup maps
  const propertyMap = useMemo(() => {
    return properties.reduce((acc, prop) => {
      acc[prop.id] = prop;
      return acc;
    }, {} as Record<string, any>);
  }, [properties]);

  const customerMap = useMemo(() => {
    return rawCustomers.reduce((acc, customer) => {
      acc[customer.id] = customer;
      return acc;
    }, {} as Record<string, Customer>);
  }, [rawCustomers]);

  // Defaulter customer IDs from secretary dashboard & urgent notifications
  const secretaryDefaulterCustomerIds = useMemo(() => {
    const list = secretaryDashboardData?.defaulters ?? [];
    return new Set(list.map((d: any) => d.customerId));
  }, [secretaryDashboardData]);

  const defaulterNotificationCustomerIds = useMemo(() => {
    try {
      const notifs = getStoredNotifications();
      const defaulterNotifs = notifs.filter((n: SystemNotification) => n.category === 'defaulter');
      const ids = new Set<string>();
      rawCustomers.forEach(c => {
        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
        if (defaulterNotifs.some((n: SystemNotification) => 
          (n.title && n.title.toLowerCase().includes(fullName)) ||
          (n.message && n.message.toLowerCase().includes(fullName)) ||
          (c.code && (n.title.includes(c.code) || n.message.includes(c.code)))
        )) {
          ids.add(c.id);
        }
      });
      return ids;
    } catch {
      return new Set<string>();
    }
  }, [rawCustomers]);

  // ── Merge All Payment Plans (Active, Completed & Defaulted) ───────────────
  // Resolves the issue where only backend-seeded defaulters were returned,
  // making sure every customer on a payment plan is represented with their true status.
  const allRawPaymentPlans = useMemo(() => {
    const plansMap = new Map<string, PaymentPlan>();

    // 1. Process payment plans from the live API response
    rawPaymentPlans.forEach(p => {
      const overrides = getPlanPaymentOverrides(p.id);
      let adjustedBalanceMinor = p.balanceMinor;
      let adjustedProgressPercent = p.progressPercent;
      let adjustedStatus = p.status;

      if (overrides) {
        const totalPaidMinor = Object.values(overrides.paidInstallments || {}).reduce(
          (sum, inst) => sum + (inst.amountMinor || 0),
          0
        );
        if (totalPaidMinor > 0) {
          adjustedBalanceMinor = Math.max((p.balanceMinor || p.totalAmountMinor) - totalPaidMinor, 0);
          const totalPaid = (p.downPaymentMinor || 0) + totalPaidMinor;
          adjustedProgressPercent = p.totalAmountMinor > 0 
            ? Math.min(Math.round((totalPaid / p.totalAmountMinor) * 100), 100) 
            : p.progressPercent;
          if (adjustedBalanceMinor === 0) {
            adjustedStatus = 'completed';
          }
        }
      }

      const updatedPlan: PaymentPlan = {
        ...p,
        balanceMinor: adjustedBalanceMinor,
        progressPercent: adjustedProgressPercent,
        progressBand: getProgressBand(adjustedProgressPercent),
        status: adjustedStatus,
      };

      plansMap.set(p.customerId, updatedPlan);
    });

    // 2. Include all customers registered under type === 'payment_plan' or who have a plan
    rawCustomers.forEach(c => {
      if (plansMap.has(c.id)) return; // Already present from API
      if (c.type !== 'payment_plan' && !(c as any).plan) return; // Only payment plan customers

      const cached = getCachedCustomer(c.id);
      const embeddedPlan = (c as any).plan || cached?.paymentPlan;
      const prop = propertyMap[c.propertyId];

      const totalAmountMinor = embeddedPlan?.totalAmountMinor || prop?.priceMinor || 35000000;
      const downPaymentMinor = embeddedPlan?.downPaymentMinor !== undefined 
        ? embeddedPlan.downPaymentMinor 
        : Math.round(totalAmountMinor * 0.2);
      const balanceMinor = embeddedPlan?.balanceMinor !== undefined 
        ? embeddedPlan.balanceMinor 
        : Math.max(totalAmountMinor - downPaymentMinor, 0);
      const numMonths = embeddedPlan?.numMonths || 6;
      const monthlyAmountMinor = embeddedPlan?.monthlyAmountMinor || Math.round(balanceMinor / Math.max(numMonths, 1));
      
      const isDefaulter = secretaryDefaulterCustomerIds.has(c.id) || defaulterNotificationCustomerIds.has(c.id);
      const status: PaymentPlanStatus = embeddedPlan?.status || (isDefaulter ? 'defaulted' : (balanceMinor <= 0 ? 'completed' : 'active'));

      const paidSoFar = totalAmountMinor - balanceMinor;
      const progressPercent = totalAmountMinor > 0 ? Math.min(Math.round((paidSoFar / totalAmountMinor) * 100), 100) : 0;
      const progressBand = getProgressBand(progressPercent);

      const planId = embeddedPlan?.id || `plan-${c.id}`;

      // Check local payment overrides
      const overrides = getPlanPaymentOverrides(planId);
      let finalBalance = balanceMinor;
      let finalPercent = progressPercent;
      let finalStatus = status;

      if (overrides) {
        const totalPaidMinor = Object.values(overrides.paidInstallments || {}).reduce(
          (sum, inst) => sum + (inst.amountMinor || 0),
          0
        );
        if (totalPaidMinor > 0) {
          finalBalance = Math.max(balanceMinor - totalPaidMinor, 0);
          finalPercent = totalAmountMinor > 0 
            ? Math.min(Math.round(((paidSoFar + totalPaidMinor) / totalAmountMinor) * 100), 100) 
            : 100;
          if (finalBalance === 0) finalStatus = 'completed';
        }
      }

      const syntheticPlan: PaymentPlan = {
        id: planId,
        customerId: c.id,
        propertyId: c.propertyId || '',
        totalAmountMinor,
        downPaymentMinor,
        balanceMinor: finalBalance,
        numMonths,
        monthlyAmountMinor,
        currency: embeddedPlan?.currency || prop?.currency || 'GHS',
        startDate: embeddedPlan?.startDate || (c.createdAt ? dayjs(c.createdAt).format('YYYY-MM-DD') : dayjs().subtract(1, 'month').format('YYYY-MM-DD')),
        status: finalStatus,
        progressPercent: finalPercent,
        progressBand: getProgressBand(finalPercent),
        createdAt: c.createdAt || new Date().toISOString(),
        updatedAt: c.updatedAt || new Date().toISOString(),
      };

      plansMap.set(c.id, syntheticPlan);
    });

    return Array.from(plansMap.values());
  }, [rawPaymentPlans, rawCustomers, propertyMap, secretaryDefaulterCustomerIds, defaulterNotificationCustomerIds]);

  const paymentPlans: PaymentPlan[] = filterEntitiesByBranch(allRawPaymentPlans, user, branches);
  const customers: Customer[] = filterEntitiesByBranch(rawCustomers, user, branches);

  // Only customers without an existing plan can have a new one created for them
  const customersWithoutPlan = useMemo(() => {
    const withPlan = new Set(paymentPlans.map(p => p.customerId));
    return customers.filter(c => !withPlan.has(c.id));
  }, [customers, paymentPlans]);

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
  const filteredPlans = useMemo(() => {
    return paymentPlans.filter(plan => {
      const customerName = getCustomerName(plan.customerId).toLowerCase();
      const property = getCustomerProperty(plan.customerId).toLowerCase();
      const matchesSearch = customerName.includes(searchText.toLowerCase()) ||
                            plan.id.toLowerCase().includes(searchText.toLowerCase()) ||
                            property.includes(searchText.toLowerCase());
      const matchesStatus = statusFilter === 'all' || plan.status === statusFilter;
      const matchesBand = bandFilter === 'all' || plan.progressBand === bandFilter;
      return matchesSearch && matchesStatus && matchesBand;
    });
  }, [paymentPlans, searchText, statusFilter, bandFilter, customerMap, propertyMap]);

  // Priority sorting: Defaulted or Red-band plans float to top when viewing all
  const sortedAndFilteredPlans = useMemo(() => {
    return [...filteredPlans].sort((a, b) => {
      const aUrgent = a.status === 'defaulted' || a.progressBand === 'red';
      const bUrgent = b.status === 'defaulted' || b.progressBand === 'red';
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [filteredPlans]);

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
  // Note: the real API only supports creating a payment plan for a customer
  // who doesn't already have one — there is no update or delete endpoint.
  const handleAddPlan = async (values: any) => {
    try {
      const totalAmountMinor = Math.round((values.totalAmount || 0) * 100);
      const downPaymentMinor = Math.round((values.downPayment || 0) * 100);

      const payload: CreatePaymentPlanPayload = {
        customerId: values.customerId,
        totalAmountMinor,
        downPaymentMinor,
        planBasis: 'months',
        numMonths: values.numMonths,
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
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

  // ── Print Schedule Statement ──────────────────────────────────────────────
  const handlePrintPlan = (plan: PaymentPlan) => {
    const customer = customerMap[plan.customerId];
    const property = getCustomerProperty(plan.customerId);
    const schedule = buildPaymentPlanSchedule(plan);

    const rows = schedule.rows
      .map((r) => `
        <tr style="${r.isOverdue ? 'background-color: #fff1f0;' : ''}">
          <td style="text-align: center; font-weight: bold;">${r.ordinal}</td>
          <td>${r.dueDateFormatted}</td>
          <td style="text-align: right;">₵${r.installmentGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: right;">₵${r.accumulatedGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-weight: ${r.remainingBalanceGHS === 0 ? 'bold' : 'normal'};">₵${r.remainingBalanceGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: center;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; ${
              r.isPaid
                ? 'background: #f6ffed; color: #52c41a; border: 1px solid #b7eb8f;'
                : r.isOverdue
                ? 'background: #fff2f0; color: #ff4d4f; border: 1px solid #ffccc7;'
                : 'background: #e6f7ff; color: #1890ff; border: 1px solid #91d5ff;'
            }">
              ${r.isPaid ? 'Paid' : r.isOverdue ? 'Overdue' : 'Pending'}
            </span>
          </td>
          <td>${r.paidAt ? dayjs(r.paidAt).format('DD MMM YYYY') : '—'}</td>
        </tr>
      `)
      .join('');

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Payment Plan Statement — ${customer ? `${customer.firstName} ${customer.lastName}` : 'Customer'}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px; color: #1a1a2e; }
          h1 { font-size: 22px; margin-bottom: 2px; color: #1890ff; }
          .muted { color: #666; font-size: 12px; margin-bottom: 16px; }
          .summary { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 18px; margin-bottom: 20px; }
          .summary div { margin-bottom: 4px; font-size: 13px; }
          .contract-banner { background: #fafafa; border-left: 4px solid #1890ff; padding: 12px 16px; margin-bottom: 18px; border-radius: 4px; }
          .contract-banner h3 { margin: 0 0 6px 0; font-size: 15px; color: #111; }
          .contract-banner p { margin: 0 0 6px 0; font-size: 13px; line-height: 1.5; color: #333; }
          .plan-title { font-weight: bold; font-size: 14px; text-transform: uppercase; margin: 12px 0 6px 0; letter-spacing: 0.3px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 9px; font-size: 12px; text-align: left; }
          th { background: #f1f5f9; font-weight: 600; color: #334155; }
        </style>
      </head>
      <body>
        <h1>Omark Real Estate — Payment Plan Statement</h1>
        <div class="muted">Official Record • Generated ${dayjs().format('MMMM DD, YYYY HH:mm')}</div>
        
        <div class="summary">
          <div><strong>Customer:</strong> ${customer ? `${customer.firstName} ${customer.lastName}` : 'Customer'}</div>
          <div><strong>Phone:</strong> ${customer?.phoneNumber || '—'}</div>
          <div><strong>Property:</strong> ${property}</div>
          <div><strong>Total Property Value:</strong> ₵${(plan.totalAmountMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          <div><strong>Down Payment Paid:</strong> ₵${(plan.downPaymentMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          <div><strong>Installment Balance:</strong> ₵${(plan.balanceMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>

        <div class="contract-banner">
          <h3>Payment Plan Schedule:</h3>
          <p>${schedule.agreementLeadText}</p>
          <p style="font-style: italic; color: #555;">${schedule.agreementDueText}</p>
          <div class="plan-title">${schedule.planTitleText}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">Inst.</th>
              <th>Due Date</th>
              <th style="text-align: right;">Installment (₵)</th>
              <th style="text-align: right;">Accumulated (₵)</th>
              <th style="text-align: right;">Remaining Balance (₵)</th>
              <th style="text-align: center;">Status</th>
              <th>Paid Date</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <script>window.onload = function () { window.print(); };</script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error('Please allow pop-ups for this site to generate the PDF');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // ── Table Columns ─────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Customer',
      key: 'customer',
      width: 200,
      render: (_: any, record: PaymentPlan) => (
        <Space>
          <PhotoUpload entityType="customer" entityId={record.customerId} size={32} editable={false} />
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
          <Tooltip title="Send Land Purchase Agreement to Customer Portal">
            <Button
              type="primary"
              icon={<FileProtectOutlined />}
              style={{ backgroundColor: '#092b5a', borderColor: '#092b5a' }}
              onClick={() => {
                setAgreementPlan(record);
                setAgreementModalOpen(true);
              }}
            />
          </Tooltip>
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
              ghost
              icon={<FilePdfOutlined />}
              onClick={() => handlePrintPlan(selectedPlan)}
            >
              Generate Statement PDF
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

        {/* Payment Plan Schedule with Actions */}
        <div style={{ marginTop: 20 }}>
          <PaymentPlanScheduleTable
            plan={selectedPlan}
            customerName={getCustomerName(selectedPlan.customerId)}
            customerPhone={getCustomerPhone(selectedPlan.customerId)}
            propertyName={getCustomerProperty(selectedPlan.customerId)}
            onRecordPayment={async () => {
              refetchPaymentPlans();
            }}
          />
        </div>

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
          justifyContent: 'flex-end'
        }}>
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
            onClick={() => handleBandFilterChange('red')}
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
            onClick={() => handleBandFilterChange('yellow')}
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
            onClick={() => handleBandFilterChange('light_green')}
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
            onClick={() => handleBandFilterChange('green')}
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
              onChange={handleStatusFilterChange}
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
              onChange={handleBandFilterChange}
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
              Total: {sortedAndFilteredPlans.length} payment plans
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <Table
          columns={columns}
          dataSource={sortedAndFilteredPlans}
          rowKey="id"
          loading={paymentPlansLoading}
          size="middle"
          scroll={{ x: 1400 }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '16px 20px', background: '#fafcff', borderRadius: 8, border: '1px solid #e6f4ff' }}>
                <PaymentPlanScheduleTable
                  plan={record}
                  compact
                  customerName={getCustomerName(record.customerId)}
                  customerPhone={getCustomerPhone(record.customerId)}
                  propertyName={getCustomerProperty(record.customerId)}
                  onRecordPayment={async () => {
                    refetchPaymentPlans();
                  }}
                />
              </div>
            ),
            rowExpandable: () => true,
          }}
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
        >
          <Alert
            message="Only customers without an existing payment plan are shown"
            description="The API only supports creating a plan for a customer who doesn't already have one — plans cannot be edited or replaced afterwards."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            name="customerId"
            label="Customer"
            rules={[{ required: true, message: 'Please select a customer' }]}
          >
            <Select placeholder="Select customer" showSearch optionFilterProp="children">
              {customersWithoutPlan.map(customer => (
                <Option key={customer.id} value={customer.id}>
                  {customer.firstName} {customer.lastName} - {getCustomerProperty(customer.id)}
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
        width="min(1000px, 96vw)"
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

      {/* Land Purchase Agreement (Contract of Sale) Portal Modal */}
      {agreementPlan && (
        <LandPurchaseAgreementModal
          open={agreementModalOpen}
          onClose={() => {
            setAgreementModalOpen(false);
            setAgreementPlan(null);
          }}
          plan={agreementPlan}
          customer={customerMap[agreementPlan.customerId]}
          property={propertyMap[agreementPlan.propertyId]}
        />
      )}
    </div>
  );
};