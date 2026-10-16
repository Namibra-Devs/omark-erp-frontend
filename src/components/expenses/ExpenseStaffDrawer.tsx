// src/components/expenses/ExpenseStaffDrawer.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { Drawer, DatePicker, Typography, Space, Tag, Card, Row, Col, Empty, Button, Tooltip } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  CalendarOutlined,
  PercentageOutlined,
  DollarOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ExpenseEntity } from '@/api/expenses';
import {
  formatExpenseCurrency,
  groupExpenses,
  type GroupedStaffOrRole,
  type GroupByLevel2,
  type GroupedDay,
} from '@/utils/expenseGrouping';
import type { FourMainDepartmentKey } from '@/utils/departmentExpenses';
import { ExpenseDayAccordion } from './ExpenseDayAccordion';
import { tokens } from '@/constants/tokens';

const { Title, Text, Paragraph } = Typography;

export interface ExpenseStaffDrawerProps {
  open: boolean;
  onClose: () => void;
  targetGroup: GroupedStaffOrRole<ExpenseEntity> | null;
  groupBy: GroupByLevel2; // 'staff' | 'role'
  allExpenses: ExpenseEntity[];
  currentUserId?: string;
  usersById?: Map<string, any>;
  usersByName?: Map<string, any>;
  isAdminOrAccounts: boolean;
  onViewVoucher: (expense: ExpenseEntity) => void;
  onApproveExpense?: (id: string) => void;
  onRejectExpense?: (expense: ExpenseEntity) => void;
  onSelectDepartment?: (deptKey: FourMainDepartmentKey) => void;
}

export const ExpenseStaffDrawer: React.FC<ExpenseStaffDrawerProps> = ({
  open,
  onClose,
  targetGroup,
  groupBy,
  allExpenses,
  currentUserId,
  usersById,
  usersByName,
  isAdminOrAccounts,
  onViewVoucher,
  onApproveExpense,
  onRejectExpense,
  onSelectDepartment,
}) => {
  // Month selector inside drawer defaulting to current month
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs>(() => dayjs());

  // Reset to current month when targetGroup changes
  useEffect(() => {
    if (open) {
      setSelectedMonth(dayjs());
    }
  }, [open, targetGroup?.key]);

  const targetMonthKey = selectedMonth.format('YYYY-MM');

  // Compute stats and days for the selected month
  const { monthAllStaffTotalMinor, personMonthTotalMinor, percentageShare, daysList } = useMemo(() => {
    if (!targetGroup) {
      return {
        monthAllStaffTotalMinor: 0,
        personMonthTotalMinor: 0,
        percentageShare: 0,
        daysList: [] as GroupedDay<ExpenseEntity>[],
      };
    }

    // Run grouping across allExpenses for the target month
    const grouped = groupExpenses(allExpenses, {
      groupBy,
      currentUserId,
      usersById,
      usersByName,
    });

    const monthObj = grouped.months.find((m) => m.monthKey === targetMonthKey);
    const monthTotal = monthObj ? monthObj.totalMinor : 0;

    const matchedGroup = monthObj?.groups.find((g) => g.key === targetGroup.key);
    const personTotal = matchedGroup ? matchedGroup.totalMinor : 0;
    const share = monthTotal > 0 ? Math.round((personTotal / monthTotal) * 1000) / 10 : 0;
    const days = matchedGroup ? matchedGroup.days : [];

    return {
      monthAllStaffTotalMinor: monthTotal,
      personMonthTotalMinor: personTotal,
      percentageShare: share,
      daysList: days,
    };
  }, [allExpenses, targetGroup, targetMonthKey, groupBy, currentUserId, usersById, usersByName]);

  if (!targetGroup) return null;

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Space size={8}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `${tokens.primary}15`,
                color: tokens.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
              }}
            >
              {groupBy === 'role' ? <TeamOutlined /> : <UserOutlined />}
            </div>
            <div>
              <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                {targetGroup.name}
              </Text>
              {targetGroup.roleLabel && groupBy === 'staff' && (
                <Tag color="cyan" style={{ marginLeft: 6, borderRadius: 8, fontSize: 11 }}>
                  {targetGroup.roleLabel}
                </Tag>
              )}
            </div>
          </Space>

          <Tag color="blue" style={{ borderRadius: 10, fontWeight: 600 }}>
            {groupBy === 'role' ? 'Role Breakdown' : 'Staff Breakdown'}
          </Tag>
        </div>
      }
      placement="right"
      width={720}
      zIndex={1060}
      onClose={onClose}
      open={open}
      styles={{
        header: { padding: '16px 20px', borderBottom: '1px solid #f0f0f0' },
        body: { padding: '16px 20px', backgroundColor: '#f8fafc' },
      }}
    >
      {/* ── Top Header Statistics Card with Month Selector ─────────────────── */}
      <Card
        style={{
          borderRadius: 12,
          marginBottom: 18,
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        }}
        bodyStyle={{ padding: 18 }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 14,
            paddingBottom: 12,
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <Space size={8}>
            <CalendarOutlined style={{ color: tokens.primary, fontSize: 16 }} />
            <Text strong style={{ fontSize: 13, color: '#334155' }}>
              Select Calendar Month:
            </Text>
          </Space>

          <DatePicker
            picker="month"
            value={selectedMonth}
            onChange={(m) => m && setSelectedMonth(m)}
            allowClear={false}
            format="MMMM YYYY"
            style={{ width: 170, borderRadius: 8 }}
          />
        </div>

        {/* 3 Metric Tiles: (1) Staff Month Total, (2) All-Staff Month Total, (3) Percentage Share */}
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={8}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
              }}
            >
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                {groupBy === 'role' ? 'Role Total' : 'Staff Total'}
              </Text>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: tokens.primary,
                  marginTop: 2,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatExpenseCurrency(personMonthTotalMinor)}
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                In {selectedMonth.format('MMMM YYYY')}
              </Text>
            </div>
          </Col>

          <Col xs={24} sm={8}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
              }}
            >
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                All-Staff Month Total
              </Text>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: '#0f172a',
                  marginTop: 2,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatExpenseCurrency(monthAllStaffTotalMinor)}
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                All corporate expenses
              </Text>
            </div>
          </Col>

          <Col xs={24} sm={8}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
              }}
            >
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                Month Share
              </Text>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: percentageShare >= 25 ? '#722ed1' : '#1d4ed8',
                  marginTop: 2,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {percentageShare}%
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Of total monthly burn
              </Text>
            </div>
          </Col>
        </Row>
      </Card>

      {/* ── Day Accordions for this person (Newest Day First) ────────────────── */}
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 14, color: '#1e293b' }}>
          Day-by-Day Activity • {selectedMonth.format('MMMM YYYY')}
        </Text>
      </div>

      {daysList.length === 0 ? (
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '30px 20px' }}>
          <Empty
            description={
              <span>
                No expenses recorded for <strong>{targetGroup.name}</strong> in{' '}
                <strong>{selectedMonth.format('MMMM YYYY')}</strong>.
              </span>
            }
          />
        </Card>
      ) : (
        daysList.map((day, idx) => (
          <ExpenseDayAccordion
            key={day.dateKey}
            day={day}
            defaultExpanded={idx === 0} // expand the newest day by default
            isAdminOrAccounts={isAdminOrAccounts}
            onViewVoucher={onViewVoucher}
            onApproveExpense={onApproveExpense}
            onRejectExpense={onRejectExpense}
            onSelectDepartment={onSelectDepartment}
          />
        ))
      )}
    </Drawer>
  );
};
