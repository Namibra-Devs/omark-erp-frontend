// src/components/expenses/HistoricalExpenseCrossCheck.tsx
import React, { useState, useMemo } from 'react';
import {
  Drawer,
  Card,
  Row,
  Col,
  Typography,
  Table,
  Tag,
  Space,
  Button,
  Statistic,
  Select,
  Input,
  DatePicker,
  Divider,
  Alert,
  Tooltip,
  Badge,
} from 'antd';
import {
  CalendarOutlined,
  SearchOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  SwapOutlined,
  EyeOutlined,
  ExportOutlined,
  FileDoneOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ExpenseEntity } from '@/api/expenses';
import {
  groupExpensesByDay,
  compareDailyLedgers,
  type DailyLedgerSummary,
} from '@/utils/expenseRoleIsolation';
import { tokens } from '@/constants/tokens';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export interface HistoricalExpenseCrossCheckProps {
  open: boolean;
  onClose: () => void;
  expenses: ExpenseEntity[];
  activeDate: string; // 'YYYY-MM-DD'
  onSelectDate: (date: string) => void;
  roleTitle?: string;
}

export const HistoricalExpenseCrossCheck: React.FC<HistoricalExpenseCrossCheckProps> = ({
  open,
  onClose,
  expenses,
  activeDate,
  onSelectDate,
  roleTitle = 'Departmental',
}) => {
  const dailySummaries = useMemo(() => {
    return groupExpensesByDay(expenses);
  }, [expenses]);

  const [searchText, setSearchText] = useState('');

  // Comparator states
  const todayKey = dayjs().format('YYYY-MM-DD');
  const yesterdayKey = dayjs().subtract(1, 'day').format('YYYY-MM-DD');

  const [compareDateA, setCompareDateA] = useState<string>(activeDate || todayKey);
  const [compareDateB, setCompareDateB] = useState<string>(
    dailySummaries.length > 1 && dailySummaries[1].date !== activeDate
      ? dailySummaries[1].date
      : yesterdayKey
  );

  // Sync compareDateA if activeDate changes
  React.useEffect(() => {
    if (activeDate) {
      setCompareDateA(activeDate);
    }
  }, [activeDate]);

  // Aggregate KPI across all tracked historical days
  const kpiMetrics = useMemo(() => {
    if (dailySummaries.length === 0) {
      return {
        totalDays: 0,
        averageDailySpendGHS: 0,
        peakSpendGHS: 0,
        peakDay: 'N/A',
        lowestSpendGHS: 0,
        lowestDay: 'N/A',
      };
    }

    const totalDays = dailySummaries.length;
    const totalSpendMinor = dailySummaries.reduce((sum, d) => sum + d.totalMinor, 0);
    const avgMinor = totalSpendMinor / totalDays;

    let peak = dailySummaries[0];
    let lowest = dailySummaries[0];

    dailySummaries.forEach((d) => {
      if (d.totalMinor > peak.totalMinor) peak = d;
      if (d.totalMinor < lowest.totalMinor) lowest = d;
    });

    return {
      totalDays,
      averageDailySpendGHS: avgMinor / 100,
      peakSpendGHS: peak.totalGHS,
      peakDay: peak.formattedDate,
      lowestSpendGHS: lowest.totalGHS,
      lowestDay: lowest.formattedDate,
    };
  }, [dailySummaries]);

  // Filtered daily summaries for table
  const filteredSummaries = useMemo(() => {
    if (!searchText.trim()) return dailySummaries;
    const q = searchText.trim().toLowerCase();
    return dailySummaries.filter(
      (d) =>
        d.date.includes(q) ||
        d.formattedDate.toLowerCase().includes(q) ||
        d.dayOfWeek.toLowerCase().includes(q) ||
        d.topCategory.toLowerCase().includes(q)
    );
  }, [dailySummaries, searchText]);

  // Side-by-side comparison data
  const summaryA = dailySummaries.find((d) => d.date === compareDateA);
  const summaryB = dailySummaries.find((d) => d.date === compareDateB);
  const comparison = useMemo(() => {
    return compareDailyLedgers(summaryA, summaryB);
  }, [summaryA, summaryB]);

  // Export Daily Cross-Check CSV
  const handleExportArchiveCSV = () => {
    if (dailySummaries.length === 0) return;
    const headers = [
      'Date',
      'Day Of Week',
      'Total Spend (GHS)',
      'Vouchers Count',
      'Approved Vouchers',
      'Pending Vouchers',
      'Rejected Vouchers',
      'Dominant Category',
      'Trend vs Prev Day (%)',
    ];

    const rows = dailySummaries.map((d) => [
      d.date,
      d.dayOfWeek,
      d.totalGHS.toFixed(2),
      d.count,
      d.approvedCount,
      d.pendingCount,
      d.rejectedCount,
      `"${d.topCategory}"`,
      d.spendChangeVsPrevPercent !== undefined ? `${d.spendChangeVsPrevPercent}%` : 'N/A',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `historical-daily-expense-audit-${dayjs().format('YYYY-MM-DD')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      title: 'Ledger Date',
      key: 'date',
      width: 220,
      render: (_: any, record: DailyLedgerSummary) => {
        const isCurrentActive = record.date === activeDate;
        return (
          <Space direction="vertical" size={2}>
            <Space size={6}>
              <Text strong style={{ fontSize: 13, color: isCurrentActive ? tokens.primary : '#1f2937' }}>
                {record.formattedDate}
              </Text>
              {record.isToday && (
                <Tag color="success" style={{ borderRadius: 10, fontSize: 10, padding: '0 6px' }}>
                  Today
                </Tag>
              )}
              {record.isYesterday && (
                <Tag color="cyan" style={{ borderRadius: 10, fontSize: 10, padding: '0 6px' }}>
                  Yesterday
                </Tag>
              )}
              {isCurrentActive && (
                <Badge status="processing" text={<Text style={{ fontSize: 11, color: tokens.primary }}>Active Sheet</Text>} />
              )}
            </Space>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {record.dayOfWeek} • {record.date}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Total Spend',
      key: 'totalGHS',
      width: 140,
      sorter: (a: DailyLedgerSummary, b: DailyLedgerSummary) => a.totalMinor - b.totalMinor,
      render: (_: any, record: DailyLedgerSummary) => (
        <div>
          <Text strong style={{ fontSize: 14, color: '#1a1f36' }}>
            ₵ {record.totalGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </div>
      ),
    },
    {
      title: 'Vouchers & Status',
      key: 'vouchers',
      width: 180,
      render: (_: any, record: DailyLedgerSummary) => (
        <Space size={6} wrap>
          <Tag color="blue" style={{ borderRadius: 4, fontWeight: 600 }}>
            {record.count} voucher{record.count === 1 ? '' : 's'}
          </Tag>
          {record.approvedCount > 0 && (
            <Tag color="green" icon={<CheckCircleOutlined />} style={{ borderRadius: 4 }}>
              {record.approvedCount}
            </Tag>
          )}
          {record.pendingCount > 0 && (
            <Tag color="orange" icon={<ClockCircleOutlined />} style={{ borderRadius: 4 }}>
              {record.pendingCount}
            </Tag>
          )}
          {record.rejectedCount > 0 && (
            <Tag color="red" icon={<CloseCircleOutlined />} style={{ borderRadius: 4 }}>
              {record.rejectedCount}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Top Category',
      dataIndex: 'topCategory',
      key: 'topCategory',
      width: 180,
      render: (cat: string) => (
        <Tag color="geekblue" style={{ borderRadius: 4, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {cat}
        </Tag>
      ),
    },
    {
      title: 'Day-to-Day Trend',
      key: 'trend',
      width: 130,
      render: (_: any, record: DailyLedgerSummary) => {
        if (record.spendChangeVsPrevPercent === undefined) {
          return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
        }
        const isUp = record.spendChangeVsPrevPercent > 0;
        const isDown = record.spendChangeVsPrevPercent < 0;
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              fontWeight: 600,
              color: isUp ? '#cf1322' : isDown ? '#389e0d' : '#8c8c8c',
            }}
          >
            {isUp && <ArrowUpOutlined />}
            {isDown && <ArrowDownOutlined />}
            {isUp ? `+${record.spendChangeVsPrevPercent}%` : `${record.spendChangeVsPrevPercent}%`}
          </span>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      width: 140,
      render: (_: any, record: DailyLedgerSummary) => (
        <Button
          type={record.date === activeDate ? 'default' : 'primary'}
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            onSelectDate(record.date);
            onClose();
          }}
          style={{
            borderRadius: 6,
            fontSize: 12,
            background: record.date === activeDate ? '#f0f5ff' : undefined,
            borderColor: record.date === activeDate ? tokens.primary : undefined,
          }}
        >
          {record.date === activeDate ? 'Active Sheet' : 'Open Sheet'}
        </Button>
      ),
    },
  ];

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Space size={8}>
            <CalendarOutlined style={{ color: tokens.primary, fontSize: 18 }} />
            <div>
              <Text strong style={{ fontSize: 16 }}>
                Historical Daily Expense Cross-Check & Audit
              </Text>
              <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                Cross-reference past daily sheets by date with full audit trail ({roleTitle})
              </Text>
            </div>
          </Space>
          <Button icon={<ExportOutlined />} onClick={handleExportArchiveCSV} size="small">
            Export Archive CSV
          </Button>
        </div>
      }
      open={open}
      onClose={onClose}
      width={840}
      bodyStyle={{ padding: '20px 24px', background: '#f8fafc' }}
    >
      {/* ── Top Summary Statistics ────────────────────────────────────────── */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card
            size="small"
            style={{ borderRadius: 10, border: '1px solid #e2e8f0', background: '#ffffff' }}
          >
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 11 }}>Tracked Daily Sheets</Text>}
              value={kpiMetrics.totalDays}
              suffix="Days"
              valueStyle={{ fontSize: 20, fontWeight: 700, color: tokens.primary }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card
            size="small"
            style={{ borderRadius: 10, border: '1px solid #e2e8f0', background: '#ffffff' }}
          >
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 11 }}>Average Daily Spend</Text>}
              value={kpiMetrics.averageDailySpendGHS}
              prefix="₵"
              precision={2}
              valueStyle={{ fontSize: 20, fontWeight: 700, color: '#096dd9' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card
            size="small"
            style={{ borderRadius: 10, border: '1px solid #e2e8f0', background: '#ffffff' }}
          >
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 11 }}>Peak Day Spend</Text>}
              value={kpiMetrics.peakSpendGHS}
              prefix="₵"
              precision={2}
              valueStyle={{ fontSize: 20, fontWeight: 700, color: '#cf1322' }}
            />
            <Text type="secondary" style={{ fontSize: 10 }} ellipsis>
              {kpiMetrics.peakDay}
            </Text>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card
            size="small"
            style={{ borderRadius: 10, border: '1px solid #e2e8f0', background: '#ffffff' }}
          >
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 11 }}>Lowest Day Spend</Text>}
              value={kpiMetrics.lowestSpendGHS}
              prefix="₵"
              precision={2}
              valueStyle={{ fontSize: 20, fontWeight: 700, color: '#389e0d' }}
            />
            <Text type="secondary" style={{ fontSize: 10 }} ellipsis>
              {kpiMetrics.lowestDay}
            </Text>
          </Card>
        </Col>
      </Row>

      {/* ── Side-by-Side Day-to-Day Comparison Tool ────────────────────────── */}
      <Card
        style={{
          borderRadius: 12,
          marginBottom: 20,
          border: '1px solid #dbeafe',
          background: 'linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        }}
        bodyStyle={{ padding: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Space size={6}>
            <SwapOutlined style={{ color: tokens.primary }} />
            <Text strong style={{ fontSize: 13, color: '#1e3a8a' }}>
              Day-to-Day Cross-Check Comparator
            </Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Select any two dates to compare spend variance & volume
          </Text>
        </div>

        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={11}>
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#ffffff', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>
                  Primary Date (A)
                </Text>
                <Select
                  size="small"
                  value={compareDateA}
                  onChange={setCompareDateA}
                  style={{ width: 160 }}
                >
                  {dailySummaries.map((d) => (
                    <Option key={d.date} value={d.date}>
                      {d.date} ({d.isToday ? 'Today' : d.isYesterday ? 'Yest.' : d.dayOfWeek.slice(0, 3)})
                    </Option>
                  ))}
                </Select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text strong style={{ fontSize: 16, color: tokens.primary }}>
                  ₵ {comparison.totalA.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Tag color="blue">{summaryA?.count || 0} vouchers</Tag>
              </div>
            </div>
          </Col>

          <Col xs={24} sm={2} style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#e0e7ff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4338ca',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              VS
            </div>
          </Col>

          <Col xs={24} sm={11}>
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#ffffff', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>
                  Comparison Date (B)
                </Text>
                <Select
                  size="small"
                  value={compareDateB}
                  onChange={setCompareDateB}
                  style={{ width: 160 }}
                >
                  {dailySummaries.map((d) => (
                    <Option key={d.date} value={d.date}>
                      {d.date} ({d.isToday ? 'Today' : d.isYesterday ? 'Yest.' : d.dayOfWeek.slice(0, 3)})
                    </Option>
                  ))}
                </Select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text strong style={{ fontSize: 16, color: '#4b5563' }}>
                  ₵ {comparison.totalB.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Tag>{summaryB?.count || 0} vouchers</Tag>
              </div>
            </div>
          </Col>
        </Row>

        {/* Variance Callout */}
        <div
          style={{
            marginTop: 12,
            padding: '8px 14px',
            borderRadius: 6,
            background: '#ffffff',
            border: '1px dashed #cbd5e1',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <Space size={8}>
            <Text style={{ fontSize: 12 }}>
              Variance (A vs B):
            </Text>
            <Text
              strong
              style={{
                fontSize: 13,
                color: comparison.diffGHS > 0 ? '#cf1322' : comparison.diffGHS < 0 ? '#389e0d' : '#4b5563',
              }}
            >
              {comparison.diffGHS > 0 ? '+' : ''}₵{' '}
              {comparison.diffGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {comparison.percentDiff !== null && ` (${comparison.percentDiff > 0 ? '+' : ''}${comparison.percentDiff}%)`}
            </Text>
          </Space>
          <Space size={6}>
            <Button
              type="link"
              size="small"
              onClick={() => {
                onSelectDate(compareDateA);
                onClose();
              }}
            >
              Load Sheet A ({compareDateA})
            </Button>
            <Text type="secondary">•</Text>
            <Button
              type="link"
              size="small"
              onClick={() => {
                onSelectDate(compareDateB);
                onClose();
              }}
            >
              Load Sheet B ({compareDateB})
            </Button>
          </Space>
        </div>
      </Card>

      {/* ── Daily Archive Table ────────────────────────────────────────────── */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Text strong style={{ fontSize: 14 }}>
              Daily Historical Sheets Directory ({filteredSummaries.length})
            </Text>
            <Input
              placeholder="Search date, day or category..."
              prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 220, borderRadius: 6 }}
              size="small"
              allowClear
            />
          </div>
        }
        style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          dataSource={filteredSummaries}
          columns={columns}
          rowKey="date"
          pagination={{ pageSize: 8, showSizeChanger: false }}
          size="middle"
        />
      </Card>
    </Drawer>
  );
};
