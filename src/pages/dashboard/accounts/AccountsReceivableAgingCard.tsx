import React, { useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  Radio,
  Empty,
  Tooltip,
  Badge,
} from 'antd';
import {
  ClockCircleOutlined,
  WarningOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  UserOutlined,
  PhoneOutlined,
  DollarOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { usePaymentPlansQuery } from '@/api/paymentPlans';
import { useCustomersQuery } from '@/api/customers';
import { buildPaymentPlanSchedule } from '@/utils/paymentPlanSchedule';
import { tokens } from '@/constants/tokens';
import type { PaymentPlan, Customer } from '@/types';

const { Title, Text } = Typography;

export type AgingBucketKey = 'all' | '0-30' | '31-60' | '61-90' | '90+';

interface OverdueAccountItem {
  customerId: string;
  customerName: string;
  phoneNumber?: string;
  planId: string;
  propertyName?: string;
  daysOverdue: number;
  overdueAmountMinor: number;
  totalBalanceMinor: number;
  oldestDueDate: string;
  bucket: '0-30' | '31-60' | '61-90' | '90+';
  rawPlan: PaymentPlan;
}

interface AccountsReceivableAgingCardProps {
  onRecordPayment?: (customerRecord: any) => void;
}

export const AccountsReceivableAgingCard: React.FC<AccountsReceivableAgingCardProps> = ({
  onRecordPayment,
}) => {
  const navigate = useNavigate();
  const [selectedBucket, setSelectedBucket] = useState<AgingBucketKey>('all');

  const { data: paymentPlansData, isLoading: plansLoading } = usePaymentPlansQuery({ pageSize: 100 });
  const { data: customersData, isLoading: customersLoading } = useCustomersQuery({ pageSize: 100 });

  const paymentPlans: PaymentPlan[] = paymentPlansData?.items ?? [];
  const customers: Customer[] = customersData?.items ?? [];

  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach((c) => map.set(c.id, c));
    return map;
  }, [customers]);

  // ── Calculate Aging Buckets ──────────────────────────────────────────────
  const { overdueAccounts, bucketStats, totalOverdueMinor } = useMemo(() => {
    const accountsList: OverdueAccountItem[] = [];
    const today = dayjs();

    paymentPlans.forEach((plan) => {
      // Only active or defaulted plans with outstanding balance
      if (plan.status === 'completed' || plan.status === 'cancelled') return;

      const schedule = buildPaymentPlanSchedule(plan);
      if (schedule.currentBalanceMinor <= 0) return;

      // Find all past-due unpaid or partially-paid installments
      const overdueRows = schedule.rows.filter((row) => {
        if (!row.dueDate) return false;
        const isPastDue = dayjs(row.dueDate).isBefore(today, 'day');
        return isPastDue && (!row.isPaid || row.isPartiallyPaid);
      });

      if (overdueRows.length === 0) return;

      // Find oldest overdue row to calculate max days overdue
      let maxDaysOverdue = 0;
      let oldestDate = overdueRows[0].dueDate;
      let sumOverdueMinor = 0;

      overdueRows.forEach((r) => {
        const diff = today.diff(dayjs(r.dueDate), 'day');
        if (diff > maxDaysOverdue) {
          maxDaysOverdue = diff;
          oldestDate = r.dueDate;
        }
        const unpaid = r.isPartiallyPaid && r.deficitMinor > 0 ? r.deficitMinor : r.installmentMinor;
        sumOverdueMinor += unpaid;
      });

      // Clamp sumOverdue to current remaining balance
      sumOverdueMinor = Math.min(sumOverdueMinor, schedule.currentBalanceMinor);

      let bucket: '0-30' | '31-60' | '61-90' | '90+' = '0-30';
      if (maxDaysOverdue > 90) bucket = '90+';
      else if (maxDaysOverdue > 60) bucket = '61-90';
      else if (maxDaysOverdue > 30) bucket = '31-60';

      const customer = customerMap.get(plan.customerId);
      const customerName = customer
        ? `${customer.firstName} ${customer.lastName}`
        : (plan as any).customerName || `Customer ${plan.customerId.slice(0, 6)}`;

      accountsList.push({
        customerId: plan.customerId,
        customerName,
        phoneNumber: customer?.phoneNumber,
        planId: plan.id,
        propertyName: (plan as any).propertyName || `Property #${plan.propertyId.slice(0, 6)}`,
        daysOverdue: maxDaysOverdue,
        overdueAmountMinor: sumOverdueMinor,
        totalBalanceMinor: schedule.currentBalanceMinor,
        oldestDueDate: oldestDate,
        bucket,
        rawPlan: plan,
      });
    });

    // Sort by days overdue descending
    accountsList.sort((a, b) => b.daysOverdue - a.daysOverdue);

    // Compute stats per bucket
    const stats = {
      '0-30': { count: 0, totalMinor: 0, label: '0–30 Days (Current)', color: '#52c41a', risk: 'Low Risk' },
      '31-60': { count: 0, totalMinor: 0, label: '31–60 Days', color: '#faad14', risk: 'Moderate' },
      '61-90': { count: 0, totalMinor: 0, label: '61–90 Days', color: '#fa8c16', risk: 'High Risk' },
      '90+': { count: 0, totalMinor: 0, label: '90+ Days (Critical)', color: '#ff4d4f', risk: 'Critical / Severely Delinquent' },
    };

    let totalMinor = 0;
    accountsList.forEach((acc) => {
      stats[acc.bucket].count += 1;
      stats[acc.bucket].totalMinor += acc.overdueAmountMinor;
      totalMinor += acc.overdueAmountMinor;
    });

    return {
      overdueAccounts: accountsList,
      bucketStats: stats,
      totalOverdueMinor: totalMinor,
    };
  }, [paymentPlans, customerMap]);

  // Filter accounts by selected bucket
  const filteredAccounts = useMemo(() => {
    if (selectedBucket === 'all') return overdueAccounts;
    return overdueAccounts.filter((a) => a.bucket === selectedBucket);
  }, [overdueAccounts, selectedBucket]);

  const columns = [
    {
      title: 'Customer Name',
      dataIndex: 'customerName',
      key: 'customerName',
      render: (name: string, record: OverdueAccountItem) => (
        <Space>
          <UserOutlined style={{ color: '#1677ff' }} />
          <div>
            <a onClick={() => navigate(`/customers/${record.customerId}`)}>
              <Text strong>{name}</Text>
            </a>
            {record.propertyName && (
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                {record.propertyName}
              </Text>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: 'Phone Number',
      dataIndex: 'phoneNumber',
      key: 'phoneNumber',
      render: (phone: string) =>
        phone ? (
          <a href={`tel:${phone}`} style={{ fontSize: 12 }}>
            <PhoneOutlined /> {phone}
          </a>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>N/A</Text>
        ),
    },
    {
      title: 'Days Overdue',
      dataIndex: 'daysOverdue',
      key: 'daysOverdue',
      sorter: (a: OverdueAccountItem, b: OverdueAccountItem) => b.daysOverdue - a.daysOverdue,
      render: (days: number, record: OverdueAccountItem) => {
        let color = '#52c41a';
        if (days > 90) color = '#ff4d4f';
        else if (days > 60) color = '#fa8c16';
        else if (days > 30) color = '#faad14';
        return (
          <div>
            <Tag color={color} style={{ fontWeight: 600 }}>
              {days} days
            </Tag>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
              Since {dayjs(record.oldestDueDate).format('MMM D, YYYY')}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Aging Bucket',
      dataIndex: 'bucket',
      key: 'bucket',
      render: (b: string) => {
        if (b === '90+') return <Tag color="error">90+ Days Critical</Tag>;
        if (b === '61-90') return <Tag color="warning">61–90 Days</Tag>;
        if (b === '31-60') return <Tag color="gold">31–60 Days</Tag>;
        return <Tag color="success">0–30 Days</Tag>;
      },
    },
    {
      title: 'Overdue Amount',
      dataIndex: 'overdueAmountMinor',
      key: 'overdueAmountMinor',
      align: 'right' as const,
      sorter: (a: OverdueAccountItem, b: OverdueAccountItem) => b.overdueAmountMinor - a.overdueAmountMinor,
      render: (minor: number) => (
        <Text strong style={{ color: '#ff4d4f', fontSize: 13 }}>
          GH₵ {(minor / 100).toFixed(2)}
        </Text>
      ),
    },
    {
      title: 'Total Balance',
      dataIndex: 'totalBalanceMinor',
      key: 'totalBalanceMinor',
      align: 'right' as const,
      render: (minor: number) => (
        <Text style={{ fontSize: 12 }}>
          GH₵ {(minor / 100).toFixed(2)}
        </Text>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right' as const,
      render: (_: any, record: OverdueAccountItem) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<DollarOutlined />}
            onClick={() => {
              if (onRecordPayment) {
                onRecordPayment({
                  ...record.rawPlan,
                  customerId: record.customerId,
                  name: record.customerName,
                  phone: record.phoneNumber,
                });
              } else {
                navigate(`/payment-plans?customerId=${record.customerId}`);
              }
            }}
          >
            Record Payment
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <ClockCircleOutlined style={{ color: tokens.primary }} />
          <span>Accounts Receivable (AR) Aging Buckets</span>
          {overdueAccounts.length > 0 && (
            <Badge count={overdueAccounts.length} style={{ backgroundColor: '#ff4d4f' }} />
          )}
        </Space>
      }
      extra={
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>Total Overdue Receivables:</Text>
          <Text strong style={{ color: '#ff4d4f', fontSize: 15 }}>
            GH₵ {(totalOverdueMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </Space>
      }
      style={{ borderRadius: 10, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
    >
      {/* ── 4 Interactive Bucket Cards ───────────────────────────────────── */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {(['0-30', '31-60', '61-90', '90+'] as const).map((key) => {
          const b = bucketStats[key];
          const isSelected = selectedBucket === key;
          const share =
            totalOverdueMinor > 0 ? Math.round((b.totalMinor / totalOverdueMinor) * 100) : 0;

          return (
            <Col xs={24} sm={12} lg={6} key={key}>
              <div
                onClick={() => setSelectedBucket(selectedBucket === key ? 'all' : key)}
                style={{
                  cursor: 'pointer',
                  borderRadius: 8,
                  padding: '12px 14px',
                  background: isSelected ? '#f0f9ff' : '#f8fafc',
                  border: isSelected ? `2px solid #0284c7` : `1px solid #e2e8f0`,
                  borderLeft: `5px solid ${b.color}`,
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
                    {b.label}
                  </Text>
                  <Tag color={b.color} style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>
                    {b.count} {b.count === 1 ? 'account' : 'accounts'}
                  </Tag>
                </div>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text strong style={{ fontSize: 17, color: b.color }}>
                    GH₵ {(b.totalMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>
                    {share}% of overdue
                  </Text>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  {b.risk}
                </div>
              </div>
            </Col>
          );
        })}
      </Row>

      {/* ── Filter Selector and Table ───────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>Filter Aging Cohort:</Text>
          <Radio.Group
            value={selectedBucket}
            onChange={(e) => setSelectedBucket(e.target.value)}
            size="small"
            buttonStyle="solid"
          >
            <Radio.Button value="all">All Overdue ({overdueAccounts.length})</Radio.Button>
            <Radio.Button value="0-30">0–30 Days ({bucketStats['0-30'].count})</Radio.Button>
            <Radio.Button value="31-60">31–60 Days ({bucketStats['31-60'].count})</Radio.Button>
            <Radio.Button value="61-90">61–90 Days ({bucketStats['61-90'].count})</Radio.Button>
            <Radio.Button value="90+">90+ Days ({bucketStats['90+'].count})</Radio.Button>
          </Radio.Group>
        </Space>
        {selectedBucket !== 'all' && (
          <Button size="small" type="link" onClick={() => setSelectedBucket('all')}>
            Clear Filter (Show All)
          </Button>
        )}
      </div>

      {filteredAccounts.length > 0 ? (
        <Table
          dataSource={filteredAccounts}
          rowKey={(r) => `${r.customerId}-${r.planId}`}
          columns={columns}
          size="small"
          pagination={{ pageSize: 5 }}
        />
      ) : (
        <Empty
          description={
            <span style={{ color: '#52c41a' }}>
              <CheckCircleOutlined style={{ marginRight: 6 }} />
              {selectedBucket === 'all'
                ? 'No overdue accounts detected — all payment plan contributions are up to date!'
                : `No delinquent accounts in the ${selectedBucket} days bucket.`}
            </span>
          }
        />
      )}
    </Card>
  );
};
