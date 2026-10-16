// src/components/expenses/ExpenseAccordionView.tsx
import React, { useState, useMemo } from 'react';
import { Card, Row, Col, Typography, Space, Segmented, Button, Tag, Empty, Skeleton, Table } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  DollarOutlined,
  FileTextOutlined,
  CalendarOutlined,
  UnorderedListOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ExpenseEntity } from '@/api/expenses';
import {
  groupExpenses,
  formatExpenseCurrency,
  type GroupByLevel2,
  type GroupedStaffOrRole,
} from '@/utils/expenseGrouping';
import type { FourMainDepartmentKey } from '@/utils/departmentExpenses';
import { ExpenseMonthAccordion } from './ExpenseMonthAccordion';
import { ExpenseStaffDrawer } from './ExpenseStaffDrawer';
import { tokens } from '@/constants/tokens';

const { Title, Text } = Typography;

export interface ExpenseAccordionViewProps {
  expenses: ExpenseEntity[];
  loading?: boolean;
  isAdminOrAccounts: boolean;
  currentUserId?: string;
  usersById?: Map<string, any>;
  usersByName?: Map<string, any>;
  activeDateScopeLabel?: string;
  onViewVoucher: (expense: ExpenseEntity) => void;
  onApproveExpense?: (id: string) => void;
  onRejectExpense?: (expense: ExpenseEntity) => void;
  onSelectDepartment?: (deptKey: FourMainDepartmentKey) => void;
  // Optional flat table fallback columns if user switches to flat table
  flatColumns?: any[];
  flatSummary?: (data: readonly ExpenseEntity[]) => React.ReactNode;
  customDayColumns?: any[];
  emptyExtra?: React.ReactNode;
}

export const ExpenseAccordionView: React.FC<ExpenseAccordionViewProps> = ({
  expenses,
  loading = false,
  isAdminOrAccounts,
  currentUserId,
  usersById,
  usersByName,
  activeDateScopeLabel = 'Active Filter Scope',
  onViewVoucher,
  onApproveExpense,
  onRejectExpense,
  onSelectDepartment,
  flatColumns,
  flatSummary,
  customDayColumns,
  emptyExtra,
}) => {
  // Group-by toggle: 'staff' (default) | 'role'
  const [groupBy, setGroupBy] = useState<GroupByLevel2>('staff');

  // View mode toggle: 'accordion' (default) | 'flat'
  const [viewMode, setViewMode] = useState<'accordion' | 'flat'>('accordion');

  // Staff / Role Drawer State
  const [selectedDrawerGroup, setSelectedDrawerGroup] = useState<GroupedStaffOrRole<ExpenseEntity> | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Run pure grouping algorithm
  const groupingResult = useMemo(() => {
    return groupExpenses(expenses, {
      groupBy,
      currentUserId,
      usersById,
      usersByName,
    });
  }, [expenses, groupBy, currentUserId, usersById, usersByName]);

  const handleOpenDrawer = (group: GroupedStaffOrRole<ExpenseEntity>) => {
    setSelectedDrawerGroup(group);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedDrawerGroup(null);
  };

  if (loading) {
    return (
      <Card style={{ borderRadius: 14, marginBottom: 20 }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      {/* ── Period Summary Bar Above Accordions ────────────────────────────── */}
      <Card
        style={{
          borderRadius: 14,
          marginBottom: 16,
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          {/* Left: Summary Metrics */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            {/* Overall Total */}
            <div>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                Filtered Total Outlay
              </Text>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: tokens.primary,
                  lineHeight: 1.2,
                  marginTop: 2,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatExpenseCurrency(groupingResult.overallTotalMinor)}
              </div>
            </div>

            {/* Expense Count */}
            <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 16 }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                Total Records
              </Text>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>
                {groupingResult.overallCount} {groupingResult.overallCount === 1 ? 'voucher' : 'vouchers'}
              </div>
            </div>

            {/* Staff Count */}
            <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 16 }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                Active Spend Contributors
              </Text>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>
                {groupingResult.overallStaffCount} {groupingResult.overallStaffCount === 1 ? 'member' : 'members'}
              </div>
            </div>

            <Tag color="blue" style={{ borderRadius: 10, fontWeight: 600, padding: '3px 10px', fontSize: 12 }}>
              Scope: {activeDateScopeLabel}
            </Tag>
          </div>

          {/* Right: Group-by toggle (Staff | Role) + View Mode Switcher */}
          <Space size={12} wrap>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Text strong style={{ fontSize: 12, color: '#475569' }}>
                Level 2 Group:
              </Text>
              <Segmented
                value={groupBy}
                onChange={(val) => setGroupBy(val as GroupByLevel2)}
                options={[
                  {
                    label: (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <UserOutlined />
                        By Staff
                      </span>
                    ),
                    value: 'staff',
                  },
                  {
                    label: (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <TeamOutlined />
                        By Role
                      </span>
                    ),
                    value: 'role',
                  },
                ]}
                style={{ fontWeight: 600, borderRadius: 8 }}
              />
            </div>

            {/* Optional Flat Table view toggle */}
            {flatColumns && (
              <Segmented
                value={viewMode}
                onChange={(val) => setViewMode(val as any)}
                options={[
                  {
                    label: (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <ApartmentOutlined />
                        Accordion
                      </span>
                    ),
                    value: 'accordion',
                  },
                  {
                    label: (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <UnorderedListOutlined />
                        Flat Table
                      </span>
                    ),
                    value: 'flat',
                  },
                ]}
                style={{ borderRadius: 8 }}
              />
            )}
          </Space>
        </div>
      </Card>

      {/* ── View Content ────────────────────────────────────────────────────── */}
      {viewMode === 'flat' && flatColumns ? (
        <Card
          style={{ borderRadius: 14, border: '1px solid #f0f0f0' }}
          bodyStyle={{ padding: 0 }}
        >
          <Table
            dataSource={expenses}
            columns={flatColumns}
            rowKey="id"
            pagination={{ pageSize: 15, showSizeChanger: true }}
            scroll={{ x: 1100 }}
            summary={flatSummary}
          />
        </Card>
      ) : groupingResult.months.length === 0 ? (
        <Card style={{ borderRadius: 14, textAlign: 'center', padding: '40px 20px' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <span>
                  No expenses found matching the active filters (<strong>{activeDateScopeLabel}</strong>).
                </span>
                {emptyExtra && <div style={{ marginTop: 10 }}>{emptyExtra}</div>}
              </div>
            }
          />
        </Card>
      ) : (
        groupingResult.months.map((month, idx) => (
          <ExpenseMonthAccordion
            key={month.monthKey}
            month={month}
            groupBy={groupBy}
            defaultExpanded={month.isCurrentMonth || idx === 0} // Expand current month by default
            isAdminOrAccounts={isAdminOrAccounts}
            onOpenDrawer={handleOpenDrawer}
            onViewVoucher={onViewVoucher}
            onApproveExpense={onApproveExpense}
            onRejectExpense={onRejectExpense}
            onSelectDepartment={onSelectDepartment}
            customColumns={customDayColumns}
          />
        ))
      )}

      {/* ── "View more" Drawer for Selected Staff / Role ────────────────────── */}
      <ExpenseStaffDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        targetGroup={selectedDrawerGroup}
        groupBy={groupBy}
        allExpenses={expenses}
        currentUserId={currentUserId}
        usersById={usersById}
        usersByName={usersByName}
        isAdminOrAccounts={isAdminOrAccounts}
        onViewVoucher={onViewVoucher}
        onApproveExpense={onApproveExpense}
        onRejectExpense={onRejectExpense}
        onSelectDepartment={onSelectDepartment}
      />
    </div>
  );
};
