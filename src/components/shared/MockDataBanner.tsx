// src/components/shared/MockDataBanner.tsx
import React from 'react';
import { Alert } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';

interface MockDataBannerProps {
  message?: string;
  description?: string;
}

/**
 * Consistent, unmissable indicator for screens built ahead of their backend
 * endpoints. Use on every page/section driven by src/mock/* data so it's
 * never confused with something live.
 */
export const MockDataBanner: React.FC<MockDataBannerProps> = ({
  message = 'Preview — sample data, not live',
  description = 'This screen is a working prototype. The figures shown are illustrative and will be replaced with real numbers once the backend adds branch-aware endpoints.',
}) => (
  <Alert
    type="warning"
    showIcon
    icon={<ExperimentOutlined />}
    message={message}
    description={description}
    style={{ marginBottom: 24 }}
  />
);
