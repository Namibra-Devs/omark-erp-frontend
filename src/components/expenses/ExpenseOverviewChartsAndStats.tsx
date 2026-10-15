// src/components/expenses/ExpenseOverviewChartsAndStats.tsx
import React, { useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Statistic,
  Segmented,
  Select,
  DatePicker,
  Space,
  Button,
  Tag,
  Empty,
  Tooltip,
} from 'antd';
import {
  DollarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  PieChartOutlined,
  BarChartOutlined,
  CalendarOutlined,
  ExportOutlined,
  RightOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useExpensesQuery, isDummyFuelExpense, type ExpenseEntity } from '@/api/expenses';
import {
  calculateFourDepartmentSummaries,
  calculateGrandTotals,
  FOUR_MAIN_DEPARTMENTS,
} from '@/utils/departmentExpenses';
import { tokens } from '@/constants/tokens';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const CHART_COLORS = ['#1890ff', '#52c41a', '#fa8c16', '#722ed1', '#13c2c2', '#eb2f96', '#faad14', '#2f54eb'];

export interface ExpenseOverviewChartsAndStatsProps {
  title?: string;
  subtitle?: string;
  style?: React.CSSProperties;
  showNavigationLink?: boolean;
}

export const ExpenseOverviewChartsAndStats: React.FC<ExpenseOverviewChartsAndStatsProps> = ({
  title = 'Corporate Expense Analytics & Visual Overview',
  subtitle = 'Comprehensive high-level expenditure intelligence, category distributions, and departmental burn rate comparison.',
  style,
  showNavigationLink = true,
}) => {
  const navigate = useNavigate();
  const { data: expensesData, isLoading, refetch, isFetching } = useExpensesQuery();

  // Clean raw records
  const allExpenses: ExpenseEntity[] = useMemo(() => {
    const raw = expensesData?.items ?? [];
    return raw.filter((e) => !isDummyFuelExpense(e));
  }, [expensesData]);

  // Periodic Filter State
  const [period, setPeriod] = useState<'all' | 'today' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs>(() => dayjs());
  const [customRange, setCustomRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // Periodically filtered dataset
  const filteredExpenses = useMemo(() => {
    return allExpenses.filter((e) => {
      const d = dayjs(e.incurredOn || e.createdAt);
      if (!d.isValid()) return period === 'all';

      const now = dayjs();
      if (period === 'today') return d.isSame(now, 'day');
      if (period === 'weekly') return d.isSame(now, 'week');
      if (period === 'monthly') {
        const target = selectedMonth || now;
        return d.isSame(target, 'month') && d.isSame(target, 'year');
      }
      if (period === 'yearly') return d.isSame(now, 'year');
      if (period === 'custom' && customRange && customRange[0] && customRange[1]) {
        return !d.isBefore(customRange[0].startOf('day')) && !d.isAfter(customRange[1].endOf('day'));
      }
      return true;
    });
  }, [allExpenses, period, selectedMonth, customRange]);

  // Grand totals for active period
  const totals = useMemo(() => {
    return calculateGrandTotals(filteredExpenses);
  }, [filteredExpenses]);

  // 4 Department summaries for active period
  const deptSummaries = useMemo(() => {
    return calculateFourDepartmentSummaries(filteredExpenses);
  }, [filteredExpenses]);

  // Period label
  const periodLabel = useMemo(() => {
    if (period === 'today') return `Today (${dayjs().format('MMM D, YYYY')})`;
    if (period === 'weekly') {
      return `This Week (${dayjs().startOf('week').format('MMM D')} – ${dayjs().endOf('week').format('MMM D')})`;
    }
    if (period === 'monthly') return `Month: ${selectedMonth.format('MMMM YYYY')}`;
    if (period === 'yearly') return `Annual: ${dayjs().format('YYYY')}`;
    if (period === 'custom' && customRange && customRange[0] && customRange[1]) {
      return `${customRange[0].format('MMM D')} – ${customRange[1].format('MMM D, YYYY')}`;
    }
    return 'All-Time Cumulative';
  }, [period, selectedMonth, customRange]);

  // Category Pie Chart data
  const categoryChartData = useMemo(() => {
    const map = new Map<string, number>();
    filteredExpenses.forEach((e) => {
      const cat = e.category || 'General';
      const cur = map.get(cat) || 0;
      map.set(cat, cur + (e.amountMinor || 0));
    });
    return Array.from(map.entries())
      .map(([name, valMinor]) => ({
        name,
        value: Math.round(valMinor / 100),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 categories
  }, [filteredExpenses]);

  // Department Bar Chart data
  const departmentChartData = useMemo(() => {
    return deptSummaries.map((dept) => ({
      name: dept.name,
      amountGHS: Math.round(dept.totalMinor / 100),
      approvedGHS: Math.round(dept.approvedMinor / 100),
      pendingGHS: Math.round(dept.pendingMinor / 100),
      count: dept.count,
    }));
  }, [deptSummaries]);

  return (
    <Card
      style={{
        borderRadius: 16,
        marginBottom: 24,
        border: '1px solid #e8eff5',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        ...style,
      }}
      bodyStyle={{ padding: '20px 24px' }}
    >
      {/* ── Header & Periodic Scope Controls ───────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20,
          borderBottom: '1px solid #f0f2f5',
          paddingBottom: 16,
        }}
      >
        <div>
          <Space size={8} style={{ marginBottom: 4 }}>
            <PieChartOutlined style={{ color: tokens.primary, fontSize: 18 }} />
            <Title level={4} style={{ margin: 0, color: '#1a1f36' }}>
              {title}
            </Title>
            <Tag color="blue" style={{ borderRadius: 10, fontWeight: 600 }}>
              {periodLabel}
            </Tag>
          </Space>
          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
            {subtitle}
          </Text>
        </div>

        <Space size={10} wrap align="center">
          <Segmented
            value={period}
            onChange={(v) => setPeriod(v as any)}
            options={[
              { label: 'Today', value: 'today' },
              { label: 'Week', value: 'weekly' },
              { label: 'Month', value: 'monthly' },
              { label: 'Year', value: 'yearly' },
              { label: 'All-Time', value: 'all' },
              { label: 'Custom', value: 'custom' },
            ]}
            style={{ fontWeight: 600, background: '#f1f5f9' }}
          />

          {period === 'monthly' && (
            <DatePicker
              picker="month"
              value={selectedMonth}
              onChange={(m) => m && setSelectedMonth(m)}
              allowClear={false}
              style={{ width: 130 }}
              format="MMM YYYY"
            />
          )}

          {period === 'custom' && (
            <RangePicker
              value={customRange}
              onChange={(r) => setCustomRange(r as any)}
              style={{ width: 220 }}
            />
          )}

          {showNavigationLink && (
            <Button
              type="primary"
              icon={<RightOutlined />}
              onClick={() => navigate('/accounts/expenses')}
              style={{
                borderRadius: 8,
                background: tokens.primary,
                fontWeight: 600,
              }}
            >
              Go to Expenses Hub
            </Button>
          )}
        </Space>
      </div>

      {/* ── 4 KPI Stat Cards (Relocated from Expenses Page) ─────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Total Spend */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            size="small"
            style={{
              borderRadius: 12,
              border: '1px solid #bfdbfe',
              background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
            }}
          >
            <Statistic
              title={
                <Text strong style={{ color: '#1e40af', fontSize: 12, textTransform: 'uppercase' }}>
                  Total Expenditure
                </Text>
              }
              value={totals.grandTotalGHS}
              prefix="₵"
              precision={2}
              valueStyle={{ color: tokens.primary, fontWeight: 800, fontSize: 22 }}
            />
            <div style={{ marginTop: 6, fontSize: 11, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
              <span>{totals.grandCount} requisition{totals.grandCount === 1 ? '' : 's'}</span>
              <span style={{ fontWeight: 600, color: '#1e40af' }}>{periodLabel}</span>
            </div>
          </Card>
        </Col>

        {/* Authorized Spend */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            size="small"
            style={{
              borderRadius: 12,
              border: '1px solid #b7eb8f',
              background: 'linear-gradient(135deg, #f6ffed 0%, #ffffff 100%)',
            }}
          >
            <Statistic
              title={
                <Text strong style={{ color: '#237804', fontSize: 12, textTransform: 'uppercase' }}>
                  Authorized & Disbursed
                </Text>
              }
              value={totals.grandApprovedGHS}
              prefix="₵"
              precision={2}
              valueStyle={{ color: '#52c41a', fontWeight: 800, fontSize: 22 }}
            />
            <div style={{ marginTop: 6, fontSize: 11, color: '#52c41a', fontWeight: 500 }}>
              Fully approved by accounts
            </div>
          </Card>
        </Col>

        {/* Pending Authorization */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            size="small"
            style={{
              borderRadius: 12,
              border: '1px solid #ffd591',
              background: 'linear-gradient(135deg, #fff7e6 0%, #ffffff 100%)',
            }}
          >
            <Statistic
              title={
                <Text strong style={{ color: '#d46b08', fontSize: 12, textTransform: 'uppercase' }}>
                  Pending Sign-Off
                </Text>
              }
              value={totals.grandPendingGHS}
              prefix="₵"
              precision={2}
              valueStyle={{ color: '#fa8c16', fontWeight: 800, fontSize: 22 }}
            />
            <div style={{ marginTop: 6, fontSize: 11, color: '#d46b08', fontWeight: 500 }}>
              Awaiting administrative approval
            </div>
          </Card>
        </Col>

        {/* Department Coverage / Rejected */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            size="small"
            style={{
              borderRadius: 12,
              border: '1px solid #d3adf7',
              background: 'linear-gradient(135deg, #f9f0ff 0%, #ffffff 100%)',
            }}
          >
            <Statistic
              title={
                <Text strong style={{ color: '#531dab', fontSize: 12, textTransform: 'uppercase' }}>
                  4-Department Coverage
                </Text>
              }
              value="Secretary • BM • Mkt • Admin"
              valueStyle={{ color: '#722ed1', fontWeight: 700, fontSize: 14 }}
            />
            <div style={{ marginTop: 6, fontSize: 11, color: '#722ed1', display: 'flex', justifyContent: 'space-between' }}>
              <span>Declined: ₵ {totals.grandRejectedGHS.toFixed(2)}</span>
              <span style={{ fontWeight: 600 }}>100% Tracked</span>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── Visual Analytics Section (Charts) ───────────────────────────── */}
      <Row gutter={[16, 16]}>
        {/* Category Expenditure Distribution Pie Chart */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <PieChartOutlined style={{ color: tokens.primary }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Category Expenditure Distribution</span>
              </Space>
            }
            size="small"
            style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            {categoryChartData.length > 0 ? (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                    >
                      {categoryChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(val: any) => `₵ ${Number(val).toLocaleString()}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <Empty description="No category spend recorded for this period" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            )}
          </Card>
        </Col>

        {/* Department Expenditure Breakdown Bar Chart */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <BarChartOutlined style={{ color: '#52c41a' }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Department Spend Comparison</span>
              </Space>
            }
            size="small"
            style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            {departmentChartData.some((d) => d.amountGHS > 0) ? (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={departmentChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
                    <XAxis dataKey="name" stroke="#8c8c8c" fontSize={12} tickLine={false} />
                    <YAxis
                      stroke="#8c8c8c"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `₵${(v / 1000).toFixed(0)}k`}
                    />
                    <RechartsTooltip formatter={(val: any) => `₵ ${Number(val).toLocaleString()}`} />
                    <Bar dataKey="amountGHS" fill={tokens.primary} radius={[6, 6, 0, 0]} name="Total Outlay (₵)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <Empty description="No department records for this period" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Card>
  );
};
