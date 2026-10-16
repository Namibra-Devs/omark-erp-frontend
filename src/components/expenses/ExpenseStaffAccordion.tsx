// src/components/expenses/ExpenseStaffAccordion.tsx
import React, { useState } from 'react';
import { Tag, Typography, Button, Space, Tooltip } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  DownOutlined,
  RightOutlined,
  FullscreenOutlined,
  StarFilled,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ExpenseEntity } from '@/api/expenses';
import {
  formatExpenseCurrency,
  type GroupedStaffOrRole,
  type GroupByLevel2,
} from '@/utils/expenseGrouping';
import type { FourMainDepartmentKey } from '@/utils/departmentExpenses';
import { ExpenseDayAccordion } from './ExpenseDayAccordion';
import { tokens } from '@/constants/tokens';

const { Text } = Typography;

export interface ExpenseStaffAccordionProps {
  group: GroupedStaffOrRole<ExpenseEntity>;
  groupBy: GroupByLevel2; // 'staff' | 'role'
  defaultExpanded?: boolean;
  isAdminOrAccounts: boolean;
  onOpenDrawer: (group: GroupedStaffOrRole<ExpenseEntity>) => void;
  onViewVoucher: (expense: ExpenseEntity) => void;
  onApproveExpense?: (id: string) => void;
  onRejectExpense?: (expense: ExpenseEntity) => void;
  onSelectDepartment?: (deptKey: FourMainDepartmentKey) => void;
  customColumns?: any[];
}

export const ExpenseStaffAccordion: React.FC<ExpenseStaffAccordionProps> = ({
  group,
  groupBy,
  defaultExpanded = false,
  isAdminOrAccounts,
  onOpenDrawer,
  onViewVoucher,
  onApproveExpense,
  onRejectExpense,
  onSelectDepartment,
  customColumns,
}) => {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);
  const todayKey = dayjs().format('YYYY-MM-DD');

  return (
    <div
      style={{
        borderRadius: 10,
        border: group.isCurrentUser ? `1.5px solid ${tokens.primary}44` : '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        marginBottom: 10,
        boxShadow: expanded ? '0 4px 12px rgba(0,0,0,0.04)' : '0 1px 3px rgba(0,0,0,0.02)',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Level 2 Header: Staff or Role */}
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
          gap: 10,
          padding: '12px 16px',
          background: group.isCurrentUser
            ? 'linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%)'
            : expanded
            ? '#f8fafc'
            : '#ffffff',
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: expanded ? '1px solid #e2e8f0' : 'none',
        }}
      >
        {/* Left: Indicator + Icon + Name + Role Tag + Badges */}
        <Space size={8} wrap style={{ alignItems: 'center' }}>
          <span style={{ color: '#475569', fontSize: 13, marginRight: 2 }}>
            {expanded ? <DownOutlined /> : <RightOutlined />}
          </span>

          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: group.isCurrentUser ? `${tokens.primary}18` : '#f1f5f9',
              color: group.isCurrentUser ? tokens.primary : '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
            }}
          >
            {groupBy === 'role' ? <TeamOutlined /> : <UserOutlined />}
          </div>

          <div>
            <Space size={6} wrap align="center">
              <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
                {group.name}
              </Text>

              {group.isCurrentUser && (
                <Tag color="blue" style={{ borderRadius: 8, fontSize: 11, fontWeight: 600, margin: 0 }}>
                  <StarFilled style={{ marginRight: 3, color: '#faad14' }} />
                  You
                </Tag>
              )}

              {/* Show role tag when grouped by staff */}
              {groupBy === 'staff' && group.roleLabel && (
                <Tag color="cyan" style={{ borderRadius: 8, fontSize: 11, margin: 0 }}>
                  {group.roleLabel}
                </Tag>
              )}

              <Tag color="default" style={{ borderRadius: 10, fontSize: 11, margin: 0 }}>
                {group.count} {group.count === 1 ? 'expense' : 'expenses'}
              </Tag>
            </Space>
          </div>
        </Space>

        {/* Right: Total + Percentage Share + View more Drawer Trigger */}
        <Space size={12} wrap style={{ alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
              <Tag
                color={group.percentageOfMonth >= 25 ? 'purple' : 'geekblue'}
                style={{
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                {group.percentageOfMonth}% of month
              </Tag>
              <Text
                strong
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#0f172a',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatExpenseCurrency(group.totalMinor)}
              </Text>
            </div>
          </div>

          <Tooltip title={`View detailed monthly day-by-day records for ${group.name}`}>
            <Button
              size="small"
              icon={<FullscreenOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onOpenDrawer(group);
              }}
              style={{
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                borderColor: '#cbd5e1',
              }}
            >
              View more
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* Inside: Days list (Level 3 Day accordions) */}
      {expanded && (
        <div style={{ padding: '12px 14px', backgroundColor: '#fcfdfe' }}>
          {group.days.length === 0 ? (
            <div style={{ padding: 12, textAlign: 'center', color: '#94a3b8' }}>
              No recorded daily expenses.
            </div>
          ) : (
            group.days.map((day) => {
              // Expand today's day by default if this is current user
              const shouldDefaultExpandDay = group.isCurrentUser && day.dateKey === todayKey;
              return (
                <ExpenseDayAccordion
                  key={day.dateKey}
                  day={day}
                  defaultExpanded={shouldDefaultExpandDay}
                  isAdminOrAccounts={isAdminOrAccounts}
                  onViewVoucher={onViewVoucher}
                  onApproveExpense={onApproveExpense}
                  onRejectExpense={onRejectExpense}
                  onSelectDepartment={onSelectDepartment}
                  customColumns={customColumns}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
