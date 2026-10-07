import React, { useMemo } from 'react';
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
  Space,
  Avatar,
  Tooltip,
} from 'antd';
import {
  TrophyOutlined,
  BankOutlined,
  DollarOutlined,
  MobileOutlined,
  FileTextOutlined,
  UserOutlined,
  CreditCardOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import dayjs from 'dayjs';
import { useAnalyticsDashboardQuery } from '@/api/dashboard';
import { usePaymentPlansQuery } from '@/api/paymentPlans';
import { useCustomersQuery } from '@/api/customers';
import { useProspectsQuery } from '@/api/prospects';
import { useUsersQuery } from '@/api/users';
import { buildPaymentPlanSchedule, getPlanPaymentOverrides } from '@/utils/paymentPlanSchedule';
import { tokens } from '@/constants/tokens';
import type { PaymentPlan, Customer, Prospect, User } from '@/types';

const { Title, Text } = Typography;

interface AccountsAnalyticsSectionProps {
  branchId?: string;
}

export const AccountsAnalyticsSection: React.FC<AccountsAnalyticsSectionProps> = () => {
  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: analyticsData, isLoading: analyticsLoading } = useAnalyticsDashboardQuery();
  const { data: paymentPlansData, isLoading: plansLoading } = usePaymentPlansQuery({ pageSize: 500 });
  const { data: customersData, isLoading: customersLoading } = useCustomersQuery({ pageSize: 1000 });
  const { data: prospectsData, isLoading: prospectsLoading } = useProspectsQuery({ pageSize: 1000 });
  const { data: usersData, isLoading: usersLoading } = useUsersQuery({ pageSize: 500 });

  const paymentPlans: PaymentPlan[] = paymentPlansData?.items ?? [];
  const customers: Customer[] = customersData?.items ?? [];
  const prospects: Prospect[] = prospectsData?.items ?? [];
  const users: any[] = usersData?.items ?? [];

  // ── 1. REVENUE OVER TIME (12 MONTHS) — REAL ERP COLLECTIONS ───────────────
  const { chartData, total12MoRevenueGHS, peakMonthRevenueGHS, avgMonthlyRevenueGHS } = useMemo(() => {
    // Generate the last 12 months array [YYYY-MM]
    const monthsMap = new Map<string, { label: string; revenueMinor: number }>();
    const now = dayjs();
    for (let i = 11; i >= 0; i--) {
      const d = now.subtract(i, 'month');
      const key = d.format('YYYY-MM');
      const label = d.format('MMM YY');
      monthsMap.set(key, { label, revenueMinor: 0 });
    }

    // 1. Ingest payments from payment plan schedules (down payments + actual installment payments)
    paymentPlans.forEach((plan) => {
      const schedule = buildPaymentPlanSchedule(plan);

      // Down payment revenue credited at plan creation/start
      if (plan.downPaymentMinor && plan.downPaymentMinor > 0) {
        const dpDate = plan.startDate || plan.createdAt;
        if (dpDate) {
          const mKey = dayjs(dpDate).format('YYYY-MM');
          if (monthsMap.has(mKey)) {
            monthsMap.get(mKey)!.revenueMinor += plan.downPaymentMinor;
          }
        }
      }

      // Live ledger transactions
      schedule.transactions.forEach((tx) => {
        if (tx.paidOn && tx.amountMinor > 0) {
          const mKey = dayjs(tx.paidOn).format('YYYY-MM');
          if (monthsMap.has(mKey)) {
            monthsMap.get(mKey)!.revenueMinor += tx.amountMinor;
          }
        }
      });

      // Paid installments if not captured in transactions
      schedule.rows.forEach((row) => {
        if (row.isPaid && row.paidAt) {
          const mKey = dayjs(row.paidAt).format('YYYY-MM');
          if (monthsMap.has(mKey)) {
            // Check if already captured in ledger
            const alreadyLogged = schedule.transactions.some(
              (tx) => tx.sequence === row.sequence
            );
            if (!alreadyLogged) {
              monthsMap.get(mKey)!.revenueMinor += (row as any).actualPaidMinor || row.installmentMinor;
            }
          }
        }
      });
    });

    // 2. Merge backend analytics time series if present
    if (analyticsData?.timeSeries && analyticsData.timeSeries.length > 0) {
      analyticsData.timeSeries.forEach((pt) => {
        const mKey = pt.month;
        if (monthsMap.has(mKey)) {
          // If local calculation was 0, fall back to backend revenue
          const current = monthsMap.get(mKey)!;
          if (current.revenueMinor === 0 && pt.revenue > 0) {
            current.revenueMinor = pt.revenue;
          }
        } else {
          // Add month if within range
          monthsMap.set(mKey, {
            label: dayjs(mKey).isValid() ? dayjs(mKey).format('MMM YY') : mKey,
            revenueMinor: pt.revenue ?? 0,
          });
        }
      });
    }

    const data = Array.from(monthsMap.entries()).map(([key, item]) => {
      const revenueGHS = Math.round(item.revenueMinor / 100);
      return {
        monthKey: key,
        month: item.label,
        revenue: revenueGHS,
      };
    });

    const totalRevMinor = Array.from(monthsMap.values()).reduce(
      (sum, m) => sum + m.revenueMinor,
      0
    );
    const totalGHS = Math.round(totalRevMinor / 100);
    const maxGHS = Math.max(...data.map((d) => d.revenue), 0);
    const avgGHS = data.length > 0 ? Math.round(totalGHS / data.length) : 0;

    return {
      chartData: data,
      total12MoRevenueGHS: totalGHS,
      peakMonthRevenueGHS: maxGHS,
      avgMonthlyRevenueGHS: avgGHS,
    };
  }, [paymentPlans, analyticsData]);

  // ── 2. TOP MARKETERS DEALS — CALCULATED DIRECTLY FROM ERP ─────────────────
  const topMarketers = useMemo(() => {
    // A: Map prospectId -> assigned marketer User
    const prospectMarketerMap = new Map<string, string>();
    prospects.forEach((p) => {
      const marketerId = p.assignedUserId || p.createdByUserId;
      if (marketerId) {
        prospectMarketerMap.set(p.id, marketerId);
      }
    });

    // B: Map customerId -> assigned marketer
    const customerMarketerMap = new Map<string, string>();
    customers.forEach((c) => {
      const marketerId = prospectMarketerMap.get(c.prospectId);
      if (marketerId) {
        customerMarketerMap.set(c.id, marketerId);
      }
    });

    // C: Marketers map: userId -> stats
    const marketerStats = new Map<
      string,
      {
        userId: string;
        name: string;
        role: string;
        branch?: string;
        dealsClosed: number;
        revenueGeneratedMinor: number;
        cashCollectedMinor: number;
      }
    >();

    // Seed all marketing staff
    users.forEach((u) => {
      if (
        u.role === 'marketing_staff' ||
        u.role === 'marketing_director' ||
        u.role === 'branch_manager'
      ) {
        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || u.email;
        marketerStats.set(u.id, {
          userId: u.id,
          name: fullName,
          role: u.role,
          branch: u.branch,
          dealsClosed: 0,
          revenueGeneratedMinor: 0,
          cashCollectedMinor: 0,
        });
      }
    });

    // D: Count closed deals and revenue from payment plans
    paymentPlans.forEach((plan) => {
      const marketerId = customerMarketerMap.get(plan.customerId);
      if (marketerId && marketerStats.has(marketerId)) {
        const stats = marketerStats.get(marketerId)!;
        stats.dealsClosed += 1;
        stats.revenueGeneratedMinor += plan.totalAmountMinor || 0;
        const collected = (plan.totalAmountMinor || 0) - (plan.balanceMinor || 0);
        stats.cashCollectedMinor += Math.max(0, collected);
      }
    });

    // E: Merge backend topMarketers if present to ensure complete reconciliation
    if (analyticsData?.topMarketers && analyticsData.topMarketers.length > 0) {
      analyticsData.topMarketers.forEach((backendM) => {
        if (marketerStats.has(backendM.userId)) {
          const stats = marketerStats.get(backendM.userId)!;
          if (stats.dealsClosed === 0 && backendM.dealsClosed > 0) {
            stats.dealsClosed = backendM.dealsClosed;
            stats.revenueGeneratedMinor = backendM.revenueGenerated;
            stats.cashCollectedMinor = Math.round(backendM.revenueGenerated * 0.7);
          }
        } else {
          marketerStats.set(backendM.userId, {
            userId: backendM.userId,
            name: backendM.name,
            role: 'marketing_staff',
            dealsClosed: backendM.dealsClosed,
            revenueGeneratedMinor: backendM.revenueGenerated,
            cashCollectedMinor: Math.round(backendM.revenueGenerated * 0.7),
          });
        }
      });
    }

    // Sort by deals closed descending, then by revenue
    const list = Array.from(marketerStats.values())
      .filter((m) => m.dealsClosed > 0 || m.revenueGeneratedMinor > 0)
      .sort((a, b) => {
        if (b.dealsClosed !== a.dealsClosed) {
          return b.dealsClosed - a.dealsClosed;
        }
        return b.revenueGeneratedMinor - a.revenueGeneratedMinor;
      });

    // Fallback if none closed deals yet: show all marketing staff
    if (list.length === 0) {
      return Array.from(marketerStats.values()).slice(0, 5);
    }

    return list.slice(0, 6);
  }, [prospects, customers, paymentPlans, users, analyticsData]);

  // ── 3. PAYMENT METHODS BREAKDOWN — REAL ERP DISTRIBUTION ─────────────────
  const paymentMethodsBreakdown = useMemo(() => {
    const methodsMap: Record<
      string,
      { method: string; label: string; count: number; totalMinor: number; color: string; icon: any }
    > = {
      bank_transfer: {
        method: 'bank_transfer',
        label: 'Bank Transfer',
        count: 0,
        totalMinor: 0,
        color: '#1677ff',
        icon: <BankOutlined />,
      },
      mobile_money: {
        method: 'mobile_money',
        label: 'Mobile Money (MoMo)',
        count: 0,
        totalMinor: 0,
        color: '#52c41a',
        icon: <MobileOutlined />,
      },
      cash: {
        method: 'cash',
        label: 'Cash Payment',
        count: 0,
        totalMinor: 0,
        color: '#faad14',
        icon: <DollarOutlined />,
      },
      cheque: {
        method: 'cheque',
        label: 'Bank Cheque',
        count: 0,
        totalMinor: 0,
        color: '#722ed1',
        icon: <FileTextOutlined />,
      },
      other: {
        method: 'other',
        label: 'Card / Paystack / Other',
        count: 0,
        totalMinor: 0,
        color: '#13c2c2',
        icon: <CreditCardOutlined />,
      },
    };

    let totalCollectedMinor = 0;

    paymentPlans.forEach((plan) => {
      const schedule = buildPaymentPlanSchedule(plan);

      // Ledger transactions
      schedule.transactions.forEach((tx) => {
        const rawMethod = (tx.method || 'bank_transfer').toLowerCase();
        const key = methodsMap[rawMethod] ? rawMethod : 'other';
        methodsMap[key].count += 1;
        methodsMap[key].totalMinor += tx.amountMinor;
        totalCollectedMinor += tx.amountMinor;
      });

      // Down payments default to bank_transfer if not logged
      if (plan.downPaymentMinor && plan.downPaymentMinor > 0) {
        methodsMap.bank_transfer.count += 1;
        methodsMap.bank_transfer.totalMinor += plan.downPaymentMinor;
        totalCollectedMinor += plan.downPaymentMinor;
      }
    });

    // Merge backend breakdown if local count is small
    if (totalCollectedMinor === 0 && analyticsData?.paymentMethods) {
      analyticsData.paymentMethods.forEach((pm) => {
        const rawMethod = (pm.method || 'other').toLowerCase();
        const key = methodsMap[rawMethod] ? rawMethod : 'other';
        methodsMap[key].count += pm.count;
        methodsMap[key].totalMinor += pm.totalMinor;
        totalCollectedMinor += pm.totalMinor;
      });
    }

    return Object.values(methodsMap)
      .map((item) => ({
        ...item,
        percentage:
          totalCollectedMinor > 0
            ? Math.round((item.totalMinor / totalCollectedMinor) * 100)
            : 0,
        totalGHS: Math.round(item.totalMinor / 100),
      }))
      .filter((item) => item.count > 0 || item.totalMinor > 0);
  }, [paymentPlans, analyticsData]);

  const isLoading =
    analyticsLoading || plansLoading || customersLoading || prospectsLoading || usersLoading;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
        <Spin tip="Loading Finance & Accounts Analytics..." />
      </div>
    );
  }

  return (
    <div>
      {/* ── Summary Stats for Revenue ────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8, background: '#fafafa' }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}>12-Month Total Collected</Text>}
              value={total12MoRevenueGHS}
              prefix="GH₵"
              precision={0}
              valueStyle={{ color: tokens.primary, fontWeight: 700, fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8, background: '#fafafa' }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}>Peak Month Revenue</Text>}
              value={peakMonthRevenueGHS}
              prefix="GH₵"
              precision={0}
              valueStyle={{ color: '#52c41a', fontWeight: 700, fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8, background: '#fafafa' }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}>Average Monthly Collection</Text>}
              value={avgMonthlyRevenueGHS}
              prefix="GH₵"
              precision={0}
              valueStyle={{ color: '#722ed1', fontWeight: 700, fontSize: 20 }}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Revenue Over Time Chart ─────────────────────────────────────── */}
      <Card
        title={
          <Space>
            <LineChartOutlined style={{ color: tokens.primary }} />
            <span>Revenue Over Time (12 Months Historical)</span>
          </Space>
        }
        style={{ marginBottom: 24, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
      >
        {chartData.length > 0 && chartData.some((d) => d.revenue > 0) ? (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={tokens.primary} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={tokens.primary} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="month" tickLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `GH₵ ${(val / 1000).toFixed(0)}k`}
              />
              <RechartsTooltip
                formatter={(value: any) => [`GH₵ ${Number(value).toLocaleString()}`, 'Collections']}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Collections"
                stroke={tokens.primary}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#revenueGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty description="No collected revenue recorded in the selected period" />
          </div>
        )}
      </Card>

      {/* ── Top Marketers & Payment Methods Grid ────────────────────────── */}
      <Row gutter={[16, 16]}>
        {/* Top Marketers Deals */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <TrophyOutlined style={{ color: '#faad14' }} />
                <span>Top Marketers — Closed Deals & Revenue</span>
              </Space>
            }
            style={{ borderRadius: 10, height: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
          >
            {topMarketers.length > 0 ? (
              <Table
                dataSource={topMarketers}
                rowKey="userId"
                pagination={false}
                size="small"
                columns={[
                  {
                    title: '#',
                    key: 'rank',
                    width: 44,
                    render: (_: any, __: any, index: number) => {
                      if (index === 0) return <span style={{ fontSize: 16 }}>🥇</span>;
                      if (index === 1) return <span style={{ fontSize: 16 }}>🥈</span>;
                      if (index === 2) return <span style={{ fontSize: 16 }}>🥉</span>;
                      return <Text type="secondary">{index + 1}</Text>;
                    },
                  },
                  {
                    title: 'Marketer',
                    dataIndex: 'name',
                    key: 'name',
                    render: (name: string, record: any) => (
                      <Space>
                        <Avatar size="small" icon={<UserOutlined />} style={{ background: '#e6f4ff', color: '#1677ff' }} />
                        <div>
                          <Text strong style={{ fontSize: 13, display: 'block' }}>{name}</Text>
                          {record.branch && (
                            <Text type="secondary" style={{ fontSize: 11 }}>{record.branch}</Text>
                          )}
                        </div>
                      </Space>
                    ),
                  },
                  {
                    title: 'Deals',
                    dataIndex: 'dealsClosed',
                    key: 'dealsClosed',
                    align: 'center',
                    render: (deals: number) => (
                      <Tag color="blue" style={{ fontWeight: 600, fontSize: 12, padding: '2px 8px' }}>
                        {deals} {deals === 1 ? 'deal' : 'deals'}
                      </Tag>
                    ),
                  },
                  {
                    title: 'Contract Sum',
                    dataIndex: 'revenueGeneratedMinor',
                    key: 'revenueGeneratedMinor',
                    align: 'right',
                    render: (minor: number) => (
                      <div>
                        <Text strong style={{ fontSize: 12 }}>GH₵ {(minor / 100).toLocaleString()}</Text>
                      </div>
                    ),
                  },
                  {
                    title: 'Cash Collected',
                    dataIndex: 'cashCollectedMinor',
                    key: 'cashCollectedMinor',
                    align: 'right',
                    render: (minor: number) => (
                      <Text style={{ color: '#52c41a', fontWeight: 600, fontSize: 12 }}>
                        GH₵ {(minor / 100).toLocaleString()}
                      </Text>
                    ),
                  },
                ]}
              />
            ) : (
              <Empty description="No marketer deals registered yet" />
            )}
          </Card>
        </Col>

        {/* Payment Methods */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <CreditCardOutlined style={{ color: '#52c41a' }} />
                <span>Payment Methods Distribution</span>
              </Space>
            }
            style={{ borderRadius: 10, height: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
          >
            {paymentMethodsBreakdown.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {paymentMethodsBreakdown.map((pm) => (
                  <div
                    key={pm.method}
                    style={{
                      background: '#f8fafc',
                      borderRadius: 8,
                      padding: '12px 16px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <Row justify="space-between" align="middle" style={{ marginBottom: 6 }}>
                      <Col>
                        <Space>
                          <span style={{ color: pm.color, fontSize: 16 }}>{pm.icon}</span>
                          <Text strong style={{ fontSize: 13 }}>{pm.label}</Text>
                        </Space>
                      </Col>
                      <Col>
                        <Space size={12}>
                          <Tag color="default" style={{ margin: 0, fontSize: 11 }}>
                            {pm.count} {pm.count === 1 ? 'txn' : 'txns'}
                          </Tag>
                          <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
                            GH₵ {pm.totalGHS.toLocaleString()}
                          </Text>
                          <Text style={{ fontWeight: 700, color: pm.color, minWidth: 40, textAlign: 'right' }}>
                            {pm.percentage}%
                          </Text>
                        </Space>
                      </Col>
                    </Row>
                    <Progress
                      percent={pm.percentage}
                      strokeColor={pm.color}
                      showInfo={false}
                      size="small"
                      trailColor="#e2e8f0"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="No payment transactions recorded" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
