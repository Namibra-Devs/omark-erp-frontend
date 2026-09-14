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

  // Helper for ordinals (1st, 2nd, 3rd...)
  const getOrdinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const totalInstallmentMinor = installments.reduce((sum, i) => sum + (i.expectedAmountMinor || 0), 0);
  let accumulatedMinor = 0;
  const enhancedInstallments = installments.map((item, idx) => {
    accumulatedMinor += (item.expectedAmountMinor || 0);
    const remainingBalanceMinor = idx === installments.length - 1 
      ? 0 
      : Math.max(totalInstallmentMinor - accumulatedMinor, 0);
    return {
      ...item,
      ordinal: getOrdinal(item.sequence || idx + 1),
      accumulatedMinor,
      remainingBalanceMinor,
    };
  });

  const installmentColumns = [
    { 
      title: 'Inst.', 
      dataIndex: 'ordinal', 
      key: 'ordinal', 
      width: 70, 
      align: 'center' as const,
      render: (v: string) => <strong>{v}</strong>
    },
    { 
      title: 'Due Date', 
      dataIndex: 'dueDate', 
      key: 'dueDate', 
      width: 130, 
      render: (d: string) => d ? dayjs(d).format('D MMM YYYY') : 'N/A' 
    },
    { 
      title: 'Installment (₵)', 
      dataIndex: 'expectedAmountMinor', 
      key: 'amount', 
      width: 140, 
      align: 'right' as const,
      render: (v: number) => `₵${((v || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
    },
    { 
      title: 'Accumulated (₵)', 
      dataIndex: 'accumulatedMinor', 
      key: 'accumulated', 
      width: 150, 
      align: 'right' as const,
      render: (v: number) => `₵${((v || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
    },
    { 
      title: 'Remaining Balance (₵)', 
      dataIndex: 'remainingBalanceMinor', 
      key: 'remaining', 
      width: 170, 
      align: 'right' as const,
      render: (v: number) => <strong>₵{((v || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
    },
    {
      title: 'Status',
      dataIndex: 'isPaid',
      key: 'status',
      width: 100,
      align: 'center' as const,
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
            dataSource={enhancedInstallments}
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
