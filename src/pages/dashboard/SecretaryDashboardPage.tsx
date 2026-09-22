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
import { useProspectsQuery } from '@/api/prospects';
import { usePaymentPlansQuery, getProgressBand } from '@/api/paymentPlans';
import { useRecordPaymentMutation } from '@/api/payments';
import { useCreateExpenseMutation } from '@/api/expenses';
import { usePropertiesQuery } from '@/api/properties';
import { useBranchesQuery } from '@/api/branches';
import {
  buildPaymentPlanSchedule,
  getPlanPaymentOverrides,
  recordLocalInstallmentPayment,
  usePaymentPlanScheduleListener,
} from '@/utils/paymentPlanSchedule';
import { dispatchPaymentReceiptSMS } from '@/utils/paymentNotificationService';
import type { PaymentPlan, PaymentPlanStatus } from '@/types';
import { filterEntitiesByBranch, tagPayloadWithBranch } from '@/utils/branchIsolation';
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
import { ProspectsSourcePieChart } from '@/components/dashboard/ProspectsSourcePieChart';
import { ProspectInteractionsTimeline } from '@/components/dashboard/ProspectInteractionsTimeline';
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
  const existingCustomersList = customersData?.items ?? [];
  const existingProspectsList = prospectsData?.items ?? [];

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
  const [paymentForm] = Form.useForm();
  const [expenseForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [pipelineMetric, setPipelineMetric] = useState<'amount' | 'count'>('amount');

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

      await createCustomer.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        phoneNumber: values.phoneNumber,
        address: values.address,
        type: values.type,
        propertyId: values.propertyId,
        createPlan,
      });
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

  const handleRecordPayment = async (values: any) => {
    if (!selectedPlan) {
      message.error('No active payment plan found for this customer');
      return;
    }

    try {
      setLoading(true);
      const amountMinor = Math.round(values.amount * 100);
      const paidOn = values.paymentDate.format('YYYY-MM-DD');
      const method = values.method;
      const reference = values.reference || `REC-SEC-${Date.now().toString().slice(-4)}`;

      // 1. Record locally so UI updates reactively and persists across schedule components
      recordLocalInstallmentPayment(selectedPlan.id, 1, amountMinor, method, reference, paidOn);

      // 2. Persist to real backend if valid backend plan ID exists
      if (selectedPlan.id && !selectedPlan.id.startsWith('plan-')) {
        try {
          await recordPayment.mutateAsync({
            amountMinor,
            paidOn,
            method,
            reference,
          });
        } catch (apiErr) {
          console.warn('[SecretaryDashboard] Backend payment record fallback:', apiErr);
        }
      }

      // 3. Dispatch automated SMS receipt to customer
      const cust = customerMap[selectedPlan.customerId] || selectedCustomer;
      const phone = cust?.phone || cust?.phoneNumber || selectedCustomer?.phone;
      const name = cust?.name || `${cust?.firstName || ''} ${cust?.lastName || ''}`.trim() || selectedCustomer?.name || 'Customer';
      const remainingBalance = Math.max(0, (selectedPlan.balanceMinor || 0) - amountMinor);
      const prop = propertyMap[selectedPlan.propertyId];

      dispatchPaymentReceiptSMS({
        customerPhone: phone,
        customerName: name,
        amountMinor,
        remainingBalanceMinor: remainingBalance,
        propertyName: prop ? prop.houseNumber || prop.title : undefined,
        reference,
        method,
        recordedBy: user?.firstName ? `${user.firstName} ${user.lastName} (Secretary)` : 'Secretary',
      });

      message.success('Payment recorded successfully!');
      setAddPaymentModal(false);
      paymentForm.resetFields();
      setSelectedCustomer(null);
      refetchPaymentPlans();
      refetchDashboard();
    } catch (error: any) {
      message.error(error?.error?.message || error?.message || 'Failed to record payment');
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
            onClick={() => navigate('/cs/check-ins')}
          >
            Client Check-Ins
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
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
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
        <Col xs={24} sm={12} lg={6}>
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
        <Col xs={24} sm={12} lg={6}>
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
        <Col xs={24} sm={12} lg={6}>
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
      </Row>

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

      {/* ── Action Tables: Full Width Defaulters followed by Due Soon ────────── */}
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
    </div>
  );
};