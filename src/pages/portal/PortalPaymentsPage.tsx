// src/pages/portal/PortalPaymentsPage.tsx
import React from 'react';
import { Card, Empty, Table, Tag, Typography, Spin } from 'antd';
import { DollarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { usePortalPaymentsQuery } from '@/api/portal';

const { Title } = Typography;

export const PortalPaymentsPage: React.FC = () => {
  const { data: paymentsData, isLoading } = usePortalPaymentsQuery();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="Loading payment history..." />
      </div>
    );
  }

  const installments = paymentsData?.installments ?? [];
  const payments = paymentsData?.payments ?? [];

  const installmentColumns = [
    { title: '#', dataIndex: 'sequence', key: 'sequence', width: 50 },
    { title: 'Due Date', dataIndex: 'dueDate', key: 'dueDate', width: 120, render: (d: string) => d ? dayjs(d).format('MMM D, YYYY') : 'N/A' },
    { title: 'Expected Amount', dataIndex: 'expectedAmountMinor', key: 'amount', width: 140, render: (v: number) => `GHS ${(v / 100).toLocaleString()}` },
    {
      title: 'Status',
      dataIndex: 'isPaid',
      key: 'status',
      width: 90,
      render: (isPaid: boolean) => <Tag color={isPaid ? 'green' : 'red'}>{isPaid ? 'Paid' : 'Pending'}</Tag>,
    },
  ];

  const paymentColumns = [
    { title: 'Date', dataIndex: 'createdAt', key: 'createdAt', width: 120, render: (d: string) => d ? dayjs(d).format('MMM D, YYYY') : 'N/A' },
    { title: 'Amount Paid', dataIndex: 'amountMinor', key: 'amount', width: 140, render: (v: number) => `GHS ${(v / 100).toLocaleString()}` },
    { title: 'Method', dataIndex: 'paymentMethod', key: 'method', width: 120, render: (m?: string) => <Tag>{m || 'Online/Cash'}</Tag> },
    { title: 'Reference', dataIndex: 'reference', key: 'reference', width: 140, render: (r?: string) => r || '—' },
  ];

  return (
    <div>
      <Title level={3} style={{ fontSize: 'clamp(18px, 4vw, 24px)', marginBottom: 16 }}>
        <DollarOutlined /> Payments & Schedule
      </Title>

      <Card title="Installment Schedule" style={{ marginBottom: 20 }}>
        {installments.length > 0 ? (
          <Table
            columns={installmentColumns}
            dataSource={installments}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
          />
        ) : (
          <Empty description="No installment schedule found." />
        )}
      </Card>

      <Card title="Payment History">
        {payments.length > 0 ? (
          <Table
            columns={paymentColumns}
            dataSource={payments}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
          />
        ) : (
          <Empty description="No payment history recorded yet." />
        )}
      </Card>
    </div>
  );
};
