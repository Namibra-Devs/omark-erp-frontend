// src/components/expenses/ExpenseRecorderIdentitySummary.tsx
import React from 'react';
import { Space, Tag, Typography } from 'antd';
import {
  UserOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

export interface ExpenseRecorderIdentitySummaryProps {
  userName: string;
  roleLabel: string;
  branchName: string;
  label?: string;
}

export const ExpenseRecorderIdentitySummary: React.FC<ExpenseRecorderIdentitySummaryProps> = ({
  userName,
  roleLabel,
  branchName,
  label = 'Default Staff Attribution',
}) => {
  return (
    <div
      data-testid="expense-recorder-identity-summary"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 10,
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        marginBottom: 16,
      }}
    >
      <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Text>
      <Space size={[10, 6]} wrap>
        <Tag color="default" style={{ margin: 0, padding: '3px 8px', fontSize: 12 }}>
          <Space size={4}>
            <UserOutlined style={{ color: '#475569' }} />
            <Text type="secondary" style={{ fontSize: 11 }}>Name:</Text>
            <Text strong style={{ fontSize: 12 }}>{userName}</Text>
          </Space>
        </Tag>
        <Tag color="blue" style={{ margin: 0, padding: '3px 8px', fontSize: 12 }}>
          <Space size={4}>
            <SafetyCertificateOutlined />
            <Text style={{ fontSize: 11, color: 'inherit' }}>Role:</Text>
            <Text strong style={{ fontSize: 12, color: 'inherit' }}>{roleLabel}</Text>
          </Space>
        </Tag>
        <Tag color="geekblue" style={{ margin: 0, padding: '3px 8px', fontSize: 12 }}>
          <Space size={4}>
            <ShopOutlined />
            <Text style={{ fontSize: 11, color: 'inherit' }}>Branch:</Text>
            <Text strong style={{ fontSize: 12, color: 'inherit' }}>{branchName}</Text>
          </Space>
        </Tag>
      </Space>
    </div>
  );
};

export default ExpenseRecorderIdentitySummary;

