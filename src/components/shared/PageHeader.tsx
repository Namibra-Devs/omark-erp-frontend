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
    disabled?: boolean;
    danger?: boolean;
    style?: React.CSSProperties;
    className?: string;
  }>;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, actions }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
      <Title level={2} style={{ margin: 0, fontSize: 'clamp(20px, 4vw, 28px)' }}>
        {title}
      </Title>
      {actions && actions.length > 0 && (
        <Space wrap size={[8, 8]}>
          {actions.map((action, index) => (
            <Button
              key={index}
              type={action.type || 'primary'}
              onClick={action.onClick}
              icon={action.icon}
              disabled={action.disabled}
              danger={action.danger}
              style={action.style}
              className={action.className}
            >
              {action.label}
            </Button>
          ))}
        </Space>
      )}
    </div>
  );
};