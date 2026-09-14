// src/components/dashboard/ProspectsSourcePieChart.tsx
//
// Interactive Pie / Donut Chart displaying Marketing Prospects vs Customer Service (CS)
// Prospects distribution along with the overall total.
// Used across both Secretary Dashboard and Admin Dashboard.

import React, { useMemo } from 'react';
import { Card, Row, Col, Statistic, Typography, Tag, Space, Spin, Button } from 'antd';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TeamOutlined,
  UserOutlined,
  CustomerServiceOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useProspectsQuery } from '@/api/prospects';
import { tokens } from '@/constants/tokens';
import type { Prospect } from '@/types';

const { Text, Title } = Typography;

const COLORS = {
  marketing: '#1677ff', // Vibrant Royal Blue
  cs: '#52c41a', // Vibrant Emerald Green
};

interface ProspectsSourcePieChartProps {
  prospects?: Prospect[];
  style?: React.CSSProperties;
  className?: string;
  showNavigationButtons?: boolean;
}

export const ProspectsSourcePieChart: React.FC<ProspectsSourcePieChartProps> = ({
  prospects: propProspects,
  style,
  className,
  showNavigationButtons = true,
}) => {
  const navigate = useNavigate();

  // If prospects not passed as props, query them
  const { data: prospectsData, isLoading } = useProspectsQuery(
    { pageSize: 10000 },
    !propProspects
  );

  const allProspects = useMemo(() => {
    return propProspects || prospectsData?.items || [];
  }, [propProspects, prospectsData]);

  // Breakdown calculation
  const { marketingCount, csCount, overallTotal, marketingPercent, csPercent } = useMemo(() => {
    const mkt = allProspects.filter((p) => p.source === 'marketing' || !p.source).length;
    const cs = allProspects.filter((p) => p.source === 'customer_service').length;
    const total = mkt + cs;
    const mktPct = total > 0 ? Math.round((mkt / total) * 100) : 0;
    const csPct = total > 0 ? 100 - mktPct : 0;

    return {
      marketingCount: mkt,
      csCount: cs,
      overallTotal: total,
      marketingPercent: mktPct,
      csPercent: csPct,
    };
  }, [allProspects]);

  const chartData = useMemo(() => {
    if (overallTotal === 0) {
      return [{ name: 'No Data', value: 1, color: '#e2e8f0' }];
    }
    return [
      { name: 'Marketing Prospects', value: marketingCount, color: COLORS.marketing },
      { name: 'CS Prospects', value: csCount, color: COLORS.cs },
    ];
  }, [marketingCount, csCount, overallTotal]);

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const pct = overallTotal > 0 ? Math.round((item.value / overallTotal) * 100) : 0;
      return (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(8px)',
            padding: '10px 14px',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: item.payload?.color || item.color,
                display: 'inline-block',
              }}
            />
            <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
              {item.name}
            </Text>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
            {item.value?.toLocaleString()} prospects ({pct}%)
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space align="center">
            <TeamOutlined style={{ color: tokens.primary, fontSize: 18 }} />
            <Text strong style={{ fontSize: 15 }}>
              Prospects Distribution (Marketing vs CS)
            </Text>
          </Space>
          <Tag color="geekblue" style={{ fontSize: 11, borderRadius: 4, margin: 0 }}>
            Live Sync
          </Tag>
        </div>
      }
      style={{
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        height: '100%',
        ...style,
      }}
      className={className}
    >
      {isLoading && !propProspects ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 260 }}>
          <Spin size="default" tip="Loading prospects distribution..." />
        </div>
      ) : (
        <div>
          {/* Top Metric Header: Overall Total */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px solid #edf2f7',
              marginBottom: 16,
            }}
          >
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                Overall Total Prospects
              </Text>
              <Title level={3} style={{ margin: 0, color: tokens.primary, lineHeight: 1.2 }}>
                {overallTotal.toLocaleString()}
              </Title>
            </div>
            <Space size={12}>
              <div style={{ textAlign: 'right' }}>
                <Text style={{ fontSize: 11, color: '#64748b' }}>Ratio</Text>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  <span style={{ color: COLORS.marketing }}>{marketingPercent}% Mkt</span>
                  <span style={{ margin: '0 4px', color: '#cbd5e1' }}>|</span>
                  <span style={{ color: COLORS.cs }}>{csPercent}% CS</span>
                </div>
              </div>
            </Space>
          </div>

          <Row gutter={[16, 16]} align="middle">
            {/* Donut Chart */}
            <Col xs={24} sm={13}>
              <div style={{ position: 'relative', width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <RechartsTooltip content={customTooltip} />
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={overallTotal > 0 ? 4 : 0}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center metric */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                    {overallTotal.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, fontWeight: 500 }}>
                    TOTAL
                  </div>
                </div>
              </div>
            </Col>

            {/* Legend & Breakdown Details */}
            <Col xs={24} sm={11}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Marketing Row */}
                <div
                  style={{
                    padding: '10px 12px',
                    background: '#f0f7ff',
                    borderRadius: 8,
                    border: '1px solid #bae0ff',
                    cursor: showNavigationButtons ? 'pointer' : 'default',
                    transition: 'transform 0.15s ease',
                  }}
                  onClick={() => showNavigationButtons && navigate('/marketing/prospects')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={6}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: COLORS.marketing,
                          display: 'inline-block',
                        }}
                      />
                      <Text strong style={{ fontSize: 13, color: '#003eb3' }}>
                        Marketing
                      </Text>
                    </Space>
                    <Tag color="blue" style={{ margin: 0, fontWeight: 700, borderRadius: 4 }}>
                      {marketingPercent}%
                    </Tag>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#002c8c' }}>
                      {marketingCount.toLocaleString()}
                    </span>
                    {showNavigationButtons && (
                      <span style={{ fontSize: 11, color: '#1677ff' }}>
                        View list <ArrowRightOutlined style={{ fontSize: 10 }} />
                      </span>
                    )}
                  </div>
                </div>

                {/* CS Row */}
                <div
                  style={{
                    padding: '10px 12px',
                    background: '#f6ffed',
                    borderRadius: 8,
                    border: '1px solid #b7eb8f',
                    cursor: showNavigationButtons ? 'pointer' : 'default',
                    transition: 'transform 0.15s ease',
                  }}
                  onClick={() => showNavigationButtons && navigate('/cs/prospects')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={6}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: COLORS.cs,
                          display: 'inline-block',
                        }}
                      />
                      <Text strong style={{ fontSize: 13, color: '#135200' }}>
                        Customer Service
                      </Text>
                    </Space>
                    <Tag color="green" style={{ margin: 0, fontWeight: 700, borderRadius: 4 }}>
                      {csPercent}%
                    </Tag>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#092b00' }}>
                      {csCount.toLocaleString()}
                    </span>
                    {showNavigationButtons && (
                      <span style={{ fontSize: 11, color: '#52c41a' }}>
                        View list <ArrowRightOutlined style={{ fontSize: 10 }} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </div>
      )}
    </Card>
  );
};
