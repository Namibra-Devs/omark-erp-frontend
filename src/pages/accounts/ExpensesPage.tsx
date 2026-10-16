// src/pages/accounts/ExpensesPage.tsx
import React from 'react';
import { Alert } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
import { EXPENSES_ALLOWED_ROLES } from '@/constants/enums';
import { RoleExpenseDashboard } from '@/components/expenses/RoleExpenseDashboard';
import { ExpenseOverviewChartsAndStats } from '@/components/expenses/ExpenseOverviewChartsAndStats';

export const ExpensesPage: React.FC = () => {
  const { hasRole } = useAuth();

  const isAuthorized = hasRole(EXPENSES_ALLOWED_ROLES);
  if (!isAuthorized) {
    return (
      <div style={{ padding: 48, maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
        <Alert
          type="error"
          message="Access Restricted"
          description="Expense management is reserved for Administrators, Finance/Accounts, Secretary, Branch Managers, and Marketing Director."
          showIcon
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 4px' }}>
      <ExpenseOverviewChartsAndStats showNavigationLink={false} style={{ marginBottom: 20 }} />
      <RoleExpenseDashboard />
    </div>
  );
};

export default ExpensesPage;
