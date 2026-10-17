// src/components/expenses/ExpenseDayAccordion.tsx
import React, { useState } from 'react';
import { Table, Tag, Typography, Button, Space, Tooltip, Popconfirm } from 'antd';
import {
  CalendarOutlined,
  DownOutlined,
  RightOutlined,
  FileTextOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ExpenseEntity } from '@/api/expenses';
import { formatExpenseCurrency, type GroupedDay } from '@/utils/expenseGrouping';
import { resolveFourMainDepartment, type FourMainDepartmentKey } from '@/utils/departmentExpenses';
import { FOUR_DEPARTMENT_UI_CONFIG } from './RoleExpenseDashboard';
import { tokens } from '@/constants/tokens';

const { Text, Paragraph } = Typography;

export interface ExpenseDayAccordionProps {
  day: GroupedDay<ExpenseEntity>;
  defaultExpanded?: boolean;
  isAdminOrAccounts: boolean;
  onViewVoucher: (expense: ExpenseEntity) => void;
  onApproveExpense?: (id: string) => void;
  onRejectExpense?: (expense: ExpenseEntity) => void;
  onSelectDepartment?: (deptKey: FourMainDepartmentKey) => void;
  customColumns?: any[];
}

export const ExpenseDayAccordion: React.FC<ExpenseDayAccordionProps> = ({
  day,
  defaultExpanded = false,
  isAdminOrAccounts,
  onViewVoucher,
  onApproveExpense,
  onRejectExpense,
  onSelectDepartment,
  customColumns,
}) => {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);

  // Table columns for Level 4 individual expense rows
  const columns = [
    {
      title: 'Voucher',
      key: 'voucher',
      width: 140,
      render: (_: any, record: ExpenseEntity) => (
        <div>
          <Tooltip title="Click to view full expense record">
            <Text
              strong
              style={{ color: tokens.primary, fontSize: 13, cursor: 'pointer' }}
              onClick={() => onViewVoucher(record)}
            >
              {record.code || `EXP-${record.id.slice(0, 6).toUpperCase()}`}
            </Text>
          </Tooltip>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>
            {dayjs(record.incurredOn).format('MMM D, YYYY')}
          </div>
        </div>
      ),
    },
    {
      title: 'Category & Details',
      key: 'category',
      width: 250,
      render: (_: any, record: ExpenseEntity) => (
        <div style={{ maxWidth: 280 }}>
          <Space size={4} wrap>
            <Tag color="blue" style={{ borderRadius: 4, fontWeight: 600 }}>
              {record.category}
            </Tag>
            <Tag color={record.type === 'internal' ? 'cyan' : 'purple'} style={{ borderRadius: 4, fontSize: 10 }}>
              {record.type.toUpperCase()}
            </Tag>
          </Space>
          {record.description && (
            <Paragraph
              ellipsis={{ rows: 2, tooltip: record.description }}
              style={{ fontSize: 12, color: '#595959', margin: '4px 0 0 0' }}
            >
              {record.description}
            </Paragraph>
          )}
        </div>
      ),
    },
    {
      title: 'Department',
      key: 'department',
      width: 140,
      render: (_: any, record: ExpenseEntity) => {
        const deptKey = resolveFourMainDepartment(record);
        const cfg = FOUR_DEPARTMENT_UI_CONFIG[deptKey];
        return (
          <Tooltip title={`Open ${cfg.name} Department Drawer`}>
            <Tag
              color={cfg.color}
              style={{
                cursor: onSelectDepartment ? 'pointer' : 'default',
                borderRadius: 12,
                padding: '2px 8px',
                fontWeight: 600,
                fontSize: 11,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              onClick={() => onSelectDepartment?.(deptKey)}
            >
              {cfg.icon}
              {cfg.name}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Submitter & Branch',
      key: 'submitter',
      width: 170,
      render: (_: any, record: ExpenseEntity) => (
        <div>
          <Space size={4}>
            <UserOutlined style={{ color: '#8c8c8c', fontSize: 11 }} />
            <Text style={{ fontSize: 12, fontWeight: 500 }}>
              {record.recordedByUserName || 'Staff Member'}
            </Text>
          </Space>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>
            {record.branchName || 'Kumasi Main'} •{' '}
            <span style={{ textTransform: 'capitalize' }}>
              {(record.recordedByUserRole || '').replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amountMinor',
      key: 'amountMinor',
      width: 140,
      align: 'right' as const,
      render: (amountMinor: number) => (
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#111827',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {formatExpenseCurrency(amountMinor)}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center' as const,
      render: (status: string, record: ExpenseEntity) => {
        const isApproved = status === 'approved';
        const isPending = status === 'pending';
        return (
          <Tooltip title={record.decisionNote ? `Note: ${record.decisionNote}` : undefined}>
            <Tag
              color={isApproved ? 'success' : isPending ? 'warning' : 'error'}
              icon={
                isApproved ? (
                  <CheckCircleOutlined />
                ) : isPending ? (
                  <ClockCircleOutlined />
                ) : (
                  <CloseCircleOutlined />
                )
              }
              style={{ borderRadius: 12, padding: '2px 8px', fontWeight: 600 }}
            >
              {isApproved ? 'Approved' : isPending ? 'Pending' : 'Rejected'}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 175,
      align: 'center' as const,
      render: (_: any, record: ExpenseEntity) => (
        <Space size={4}>
          <Tooltip title="Expand full record details on large screen without scrolling">
            <Button
              size="small"
              icon={<EyeOutlined />}
              style={{
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                borderColor: '#bfdbfe',
                color: '#1d4ed8',
                background: '#eff6ff',
              }}
              onClick={() => onViewVoucher(record)}
            >
              View More
            </Button>
          </Tooltip>

          {isAdminOrAccounts && record.status === 'pending' && (
            <>
              {onApproveExpense && (
                <Tooltip title="Direct Administrative Approval">
                  <Popconfirm
                    title="Authorize Department Expense"
                    description={`Approve ${formatExpenseCurrency(record.amountMinor)} for ${record.category}?`}
                    onConfirm={() => onApproveExpense(record.id)}
                    okText="Authorize"
                    okButtonProps={{ type: 'primary', style: { background: '#52c41a' } }}
                  >
                    <Button
                      size="small"
                      type="primary"
                      style={{ background: '#52c41a', borderColor: '#52c41a' }}
                      icon={<CheckCircleOutlined />}
                    >
                      Approve
                    </Button>
                  </Popconfirm>
                </Tooltip>
              )}

              {onRejectExpense && (
                <Tooltip title="Reject Requisition with Reason">
                  <Button
                    size="small"
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => onRejectExpense(record)}
                  >
                    Reject
                  </Button>
                </Tooltip>
              )}
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div
      style={{
        borderRadius: 8,
        border: '1px solid #eef2f6',
        backgroundColor: '#ffffff',
        marginBottom: 8,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Level 3 Header: Day accordion header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setExpanded(!expanded);
          }
        }}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          padding: '10px 14px',
          background: expanded ? '#f8fafc' : '#ffffff',
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: expanded ? '1px solid #eef2f6' : 'none',
        }}
      >
        <Space size={8} wrap>
          <span style={{ color: '#64748b', fontSize: 12 }}>
            {expanded ? <DownOutlined /> : <RightOutlined />}
          </span>
          <CalendarOutlined style={{ color: tokens.primary, fontSize: 13 }} />
          <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
            {day.dateLabel}
          </Text>
          <Tag color="default" style={{ borderRadius: 10, fontSize: 11, margin: 0 }}>
            {day.count} {day.count === 1 ? 'expense' : 'expenses'}
          </Tag>
        </Space>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>
            Day Total:
          </Text>
          <Text
            strong
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#0f172a',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatExpenseCurrency(day.totalMinor)}
          </Text>
        </div>
      </div>

      {/* Level 4: Individual expense rows (lazy rendered only when expanded) */}
      {expanded && (
        <div style={{ padding: '4px 0 0 0' }}>
          <Table
            dataSource={day.items}
            columns={customColumns || columns}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: customColumns ? 720 : 1000 }}
          />
        </div>
      )}
    </div>
  );
};
