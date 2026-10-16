// src/components/expenses/ExpenseMonthAccordion.tsx
import React, { useState } from 'react';
import { Tag, Typography, Button, Space, Badge } from 'antd';
import {
  CalendarOutlined,
  DownOutlined,
  RightOutlined,
  TeamOutlined,
  CheckOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import type { ExpenseEntity } from '@/api/expenses';
import {
  formatExpenseCurrency,
  type GroupedMonth,
  type GroupedStaffOrRole,
  type GroupByLevel2,
} from '@/utils/expenseGrouping';
import type { FourMainDepartmentKey } from '@/utils/departmentExpenses';
import { ExpenseStaffAccordion } from './ExpenseStaffAccordion';
import { tokens } from '@/constants/tokens';

const { Text } = Typography;

export interface ExpenseMonthAccordionProps {
  month: GroupedMonth<ExpenseEntity>;
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

export const ExpenseMonthAccordion: React.FC<ExpenseMonthAccordionProps> = ({
  month,
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
  // Manual override for expand all / collapse all within this month
  const [allGroupsExpanded, setAllGroupsExpanded] = useState<boolean | null>(null);

  const handleToggleExpandAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAllGroupsExpanded((prev) => (prev === true ? false : true));
  };

  return (
    <div
      style={{
        borderRadius: 14,
        border: month.isCurrentMonth
          ? `2px solid ${tokens.primary}`
          : '1px solid #cbd5e1',
        backgroundColor: '#ffffff',
        marginBottom: 18,
        boxShadow: expanded
          ? '0 6px 20px rgba(0,0,0,0.06)'
          : '0 2px 6px rgba(0,0,0,0.02)',
        overflow: 'hidden',
        transition: 'all 0.25s ease',
      }}
    >
      {/* Level 1 Header: Month */}
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
          gap: 12,
          padding: '16px 20px',
          background: month.isCurrentMonth
            ? 'linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%)'
            : expanded
            ? '#f8fafc'
            : '#ffffff',
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: expanded ? '1px solid #e2e8f0' : 'none',
        }}
      >
        {/* Left: Arrow + Month Label + Badges + Expand All Button */}
        <Space size={10} wrap style={{ alignItems: 'center' }}>
          <span style={{ color: '#334155', fontSize: 14, marginRight: 2 }}>
            {expanded ? <DownOutlined /> : <RightOutlined />}
          </span>

          <CalendarOutlined style={{ color: tokens.primary, fontSize: 18 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text strong style={{ fontSize: 16, color: '#0f172a' }}>
              {month.monthLabel}
            </Text>

            {month.isCurrentMonth && (
              <Tag
                color="processing"
                style={{
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 700,
                  margin: 0,
                  padding: '1px 8px',
                }}
              >
                Current Month
              </Tag>
            )}

            <Tag color="cyan" style={{ borderRadius: 12, fontSize: 11, margin: 0 }}>
              <TeamOutlined style={{ marginRight: 4 }} />
              {month.staffCount} {groupBy === 'role' ? 'roles' : (month.staffCount === 1 ? 'staff member' : 'staff members')}
            </Tag>

            <Tag color="default" style={{ borderRadius: 12, fontSize: 11, margin: 0 }}>
              {month.count} {month.count === 1 ? 'expense' : 'expenses'}
            </Tag>
          </div>

          {/* Expand All / Collapse All Button at Month Level */}
          {expanded && month.groups.length > 1 && (
            <Button
              size="small"
              type="text"
              onClick={handleToggleExpandAll}
              style={{
                fontSize: 11,
                color: tokens.primary,
                fontWeight: 600,
                padding: '0 8px',
                marginLeft: 4,
                backgroundColor: '#eff6ff',
                borderRadius: 6,
              }}
            >
              {allGroupsExpanded === true ? 'Collapse All' : 'Expand All'}
            </Button>
          )}
        </Space>

        {/* Right: Overall all-staff total for the month */}
        <div style={{ textAlign: 'right' }}>
          <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
            Month Total (All Staff)
          </Text>
          <Text
            strong
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: tokens.primary,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatExpenseCurrency(month.totalMinor)}
          </Text>
        </div>
      </div>

      {/* Level 2: List of Staff / Role Accordions */}
      {expanded && (
        <div style={{ padding: '16px 18px', backgroundColor: '#f8fafc' }}>
          {month.groups.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
              No expenses recorded for this month.
            </div>
          ) : (
            month.groups.map((group) => {
              // Default expansion logic:
              // Inside current month: staff items collapsed EXCEPT logged-in user's own item
              let shouldExpand = false;
              if (allGroupsExpanded !== null) {
                shouldExpand = allGroupsExpanded;
              } else if (month.isCurrentMonth && group.isCurrentUser) {
                shouldExpand = true;
              }

              return (
                <ExpenseStaffAccordion
                  key={`${group.key}-${allGroupsExpanded !== null ? String(allGroupsExpanded) : 'default'}`}
                  group={group}
                  groupBy={groupBy}
                  defaultExpanded={shouldExpand}
                  isAdminOrAccounts={isAdminOrAccounts}
                  onOpenDrawer={onOpenDrawer}
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
