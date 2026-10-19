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
  Segmented,
  Skeleton,
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
  TableOutlined,
  UnorderedListOutlined,
  InfoCircleOutlined,
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

  // View mode: 'accordion' (default nested) vs 'table' (flat data table)
  // When user clicks "Expand View", accordions automatically drop to table as requested!
  const [viewMode, setViewMode] = useState<'accordion' | 'table'>('accordion');

  // Filters
  const [searchText, setSearchText] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'all' | 'payment_plan' | 'outright'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');

  // Live queries (Server Data Only)
  const { data: customersData, isLoading: isLoadingCustomers } = useCustomersQuery({ pageSize: 100 });
  const { data: plansData, isLoading: isLoadingPlans } = usePaymentPlansQuery({ pageSize: 100 });
  const { data: propertiesData, isLoading: isLoadingProperties } = usePropertiesQuery({ pageSize: 100 });
  const isLoading = isLoadingCustomers || isLoadingPlans || isLoadingProperties;

  const rawCustomers = customersData?.items ?? [];
  const rawPlans = plansData?.items ?? [];
  const rawProperties = propertiesData?.items ?? [];

  // Compute the comprehensive monthly revenue summary with narrative descriptions
  const summary = useMemo(() => {
    return computeMonthlyCustomerRevenue({
      customers: rawCustomers,
      paymentPlans: rawPlans,
      properties: rawProperties,
    });
  }, [rawCustomers, rawPlans, rawProperties]);

  // Active month keys in Collapse (folding state)
  // Current month is unfolded by default, past months are folded at the end of each month
  const [activeMonthKeys, setActiveMonthKeys] = useState<string[]>(() => [summary.currentMonthKey]);

  // Active customer keys inside each month
  const [activeCustomerKeys, setActiveCustomerKeys] = useState<string[]>([]);

  // Update default unfolded keys when current month becomes available
  React.useEffect(() => {
    if (summary.currentMonthKey && activeMonthKeys.length === 0) {
      setActiveMonthKeys([summary.currentMonthKey]);
    }
  }, [summary.currentMonthKey]);

  // Handle clicking "Expand View": toggles large-screen and drops accordions to table!
  const handleToggleExpand = () => {
    if (!isExpanded) {
      setIsExpanded(true);
      // As requested: "when clicked on the expand view, drop the accordions to a table"
      setViewMode('table');
    } else {
      setIsExpanded(false);
    }
  };

  // Apply search and filter to customer records inside each month
  const filteredMonths = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return summary.months
      .filter((m) => monthFilter === 'all' || m.monthKey === monthFilter)
      .map((month) => {
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

          // Search text across customer name, phone, unit, code, and description memo
          if (!q) return true;
          const matchesName = c.customerName.toLowerCase().includes(q);
          const matchesPhone = c.customerPhone.toLowerCase().includes(q);
          const matchesProp = c.propertyName.toLowerCase().includes(q);
          const matchesCode = (c.customerCode || '').toLowerCase().includes(q);
          const matchesDesc = (c.description || '').toLowerCase().includes(q);

          return matchesName || matchesPhone || matchesProp || matchesCode || matchesDesc;
        });

        const filteredDownPaymentTotalMinor = filteredCustomers.reduce((sum, c) => sum + c.downPaymentMinor, 0);
        const filteredInstallmentTotalMinor = filteredCustomers.reduce((sum, c) => sum + c.installmentsMinor, 0);
        const filteredTotalRevenueMinor = filteredCustomers.reduce((sum, c) => sum + c.monthRevenueMinor, 0);

        return {
          ...month,
          newCustomers: filteredCustomers,
          downPaymentTotalMinor: filteredDownPaymentTotalMinor,
          installmentTotalMinor: filteredInstallmentTotalMinor,
          totalRevenueMinor: filteredTotalRevenueMinor,
          filteredTotalRevenueMinor,
          hasMatches: filteredCustomers.length > 0 || !q,
        };
      });
  }, [summary.months, searchText, customerTypeFilter, statusFilter, monthFilter]);

  // Flattened customer records for Table View
  const flatTableData = useMemo(() => {
    const list: Array<
      NewCustomerRevenueRecord & {
        monthKey: string;
        monthLabel: string;
        isCurrentMonth: boolean;
        monthDescription: string;
      }
    > = [];

    filteredMonths.forEach((m) => {
      m.newCustomers.forEach((c) => {
        list.push({
          ...c,
          monthKey: m.monthKey,
          monthLabel: m.monthLabel,
          isCurrentMonth: m.isCurrentMonth,
          monthDescription: m.description,
        });
      });
    });

    return list;
  }, [filteredMonths]);

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

  // Table Columns for Dropped Table View
  const tableColumns = [
    {
      title: 'Month / Intake Date',
      key: 'month',
      width: 150,
      sorter: (a: any, b: any) => a.monthKey.localeCompare(b.monthKey),
      render: (_: any, record: any) => (
        <div>
          <Tag
            color={record.isCurrentMonth ? 'success' : 'default'}
            style={{ borderRadius: 6, fontWeight: 700, fontSize: 11, marginBottom: 4 }}
          >
            <CalendarOutlined style={{ marginRight: 4 }} />
            {record.monthLabel}
          </Tag>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            Joined {dayjs(record.joinedDate).format('MMM D, YYYY')}
          </div>
        </div>
      ),
    },
    {
      title: 'Customer & Contact',
      key: 'customer',
      width: 200,
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <Avatar
            size="small"
            style={{
              backgroundColor: record.customerType === 'outright' ? '#06b6d4' : tokens.primary,
              fontSize: 12,
              fontWeight: 700,
              marginTop: 2,
            }}
          >
            {(record.customerName || 'U').charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <Text strong style={{ fontSize: 13, color: '#0f172a', display: 'block' }}>
              {record.customerName || 'Unnamed customer'}
            </Text>
            <Tag color="geekblue" style={{ borderRadius: 4, fontSize: 10, padding: '0 4px', margin: '2px 0' }}>
              {record.customerCode || 'CUST'}
            </Tag>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              <PhoneOutlined style={{ fontSize: 10, marginRight: 4 }} />
              {record.customerPhone || 'N/A'}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Property & Unit',
      key: 'property',
      width: 180,
      render: (_: any, record: any) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <HomeOutlined style={{ color: '#059669', fontSize: 12 }} />
            <Text strong style={{ fontSize: 12, color: '#1e293b' }}>
              {record.propertyName || 'Property Assigned'}
            </Text>
          </div>
          {record.propertyDescription && (
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
              {record.propertyDescription}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Acquisition Agreement & Description Memo',
      key: 'description',
      width: 340,
      align: 'left' as const,
      render: (_: any, record: any) => (
        <div
          style={{
            minWidth: 310,
            maxWidth: 340,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderLeft: '4px solid #059669',
            borderRadius: 8,
            padding: '8px 12px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
            <Space size={6}>
              <FileTextOutlined style={{ color: '#059669', fontSize: 12 }} />
              <Text strong style={{ fontSize: 11, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Terms & Agreement Memo
              </Text>
            </Space>
            <Tag
              color={record.customerType === 'outright' ? 'cyan' : 'blue'}
              style={{ fontSize: 9, padding: '0 4px', margin: 0, borderRadius: 4, fontWeight: 700 }}
            >
              {record.customerType === 'outright' ? 'OUTRIGHT' : 'INSTALLMENT'}
            </Tag>
          </div>
          <Paragraph
            ellipsis={{ rows: 3, expandable: true, symbol: 'read more' }}
            style={{
              fontSize: 12,
              color: '#334155',
              lineHeight: 1.5,
              margin: 0,
              wordBreak: 'break-word',
              whiteSpace: 'normal',
            }}
          >
            {record.description}
          </Paragraph>
        </div>
      ),
    },
    {
      title: 'Plan Type',
      key: 'planType',
      width: 140,
      render: (_: any, record: any) => {
        const isOutright = record.customerType === 'outright';
        return (
          <div>
            <Tag
              color={isOutright ? 'cyan' : 'blue'}
              style={{ borderRadius: 6, fontWeight: 700, fontSize: 10 }}
            >
              {isOutright ? 'OUTRIGHT' : 'PAYMENT PLAN'}
            </Tag>
            {!isOutright && record.numMonths && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                {record.numMonths} Mos • {formatRevenueGHS(record.monthlyInstallmentMinor)}/mo
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Revenue Credited',
      key: 'revenue',
      width: 150,
      align: 'right' as const,
      sorter: (a: any, b: any) => a.monthRevenueMinor - b.monthRevenueMinor,
      render: (_: any, record: any) => (
        <div>
          <Text
            strong
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: '#059669',
              fontVariantNumeric: 'tabular-nums',
              display: 'block',
            }}
          >
            {formatRevenueGHS(record.monthRevenueMinor)}
          </Text>
          <Text type="secondary" style={{ fontSize: 10 }}>
            {record.transactions.length} collection record{record.transactions.length === 1 ? '' : 's'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Financial Breakdown',
      key: 'financials',
      width: 180,
      render: (_: any, record: any) => (
        <div style={{ fontSize: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Price:</span>
            <Text strong>{formatRevenueGHS(record.propertyPriceMinor)}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Down Payment:</span>
            <span style={{ color: '#059669', fontWeight: 600 }}>{formatRevenueGHS(record.downPaymentMinor)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Installments:</span>
            <span style={{ color: '#2563eb', fontWeight: 600 }}>{formatRevenueGHS(record.installmentsMinor)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Balance:</span>
            <span style={{ color: record.balanceMinor > 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>
              {formatRevenueGHS(record.balanceMinor)}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: 'Status & Progress',
      key: 'status',
      width: 140,
      render: (_: any, record: any) => (
        <div>
          <Tag
            color={record.planStatus === 'completed' ? 'success' : 'processing'}
            style={{ borderRadius: 6, fontSize: 10, fontWeight: 600, marginBottom: 4 }}
          >
            {record.planStatus === 'completed' ? 'Completed' : 'Active Plan'}
          </Tag>
          <Progress
            percent={record.progressPercent}
            size="small"
            strokeColor="#10b981"
            style={{ margin: 0 }}
          />
          <div style={{ fontSize: 10, color: '#64748b', textAlign: 'right', marginTop: 2 }}>
            {record.progressPercent}% Settled
          </div>
        </div>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 110,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Button
          size="small"
          type="link"
          onClick={() => {
            onClose();
            navigate(`/customers/${record.customerId}`);
          }}
          style={{ fontSize: 11, fontWeight: 600, padding: 0 }}
        >
          View Profile →
        </Button>
      ),
    },
  ];

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
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
      width={
        isExpanded
          ? '95vw'
          : viewMode === 'table'
          ? Math.min(960, typeof window !== 'undefined' ? window.innerWidth - 32 : 960)
          : Math.min(880, typeof window !== 'undefined' ? window.innerWidth - 32 : 880)
      }
      zIndex={1060}
      onClose={onClose}
      open={open}
      extra={
        <Space size={8} wrap>
          {/* Segmented View Mode Toggle: Accordions vs Table */}
          <Segmented
            value={viewMode}
            onChange={(val) => setViewMode(val as 'accordion' | 'table')}
            options={[
              {
                label: 'Accordion View',
                value: 'accordion',
                icon: <FolderOpenOutlined />,
              },
              {
                label: 'Table View',
                value: 'table',
                icon: <TableOutlined />,
              },
            ]}
            style={{
              background: '#f1f5f9',
              borderRadius: 8,
              padding: 2,
              fontWeight: 600,
              fontSize: 12,
            }}
          />

          {/* Expand View Button: automatically drops accordions to table */}
          <Tooltip
            title={
              isExpanded
                ? 'Collapse to standard width'
                : 'Expand to large-screen view and drop accordions to a comprehensive data table'
            }
          >
            <Button
              size="small"
              icon={isExpanded ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={handleToggleExpand}
              style={{
                fontWeight: 600,
                borderRadius: 6,
                borderColor: isExpanded ? '#3b82f6' : '#cbd5e1',
                color: isExpanded ? '#1d4ed8' : '#334155',
                background: isExpanded ? '#eff6ff' : '#ffffff',
              }}
            >
              {isExpanded ? 'Standard Width' : 'Expand View (Drop to Table)'}
            </Button>
          </Tooltip>
        </Space>
      }
      styles={{
        header: { padding: '16px 20px', borderBottom: '1px solid #f0f0f0' },
        body: { padding: '16px 20px', backgroundColor: '#f8fafc' },
      }}
    >
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Row gutter={[12, 12]}>
            {[1, 2, 3, 4].map((i) => (
              <Col xs={24} sm={12} md={6} key={i}>
                <Card size="small" style={{ borderRadius: 12, background: '#ffffff', border: '1px solid #e2e8f0' }}>
                  <Skeleton active paragraph={{ rows: 2 }} title={{ width: '60%' }} />
                </Card>
              </Col>
            ))}
          </Row>

          <Card size="small" style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
            <Skeleton.Input active block style={{ height: 36, borderRadius: 6 }} />
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[1, 2, 3].map((i) => (
              <Card key={i} size="small" style={{ borderRadius: 14, border: '1px solid #e2e8f0', background: '#ffffff' }}>
                <Skeleton active avatar={{ shape: 'square', size: 'default' }} paragraph={{ rows: 2 }} />
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <>
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
                Direct acquisitions logged
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
          <Col xs={24} md={14}>
            <Space size={8} wrap style={{ width: '100%' }}>
              <Input
                placeholder="Search customer, phone, unit, or description..."
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
                style={{ width: 280, borderRadius: 8 }}
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
              <Select
                value={monthFilter}
                onChange={setMonthFilter}
                style={{ width: 140 }}
              >
                <Option value="all">All Months</Option>
                {summary.months.map((m) => (
                  <Option key={m.monthKey} value={m.monthKey}>
                    {m.monthLabel}
                  </Option>
                ))}
              </Select>
            </Space>
          </Col>

          <Col xs={24} md={10} style={{ textAlign: 'right' }}>
            {viewMode === 'accordion' ? (
              <Space size={6} wrap>
                <Tooltip title="Keep only the ongoing current month unfolded for live tracking">
                  <Button
                    size="small"
                    onClick={handleUnfoldCurrentMonth}
                    icon={<FolderOpenOutlined />}
                    style={{ borderRadius: 6, fontSize: 12, fontWeight: 500 }}
                  >
                    Current Month
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
            ) : (
              <Space size={6}>
                <Tag color="blue" style={{ borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                  {flatTableData.length} Total Records in Table
                </Tag>
                <Button
                  size="small"
                  icon={<FolderOpenOutlined />}
                  onClick={() => setViewMode('accordion')}
                  style={{ borderRadius: 6, fontSize: 12 }}
                >
                  Return to Accordions
                </Button>
              </Space>
            )}
          </Col>
        </Row>
      </Card>

      {/* ── CONDITIONAL VIEW: DROPPED TABLE VIEW VS ACCORDIONS VIEW ─────── */}
      {viewMode === 'table' ? (
        /* ── DROPPED TABLE VIEW (ON EXPAND OR MANUAL TOGGLE) ──────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Informative Table Header Banner */}
          <Card
            size="small"
            style={{
              borderRadius: 12,
              border: '1px solid #bfdbfe',
              background: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)',
              boxShadow: '0 2px 6px rgba(59, 130, 246, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <Space size={10}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: '#dbeafe',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                  }}
                >
                  <TableOutlined />
                </div>
                <div>
                  <Text strong style={{ fontSize: 14, color: '#1e40af' }}>
                    Customer Revenue Audit Ledger (Table View)
                  </Text>
                  <div style={{ fontSize: 12, color: '#475569' }}>
                    Accordions flattened into a comprehensive table displaying detailed acquisition memos, valuations, and payment schedules.
                  </div>
                </div>
              </Space>

              <Tag color="purple" style={{ borderRadius: 6, fontWeight: 600, fontSize: 11 }}>
                Click row arrow ▶ to expand payment receipts ledger
              </Tag>
            </div>
          </Card>

          {/* Flat Table */}
          <Table
            dataSource={flatTableData}
            rowKey={(r) => `${r.monthKey}-${r.customerId}`}
            columns={tableColumns}
            pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (total) => `Total ${total} customer records` }}
            scroll={{ x: 1560 }}
            size="middle"
            style={{
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
            expandable={{
              expandedRowRender: (record) => (
                <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  {/* Detailed Acquisition Description Box */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderLeft: '4px solid #059669',
                      borderRadius: 8,
                      padding: '10px 14px',
                      marginBottom: 14,
                    }}
                  >
                    <Space size={6} style={{ marginBottom: 4 }}>
                      <FileTextOutlined style={{ color: '#059669' }} />
                      <Text strong style={{ fontSize: 12, color: '#0f172a' }}>
                        Comprehensive Agreement & Terms Description:
                      </Text>
                    </Space>
                    <Paragraph style={{ margin: 0, fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                      {record.description}
                    </Paragraph>
                  </div>

                  {/* Transaction receipts ledger */}
                  <Text strong style={{ fontSize: 12, color: '#334155', display: 'block', marginBottom: 8 }}>
                    Collections & Receipts Logged for {record.monthLabel}:
                  </Text>
                  {record.transactions.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="No payments recorded yet"
                      style={{ padding: '16px 0', background: '#ffffff', borderRadius: 8, border: '1px dashed #e2e8f0' }}
                    />
                  ) : (
                    <Table
                      dataSource={record.transactions}
                      rowKey="id"
                      pagination={false}
                      size="small"
                      columns={[
                        {
                          title: 'Date',
                          dataIndex: 'paidOn',
                          key: 'paidOn',
                          width: 120,
                          render: (val: string) => <Text style={{ fontSize: 11 }}>{dayjs(val).isValid() ? dayjs(val).format('MMM D, YYYY') : (val || '—')}</Text>,
                        },
                        {
                          title: 'Installment Number',
                          dataIndex: 'installmentNumber',
                          key: 'installmentNumber',
                          width: 160,
                          render: (val: any, tx) => (
                            <Space size={6}>
                              <Tag
                                color={tx.type === 'down_payment' ? 'green' : tx.type === 'outright_purchase' ? 'cyan' : 'blue'}
                                style={{ fontSize: 10, borderRadius: 4 }}
                              >
                                {val || tx.label || '—'}
                              </Tag>
                            </Space>
                          ),
                        },
                        {
                          title: 'Amount',
                          dataIndex: 'amountMinor',
                          key: 'amountMinor',
                          align: 'right' as const,
                          width: 140,
                          render: (val: number) => (
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                              {formatRevenueGHS(val)}
                            </span>
                          ),
                        },
                        {
                          title: 'Method',
                          dataIndex: 'method',
                          key: 'method',
                          width: 150,
                          render: (val: string) => <Tag color="geekblue" style={{ borderRadius: 6, fontSize: 10 }}>{val || '—'}</Tag>,
                        },
                        {
                          title: 'Reference',
                          dataIndex: 'reference',
                          key: 'reference',
                          width: 130,
                          render: (val: string) => (val ? <Text copyable style={{ fontSize: 11, fontFamily: 'monospace' }}>{val}</Text> : '—'),
                        },
                      ]}
                    />
                  )}
                </div>
              ),
            }}
          />
        </div>
      ) : (
        /* ── ACCORDIONS VIEW (NESTED MONTHS & CUSTOMERS) ──────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Informative Accordions Header Banner */}
          <Card
            size="small"
            style={{
              borderRadius: 12,
              border: '1px solid #a7f3d0',
              background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%)',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <Space size={10}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: '#d1fae5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                  }}
                >
                  <FolderOpenOutlined />
                </div>
                <div>
                  <Text strong style={{ fontSize: 14, color: '#065f46' }}>
                    Monthly Customer Revenue & Acquisition Accordions
                  </Text>
                  <div style={{ fontSize: 12, color: '#475569' }}>
                    Monthly folding folders tracking customer acquisitions and collections. Active months remain unfolded for live monitoring; concluded cycles fold into archives. Click any folder to inspect.
                  </div>
                </div>
              </Space>

              <Tag color="green" style={{ borderRadius: 6, fontWeight: 600, fontSize: 11 }}>
                {activeMonthKeys.length} of {filteredMonths.length} Months Unfolded
              </Tag>
            </div>
          </Card>

          {filteredMonths.length === 0 ? (
            <Card style={{ borderRadius: 12, textAlign: 'center', padding: '36px 0', border: '1px solid #e2e8f0', background: '#ffffff' }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No customer revenue records found matching the selected filters."
              />
            </Card>
          ) : (
            <Collapse
              activeKey={activeMonthKeys}
              onChange={(keys) => setActiveMonthKeys(typeof keys === 'string' ? [keys] : keys)}
              style={{ background: 'transparent', border: 'none' }}
              items={filteredMonths.map((month) => {
                const isCurrent = month.isCurrentMonth;
                const isUnfolded = activeMonthKeys.includes(month.monthKey);
                const isCollapsed = !isUnfolded;
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
                    border: isCurrent
                      ? '2px solid #34d399'
                      : isUnfolded
                      ? '1.5px solid #94a3b8'
                      : '1px solid #cbd5e1',
                    background: isCollapsed ? '#fafafa' : '#ffffff',
                    overflow: 'hidden',
                    boxShadow: isCurrent
                      ? '0 4px 16px rgba(16, 185, 129, 0.12)'
                      : '0 2px 6px rgba(0,0,0,0.02)',
                  },
                  label: (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      width: '100%',
                      padding: '4px 0',
                      gap: 8,
                    }}
                  >
                    {/* Top Row: Icon + Month Title + Status Badges + Revenue on right */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        width: '100%',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: isCurrent ? '#ecfdf5' : isUnfolded ? '#e0f2fe' : '#f1f5f9',
                            color: isCurrent ? '#059669' : isUnfolded ? '#0284c7' : '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                            flexShrink: 0,
                          }}
                        >
                          {isUnfolded ? <FolderOpenOutlined /> : <FolderOutlined />}
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                              {month.monthLabel} Revenue Folder
                            </Text>

                            {/* Active vs Concluded Cycle Tag */}
                            {isCurrent ? (
                              <Tag color="success" style={{ borderRadius: 8, fontWeight: 700, fontSize: 10 }}>
                                ACTIVE ONGOING MONTH
                              </Tag>
                            ) : (
                              <Tag color="default" style={{ borderRadius: 8, fontSize: 10, color: '#64748b' }}>
                                CONCLUDED MONTH ARCHIVE
                              </Tag>
                            )}

                            {/* Collapsed vs Unfolded State Tag */}
                            {isCollapsed ? (
                              <Tag
                                color="warning"
                                style={{ borderRadius: 8, fontWeight: 700, fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                <FolderOutlined />
                                FOLDED ACCORDION • CLICK TO EXPAND
                              </Tag>
                            ) : (
                              <Tag
                                color="processing"
                                style={{ borderRadius: 8, fontWeight: 700, fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                <FolderOpenOutlined />
                                UNFOLDED (AUDIT VIEW)
                              </Tag>
                            )}
                          </div>

                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            {customerCount} customer acquisition{customerCount === 1 ? '' : 's'} registered
                            {month.downPaymentTotalMinor > 0 && ` • Initial Deposits: ${formatRevenueGHS(month.downPaymentTotalMinor)}`}
                            {month.installmentTotalMinor > 0 && ` • Installments: ${formatRevenueGHS(month.installmentTotalMinor)}`}
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
                          <Text type="secondary" style={{ fontSize: 10 }}>
                            {isCollapsed ? 'Click to inspect records' : 'Month Total Credited'}
                          </Text>
                        </div>
                      </div>
                    </div>

                    {/* Explicit Content Summary & Narrative for Collapsed Accordion */}
                    {isCollapsed ? (
                      <div
                        style={{
                          marginTop: 4,
                          padding: '8px 12px',
                          background: '#ffffff',
                          border: '1px dashed #cbd5e1',
                          borderRadius: 8,
                          fontSize: 11,
                          color: '#334155',
                          width: '100%',
                          boxSizing: 'border-box',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                          <Space size={6} wrap>
                            <Tag color="cyan" style={{ borderRadius: 4, fontSize: 10, fontWeight: 700, margin: 0 }}>
                              COLLAPSED ACCORDION CONTENTS
                            </Tag>
                            <Text strong style={{ fontSize: 12, color: '#0f172a' }}>
                              {customerCount} Customer Acquisition{customerCount === 1 ? '' : 's'}
                            </Text>
                            <span style={{ color: '#94a3b8' }}>•</span>
                            <span style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>
                              Total Revenue: {revenueDisplay}
                            </span>
                            {month.downPaymentTotalMinor > 0 && (
                              <>
                                <span style={{ color: '#94a3b8' }}>•</span>
                                <span style={{ fontSize: 11, color: '#475569' }}>
                                  Deposits: <strong>{formatRevenueGHS(month.downPaymentTotalMinor)}</strong>
                                </span>
                              </>
                            )}
                          </Space>

                          <span style={{ color: '#2563eb', fontWeight: 600, fontSize: 11 }}>
                            Click row anywhere to unfold agreements & receipts ledger ↓
                          </span>
                        </div>

                        {/* Narrative Memo Preview */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FileTextOutlined style={{ color: '#059669', fontSize: 11, flexShrink: 0 }} />
                          <Text strong style={{ fontSize: 11, color: '#065f46', flexShrink: 0 }}>
                            Month Narrative Memo:
                          </Text>
                          <Text
                            ellipsis={{ tooltip: month.description }}
                            style={{ fontSize: 11, color: '#475569', margin: 0, flex: 1 }}
                          >
                            {month.description}
                          </Text>
                        </div>
                      </div>
                    ) : (
                      /* When unfolded, show small memo indicator */
                      <div
                        style={{
                          fontSize: 11,
                          color: '#475569',
                          marginTop: 2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <FileTextOutlined style={{ fontSize: 11, color: '#059669', flexShrink: 0 }} />
                        <Text strong style={{ fontSize: 11, color: '#065f46', flexShrink: 0 }}>
                          Month Performance Memo:
                        </Text>
                        <Text
                          ellipsis={{ tooltip: month.description }}
                          style={{
                            maxWidth: isExpanded ? '60vw' : '450px',
                            fontSize: 11,
                            color: '#475569',
                          }}
                        >
                          {month.description}
                        </Text>
                      </div>
                    )}
                  </div>
                ),
                children: (
                  <div style={{ padding: '8px 4px' }}>
                    {/* ── PROMINENT MONTHLY REVENUE PERFORMANCE NARRATIVE CARD ── */}
                    <div
                      style={{
                        background: isCurrent
                          ? 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)'
                          : '#f8fafc',
                        border: isCurrent ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                        borderRadius: 12,
                        padding: '12px 16px',
                        marginBottom: 14,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 6,
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        <Space size={8}>
                          <FileTextOutlined style={{ color: '#059669', fontSize: 15 }} />
                          <Text strong style={{ fontSize: 13, color: '#065f46' }}>
                            Monthly Performance Narrative & Acquisition Audit:
                          </Text>
                        </Space>
                        <Tag
                          color={isCurrent ? 'success' : 'default'}
                          style={{ borderRadius: 8, fontSize: 10, fontWeight: 600 }}
                        >
                          {isCurrent ? 'LIVE ONGOING CALENDAR MONTH' : 'CLOSED MONTH ARCHIVE'}
                        </Tag>
                      </div>
                      <Paragraph style={{ margin: 0, fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                        {month.description}
                      </Paragraph>
                    </div>

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
                          const customerKey = `${month.monthKey}-${c.customerId}`;
                          const isCustomerUnfolded = activeCustomerKeys.includes(customerKey);
                          const isCustomerCollapsed = !isCustomerUnfolded;

                          return {
                            key: customerKey,
                            style: {
                              marginBottom: 10,
                              borderRadius: 10,
                              border: isCustomerUnfolded ? '1.5px solid #059669' : '1px solid #e2e8f0',
                              background: isCustomerCollapsed ? '#fcfcfc' : '#ffffff',
                              overflow: 'hidden',
                            },
                            label: (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: '8px 14px',
                                  width: '100%',
                                  padding: '2px 0',
                                }}
                              >
                                {/* 1. Customer name and property */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <Avatar
                                    size="small"
                                    style={{
                                      backgroundColor: isOutright ? '#06b6d4' : tokens.primary,
                                      fontSize: 12,
                                      fontWeight: 700,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {(c.customerName || 'U').charAt(0).toUpperCase()}
                                  </Avatar>
                                  <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                                    {c.customerName || 'Unnamed customer'}
                                  </Text>
                                  <Tag
                                    color="default"
                                    style={{
                                      borderRadius: 6,
                                      fontSize: 11,
                                      color: '#334155',
                                      background: '#f8fafc',
                                      border: '1px solid #e2e8f0',
                                      margin: 0,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <HomeOutlined style={{ fontSize: 10, color: '#059669' }} />
                                    {c.propertyName || 'Property Assigned'}
                                  </Tag>
                                  <Tag
                                    color={isOutright ? 'cyan' : 'blue'}
                                    style={{ borderRadius: 6, fontSize: 10, padding: '0 5px', fontWeight: 600, margin: 0 }}
                                  >
                                    {isOutright ? 'OUTRIGHT' : 'PLAN'}
                                  </Tag>
                                </div>

                                {/* 2. Date joined or paid down payment */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b' }}>
                                  <CalendarOutlined style={{ fontSize: 11 }} />
                                  <span>{dayjs(c.joinedDate).isValid() ? dayjs(c.joinedDate).format('MMM D, YYYY') : (c.joinedDate || '—')}</span>
                                </div>

                                {/* 3. Down payment amount (green) */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontSize: 11, color: '#64748b' }}>Down Payment:</span>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                                    {formatRevenueGHS(c.downPaymentMinor)}
                                  </span>
                                </div>

                                {/* 4. Installments paid this month (blue) */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontSize: 11, color: '#64748b' }}>Installments:</span>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', fontVariantNumeric: 'tabular-nums' }}>
                                    {formatRevenueGHS(c.installmentsMinor)}
                                  </span>
                                </div>

                                {/* 5. Total collected from this customer this month */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontSize: 11, color: '#64748b' }}>Total This Month:</span>
                                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                                    {formatRevenueGHS(c.monthRevenueMinor)}
                                  </span>
                                </div>

                                {/* 6. Status tag (plan status) */}
                                <Tag
                                  color={c.planStatus === 'completed' ? 'success' : c.planStatus === 'active' ? 'processing' : 'default'}
                                  style={{ borderRadius: 6, fontSize: 10, fontWeight: 600, margin: 0 }}
                                >
                                  {c.planStatus === 'completed' ? 'Fully Paid' : c.planStatus === 'active' ? 'Active Plan' : (c.planStatus || 'Active')}
                                </Tag>
                              </div>
                            ),
                            children: (
                              <div style={{ padding: '10px 4px' }}>
                                {/* ── CUSTOMER ACQUISITION AGREEMENT & TERMS MEMO BOX ── */}
                                <div
                                  style={{
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderLeft: '4px solid #059669',
                                    borderRadius: 8,
                                    padding: '10px 14px',
                                    marginBottom: 14,
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                                    <Space size={6}>
                                      <FileTextOutlined style={{ color: '#059669', fontSize: 13 }} />
                                      <Text strong style={{ fontSize: 12, color: '#0f172a' }}>
                                        Acquisition Agreement & Description Memo:
                                      </Text>
                                    </Space>
                                    <Tag color="success" style={{ fontSize: 10, borderRadius: 4, fontWeight: 600 }}>
                                      Verified Contract Record
                                    </Tag>
                                  </div>
                                  <Paragraph style={{ margin: 0, fontSize: 12, color: '#334155', lineHeight: 1.6, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                    {c.description}
                                  </Paragraph>
                                </div>

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

                                  {c.transactions.length === 0 ? (
                                    <Empty
                                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                                      description="No payments recorded yet"
                                      style={{ padding: '16px 0', background: '#f8fafc', borderRadius: 8, border: '1px dashed #e2e8f0' }}
                                    />
                                  ) : (
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
                                          width: 120,
                                          render: (val: string) => (
                                            <Text style={{ fontSize: 11 }}>
                                              {dayjs(val).isValid() ? dayjs(val).format('MMM D, YYYY') : (val || '—')}
                                            </Text>
                                          ),
                                        },
                                        {
                                          title: 'Installment Number',
                                          dataIndex: 'installmentNumber',
                                          key: 'installmentNumber',
                                          width: 160,
                                          render: (val: any, record) => (
                                            <Space size={6}>
                                              <Tag
                                                color={record.type === 'down_payment' ? 'green' : record.type === 'outright_purchase' ? 'cyan' : 'blue'}
                                                style={{ fontSize: 10, borderRadius: 4 }}
                                              >
                                                {val || record.label || '—'}
                                              </Tag>
                                            </Space>
                                          ),
                                        },
                                        {
                                          title: 'Amount',
                                          dataIndex: 'amountMinor',
                                          key: 'amountMinor',
                                          align: 'right' as const,
                                          width: 140,
                                          render: (val: number) => (
                                            <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                                              {formatRevenueGHS(val)}
                                            </span>
                                          ),
                                        },
                                        {
                                          title: 'Method',
                                          dataIndex: 'method',
                                          key: 'method',
                                          width: 150,
                                          render: (val: string) => (
                                            <Tag color="geekblue" style={{ borderRadius: 6, fontSize: 10 }}>
                                              {val || '—'}
                                            </Tag>
                                          ),
                                        },
                                        {
                                          title: 'Reference',
                                          dataIndex: 'reference',
                                          key: 'reference',
                                          width: 130,
                                          render: (val: string) => (
                                            val ? (
                                              <Text copyable style={{ fontSize: 11, fontFamily: 'monospace' }}>
                                                {val}
                                              </Text>
                                            ) : '—'
                                          ),
                                        },
                                      ]}
                                    />
                                  )}
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
        )}
      </div>
    )}
  </>
)}
</Drawer>
);
};
