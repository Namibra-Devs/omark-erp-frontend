// src/components/shared/PageHeader.tsx
import React from 'react';
import { Typography, Space, Button } from 'antd';
import type { ButtonProps } from 'antd';

const { Title } = Typography;

interface PageHeaderProps {
  title: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    type?: ButtonProps['type'];
    icon?: React.ReactNode;
  }>;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, actions }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
      <Title level={2} style={{ margin: 0 }}>
        {title}
      </Title>
      {actions && actions.length > 0 && (
        <Space>
          {actions.map((action, index) => (
            <Button
              key={index}
              type={action.type || 'primary'}
              onClick={action.onClick}
              icon={action.icon}
            >
              {action.label}
            </Button>
          ))}
        </Space>
      )}
    </div>
  );
};