// src/pages/dashboard/admin/components/MonthlyCustomerRevenueDrawer.tsx
import React, { useState, useMemo } from 'react';
import {
  Drawer,
  Typography,
  Space,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Collapse,
  Table,
  Button,
  Input,
  Select,
  Progress,
  Tooltip,
  Empty,
  Badge,
  Avatar,
  Divider,
} from 'antd';
import {
  DollarOutlined,
  UserOutlined,
  CalendarOutlined,
  SearchOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  HomeOutlined,
  PhoneOutlined,
  RightOutlined,
  ArrowUpOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  CreditCardOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { Customer, PaymentPlan, Property } from '@/types';
import { useCustomersQuery } from '@/api/customers';
import { usePaymentPlansQuery } from '@/api/paymentPlans';
import { usePropertiesQuery } from '@/api/properties';
import {
  computeMonthlyCustomerRevenue,
  formatRevenueGHS,
  type MonthRevenueGroup,
  type NewCustomerRevenueRecord,
} from '@/utils/monthlyCustomerRevenue';
import { tokens } from '@/constants/tokens';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export interface MonthlyCustomerRevenueDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const MonthlyCustomerRevenueDrawer: React.FC<MonthlyCustomerRevenueDrawerProps> = ({
  open,
  onClose,
}) => {
  const navigate = useNavigate();

  // Screen expansion mode: Standard (840px) vs Fullscreen Large-Screen (95vw)
  const [isExpanded, setIsExpanded] = useState(false);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'all' | 'payment_plan' | 'outright'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');

  // Live queries
  const { data: customersData, isLoading: customersLoading } = useCustomersQuery({ pageSize: 100 });
  const { data: plansData, isLoading: plansLoading } = usePaymentPlansQuery({ pageSize: 100 });
  const { data: propertiesData } = usePropertiesQuery({ pageSize: 100 });

  const rawCustomers = customersData?.items ?? [];
  const rawPlans = plansData?.items ?? [];
  const rawProperties = propertiesData?.items ?? [];

  // Compute the comprehensive monthly revenue summary
  const summary = useMemo(() => {
    return computeMonthlyCustomerRevenue({
      customers: rawCustomers,
      paymentPlans: rawPlans,
      properties: rawProperties,
    });
  }, [rawCustomers, rawPlans, rawProperties]);

  // Active month keys in Collapse (folding state)
  // By default: Current month is unfolded ([summary.currentMonthKey]),
  // while past months are folded at the end of each month!
  const [activeMonthKeys, setActiveMonthKeys] = useState<string[]>(() => [summary.currentMonthKey]);

  // Active customer keys inside each month
  const [activeCustomerKeys, setActiveCustomerKeys] = useState<string[]>([]);

  // Update default unfolded keys when current month becomes available
  React.useEffect(() => {
    if (summary.currentMonthKey && activeMonthKeys.length === 0) {
      setActiveMonthKeys([summary.currentMonthKey]);
    }
  }, [summary.currentMonthKey]);

  // Apply search and filter to customer records inside each month
  const filteredMonths = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return summary.months.map((month) => {
      const filteredCustomers = month.newCustomers.filter((c) => {
        // Customer type filter
        if (customerTypeFilter !== 'all' && c.customerType !== customerTypeFilter) {
          return false;
        }

        // Status filter
        if (statusFilter !== 'all') {
          if (statusFilter === 'completed' && c.planStatus !== 'completed') return false;
          if (statusFilter === 'active' && c.planStatus !== 'active') return false;
        }

        // Search text
        if (!q) return true;
        const matchesName = c.customerName.toLowerCase().includes(q);
        const matchesPhone = c.customerPhone.toLowerCase().includes(q);
        const matchesProp = c.propertyName.toLowerCase().includes(q);
        const matchesCode = (c.customerCode || '').toLowerCase().includes(q);

        return matchesName || matchesPhone || matchesProp || matchesCode;
      });

      const filteredTotalRevenueMinor = filteredCustomers.reduce((sum, c) => sum + c.monthRevenueMinor, 0);

      return {
        ...month,
        newCustomers: filteredCustomers,
        filteredTotalRevenueMinor,
        hasMatches: filteredCustomers.length > 0 || !q,
      };
    });
  }, [summary.months, searchText, customerTypeFilter, statusFilter]);

  // Folding helper buttons
  const handleUnfoldCurrentMonth = () => {
    setActiveMonthKeys([summary.currentMonthKey]);
  };

  const handleUnfoldAll = () => {
    setActiveMonthKeys(summary.months.map((m) => m.monthKey));
  };

  const handleFoldAll = () => {
    setActiveMonthKeys([]);
  };

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Space size={10}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                border: '1px solid #a7f3d0',
              }}
            >
              <DollarOutlined />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text strong style={{ fontSize: 16, color: '#0f172a' }}>
                  Monthly Customer Revenue Tracker
                </Text>
                <Tag color="success" style={{ borderRadius: 10, fontWeight: 700, fontSize: 11 }}>
                  LIVE REAL-TIME
                </Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Tracks new customer acquisitions, initial deposits, and recurring installments with monthly folding accordions
              </Text>
            </div>
          </Space>
        </div>
      }
      placement="right"
      width={isExpanded ? '95vw' : Math.min(840, typeof window !== 'undefined' ? window.innerWidth - 32 : 840)}
      zIndex={1060}
      onClose={onClose}
      open={open}
      extra={
        <Space size={8}>
          <Tooltip title={isExpanded ? 'Collapse to standard width' : 'Expand to large-screen view without scrolling limitations'}>
            <Button
              size="small"
              icon={isExpanded ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                fontWeight: 600,
                borderRadius: 6,
                borderColor: isExpanded ? '#3b82f6' : '#cbd5e1',
                color: isExpanded ? '#1d4ed8' : '#334155',
                background: isExpanded ? '#eff6ff' : '#ffffff',
              }}
            >
              {isExpanded ? 'Standard Width' : 'Expand View'}
            </Button>
          </Tooltip>
        </Space>
      }
      styles={{
        header: { padding: '16px 20px', borderBottom: '1px solid #f0f0f0' },
        body: { padding: '16px 20px', backgroundColor: '#f8fafc' },
      }}
    >
      {/* ── TOP KPI SUMMARY CARDS ─────────────────────────────────────────── */}
      <Row gutter={[12, 12]} style={{ marginBottom: 18 }}>
        <Col xs={24} sm={12} md={6}>
          <Card
            size="small"
            style={{
              borderRadius: 12,
              border: '1px solid #a7f3d0',
              background: 'linear-gradient(180deg, #ffffff 0%, #ecfdf5 100%)',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.08)',
            }}
          >
            <Statistic
              title={
                <Text style={{ fontSize: 11, fontWeight: 600, color: '#065f46', textTransform: 'uppercase' }}>
                  {summary.currentMonthLabel} Revenue
                </Text>
              }
              value={summary.currentMonthRevenueMinor / 100}
              prefix="₵"
              precision={2}
              valueStyle={{ fontSize: 18, fontWeight: 800, color: '#059669', fontVariantNumeric: 'tabular-nums' }}
            />
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tag color="success" style={{ borderRadius: 8, fontSize: 10, padding: '0 6px', fontWeight: 600 }}>
                {summary.currentMonthNewCustomersCount} New Buyers
              </Tag>
              {summary.growthRatePercent !== 0 && (
                <Text style={{ fontSize: 11, color: summary.growthRatePercent > 0 ? '#059669' : '#dc2626', fontWeight: 600 }}>
                  {summary.growthRatePercent > 0 ? `+${summary.growthRatePercent}%` : `${summary.growthRatePercent}%`} MoM
                </Text>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            size="small"
            style={{
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
            }}
          >
            <Statistic
              title={
                <Text style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Total All-Time Revenue
                </Text>
              }
              value={summary.allTimeNewCustomerRevenueMinor / 100}
              prefix="₵"
              precision={2}
              valueStyle={{ fontSize: 18, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}
            />
            <div style={{ marginTop: 4 }}>
              <Tag color="blue" style={{ borderRadius: 8, fontSize: 10, padding: '0 6px', fontWeight: 600 }}>
                {summary.allTimeNewCustomersCount} Total Customers
              </Tag>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            size="small"
            style={{
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
            }}
          >
            <Statistic
              title={
                <Text style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  New Buyers This Month
                </Text>
              }
              value={summary.currentMonthNewCustomersCount}
              suffix="Customers"
              valueStyle={{ fontSize: 18, fontWeight: 800, color: '#2563eb', fontVariantNumeric: 'tabular-nums' }}
            />
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Direct conversions logged
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            size="small"
            style={{
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
            }}
          >
            <Statistic
              title={
                <Text style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Avg. Revenue / Customer
                </Text>
              }
              value={summary.averageRevenuePerCustomerMinor / 100}
              prefix="₵"
              precision={2}
              valueStyle={{ fontSize: 18, fontWeight: 800, color: '#7c3aed', fontVariantNumeric: 'tabular-nums' }}
            />
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Initial acquisition yield
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── FILTER & ACCORDION FOLD CONTROLS BAR ─────────────────────────── */}
      <Card
        size="small"
        style={{
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          marginBottom: 16,
          background: '#ffffff',
        }}
      >
        <Row gutter={[10, 10]} align="middle" justify="space-between">
          <Col xs={24} md={12}>
            <Space size={8} wrap style={{ width: '100%' }}>
              <Input
                placeholder="Search by customer name, phone, or unit..."
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
                style={{ width: 260, borderRadius: 8 }}
              />
              <Select
                value={customerTypeFilter}
                onChange={setCustomerTypeFilter}
                style={{ width: 140 }}
              >
                <Option value="all">All Plan Types</Option>
                <Option value="payment_plan">Installment Plans</Option>
                <Option value="outright">Outright Buyers</Option>
              </Select>
            </Space>
          </Col>

          <Col xs={24} md={12} style={{ textAlign: 'right' }}>
            <Space size={6} wrap>
              <Tooltip title="Keep only the ongoing current month unfolded for live tracking">
                <Button
                  size="small"
                  onClick={handleUnfoldCurrentMonth}
                  icon={<FolderOpenOutlined />}
                  style={{ borderRadius: 6, fontSize: 12, fontWeight: 500 }}
                >
                  Unfold Current Month
                </Button>
              </Tooltip>
              <Tooltip title="Unfold all monthly accordions to view entire financial history">
                <Button
                  size="small"
                  onClick={handleUnfoldAll}
                  style={{ borderRadius: 6, fontSize: 12 }}
                >
                  Unfold All
                </Button>
              </Tooltip>
              <Tooltip title="Fold past and current months for clean overview">
                <Button
                  size="small"
                  onClick={handleFoldAll}
                  icon={<FolderOutlined />}
                  style={{ borderRadius: 6, fontSize: 12 }}
                >
                  Fold All
                </Button>
              </Tooltip>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* ── NESTED ACCORDIONS: MONTHS (LEVEL 1) ─────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Collapse
          activeKey={activeMonthKeys}
          onChange={(keys) => setActiveMonthKeys(typeof keys === 'string' ? [keys] : keys)}
          style={{ background: 'transparent', border: 'none' }}
          items={filteredMonths.map((month) => {
            const isCurrent = month.isCurrentMonth;
            const revenueDisplay = formatRevenueGHS(month.totalRevenueMinor);
            const customerCount = month.newCustomers.length;
            const shareOfAllTime = summary.allTimeNewCustomerRevenueMinor > 0
              ? Math.round((month.totalRevenueMinor / summary.allTimeNewCustomerRevenueMinor) * 100)
              : 0;

            return {
              key: month.monthKey,
              style: {
                marginBottom: 14,
                borderRadius: 14,
                border: isCurrent ? '2px solid #34d399' : '1px solid #e2e8f0',
                background: '#ffffff',
                overflow: 'hidden',
                boxShadow: isCurrent ? '0 4px 16px rgba(16, 185, 129, 0.12)' : '0 2px 6px rgba(0,0,0,0.02)',
              },
              header: (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    width: '100%',
                    padding: '4px 0',
                    gap: 10,
                  }}
                >
                  {/* Left: Month title + Status Tag + Customer count */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: isCurrent ? '#ecfdf5' : '#f1f5f9',
                        color: isCurrent ? '#059669' : '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                      }}
                    >
                      <CalendarOutlined />
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                          {month.monthLabel}
                        </Text>
                        {isCurrent ? (
                          <Tag color="success" style={{ borderRadius: 10, fontWeight: 700, fontSize: 10 }}>
                            CURRENT MONTH (UNFOLDED)
                          </Tag>
                        ) : (
                          <Tag color="default" style={{ borderRadius: 10, fontSize: 10, color: '#64748b' }}>
                            CLOSED MONTH (FOLDED)
                          </Tag>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {customerCount} new customer{customerCount === 1 ? '' : 's'} registered
                        {month.downPaymentTotalMinor > 0 && ` • Initial Deposits: ${formatRevenueGHS(month.downPaymentTotalMinor)}`}
                      </div>
                    </div>
                  </div>

                  {/* Right: Revenue total pill + Share tag */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Tag
                      color="purple"
                      style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, border: 'none' }}
                    >
                      {shareOfAllTime}% of all-time
                    </Tag>

                    <div style={{ textAlign: 'right' }}>
                      <Text
                        strong
                        style={{
                          fontSize: 17,
                          fontWeight: 800,
                          color: '#059669',
                          fontVariantNumeric: 'tabular-nums',
                          display: 'block',
                        }}
                      >
                        {revenueDisplay}
                      </Text>
                    </div>
                  </div>
                </div>
              ),
              children: (
                <div style={{ padding: '8px 4px' }}>
                  {/* Sub-breakdown banner for this month */}
                  <div
                    style={{
                      background: '#f8fafc',
                      borderRadius: 10,
                      padding: '10px 14px',
                      marginBottom: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 8,
                      border: '1px solid #f1f5f9',
                    }}
                  >
                    <Space size={14} wrap>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          New Customers:
                        </Text>{' '}
                        <Text strong style={{ fontSize: 12 }}>
                          {month.newCustomers.length}
                        </Text>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Down Payments:
                        </Text>{' '}
                        <Text strong style={{ fontSize: 12, color: '#059669' }}>
                          {formatRevenueGHS(month.downPaymentTotalMinor)}
                        </Text>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Installments:
                        </Text>{' '}
                        <Text strong style={{ fontSize: 12, color: '#2563eb' }}>
                          {formatRevenueGHS(month.installmentTotalMinor)}
                        </Text>
                      </div>
                    </Space>

                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Click any customer below to unfold payment receipts and transaction records
                    </Text>
                  </div>

                  {/* ── NESTED CUSTOMER ACCORDIONS (LEVEL 2) ────────────────── */}
                  {month.newCustomers.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="No new customer acquisitions or revenue recorded in this month."
                      style={{ padding: '16px 0' }}
                    />
                  ) : (
                    <Collapse
                      activeKey={activeCustomerKeys}
                      onChange={(keys) => setActiveCustomerKeys(typeof keys === 'string' ? [keys] : keys)}
                      style={{ background: 'transparent', border: 'none' }}
                      items={month.newCustomers.map((c) => {
                        const isOutright = c.customerType === 'outright';

                        return {
                          key: `${month.monthKey}-${c.customerId}`,
                          style: {
                            marginBottom: 10,
                            borderRadius: 10,
                            border: '1px solid #e2e8f0',
                            background: '#ffffff',
                            overflow: 'hidden',
                          },
                          header: (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                width: '100%',
                                padding: '2px 0',
                                gap: 8,
                              }}
                            >
                              {/* Left: Avatar + Customer Name + Property */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Avatar
                                  size="small"
                                  style={{
                                    backgroundColor: isOutright ? '#06b6d4' : tokens.primary,
                                    fontSize: 12,
                                    fontWeight: 700,
                                  }}
                                >
                                  {c.customerName.charAt(0).toUpperCase()}
                                </Avatar>

                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
                                      {c.customerName}
                                    </Text>
                                    <Tag
                                      color={isOutright ? 'cyan' : 'blue'}
                                      style={{ borderRadius: 6, fontSize: 10, padding: '0 5px' }}
                                    >
                                      {isOutright ? 'OUTRIGHT' : 'PAYMENT PLAN'}
                                    </Tag>
                                  </div>

                                  <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <HomeOutlined style={{ fontSize: 10 }} />
                                    <span>{c.propertyName}</span>
                                    <span>• Joined {dayjs(c.joinedDate).format('MMM D, YYYY')}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Right: Revenue credited + Status tag */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Tag
                                  color={c.planStatus === 'completed' ? 'success' : 'processing'}
                                  style={{ borderRadius: 8, fontSize: 10, fontWeight: 600 }}
                                >
                                  {c.planStatus === 'completed' ? 'Fully Paid' : 'Active Plan'}
                                </Tag>

                                <div style={{ textAlign: 'right' }}>
                                  <Text
                                    strong
                                    style={{
                                      fontSize: 14,
                                      fontWeight: 700,
                                      color: '#059669',
                                      fontVariantNumeric: 'tabular-nums',
                                    }}
                                  >
                                    {formatRevenueGHS(c.monthRevenueMinor)}
                                  </Text>
                                </div>
                              </div>
                            </div>
                          ),
                          children: (
                            <div style={{ padding: '10px 4px' }}>
                              {/* Customer Financial Overview Strip */}
                              <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
                                <Col xs={12} sm={6}>
                                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                                    <Text type="secondary" style={{ fontSize: 10, display: 'block', textTransform: 'uppercase' }}>
                                      Property Price
                                    </Text>
                                    <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                                      {formatRevenueGHS(c.propertyPriceMinor)}
                                    </Text>
                                  </div>
                                </Col>

                                <Col xs={12} sm={6}>
                                  <div style={{ background: '#ecfdf5', padding: '8px 12px', borderRadius: 8, border: '1px solid #a7f3d0' }}>
                                    <Text style={{ fontSize: 10, display: 'block', textTransform: 'uppercase', color: '#065f46', fontWeight: 600 }}>
                                      Down Payment
                                    </Text>
                                    <Text strong style={{ fontSize: 13, color: '#059669' }}>
                                      {formatRevenueGHS(c.downPaymentMinor)}
                                    </Text>
                                  </div>
                                </Col>

                                <Col xs={12} sm={6}>
                                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                                    <Text type="secondary" style={{ fontSize: 10, display: 'block', textTransform: 'uppercase' }}>
                                      Total Paid To Date
                                    </Text>
                                    <Text strong style={{ fontSize: 13, color: '#2563eb' }}>
                                      {formatRevenueGHS(c.totalPaidToDateMinor)}
                                    </Text>
                                  </div>
                                </Col>

                                <Col xs={12} sm={6}>
                                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                                    <Text type="secondary" style={{ fontSize: 10, display: 'block', textTransform: 'uppercase' }}>
                                      Remaining Balance
                                    </Text>
                                    <Text strong style={{ fontSize: 13, color: c.balanceMinor > 0 ? '#b91c1c' : '#059669' }}>
                                      {formatRevenueGHS(c.balanceMinor)}
                                    </Text>
                                  </div>
                                </Col>
                              </Row>

                              {/* Progress bar towards completion */}
                              <div style={{ marginBottom: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                                  <Text type="secondary">Acquisition Progress</Text>
                                  <Text strong>{c.progressPercent}% Settled</Text>
                                </div>
                                <Progress
                                  percent={c.progressPercent}
                                  strokeColor={{ '0%': '#10b981', '100%': '#059669' }}
                                  size="small"
                                />
                              </div>

                              {/* Transactions / Receipts Table */}
                              <div style={{ marginBottom: 12 }}>
                                <Text strong style={{ fontSize: 12, color: '#334155', display: 'block', marginBottom: 6 }}>
                                  Collections & Receipts Logged for {month.monthLabel}:
                                </Text>

                                <Table
                                  dataSource={c.transactions}
                                  rowKey="id"
                                  pagination={false}
                                  size="small"
                                  columns={[
                                    {
                                      title: 'Date',
                                      dataIndex: 'paidOn',
                                      key: 'paidOn',
                                      width: 110,
                                      render: (val: string) => (
                                        <Text style={{ fontSize: 11 }}>{dayjs(val).format('MMM D, YYYY')}</Text>
                                      ),
                                    },
                                    {
                                      title: 'Description',
                                      dataIndex: 'label',
                                      key: 'label',
                                      render: (val: string, record) => (
                                        <Space size={6}>
                                          <Tag color={record.type === 'down_payment' ? 'green' : 'blue'} style={{ fontSize: 10, borderRadius: 4 }}>
                                            {record.type.replace('_', ' ').toUpperCase()}
                                          </Tag>
                                          <Text style={{ fontSize: 11 }}>{val}</Text>
                                        </Space>
                                      ),
                                    },
                                    {
                                      title: 'Payment Method',
                                      dataIndex: 'method',
                                      key: 'method',
                                      width: 150,
                                      render: (val: string) => (
                                        <Tag color="geekblue" style={{ borderRadius: 6, fontSize: 10 }}>
                                          {val}
                                        </Tag>
                                      ),
                                    },
                                    {
                                      title: 'Reference',
                                      dataIndex: 'reference',
                                      key: 'reference',
                                      width: 120,
                                      render: (val: string) => (
                                        <Text copyable style={{ fontSize: 11, fontFamily: 'monospace' }}>
                                          {val || '—'}
                                        </Text>
                                      ),
                                    },
                                    {
                                      title: 'Amount',
                                      dataIndex: 'amountMinor',
                                      key: 'amountMinor',
                                      align: 'right' as const,
                                      width: 130,
                                      render: (val: number) => (
                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                                          {formatRevenueGHS(val)}
                                        </span>
                                      ),
                                    },
                                  ]}
                                />
                              </div>

                              {/* Customer Contact & Profile Link */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  paddingTop: 8,
                                  borderTop: '1px solid #f1f5f9',
                                  flexWrap: 'wrap',
                                  gap: 8,
                                }}
                              >
                                <Space size={12} style={{ fontSize: 11, color: '#64748b' }}>
                                  <span><PhoneOutlined /> {c.customerPhone}</span>
                                  <span>Code: {c.customerCode || '—'}</span>
                                  <span>Address: {c.customerAddress}</span>
                                </Space>

                                <Button
                                  size="small"
                                  type="link"
                                  onClick={() => {
                                    onClose();
                                    navigate(`/customers/${c.customerId}`);
                                  }}
                                  style={{ padding: 0, fontSize: 11, fontWeight: 600 }}
                                >
                                  Open Customer Profile →
                                </Button>
                              </div>
                            </div>
                          ),
                        };
                      })}
                    />
                  )}
                </div>
              ),
            };
          })}
        />
      </div>
    </Drawer>
  );
};
