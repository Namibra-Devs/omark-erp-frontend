// src/pages/dashboard/SecretaryDashboardPage.tsx
import React, { useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Statistic,
  Table,
  Tag,
  Progress,
  Empty,
  Spin,
  Alert,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  message,
  Select,
  Badge,
  Segmented,
  Tooltip,
  Tabs,
  Divider,
} from 'antd';
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
  UserAddOutlined,
  IdcardOutlined,
  RiseOutlined,
  PieChartOutlined,
  CalendarOutlined,
  FilterOutlined,
  ArrowUpOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  EyeOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { useSecretaryDashboardQuery } from '@/api/dashboard';
import { useCustomersQuery, useCreateCustomerMutation, useUpdateCustomerMutation } from '@/api/customers';
import { useProspectsQuery, getStoredProspects } from '@/api/prospects';
import { usePaymentPlansQuery, getProgressBand } from '@/api/paymentPlans';
import { saveStoredPaymentPlan, saveCustomerPlanDefinition } from '@/utils/paymentPlansStorage';
import { useRecordPaymentMutation } from '@/api/payments';
import { useCreateExpenseMutation } from '@/api/expenses';
import { RoleExpenseDashboard } from '@/components/expenses/RoleExpenseDashboard';
import { usePropertiesQuery } from '@/api/properties';
import { useBranchesQuery } from '@/api/branches';
import {
  buildPaymentPlanSchedule,
  getPlanPaymentOverrides,
  recordLocalInstallmentPayment,
  usePaymentPlanScheduleListener,
  type PaymentPlanScheduleInfo,
} from '@/utils/paymentPlanSchedule';
import { dispatchPaymentReceiptSMS } from '@/utils/paymentNotificationService';
import { recordPlanPaymentWithBackend } from '@/api/paymentPlansPersistence';
import type { PaymentPlan, PaymentPlanStatus, Prospect } from '@/types';
import { filterEntitiesByBranch, tagPayloadWithBranch, getUserBranchId } from '@/utils/branchIsolation';
import { ClientCheckInsTable } from './admin/components/ClientCheckInsTable';
import { useCheckIns } from '@/utils/visitorCheckIns';
import {
  createDuplicatePhoneRule,
  createDuplicateNameRule,
  assertNoCustomerDuplicates,
} from '@/utils/duplicateValidation';
import { roleLabels, progressBandLabels } from '@/constants/enums';
import { tokens } from '@/constants/tokens';
import { MoneyText } from '@/components/shared/MoneyText';
import { PhoneInput } from '@/components/shared/PhoneInput';
import { AddProspectModal } from '@/components/shared/AddProspectModal';
import { StatusTag } from '@/components/shared/StatusTag';
import { ProspectsSourcePieChart } from '@/components/dashboard/ProspectsSourcePieChart';
import { ProspectInteractionsTimeline } from '@/components/dashboard/ProspectInteractionsTimeline';
import { RecordPaymentModal } from '@/components/paymentPlan/RecordPaymentModal';
import { PaymentReceiptModal, type PaymentReceiptData } from '@/components/paymentPlan/PaymentReceiptModal';
import { CustomerStatementModal } from '@/components/paymentPlan/CustomerStatementModal';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

// ── Custom Sleek Glassmorphic Tooltip for Charts ──────────────────────────────
const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          borderRadius: 10,
          padding: '10px 14px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          minWidth: 160,
        }}
      >
        {label && (
          <div style={{ fontWeight: 700, marginBottom: 6, color: '#1f1f1f', fontSize: 13 }}>
            {label}
          </div>
        )}
        {payload.map((entry: any, index: number) => {
          const isCurrency =
            entry.dataKey?.toLowerCase().includes('revenue') ||
            entry.dataKey?.toLowerCase().includes('amount') ||
            entry.dataKey?.toLowerCase().includes('minor') ||
            entry.name?.toLowerCase().includes('inflow') ||
            entry.name?.toLowerCase().includes('collected') ||
            entry.name?.toLowerCase().includes('amount');

          const displayVal =
            typeof entry.value === 'number'
              ? isCurrency
                ? `GHS ${entry.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : entry.value.toLocaleString()
              : entry.value;

          return (
            <div
              key={`item-${index}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                fontSize: 12,
                marginTop: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: entry.color || entry.stroke || entry.fill,
                  }}
                />
                <span style={{ color: '#595959' }}>{entry.name}:</span>
              </div>
              <span style={{ fontWeight: 700, color: '#1f1f1f' }}>{displayVal}</span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export const SecretaryDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: branches = [] } = useBranchesQuery();
  const userBranchId = getUserBranchId(user);

  // Live visitor check-in records for secretary's branch
  const { records: visitorRecords } = useCheckIns(userBranchId, branches);
  const activeVisitorsCount = visitorRecords.filter((r) => r.status === 'in_premises').length;
  
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
  } = useCustomersQuery({ pageSize: 100 });

  const { data: prospectsData } = useProspectsQuery({ pageSize: 10000 });
  const { data: mktProspectsData } = useProspectsQuery({ source: 'marketing', pageSize: 10000 });
  const { data: csProspectsData } = useProspectsQuery({ source: 'customer_service', pageSize: 10000 });
  const existingCustomersList = customersData?.items ?? [];

  const existingProspectsList = useMemo(() => {
    const prospectMap = new Map<string, Prospect>();
    (prospectsData?.items || []).forEach((p) => prospectMap.set(p.id, p));
    (mktProspectsData?.items || []).forEach((p) => prospectMap.set(p.id, p));
    (csProspectsData?.items || []).forEach((p) => prospectMap.set(p.id, p));
    getStoredProspects().forEach((p) => {
      if (!prospectMap.has(p.id)) prospectMap.set(p.id, p);
    });
    return Array.from(prospectMap.values());
  }, [prospectsData, mktProspectsData, csProspectsData]);

  const {
    data: paymentPlansData,
    isLoading: paymentPlansLoading,
    refetch: refetchPaymentPlans
  } = usePaymentPlansQuery({ pageSize: 100 });

  const {
    data: propertiesData,
    isLoading: propertiesLoading
  } = usePropertiesQuery({ pageSize: 100 });

  // ── API Mutations ──────────────────────────────────────────────────────────
  const createCustomer = useCreateCustomerMutation();
  const updateCustomer = useUpdateCustomerMutation();

  // ── UI State ──────────────────────────────────────────────────────────────
  const [addProspectModal, setAddProspectModal] = useState(false);
  const [addCustomerModal, setAddCustomerModal] = useState(false);
  const [addPaymentModal, setAddPaymentModal] = useState(false);
  const [addExpenseModal, setAddExpenseModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [form] = Form.useForm();
  const [expenseForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [pipelineMetric, setPipelineMetric] = useState<'amount' | 'count'>('amount');

  // Dynamic Installment & Receipt / Statement Modals
  const [activeTab, setActiveTab] = useState('overview');
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<PaymentReceiptData | null>(null);
  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [statementPlan, setStatementPlan] = useState<any>(null);
  const [statementCustomerName, setStatementCustomerName] = useState<string>('');
  const [statementCustomerPhone, setStatementCustomerPhone] = useState<string>('');
  const [statementPropertyName, setStatementPropertyName] = useState<string>('');
  const [customAmountEntered, setCustomAmountEntered] = useState<number | null>(null);
  const [prospectSearchText, setProspectSearchText] = useState('');
  const [prospectStatusFilter, setProspectStatusFilter] = useState('all');

  const createExpenseMutation = useCreateExpenseMutation();

  usePaymentPlanScheduleListener();

  // ── Data Extraction with Branch Isolation ─────────────────────────────────────
  const rawCustomers = customersData?.items ?? [];
  const rawPaymentPlans = paymentPlansData?.items ?? [];
  const rawProperties = propertiesData?.items ?? [];

  const customerMap = useMemo(() => {
    const map: Record<string, any> = {};
    rawCustomers.forEach((c: any) => {
      map[c.id] = c;
    });
    return map;
  }, [rawCustomers]);

  const propertyMap = useMemo(() => {
    const map: Record<string, any> = {};
    rawProperties.forEach((p: any) => {
      map[p.id] = p;
    });
    return map;
  }, [rawProperties]);

  // Combine rawPaymentPlans with any customers of type 'payment_plan' who have active plans
  const allRawPaymentPlans: PaymentPlan[] = useMemo(() => {
    const plansMap = new Map<string, PaymentPlan>();

    rawPaymentPlans.forEach((p: any) => {
      const overrides = getPlanPaymentOverrides(p.id);
      let adjustedBalanceMinor = p.balanceMinor;
      let adjustedProgressPercent = p.progressPercent;
      let adjustedStatus = p.status;

      if (overrides) {
        const totalPaidMinor = Object.values(overrides.paidInstallments || {}).reduce(
          (sum: number, inst: any) => sum + (inst.amountMinor || 0),
          0
        );
        if (totalPaidMinor > 0) {
          const totalScheduled = Math.max((p.totalAmountMinor || 35000000) - (p.downPaymentMinor || 0), 0);
          const overrideBalance = Math.max(totalScheduled - totalPaidMinor, 0);
          adjustedBalanceMinor = Math.min(p.balanceMinor !== undefined ? p.balanceMinor : totalScheduled, overrideBalance);
          const totalPaid = Math.max((p.totalAmountMinor || 35000000) - adjustedBalanceMinor, 0);
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

    rawCustomers.forEach((c: any) => {
      if (plansMap.has(c.id)) return;
      if (c.type !== 'payment_plan' && !c.plan) return;

      const prop = propertyMap[c.propertyId];
      const embeddedPlan = c.plan;
      const totalAmountMinor = embeddedPlan?.totalAmountMinor || prop?.priceMinor || 35000000;
      const downPaymentMinor = embeddedPlan?.downPaymentMinor !== undefined 
        ? embeddedPlan.downPaymentMinor 
        : Math.round(totalAmountMinor * 0.2);
      const balanceMinor = embeddedPlan?.balanceMinor !== undefined 
        ? embeddedPlan.balanceMinor 
        : Math.max(totalAmountMinor - downPaymentMinor, 0);
      const numMonths = embeddedPlan?.numMonths || 6;
      const monthlyAmountMinor = embeddedPlan?.monthlyAmountMinor || Math.round(balanceMinor / Math.max(numMonths, 1));
      
      const planId = embeddedPlan?.id || `plan-${c.id}`;
      const overrides = getPlanPaymentOverrides(planId);
      let finalBalance = balanceMinor;
      let finalPercent = totalAmountMinor > 0 ? Math.min(Math.round(((totalAmountMinor - balanceMinor) / totalAmountMinor) * 100), 100) : 0;
      let finalStatus: PaymentPlanStatus = balanceMinor <= 0 ? 'completed' : 'active';

      if (overrides) {
        const totalPaidMinor = Object.values(overrides.paidInstallments || {}).reduce(
          (sum: number, inst: any) => sum + (inst.amountMinor || 0),
          0
        );
        if (totalPaidMinor > 0) {
          finalBalance = Math.max(balanceMinor - totalPaidMinor, 0);
          finalPercent = totalAmountMinor > 0 
            ? Math.min(Math.round(((totalAmountMinor - finalBalance) / totalAmountMinor) * 100), 100) 
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
  }, [rawPaymentPlans, rawCustomers, propertyMap]);

  const customers = filterEntitiesByBranch(rawCustomers, user, branches);
  const paymentPlans = filterEntitiesByBranch(allRawPaymentPlans, user, branches);
  const properties = filterEntitiesByBranch(rawProperties, user, branches);

  // ── Dashboard Data (Branch-Isolated) ──────────────────────────────────
  const rawDefaulters = dashboardData?.defaulters ?? [];
  const rawDueSoon = dashboardData?.dueSoon ?? [];
  const branchFilteredDefaulters = filterEntitiesByBranch(rawDefaulters, user, branches);
  const branchFilteredDueSoon = filterEntitiesByBranch(rawDueSoon, user, branches);

  // Enriched Defaulters: merges API defaulters with any plans having overdue unpaid installments
  const defaulters = useMemo(() => {
    const map = new Map<string, any>();

    branchFilteredDefaulters.forEach((d: any) => {
      const cust = customerMap[d.customerId];
      map.set(d.customerId, {
        ...d,
        phone: cust?.phoneNumber || d.phone || '',
        name: d.name || (cust ? `${cust.firstName} ${cust.lastName}` : 'Customer'),
      });
    });

    // Check payment plans for overdue installments
    paymentPlans.forEach((plan: any) => {
      if (plan.status === 'completed' || plan.balanceMinor <= 0) return;
      const cust = customerMap[plan.customerId];
      if (!cust) return;

      const schedule = buildPaymentPlanSchedule(plan);
      const overdueRows = schedule.rows.filter((r) => r.isOverdue && !r.isPaid);

      if (overdueRows.length > 0 && !map.has(plan.customerId)) {
        const totalOverdueMinor = overdueRows.reduce((sum, r) => sum + r.installmentMinor, 0);
        const earliestDueDate = overdueRows[0].dueDate;
        const daysOverdue = Math.max(1, dayjs().diff(dayjs(earliestDueDate), 'day'));

        map.set(plan.customerId, {
          customerId: plan.customerId,
          name: `${cust.firstName} ${cust.lastName}`,
          phone: cust.phoneNumber || '',
          overdueAmountMinor: totalOverdueMinor,
          daysOverdue,
          planId: plan.id,
        });
      }
    });

    return Array.from(map.values());
  }, [branchFilteredDefaulters, paymentPlans, customerMap]);

  // Enriched Due Soon: merges API dueSoon with all active payment plans whose next installment is pending
  const dueSoon = useMemo(() => {
    const map = new Map<string, any>();
    const defaulterCustomerIds = new Set(defaulters.map((d: any) => d.customerId));

    // 1. Backend dueSoon
    branchFilteredDueSoon.forEach((item: any) => {
      if (defaulterCustomerIds.has(item.customerId)) return;
      const cust = customerMap[item.customerId];
      map.set(item.customerId, {
        ...item,
        phone: cust?.phoneNumber || item.phone || '',
        name: item.name || (cust ? `${cust.firstName} ${cust.lastName}` : 'Customer'),
      });
    });

    // 2. Active plans with upcoming / due installments
    paymentPlans.forEach((plan: any) => {
      if (plan.status === 'completed' || plan.balanceMinor <= 0) return;
      if (defaulterCustomerIds.has(plan.customerId)) return;
      if (map.has(plan.customerId)) return;

      const cust = customerMap[plan.customerId];
      if (!cust) return;

      const schedule = buildPaymentPlanSchedule(plan);
      const nextUnpaidRow = schedule.rows.find((r) => !r.isPaid);

      if (nextUnpaidRow) {
        map.set(plan.customerId, {
          customerId: plan.customerId,
          name: `${cust.firstName} ${cust.lastName}`,
          phone: cust.phoneNumber || '',
          dueDate: nextUnpaidRow.dueDate,
          amountMinor: nextUnpaidRow.installmentMinor || plan.monthlyAmountMinor || 150000,
          planId: plan.id,
          sequence: nextUnpaidRow.sequence,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      return dayjs(a.dueDate).valueOf() - dayjs(b.dueDate).valueOf();
    });
  }, [branchFilteredDueSoon, defaulters, paymentPlans, customerMap]);

  const selectedCustId = selectedCustomer?.customerId || selectedCustomer?.id;
  const selectedPlan = paymentPlans.find(
    (p: any) =>
      (selectedCustId && p.customerId === selectedCustId) ||
      (selectedCustomer?.planId && p.id === selectedCustomer.planId) ||
      (selectedCustomer?.id && p.id === selectedCustomer.id)
  );
  const recordPayment = useRecordPaymentMutation(selectedPlan?.id ?? '');

  const selectedSchedule = useMemo(() => {
    if (!selectedPlan) return null;
    return buildPaymentPlanSchedule(selectedPlan);
  }, [selectedPlan]);

  const targetInstallment = selectedSchedule?.nextDueRow || selectedSchedule?.rows[0];
  const expectedMonthlyGHS = targetInstallment
    ? targetInstallment.installmentGHS
    : selectedPlan?.monthlyAmountMinor
    ? selectedPlan.monthlyAmountMinor / 100
    : 0;
  const totalRemainingBalanceGHS = selectedSchedule
    ? selectedSchedule.currentBalanceGHS
    : (selectedPlan?.balanceMinor || 0) / 100;

  // Secretary Individual Prospects & Front-Desk Conversions
  const secretaryProspects = useMemo(() => {
    const userId = user?.id;
    const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase() : '';
    return existingProspectsList.filter((p) => {
      if (userId && (p.createdByUserId === userId || p.assignedUserId === userId || (p as any).creator?.id === userId)) {
        return true;
      }
      if (userName && (p.createdByName?.toLowerCase().includes(userName) || (p as any).creator?.name?.toLowerCase().includes(userName))) {
        return true;
      }
      if ((p as any).source === 'customer_service' || (p as any).source === 'walk_in') {
        return true;
      }
      return false;
    });
  }, [existingProspectsList, user]);

  const secretaryConverted = useMemo(() => {
    return secretaryProspects.filter((p) => (p as any).converted || p.status === 'meeting_completed');
  }, [secretaryProspects]);

  const secretaryConversionRate = secretaryProspects.length > 0
    ? Math.round((secretaryConverted.length / secretaryProspects.length) * 1000) / 10
    : 0;

  const activePlansCount = paymentPlans.length;
  const calculatedMonthlyRevenue = paymentPlans.reduce(
    (sum: number, p: any) => sum + (p.monthlyAmountMinor || p.monthlyInstallmentMinor || Math.round((p.totalAmountMinor || 1200000) / (p.numMonths || 12))),
    0
  );

  const redCount = paymentPlans.filter((p: any) => p.progressBand === 'red' || (p.balanceMinor && p.balanceMinor > 2000000)).length;
  const yellowCount = paymentPlans.filter((p: any) => p.progressBand === 'yellow' || (p.balanceMinor && p.balanceMinor > 1000000 && p.balanceMinor <= 2000000)).length;
  const lightGreenCount = paymentPlans.filter((p: any) => p.progressBand === 'light_green' || (p.balanceMinor && p.balanceMinor > 500000 && p.balanceMinor <= 1000000)).length;
  const greenCount = paymentPlans.filter((p: any) => p.progressBand === 'green' || p.balanceMinor === 0).length;

  const dashboard = {
    totalCustomers: customers.length,
    activePlans: activePlansCount,
    totalDeeds: properties.filter((p: any) => p.deedGenerated || p.status === 'sold').length,
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

  const bandConfig = [
    { band: 'red' as const, label: progressBandLabels.red, color: tokens.band.red, icon: <WarningOutlined /> },
    { band: 'yellow' as const, label: progressBandLabels.yellow, color: tokens.band.yellow, icon: <ClockCircleOutlined /> },
    { band: 'light_green' as const, label: progressBandLabels.light_green, color: tokens.band.light_green, icon: <CheckCircleOutlined /> },
    { band: 'green' as const, label: progressBandLabels.green, color: tokens.band.green, icon: <CheckCircleOutlined /> },
  ];

  const activePlansForProgress = Math.max(dashboard.activePlans, 1);

  // ── Live Chart Data Calculations ───────────────────────────────────────────
  // 1. Rolling 6-month cash flow trajectory (past 4 months, current month, next month projection)
  const cashFlowTrendData = useMemo(() => {
    const months: {
      key: string;
      label: string;
      expectedRevenue: number;
      collectedRevenue: number;
      activePlans: number;
    }[] = [];

    const now = dayjs();
    for (let i = -4; i <= 1; i++) {
      const targetMonth = now.add(i, 'month');
      const monthStart = targetMonth.startOf('month');
      const monthEnd = targetMonth.endOf('month');
      const monthKey = targetMonth.format('YYYY-MM');
      const monthLabel = targetMonth.format('MMM YYYY');

      let expectedMinor = 0;
      let collectedMinor = 0;
      let activeInMonth = 0;

      paymentPlans.forEach((plan: any) => {
        const planStart = dayjs(plan.startDate || plan.createdAt);
        const planMonths = plan.numMonths || 12;
        const planEnd = planStart.add(planMonths, 'month');
        const monthlyAmount =
          plan.monthlyAmountMinor ||
          plan.monthlyInstallmentMinor ||
          Math.round((plan.totalAmountMinor || 1200000) / planMonths);
        const downPayment = plan.downPaymentMinor || 0;

        if (monthStart.isBefore(planEnd) && monthEnd.isAfter(planStart)) {
          activeInMonth++;
          expectedMinor += monthlyAmount;

          if (planStart.isSame(targetMonth, 'month')) {
            expectedMinor += downPayment;
            collectedMinor += downPayment;
          }

          if (targetMonth.isBefore(now, 'month')) {
            const pct =
              plan.progressPercent ??
              (plan.progressBand === 'green'
                ? 100
                : plan.progressBand === 'light_green'
                ? 80
                : plan.progressBand === 'yellow'
                ? 50
                : 25);
            collectedMinor += Math.round(monthlyAmount * (pct / 100));
          } else if (targetMonth.isSame(now, 'month')) {
            const isDefaulter = defaulters.some((d: any) => d.customerId === plan.customerId);
            if (!isDefaulter) {
              collectedMinor += monthlyAmount;
            } else {
              collectedMinor += Math.round(monthlyAmount * 0.35);
            }
          } else {
            const isDefaulter = defaulters.some((d: any) => d.customerId === plan.customerId);
            if (!isDefaulter) {
              collectedMinor += Math.round(monthlyAmount * 0.9);
            } else {
              collectedMinor += Math.round(monthlyAmount * 0.4);
            }
          }
        }
      });

      if (expectedMinor === 0 && dashboard.monthlyRevenue > 0) {
        expectedMinor = dashboard.monthlyRevenue;
        collectedMinor = Math.round(dashboard.monthlyRevenue * (i <= 0 ? 0.85 : 0.9));
      }

      months.push({
        key: monthKey,
        label: monthLabel,
        expectedRevenue: Math.round(expectedMinor / 100),
        collectedRevenue: Math.round(collectedMinor / 100),
        activePlans: activeInMonth,
      });
    }

    return months;
  }, [paymentPlans, defaulters, dashboard.monthlyRevenue]);

  // 2. Payment plan health & band distribution data for donut chart
  const bandDistributionData = useMemo(() => {
    return [
      { name: progressBandLabels.green, key: 'green', value: dashboard.byBand.green, color: tokens.band.green },
      { name: progressBandLabels.light_green, key: 'light_green', value: dashboard.byBand.light_green, color: tokens.band.light_green },
      { name: progressBandLabels.yellow, key: 'yellow', value: dashboard.byBand.yellow, color: tokens.band.yellow },
      { name: progressBandLabels.red, key: 'red', value: dashboard.byBand.red, color: tokens.band.red },
    ];
  }, [dashboard.byBand]);

  const totalBandPlans = useMemo(() => {
    return bandDistributionData.reduce((sum, item) => sum + item.value, 0);
  }, [bandDistributionData]);

  const healthyPercent = useMemo(() => {
    if (totalBandPlans === 0) return 100;
    const healthy = dashboard.byBand.green + dashboard.byBand.light_green;
    return Math.round((healthy / totalBandPlans) * 100);
  }, [dashboard.byBand, totalBandPlans]);

  // 3. Collection pipeline and due aging data
  const collectionAgingData = useMemo(() => {
    let criticalOverdueCount = 0;
    let criticalOverdueMinor = 0;
    let regularOverdueCount = 0;
    let regularOverdueMinor = 0;

    defaulters.forEach((d: any) => {
      const days = d.daysOverdue ?? 0;
      const amt = d.overdueAmountMinor ?? 0;
      if (days > 14) {
        criticalOverdueCount++;
        criticalOverdueMinor += amt;
      } else {
        regularOverdueCount++;
        regularOverdueMinor += amt;
      }
    });

    let due48hCount = 0;
    let due48hMinor = 0;
    let dueWeekCount = 0;
    let dueWeekMinor = 0;

    dueSoon.forEach((d: any) => {
      const daysUntil = Math.ceil(
        (new Date(d.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      const amt = d.amountMinor ?? 0;
      if (daysUntil <= 2) {
        due48hCount++;
        due48hMinor += amt;
      } else {
        dueWeekCount++;
        dueWeekMinor += amt;
      }
    });

    const onTrackPlansCount = Math.max(0, paymentPlans.length - defaulters.length - dueSoon.length);
    const onTrackMinor =
      onTrackPlansCount *
      (dashboard.monthlyRevenue > 0
        ? Math.round(dashboard.monthlyRevenue / Math.max(paymentPlans.length, 1))
        : 250000);

    return [
      {
        stage: '>14d Overdue',
        count: criticalOverdueCount,
        amountGHS: Math.round(criticalOverdueMinor / 100),
        color: '#ff4d4f',
        tag: 'Critical',
      },
      {
        stage: '1-14d Overdue',
        count: regularOverdueCount,
        amountGHS: Math.round(regularOverdueMinor / 100),
        color: '#fa8c16',
        tag: 'Attention',
      },
      {
        stage: 'Due ≤ 48h',
        count: due48hCount,
        amountGHS: Math.round(due48hMinor / 100),
        color: '#faad14',
        tag: 'Urgent',
      },
      {
        stage: 'Due This Week',
        count: dueWeekCount,
        amountGHS: Math.round(dueWeekMinor / 100),
        color: '#1890ff',
        tag: 'Upcoming',
      },
      {
        stage: 'On Track',
        count: onTrackPlansCount,
        amountGHS: Math.round(onTrackMinor / 100),
        color: '#52c41a',
        tag: 'Healthy',
      },
    ];
  }, [defaulters, dueSoon, paymentPlans, dashboard.monthlyRevenue]);

  // 4. Customer & property portfolio breakdown data
  const customerPortfolioData = useMemo(() => {
    const paymentPlanCustomers = customers.filter((c: any) => c.type === 'payment_plan').length;
    const outrightCustomers = customers.filter((c: any) => c.type === 'outright').length;
    const deedsIssued = properties.filter((p: any) => p.deedGenerated).length;
    const pendingDeeds = properties.filter((p: any) => p.status === 'sold' && !p.deedGenerated).length;

    return [
      { name: 'Payment Plans', count: paymentPlanCustomers, color: '#1677ff', icon: '💳' },
      { name: 'Outright Buyers', count: outrightCustomers, color: '#52c41a', icon: '💰' },
      { name: 'Deeds Issued', count: deedsIssued, color: '#722ed1', icon: '📜' },
      { name: 'Pending Deeds', count: pendingDeeds, color: '#faad14', icon: '⏳' },
    ];
  }, [customers, properties]);

  // Active month reference for KPI badges
  const currentMonthPoint = useMemo(() => {
    const currentKey = dayjs().format('YYYY-MM');
    return cashFlowTrendData.find((p) => p.key === currentKey) || cashFlowTrendData[cashFlowTrendData.length - 1];
  }, [cashFlowTrendData]);

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
      render: (phone: string) =>
        phone ? (
          <a href={`tel:${phone}`}><PhoneOutlined /> {phone}</a>
        ) : (
          <Text type="secondary">—</Text>
        ),
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
      render: (_: any, record: any) => {
        const custPlan = paymentPlans.find(
          (p: any) => p.customerId === record.customerId || p.id === record.planId
        );
        return (
          <Space size={4}>
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
            {custPlan && (
              <Button
                type="link"
                size="small"
                onClick={() => {
                  setStatementPlan(custPlan);
                  setStatementCustomerName(record.name);
                  setStatementCustomerPhone(record.phone);
                  setStatementPropertyName(
                    propertyMap[custPlan.propertyId]?.houseNumber || propertyMap[custPlan.propertyId]?.title
                  );
                  setStatementModalOpen(true);
                }}
              >
                Statement
              </Button>
            )}
          </Space>
        );
      },
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
      render: (phone: string) =>
        phone ? (
          <a href={`tel:${phone}`}><PhoneOutlined /> {phone}</a>
        ) : (
          <Text type="secondary">—</Text>
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
        const daysUntil = Math.ceil(
          (new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        const formattedDate = dayjs(date).isValid() ? dayjs(date).format('D MMM YYYY') : date;
        return (
          <Space direction="vertical" size={2}>
            <Tag color={daysUntil <= 2 ? 'red' : daysUntil <= 7 ? 'orange' : 'blue'}>
              {daysUntil < 0 ? `${Math.abs(daysUntil)} days overdue` : daysUntil === 0 ? 'Due Today' : `${daysUntil} days left`}
            </Tag>
            <Text type="secondary" style={{ fontSize: 11 }}>{formattedDate}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => {
        const custPlan = paymentPlans.find(
          (p: any) => p.customerId === record.customerId || p.id === record.planId
        );
        return (
          <Space size={4}>
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
            {custPlan && (
              <Button
                type="link"
                size="small"
                onClick={() => {
                  setStatementPlan(custPlan);
                  setStatementCustomerName(record.name);
                  setStatementCustomerPhone(record.phone);
                  setStatementPropertyName(
                    propertyMap[custPlan.propertyId]?.houseNumber || propertyMap[custPlan.propertyId]?.title
                  );
                  setStatementModalOpen(true);
                }}
              >
                Statement
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  // ── Secretary Prospects Tab Table & Columns ──────────────────────────────
  const filteredSecretaryProspects = useMemo(() => {
    return secretaryProspects.filter((p) => {
      const q = prospectSearchText.trim().toLowerCase();
      const matchSearch =
        !q ||
        `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase().includes(q) ||
        (p.phoneNumber && p.phoneNumber.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q)) ||
        (p.reasonForContact && p.reasonForContact.toLowerCase().includes(q));

      const matchStatus =
        prospectStatusFilter === 'all' ||
        p.status === prospectStatusFilter ||
        (prospectStatusFilter === 'converted' && (p as any).converted);

      return matchSearch && matchStatus;
    });
  }, [secretaryProspects, prospectSearchText, prospectStatusFilter]);

  const secretaryProspectColumns = [
    {
      title: 'Prospect Name',
      key: 'name',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>
            {record.firstName} {record.lastName}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <PhoneOutlined style={{ marginRight: 4 }} />
            {record.phoneNumber || 'No phone'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Address / Location',
      dataIndex: 'address',
      key: 'address',
      render: (addr: string) => addr || '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <StatusTag status={status} type="prospect" />,
    },
    {
      title: 'Reason / Interest',
      dataIndex: 'reasonForContact',
      key: 'reasonForContact',
      ellipsis: true,
      render: (text: string) => text || '—',
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      render: (source: string) => (
        <Tag color="cyan" style={{ textTransform: 'capitalize' }}>
          {source ? source.replace(/_/g, ' ') : 'Desk Inquiry'}
        </Tag>
      ),
    },
    {
      title: 'Date Logged',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => (d ? dayjs(d).format('DD MMM YYYY') : '—'),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size={4}>
          <Button
            type="primary"
            size="small"
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
            onClick={() => {
              form.setFieldsValue({
                firstName: record.firstName,
                lastName: record.lastName,
                phoneNumber: record.phoneNumber,
                address: record.address,
                type: 'payment_plan',
              });
              setAddCustomerModal(true);
            }}
          >
            Convert to Customer
          </Button>
          <Button
            size="small"
            onClick={() =>
              navigate(`/marketing/prospects?search=${encodeURIComponent(record.phoneNumber || record.lastName || '')}`)
            }
          >
            View
          </Button>
        </Space>
      ),
    },
  ];

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddCustomer = async (values: any) => {
    try {
      setLoading(true);

      // Hard pre-submission rejection guard
      assertNoCustomerDuplicates(
        {
          firstName: values.firstName,
          lastName: values.lastName,
          phoneNumber: values.phoneNumber,
        },
        {
          existingCustomers: existingCustomersList,
          existingProspects: existingProspectsList,
        }
      );

      // POST /customers requires a `createPlan` object when type is
      // 'payment_plan' — omitting it (as this used to) fails validation on
      // every submission.
      const createPlan = values.type === 'payment_plan'
        ? {
            totalAmountMinor: Math.round(values.totalAmount * 100),
            downPaymentMinor: Math.round(values.downPayment * 100),
            planBasis: values.planBasis,
            numMonths: values.planBasis === 'months' ? values.numMonths : undefined,
            monthlyAmountMinor: values.planBasis === 'monthly_amount' ? Math.round(values.monthlyAmount * 100) : undefined,
            startDate: values.startDate.format('YYYY-MM-DD'),
          }
        : undefined;

      const newCust = await createCustomer.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        phoneNumber: values.phoneNumber,
        address: values.address,
        type: values.type,
        propertyId: values.propertyId,
        createPlan,
      });

      if (createPlan && (newCust as any)?.id) {
        const balanceMinor = Math.max(createPlan.totalAmountMinor - createPlan.downPaymentMinor, 0);
        const planObj: any = {
          id: `plan-${(newCust as any).id}`,
          customerId: (newCust as any).id,
          propertyId: values.propertyId,
          totalAmountMinor: createPlan.totalAmountMinor,
          downPaymentMinor: createPlan.downPaymentMinor,
          balanceMinor,
          numMonths: createPlan.numMonths || 6,
          monthlyAmountMinor: createPlan.monthlyAmountMinor || Math.round(balanceMinor / Math.max(createPlan.numMonths || 6, 1)),
          currency: 'GHS',
          startDate: createPlan.startDate,
          status: 'active',
          progressPercent: createPlan.totalAmountMinor > 0 ? Math.round((createPlan.downPaymentMinor / createPlan.totalAmountMinor) * 100) : 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        saveStoredPaymentPlan(planObj).catch(() => {});
        saveCustomerPlanDefinition((newCust as any).id, planObj).catch(() => {});
      }

      message.success('Customer added successfully!');
      setAddCustomerModal(false);
      form.resetFields();
      refetchCustomers();
      refetchPaymentPlans();
      refetchDashboard();
    } catch (error: any) {
      message.error(error?.error?.message || error?.message || 'Failed to add customer');
    } finally {
      setLoading(false);
    }
  };



  const handleInitiateExpense = async (values: any) => {
    try {
      setExpenseLoading(true);
      const amountMinor = Math.round(values.amountGHS * 100);
      await createExpenseMutation.mutateAsync({
        category: values.category,
        type: values.type || 'internal',
        amountMinor,
        incurredOn: values.incurredOn.format('YYYY-MM-DD'),
        description: values.description,
        branchId: user?.branchId,
        recordedByUserId: user?.id,
        recordedByUserName: user?.firstName ? `${user.firstName} ${user.lastName}` : 'Secretary',
        recordedByUserRole: 'secretary',
      });
      message.success('Expense submitted successfully for Admin & Accounts approval!');
      setAddExpenseModal(false);
      expenseForm.resetFields();
    } catch (err: any) {
      message.error(err?.message || 'Failed to initiate expense');
    } finally {
      setExpenseLoading(false);
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
        <Space wrap>
          <Button 
            icon={<UserAddOutlined />} 
            onClick={() => setAddProspectModal(true)}
          >
            Add Prospect
          </Button>
          <Button 
            icon={<PlusOutlined />} 
            type="primary"
            onClick={() => setAddCustomerModal(true)}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
          >
            Add Customer
          </Button>
          <Button
            icon={<DollarOutlined />}
            onClick={() => setAddExpenseModal(true)}
          >
            Record Expense
          </Button>
          <Button 
            icon={<IdcardOutlined />} 
            onClick={() => setActiveTab('checkins')}
          >
            Front-Desk Check-Ins
            {activeVisitorsCount > 0 && (
              <Badge count={activeVisitorsCount} size="small" style={{ backgroundColor: '#52c41a', marginLeft: 6 }} />
            )}
          </Button>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* ── Stats Cards: 6 Key Metrics (including Secretary Prospect Portfolio & Conversion) ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={4}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
              border: '1px solid #f0f0f0',
              borderTop: `3px solid ${tokens.primary}`,
            }}
          >
            <Statistic
              title={<span style={{ fontWeight: 500, color: '#595959' }}>Total Customers</span>}
              value={dashboard.totalCustomers}
              prefix={<TeamOutlined style={{ color: tokens.primary, marginRight: 6 }} />}
              valueStyle={{ color: tokens.primary, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
              border: '1px solid #f0f0f0',
              borderTop: '3px solid #52c41a',
            }}
          >
            <Statistic
              title={<span style={{ fontWeight: 500, color: '#595959' }}>Active Payment Plans</span>}
              value={dashboard.activePlans}
              prefix={<DollarOutlined style={{ color: '#52c41a', marginRight: 6 }} />}
              valueStyle={{ color: '#52c41a', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
              border: '1px solid #f0f0f0',
              borderTop: '3px solid #1890ff',
            }}
          >
            <Statistic
              title={<span style={{ fontWeight: 500, color: '#595959' }}>Total Deeds</span>}
              value={dashboard.totalDeeds}
              prefix={<FileTextOutlined style={{ color: '#1890ff', marginRight: 6 }} />}
              valueStyle={{ color: '#1890ff', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
              border: '1px solid #f0f0f0',
              borderTop: '3px solid #722ed1',
            }}
          >
            <Statistic
              title={<span style={{ fontWeight: 500, color: '#595959' }}>Monthly Revenue</span>}
              value={dashboard.monthlyRevenue / 100}
              prefix="GHS"
              precision={2}
              valueStyle={{ color: '#722ed1', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
              border: '1px solid #f0f0f0',
              borderTop: '3px solid #13c2c2',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('prospects')}
          >
            <Statistic
              title={<span style={{ fontWeight: 500, color: '#595959' }}>My Logged Prospects</span>}
              value={secretaryProspects.length}
              prefix={<UserAddOutlined style={{ color: '#13c2c2', marginRight: 6 }} />}
              valueStyle={{ color: '#13c2c2', fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {secretaryConverted.length} converted to customers &rarr;
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
              border: '1px solid #f0f0f0',
              borderTop: '3px solid #fa8c16',
            }}
          >
            <Statistic
              title={<span style={{ fontWeight: 500, color: '#595959' }}>Front-Desk Conversion</span>}
              value={secretaryConversionRate}
              suffix="%"
              prefix={<RiseOutlined style={{ color: '#fa8c16', marginRight: 6 }} />}
              valueStyle={{ color: '#fa8c16', fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {secretaryProspects.length} total desk inquiries
            </Text>
          </Card>
        </Col>
      </Row>

      {/* ── Dashboard Navigation Tabs ────────────────────────────────────────── */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginBottom: 24 }}
        items={[
          {
            key: 'overview',
            label: (
              <span>
                <DashboardOutlined /> Overview & Analytics
              </span>
            ),
            children: (
              <>
                {/* ── Financial & Operational Live Analytics Charts ──────────────────── */}
                <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <RiseOutlined style={{ color: tokens.primary }} /> Live Performance & Collections Analytics
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Real-time cash flow trajectory, portfolio health distribution, and collection aging pipeline
            </Text>
          </div>
          <Space>
            <Tag color="blue" icon={<ClockCircleOutlined />} style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12 }}>
              Live Data
            </Tag>
            {currentMonthPoint && (
              <Tag color="green" style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12 }}>
                Current Month: GHS {currentMonthPoint.collectedRevenue.toLocaleString()} Inflow
              </Tag>
            )}
          </Space>
        </div>

        {/* Row 1: Cash Flow Trajectory & Plan Health Donut */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={15}>
            <Card
              title={
                <Space>
                  <RiseOutlined style={{ color: tokens.primary }} />
                  <span>Monthly Inflow & Cash Flow Trajectory</span>
                </Space>
              }
              extra={
                <Space size={8} wrap>
                  <Badge color="#1677ff" text={<span style={{ fontSize: 12, color: '#595959' }}>Expected</span>} />
                  <Badge color="#52c41a" text={<span style={{ fontSize: 12, color: '#595959' }}>Collected / Projected</span>} />
                </Space>
              }
              style={{
                borderRadius: 12,
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                border: '1px solid #f0f0f0',
              }}
            >
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={cashFlowTrendData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1677ff" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#1677ff" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#52c41a" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#52c41a" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="label" stroke="#8c8c8c" fontSize={12} tickLine={false} />
                    <YAxis
                      stroke="#8c8c8c"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `GHS ${(v / 1000).toFixed(0)}k`}
                    />
                    <RechartsTooltip content={<CustomChartTooltip />} />
                    <Area
                      type="monotone"
                      name="Expected Inflow"
                      dataKey="expectedRevenue"
                      stroke="#1677ff"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorExpected)"
                    />
                    <Area
                      type="monotone"
                      name="Collected / Projected"
                      dataKey="collectedRevenue"
                      stroke="#52c41a"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorCollected)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={9}>
            <Card
              title={
                <Space>
                  <PieChartOutlined style={{ color: '#722ed1' }} />
                  <span>Portfolio Health & Risk Bands</span>
                </Space>
              }
              extra={
                <Tag color={healthyPercent >= 75 ? 'green' : healthyPercent >= 50 ? 'orange' : 'red'}>
                  {healthyPercent}% Healthy
                </Tag>
              }
              style={{
                borderRadius: 12,
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                border: '1px solid #f0f0f0',
              }}
            >
              <div style={{ position: 'relative', width: '100%', height: 210 }}>
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      data={bandDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={88}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {bandDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CustomChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#1f1f1f', lineHeight: 1.1 }}>
                    {healthyPercent}%
                  </div>
                  <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 600, textTransform: 'uppercase' }}>
                    On Track
                  </div>
                </div>
              </div>

              {/* Interactive Band Badges */}
              <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
                {bandDistributionData.map((band) => (
                  <Col span={12} key={band.key}>
                    <div
                      onClick={() => navigate(`/payment-plans?band=${band.key}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: 8,
                        background: '#fafafa',
                        cursor: 'pointer',
                        border: '1px solid #f0f0f0',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = band.color;
                        e.currentTarget.style.background = '#f9f9f9';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#f0f0f0';
                        e.currentTarget.style.background = '#fafafa';
                      }}
                    >
                      <Space size={6}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: band.color,
                            display: 'inline-block',
                          }}
                        />
                        <Text style={{ fontSize: 12 }}>{band.name}</Text>
                      </Space>
                      <span style={{ fontWeight: 700, fontSize: 12, color: band.color }}>
                        {band.value}
                      </span>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        </Row>

        {/* Row 2: Collection Pipeline Aging & Customer Distribution */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={13}>
            <Card
              title={
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <Space>
                    <ClockCircleOutlined style={{ color: '#fa8c16' }} />
                    <span>Collection Pipeline & Due Aging</span>
                  </Space>
                  <Segmented
                    size="small"
                    options={[
                      { label: 'Amount (GHS)', value: 'amount' },
                      { label: 'Client Count', value: 'count' },
                    ]}
                    value={pipelineMetric}
                    onChange={(val) => setPipelineMetric(val as any)}
                  />
                </div>
              }
              style={{
                borderRadius: 12,
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                border: '1px solid #f0f0f0',
              }}
            >
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={collectionAgingData} margin={{ top: 15, right: 15, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="stage" stroke="#8c8c8c" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#8c8c8c"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (pipelineMetric === 'amount' ? `GHS ${(v / 1000).toFixed(0)}k` : `${v}`)}
                    />
                    <RechartsTooltip content={<CustomChartTooltip />} />
                    <Bar
                      name={pipelineMetric === 'amount' ? 'Total Amount (GHS)' : 'Clients'}
                      dataKey={pipelineMetric === 'amount' ? 'amountGHS' : 'count'}
                      radius={[6, 6, 0, 0]}
                    >
                      {collectionAgingData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Summary Stage Chips */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 10,
                  padding: '4px 6px',
                  background: '#fafafa',
                  borderRadius: 8,
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                {collectionAgingData.map((stage) => (
                  <div key={stage.stage} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>{stage.stage}</div>
                    <div style={{ fontWeight: 700, fontSize: 12, color: stage.color }}>
                      {pipelineMetric === 'amount'
                        ? `GHS ${(stage.amountGHS / 1000).toFixed(1)}k`
                        : `${stage.count} clients`}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={11}>
            <Card
              title={
                <Space>
                  <TeamOutlined style={{ color: tokens.primary }} />
                  <span>Customer & Contract Portfolio Breakdown</span>
                </Space>
              }
              extra={<Tag color="purple">{customers.length} Total Customers</Tag>}
              style={{
                borderRadius: 12,
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                border: '1px solid #f0f0f0',
              }}
            >
              <div style={{ width: '100%', height: 140, marginBottom: 12 }}>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart
                    data={customerPortfolioData}
                    layout="vertical"
                    margin={{ top: 5, right: 25, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" stroke="#8c8c8c" fontSize={11} tickLine={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#595959"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={100}
                    />
                    <RechartsTooltip content={<CustomChartTooltip />} />
                    <Bar dataKey="count" name="Count" radius={[0, 6, 6, 0]}>
                      {customerPortfolioData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Portfolio Breakdown 2x2 Metric Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {customerPortfolioData.map((item) => (
                  <div
                    key={item.name}
                    style={{
                      background: '#fafafa',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #f0f0f0',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>{item.name}</Text>
                      <span style={{ fontSize: 14 }}>{item.icon}</span>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>
                      {item.count}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        </Row>

        {/* Row 3: Marketing vs CS Prospects Distribution */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <ProspectsSourcePieChart prospects={existingProspectsList} />
          </Col>
        </Row>

        {/* Row 4: Staff Prospect Interactions Timeline */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <ProspectInteractionsTimeline />
          </Col>
        </Row>
      </div>

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
              </>
            ),
          },
          {
            key: 'prospects',
            label: (
              <span>
                <UserAddOutlined /> My Logged Prospects ({secretaryProspects.length})
              </span>
            ),
            children: (
              <Card
                style={{
                  borderRadius: 12,
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                  border: '1px solid #f0f0f0',
                  marginBottom: 24,
                }}
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <Space>
                        <UserAddOutlined style={{ color: tokens.primary }} />
                        <span>Front-Desk Prospects & Inquiries</span>
                      </Space>
                      <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 'normal', marginTop: 2 }}>
                        Prospects registered at branch front-desk by {user?.firstName} &bull; {secretaryConverted.length} converted ({secretaryConversionRate}% conversion rate)
                      </div>
                    </div>
                    <Space wrap>
                      <Input
                        placeholder="Search prospects..."
                        prefix={<SearchOutlined />}
                        allowClear
                        value={prospectSearchText}
                        onChange={(e) => setProspectSearchText(e.target.value)}
                        style={{ width: 220 }}
                      />
                      <Select
                        value={prospectStatusFilter}
                        onChange={setProspectStatusFilter}
                        style={{ width: 170 }}
                      >
                        <Option value="all">All Statuses</Option>
                        <Option value="new">New</Option>
                        <Option value="meeting_scheduled">Meeting Scheduled</Option>
                        <Option value="meeting_completed">Meeting Completed</Option>
                        <Option value="converted">Converted</Option>
                      </Select>
                      <Button
                        type="primary"
                        icon={<UserAddOutlined />}
                        onClick={() => setAddProspectModal(true)}
                      >
                        Add Prospect
                      </Button>
                    </Space>
                  </div>
                }
              >
                <Table
                  columns={secretaryProspectColumns}
                  dataSource={filteredSecretaryProspects}
                  rowKey="id"
                  pagination={{ pageSize: 8 }}
                  size="small"
                />
              </Card>
            ),
          },
          {
            key: 'collections',
            label: (
              <span>
                <DollarOutlined /> Collections & Defaulters ({dashboard.defaulters.length + dashboard.dueSoon.length})
              </span>
            ),
            children: (
              <div style={{ marginBottom: 24 }}>
                <Card
                  style={{
                    marginBottom: 24,
                    borderRadius: 12,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                    border: '1px solid #f0f0f0',
                  }}
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
                      scroll={{ x: 700 }}
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

                <Card
                  style={{
                    borderRadius: 12,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                    border: '1px solid #f0f0f0',
                  }}
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
                      scroll={{ x: 700 }}
                    />
                  ) : (
                    <Empty description="No payments due soon" />
                  )}
                </Card>
              </div>
            ),
          },
          {
            key: 'expenses',
            label: (
              <span>
                <DollarOutlined /> Operational Expenses (Secretary)
              </span>
            ),
            children: (
              <div style={{ marginTop: 8 }}>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <Title level={4} style={{ margin: 0 }}>
                      Secretary Petty Cash & Operational Expenses
                    </Title>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Daily tracking, automated 24-hour cycle resetting, and multi-tier approval workflow
                    </Text>
                  </div>
                  <Button
                    type="primary"
                    icon={<DollarOutlined />}
                    onClick={() => setAddExpenseModal(true)}
                    style={{ background: tokens.primary }}
                  >
                    Initiate Operational Expense
                  </Button>
                </div>
                <RoleExpenseDashboard fixedRole="secretary" compact />
              </div>
            ),
          },
          {
            key: 'checkins',
            label: (
              <span>
                <IdcardOutlined /> Front-Desk Check-Ins {activeVisitorsCount > 0 && `(${activeVisitorsCount})`}
              </span>
            ),
            children: (
              <div style={{ marginTop: 8 }}>
                <ClientCheckInsTable
                  title="Branch Front-Desk Client & Visitor Check-Ins"
                  branchId={userBranchId}
                />
              </div>
            ),
          },
        ]}
      />

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
        <Form form={form} layout="vertical" onFinish={handleAddCustomer} initialValues={{ type: 'payment_plan', planBasis: 'months' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="firstName"
                label="First Name"
                rules={[
                  { required: true, message: 'First name is required' },
                  createDuplicateNameRule({
                    entityType: 'customer',
                    isFirstName: true,
                    getOtherName: () => form.getFieldValue('lastName'),
                    getExistingCustomers: () => existingCustomersList,
                    getExistingProspects: () => existingProspectsList,
                  }),
                ]}
              >
                <Input placeholder="First name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="lastName"
                label="Last Name"
                rules={[
                  { required: true, message: 'Last name is required' },
                  createDuplicateNameRule({
                    entityType: 'customer',
                    isFirstName: false,
                    getOtherName: () => form.getFieldValue('firstName'),
                    getExistingCustomers: () => existingCustomersList,
                    getExistingProspects: () => existingProspectsList,
                  }),
                ]}
              >
                <Input placeholder="Last name" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="phoneNumber"
            label="Phone Number"
            rules={[
              { required: true, message: 'Phone number is required' },
              createDuplicatePhoneRule({
                entityType: 'customer',
                getExistingCustomers: () => existingCustomersList,
                getExistingProspects: () => existingProspectsList,
              }),
            ]}
          >
            <PhoneInput />
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

          <Form.Item name="type" label="Customer Type" rules={[{ required: true }]}>
            <Select>
              <Option value="payment_plan">Payment Plan</Option>
              <Option value="fully_paid">Fully Paid</Option>
            </Select>
          </Form.Item>

          <Form.Item shouldUpdate={(prev, cur) => prev.type !== cur.type || prev.planBasis !== cur.planBasis} noStyle>
            {({ getFieldValue }) => {
              if (getFieldValue('type') !== 'payment_plan') return null;
              const planBasis = getFieldValue('planBasis') || 'months';
              return (
                <>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="totalAmount"
                        label="Total Amount (GHS)"
                        rules={[{ required: true, message: 'Total amount is required' }]}
                      >
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 150000" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="downPayment"
                        label="Down Payment (GHS)"
                        rules={[{ required: true, message: 'Down payment is required' }]}
                      >
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 30000" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item name="planBasis" label="Plan Basis" rules={[{ required: true }]}>
                    <Select>
                      <Option value="months">Fixed number of months</Option>
                      <Option value="monthly_amount">Fixed monthly amount</Option>
                    </Select>
                  </Form.Item>

                  {planBasis === 'months' ? (
                    <Form.Item
                      name="numMonths"
                      label="Number of Months"
                      rules={[{ required: true, message: 'Number of months is required' }]}
                    >
                      <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 24" />
                    </Form.Item>
                  ) : (
                    <Form.Item
                      name="monthlyAmount"
                      label="Monthly Amount (GHS)"
                      rules={[{ required: true, message: 'Monthly amount is required' }]}
                    >
                      <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 3000" />
                    </Form.Item>
                  )}

                  <Form.Item
                    name="startDate"
                    label="First Installment Date"
                    rules={[{ required: true, message: 'Start date is required' }]}
                    initialValue={dayjs()}
                  >
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </>
              );
            }}
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

      {/* ── Unified Record Payment Modal (Dynamic Amortization & Flexible Installment Engine) ── */}
      <RecordPaymentModal
        open={addPaymentModal}
        onClose={() => {
          setAddPaymentModal(false);
          setSelectedCustomer(null);
        }}
        customer={selectedCustomer}
        onSuccess={() => {
          refetchPaymentPlans();
          refetchDashboard();
        }}
      />


      <AddProspectModal
        open={addProspectModal}
        onClose={() => setAddProspectModal(false)}
        onSuccess={() => {
          handleRefresh();
        }}
      />

      {/* ── Record Operational Expense Modal ── */}
      <Modal
        title={
          <Space>
            <DollarOutlined style={{ color: tokens.primary }} />
            <span>Initiate Operational Expense (Secretary)</span>
          </Space>
        }
        open={addExpenseModal}
        onCancel={() => {
          setAddExpenseModal(false);
          expenseForm.resetFields();
        }}
        footer={null}
        width={540}
      >
        <Form form={expenseForm} layout="vertical" onFinish={handleInitiateExpense}>
          <Alert
            type="info"
            showIcon
            message="Pending Approval Workflow"
            description="All operational expenses initiated by the Secretary Dashboard will be placed in 'pending' status for review and authorization by Admin and Accounts dashboards."
            style={{ marginBottom: 16 }}
          />

          <Row gutter={12}>
            <Col span={14}>
              <Form.Item
                name="category"
                label="Expense Category"
                rules={[{ required: true, message: 'Please pick category' }]}
                initialValue="Office Supplies"
              >
                <Select placeholder="Select category">
                  <Option value="Office Supplies">Office Supplies & Stationery</Option>
                  <Option value="Client Hospitality">Client Hospitality & Refreshments</Option>
                  <Option value="Courier & Dispatch">Courier & Dispatch Services</Option>
                  <Option value="Utilities & Internet">Utilities & Internet</Option>
                  <Option value="Fuel & Transport">Fuel & Transport</Option>
                  <Option value="Maintenance & Repairs">Maintenance & Repairs</Option>
                  <Option value="Other">Other Operational Cost</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="type" label="Expense Type" initialValue="internal" rules={[{ required: true }]}>
                <Select>
                  <Option value="internal">🏢 Internal Operations</Option>
                  <Option value="external">🚚 External / Project</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="amountGHS"
                label="Amount (GH₵)"
                rules={[{ required: true, message: 'Enter amount' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0.01} precision={2} prefix="GH₵" placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="incurredOn"
                label="Incurred Date"
                initialValue={dayjs()}
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Detailed Purpose / Notes"
            rules={[{ required: true, message: 'Explain what this expense is for' }]}
          >
            <Input.TextArea rows={3} placeholder="Provide details on the purchase, receipt number, vendor, or purpose..." />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setAddExpenseModal(false);
                expenseForm.resetFields();
              }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={expenseLoading}>
                Submit Expense for Approval
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Official Dynamic Payment Receipt Modal ──────────────────────── */}
      <PaymentReceiptModal
        open={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        receipt={receiptData}
      />

      {/* ── Official Customer Statement & Dynamic Amortization Ledger Modal ─ */}
      <CustomerStatementModal
        open={statementModalOpen}
        onClose={() => setStatementModalOpen(false)}
        plan={statementPlan}
        customerName={statementCustomerName}
        customerPhone={statementCustomerPhone}
        propertyName={statementPropertyName}
      />
    </div>
  );
};