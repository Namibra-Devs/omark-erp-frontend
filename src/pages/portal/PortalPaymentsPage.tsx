// src/pages/portal/PortalPaymentsPage.tsx
// ⚠️ PROTOTYPE — see src/mock/customerPortalCache.ts. Installments/payment
// history only appear here once staff have opened this customer's detail
// page at least once in this browser (that's the only fetch that carries
// this detail) — otherwise this section shows as not yet available.
import React from 'react';
import { Alert, Card, Empty, Table, Tag, Typography } from 'antd';
import { DollarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useCustomerPortalAuth } from '@/contexts/CustomerPortalAuthContext';

const { Title } = Typography;

export const PortalPaymentsPage: React.FC = () => {
  const { customer } = useCustomerPortalAuth();
  if (!customer) return null;

  const installments = customer.installments ?? [];
  const payments = customer.recentPayments ?? [];

  const installmentColumns = [
    { title: '#', dataIndex: 'sequence', key: 'sequence', width: 60 },
    { title: 'Due Date', dataIndex: 'dueDate', key: 'dueDate', render: (d: string) => dayjs(d).format('MMM D, YYYY') },
    { title: 'Amount', dataIndex: 'expectedAmountMinor', key: 'amount', render: (v: number) => `GHS ${(v / 100).toLocaleString()}` },
    {
      title: 'Status',
      dataIndex: 'isPaid',
      key: 'status',
      render: (isPaid: boolean) => <Tag color={isPaid ? 'green' : 'red'}>{isPaid ? 'Paid' : 'Pending'}</Tag>,
    },
  ];

  const paymentColumns = [
    { title: 'Date', dataIndex: 'paidOn', key: 'paidOn', render: (d: string) => dayjs(d).format('MMM D, YYYY') },
    { title: 'Amount', dataIndex: 'amountMinor', key: 'amount', render: (v: number) => `GHS ${(v / 100).toLocaleString()}` },
    { title: 'Method', dataIndex: 'method', key: 'method', render: (m: string) => <Tag>{m}</Tag> },
    { title: 'Reference', dataIndex: 'reference', key: 'reference', render: (r: string) => r || '—' },
  ];

  return (
    <div>
      <Title level={3}><DollarOutlined /> Payments</Title>

      {installments.length === 0 && payments.length === 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
          message="Payment history not yet available"
          description="This detail hasn't been synced to your portal yet — it appears the next time your account manager opens your record. Contact them if you need it sooner."
        />
      )}

      <Card title="Installment Schedule" style={{ marginBottom: 24 }}>
        {installments.length > 0 ? (
          <Table columns={installmentColumns} dataSource={installments} rowKey="id" pagination={false} size="small" />
        ) : (
          <Empty description="No installment schedule cached yet." />
        )}
      </Card>

      <Card title="Payment History">
        {payments.length > 0 ? (
          <Table columns={paymentColumns} dataSource={payments} rowKey="id" pagination={false} size="small" />
        ) : (
          <Empty description="No payment history cached yet." />
        )}
      </Card>
    </div>
  );
};
