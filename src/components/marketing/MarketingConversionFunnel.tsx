// src/components/marketing/MarketingConversionFunnel.tsx
import React from 'react';
import { Card, Row, Col, Progress, Typography, Space, Statistic, Tag } from 'antd';
import {
  RiseOutlined,
  FilterOutlined,
  UserSwitchOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { tokens } from '@/constants/tokens';

const { Title, Text } = Typography;

export interface FunnelStage {
  stage: string;
  count: number;
  percent: number;
  color: string;
}

export interface MarketingConversionFunnelProps {
  funnelData: FunnelStage[];
  overallConversionRate: number;
  totalAcquired: number;
  totalConverted: number;
}

export const MarketingConversionFunnel: React.FC<MarketingConversionFunnelProps> = ({
  funnelData,
  overallConversionRate,
  totalAcquired,
  totalConverted,
}) => {
  return (
    <Card
      title={
        <Space>
          <FilterOutlined style={{ color: tokens.primary }} />
          <span>Marketing Acquisition & Lead Conversion Funnel</span>
        </Space>
      }
      extra={
        <Tag color="purple" style={{ fontSize: 12, padding: '2px 8px' }}>
          <RiseOutlined /> Overall Conversion Rate: {overallConversionRate.toFixed(1)}%
        </Tag>
      }
      style={{
        borderRadius: 12,
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        border: '1px solid #f0f0f0',
        marginBottom: 24,
      }}
    >
      <Row gutter={[24, 24]} align="middle">
        <Col xs={24} md={16}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {funnelData.map((item, index) => {
              const prevCount = index > 0 ? funnelData[index - 1].count : item.count;
              const stepConversion = prevCount > 0 ? Math.round((item.count / prevCount) * 100) : 100;

              return (
                <div key={item.stage} style={{ width: '100%' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 4,
                      fontSize: 13,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{item.stage}</span>
                    <Space size={12}>
                      <span style={{ fontWeight: 700, color: item.color }}>
                        {item.count.toLocaleString()} Prospects
                      </span>
                      {index > 0 && (
                        <Tag color="cyan" style={{ fontSize: 11 }}>
                          {stepConversion}% step rate
                        </Tag>
                      )}
                    </Space>
                  </div>
                  <Progress
                    percent={item.percent}
                    strokeColor={item.color}
                    showInfo={false}
                    strokeWidth={14}
                    style={{ borderRadius: 6 }}
                  />
                </div>
              );
            })}
          </div>
        </Col>

        <Col xs={24} md={8}>
          <div
            style={{
              background: '#f9fbfd',
              border: '1px solid #e6f0fa',
              borderRadius: 10,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <Statistic
              title="Total Prospects Acquired"
              value={totalAcquired}
              prefix={<UserSwitchOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700 }}
            />
            <Statistic
              title="Converted Buyers / Contracts"
              value={totalConverted}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}
            />
            <div style={{ fontSize: 12, color: '#8c8c8c', borderTop: '1px solid #eee', paddingTop: 10 }}>
              💡 <Text strong>Optimization Insight:</Text> Site inspections yield the highest conversion velocity. Focus campaigns on driving on-site walkthroughs.
            </div>
          </div>
        </Col>
      </Row>
    </Card>
  );
};
