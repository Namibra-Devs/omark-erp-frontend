// src/components/paymentPlan/PaymentPlanChangeHistoryView.tsx
import React from 'react';
import { Card, Typography, Tag, Space, Empty, Spin, Timeline } from 'antd';
import { HistoryOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { usePaymentPlanChangesQuery, type PaymentPlanChange, type PlanFieldDiff } from '@/api/paymentPlans';
import { StatusTag } from '@/components/shared/StatusTag';

const { Text, Paragraph } = Typography;

interface PaymentPlanChangeHistoryViewProps {
  planId?: string;
  active?: boolean;
}

const formatFieldValue = (field: string, val: any): React.ReactNode => {
  if (val === null || val === undefined) return 'None';

  switch (field) {
    case 'totalAmountMinor':
    case 'downPaymentMinor':
    case 'balanceMinor':
    case 'monthlyAmountMinor':
    case 'paidMinor':
    case 'paidMinorAtChange':
    case 'expectedAmountMinor': {
      const num = typeof val === 'number' ? val : Number(val);
      return `GHS ${(num / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    case 'numMonths': {
      return `${val} months`;
    }
    case 'startDate': {
      return dayjs(val).isValid() ? dayjs(val).format('D MMM YYYY') : String(val);
    }
    case 'status': {
      return <StatusTag status={String(val) as any} type="paymentPlan" />;
    }
    case 'planBasis': {
      return val === 'monthly_amount' ? 'Fixed Monthly Amount' : 'Fixed Number of Months';
    }
    default:
      return String(val);
  }
};

const getFieldLabel = (field: string): string => {
  switch (field) {
    case 'totalAmountMinor':
      return 'Total Amount';
    case 'downPaymentMinor':
      return 'Down Payment';
    case 'balanceMinor':
      return 'Balance';
    case 'numMonths':
      return 'Duration';
    case 'monthlyAmountMinor':
      return 'Monthly Amount';
    case 'startDate':
      return 'Start Date';
    case 'status':
      return 'Status';
    case 'planBasis':
      return 'Plan Basis';
    default:
      return field
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase());
  }
};

export const PaymentPlanChangeHistoryView: React.FC<PaymentPlanChangeHistoryViewProps> = ({
  planId,
  active = true,
}) => {
  const { data, isLoading, error } = usePaymentPlanChangesQuery(planId, active);

  if (!planId) {
    return <Empty description="No payment plan selected." />;
  }

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin tip="Loading change history..." />
      </div>
    );
  }

  if (error) {
    return (
      <Empty
        description={
          (error as any)?.response?.status === 403
            ? 'You do not have permission to view payment plan change history.'
            : 'Failed to load change history.'
        }
      />
    );
  }

  const changes: PaymentPlanChange[] = data?.changes ?? [];

  if (changes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <HistoryOutlined style={{ fontSize: 40, color: '#bfbfbf', marginBottom: 12 }} />
        <Paragraph type="secondary" style={{ fontSize: 14 }}>
          No changes recorded yet.
        </Paragraph>
      </div>
    );
  }

  return (
    <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
      <Timeline
        mode="left"
        items={changes.map((item) => {
          const author = item.changedBy
            ? `${item.changedBy.firstName || ''} ${item.changedBy.lastName || ''}`.trim() || item.changedBy.email || 'Staff'
            : 'Staff Member';
          const role = item.changedBy?.role || 'staff';
          const formattedDate = dayjs(item.createdAt).isValid()
            ? dayjs(item.createdAt).format('D MMM YYYY, HH:mm')
            : item.createdAt;

          return {
            color: '#1890ff',
            children: (
              <Card
                size="small"
                style={{
                  marginBottom: 12,
                  borderRadius: 8,
                  borderColor: '#e8e8e8',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
                bodyStyle={{ padding: 14 }}
              >
                {/* Header: Who & When */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                  <Space size={6} wrap>
                    <UserOutlined style={{ color: '#1890ff' }} />
                    <Text strong style={{ fontSize: 13 }}>{author}</Text>
                    <Tag color="geekblue" style={{ fontSize: 11, margin: 0, textTransform: 'capitalize' }}>
                      {role}
                    </Tag>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formattedDate}
                  </Text>
                </div>

                {/* Reason */}
                <div
                  style={{
                    background: '#f9fbfd',
                    borderLeft: '3px solid #1890ff',
                    padding: '8px 12px',
                    borderRadius: 4,
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ fontStyle: 'italic', fontSize: 13, color: '#333' }}>
                    &ldquo;{item.reason}&rdquo;
                  </Text>
                </div>

                {/* Field Diff List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {item.changes && item.changes.length > 0 ? (
                    item.changes.map((diff: PlanFieldDiff, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: '#fafafa',
                          padding: '6px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        <Text type="secondary" style={{ minWidth: 120, fontWeight: 500 }}>
                          {getFieldLabel(diff.field)}
                        </Text>
                        <Space size={8} wrap>
                          <Text delete type="secondary" style={{ color: '#8c8c8c' }}>
                            {formatFieldValue(diff.field, diff.from)}
                          </Text>
                          <Text style={{ color: '#bfbfbf' }}>→</Text>
                          <Text strong style={{ color: '#092b5a' }}>
                            {formatFieldValue(diff.field, diff.to)}
                          </Text>
                        </Space>
                      </div>
                    ))
                  ) : (
                    <Text type="secondary" style={{ fontSize: 12 }}>Terms re-validated with no structural changes</Text>
                  )}
                </div>

                {/* Rescheduling & Payment details tag */}
                {(item.installmentsPreserved !== undefined || item.installmentsRegenerated !== undefined) && (
                  <div style={{ marginTop: 8 }}>
                    <Tag color="cyan" style={{ fontSize: 11, borderRadius: 4 }}>
                      {item.installmentsPreserved ?? 0} paid instalments preserved · {item.installmentsRegenerated ?? 0} rescheduled
                    </Tag>
                  </div>
                )}
              </Card>
            ),
          };
        })}
      />
    </div>
  );
};
