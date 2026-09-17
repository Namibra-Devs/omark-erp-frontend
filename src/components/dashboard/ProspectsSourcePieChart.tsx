// src/components/dashboard/ProspectsSourcePieChart.tsx
//
// Interactive Pie / Donut Chart & Data Table displaying Marketing Prospects vs Customer Service (CS)
// Prospects distribution along with the exact Overall Total Prospects.
// Used across both Secretary Dashboard and Admin Dashboard.

import React, { useMemo } from 'react';
import { Card, Row, Col, Typography, Tag, Space, Spin, Button, Table, Progress } from 'antd';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TeamOutlined,
  CustomerServiceOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
  RiseOutlined,
  CheckCircleOutlined,
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

  // 1. Query full prospects dataset with large pageSize (fetches all pages if > 100)
  const {
    data: allProspectsData,
    isLoading: allLoading,
    refetch: refetchAll,
  } = useProspectsQuery({ pageSize: 10000 });

  // 2. Query Marketing-specific and CS-specific prospects to guarantee server-side exact counts
  const {
    data: mktProspectsData,
    isLoading: mktLoading,
    refetch: refetchMkt,
  } = useProspectsQuery({ source: 'marketing', pageSize: 10000 });

  const {
    data: csProspectsData,
    isLoading: csLoading,
    refetch: refetchCs,
  } = useProspectsQuery({ source: 'customer_service', pageSize: 10000 });

  const isLoading = allLoading || mktLoading || csLoading;

  // 3. Exact Figure Breakdown Calculation (Marketing vs CS)
  const { marketingCount, csCount, overallTotal, marketingPercent, csPercent } = useMemo(() => {
    // Collect all unique prospects from all available sources
    const prospectMap = new Map<string, Prospect>();
    (propProspects || []).forEach((p) => prospectMap.set(p.id, p));
    (allProspectsData?.items || []).forEach((p) => prospectMap.set(p.id, p));
    (mktProspectsData?.items || []).forEach((p) => prospectMap.set(p.id, p));
    (csProspectsData?.items || []).forEach((p) => prospectMap.set(p.id, p));

    const combinedList = Array.from(prospectMap.values());

    // Count by source attribute
    const mktFromList = combinedList.filter((p) => p.source === 'marketing' || !p.source).length;
    const csFromList = combinedList.filter((p) => p.source === 'customer_service').length;

    // Compare with server totals if available
    const mktServerTotal = mktProspectsData?.total ?? 0;
    const csServerTotal = csProspectsData?.total ?? 0;
    const allServerTotal = allProspectsData?.total ?? 0;

    let mkt = Math.max(mktFromList, mktServerTotal);
    let cs = Math.max(csFromList, csServerTotal);

    // If server has more total prospects than classified mkt + cs, ensure no undercounting
    if (mkt + cs < allServerTotal && cs === 0) {
      mkt = allServerTotal;
    }

    // Exact figure of adding the CS and Marketing prospects
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
  }, [propProspects, allProspectsData, mktProspectsData, csProspectsData]);

  const chartData = useMemo(() => {
    if (overallTotal === 0) {
      return [{ name: 'No Prospects', value: 1, color: '#e2e8f0' }];
    }
    return [
      { name: 'Marketing Prospects', value: marketingCount, color: COLORS.marketing },
      { name: 'Customer Service (CS) Prospects', value: csCount, color: COLORS.cs },
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

  // Table rows configuration
  const tableData = [
    {
      key: 'marketing',
      sourceName: 'Marketing Prospects',
      icon: <RiseOutlined style={{ color: COLORS.marketing, fontSize: 16 }} />,
      color: COLORS.marketing,
      tagColor: 'blue',
      channelDescription: 'Mega-billboards, Digital Campaigns, Property Expos, Flyers & Field Marketers',
      count: marketingCount,
      percent: marketingPercent,
      route: '/marketing/prospects',
    },
    {
      key: 'customer_service',
      sourceName: 'Customer Service (CS) Prospects',
      icon: <CustomerServiceOutlined style={{ color: COLORS.cs, fontSize: 16 }} />,
      color: COLORS.cs,
      tagColor: 'green',
      channelDescription: 'Front Desk Walk-ins, Reception Inquiries, CS Calls & Support Leads',
      count: csCount,
      percent: csPercent,
      route: '/cs/prospects',
    },
  ];

  const tableColumns = [
    {
      title: 'Prospect Source',
      key: 'sourceName',
      width: 260,
      render: (_: any, record: (typeof tableData)[0]) => (
        <Space size={10} align="center">
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: record.key === 'marketing' ? '#e6f4ff' : '#f6ffed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {record.icon}
          </div>
          <div>
            <Text strong style={{ fontSize: 13.5, display: 'block', color: '#1f1f1f' }}>
              {record.sourceName}
            </Text>
            <Tag color={record.tagColor} style={{ fontSize: 10, margin: 0, padding: '0 6px', borderRadius: 4 }}>
              {record.key === 'marketing' ? 'DIRECT MARKETING' : 'FRONT DESK / CS'}
            </Tag>
          </div>
        </Space>
      ),
    },
    {
      title: 'Acquisition Channels & Scope',
      dataIndex: 'channelDescription',
      key: 'channelDescription',
      render: (desc: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {desc}
        </Text>
      ),
    },
    {
      title: 'Total Prospects',
      dataIndex: 'count',
      key: 'count',
      align: 'right' as const,
      width: 140,
      render: (val: number, record: (typeof tableData)[0]) => (
        <Text strong style={{ fontSize: 15, color: record.color }}>
          {val.toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Distribution (%)',
      dataIndex: 'percent',
      key: 'percent',
      width: 180,
      render: (pct: number, record: (typeof tableData)[0]) => (
        <div style={{ minWidth: 120 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text style={{ fontSize: 11, color: '#64748b' }}>Share</Text>
            <Text strong style={{ fontSize: 12, color: record.color }}>
              {pct}%
            </Text>
          </div>
          <Progress percent={pct} strokeColor={record.color} size="small" showInfo={false} />
        </div>
      ),
    },
    ...(showNavigationButtons
      ? [
          {
            title: 'Action',
            key: 'action',
            width: 130,
            align: 'center' as const,
            render: (_: any, record: (typeof tableData)[0]) => (
              <Button
                type="link"
                size="small"
                icon={<ArrowRightOutlined />}
                onClick={() => navigate(record.route)}
                style={{ fontSize: 12, padding: 0 }}
              >
                View List
              </Button>
            ),
          },
        ]
      : []),
  ];

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
        </div>
      }
      extra={
        <Space size={8}>
          <Button
            size="small"
            icon={<ReloadOutlined spin={isLoading} />}
            onClick={() => {
              refetchAll();
              refetchMkt();
              refetchCs();
            }}
          >
            Refresh
          </Button>
          <Tag color="geekblue" style={{ fontSize: 11, borderRadius: 4, margin: 0 }}>
            Live Sync
          </Tag>
        </Space>
      }
      style={{
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        ...style,
      }}
      className={className}
    >
      {isLoading && (!propProspects || propProspects.length === 0) && overallTotal === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 260 }}>
          <Spin size="default" tip="Loading live prospects distribution..." />
        </div>
      ) : (
        <div>
          {/* Top Metric Header: Overall Total Prospects */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 18px',
              background: 'linear-gradient(135deg, #f0f7ff 0%, #f6ffed 100%)',
              borderRadius: 10,
              border: '1px solid #d6e4ff',
              marginBottom: 18,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TeamOutlined style={{ color: tokens.primary, fontSize: 16 }} />
                <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
                  Overall Total Prospects
                </Text>
                <Tag color="cyan" style={{ fontSize: 10, margin: 0, padding: '0 6px' }}>
                  Exact Figure (Marketing + CS)
                </Tag>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
                <Title level={2} style={{ margin: 0, color: tokens.primary, lineHeight: 1.1 }}>
                  {overallTotal.toLocaleString()}
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  prospects registered across all channels
                </Text>
              </div>
            </div>

            <Space size={16}>
              <div style={{ textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                  Combined Channel Ratio
                </Text>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
                  <span style={{ color: COLORS.marketing }}>{marketingCount.toLocaleString()} ({marketingPercent}%) Mkt</span>
                  <span style={{ margin: '0 6px', color: '#94a3b8' }}>+</span>
                  <span style={{ color: COLORS.cs }}>{csCount.toLocaleString()} ({csPercent}%) CS</span>
                </div>
              </div>
            </Space>
          </div>

          <Row gutter={[20, 20]} align="middle" style={{ marginBottom: 20 }}>
            {/* Donut Chart */}
            <Col xs={24} md={10}>
              <div style={{ position: 'relative', width: '100%', height: 210 }}>
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <RechartsTooltip content={customTooltip} />
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={overallTotal > 0 ? 4 : 0}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center metric showing exact overall total */}
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
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                    {overallTotal.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 3, fontWeight: 600, letterSpacing: 0.5 }}>
                    OVERALL TOTAL
                  </div>
                </div>
              </div>
            </Col>

            {/* Quick Cards */}
            <Col xs={24} md={14}>
              <Row gutter={[12, 12]}>
                {/* Marketing Card */}
                <Col span={12}>
                  <div
                    style={{
                      padding: '14px 16px',
                      background: '#f0f7ff',
                      borderRadius: 10,
                      border: '1px solid #bae0ff',
                      cursor: showNavigationButtons ? 'pointer' : 'default',
                      transition: 'all 0.2s ease',
                      height: '100%',
                    }}
                    onClick={() => showNavigationButtons && navigate('/marketing/prospects')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space size={6}>
                        <RiseOutlined style={{ color: COLORS.marketing }} />
                        <Text strong style={{ fontSize: 13, color: '#003eb3' }}>
                          Marketing
                        </Text>
                      </Space>
                      <Tag color="blue" style={{ margin: 0, fontWeight: 700, borderRadius: 4 }}>
                        {marketingPercent}%
                      </Tag>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: '#002c8c' }}>
                        {marketingCount.toLocaleString()}
                      </span>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                        Digital & Field Prospects
                      </Text>
                    </div>
                    {showNavigationButtons && (
                      <div style={{ marginTop: 8, fontSize: 11, color: '#1677ff', fontWeight: 600 }}>
                        View list <ArrowRightOutlined style={{ fontSize: 10 }} />
                      </div>
                    )}
                  </div>
                </Col>

                {/* CS Card */}
                <Col span={12}>
                  <div
                    style={{
                      padding: '14px 16px',
                      background: '#f6ffed',
                      borderRadius: 10,
                      border: '1px solid #b7eb8f',
                      cursor: showNavigationButtons ? 'pointer' : 'default',
                      transition: 'all 0.2s ease',
                      height: '100%',
                    }}
                    onClick={() => showNavigationButtons && navigate('/cs/prospects')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space size={6}>
                        <CustomerServiceOutlined style={{ color: COLORS.cs }} />
                        <Text strong style={{ fontSize: 13, color: '#135200' }}>
                          Customer Service
                        </Text>
                      </Space>
                      <Tag color="green" style={{ margin: 0, fontWeight: 700, borderRadius: 4 }}>
                        {csPercent}%
                      </Tag>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: '#092b00' }}>
                        {csCount.toLocaleString()}
                      </span>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                        Front Desk & Support Leads
                      </Text>
                    </div>
                    {showNavigationButtons && (
                      <div style={{ marginTop: 8, fontSize: 11, color: '#52c41a', fontWeight: 600 }}>
                        View list <ArrowRightOutlined style={{ fontSize: 10 }} />
                      </div>
                    )}
                  </div>
                </Col>
              </Row>
            </Col>
          </Row>

          {/* ── PROSPECTS DISTRIBUTION (MARKETING VS CS) DATA TABLE ─────────── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: '#475569' }}>
                Distribution Breakdown Table
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Accurate sum of CS + Marketing prospects across all pages
              </Text>
            </div>

            <Table
              columns={tableColumns}
              dataSource={tableData}
              pagination={false}
              size="middle"
              bordered
              style={{
                borderRadius: 8,
                overflow: 'hidden',
              }}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row style={{ background: '#f8fafc' }}>
                    <Table.Summary.Cell index={0}>
                      <Space size={8}>
                        <CheckCircleOutlined style={{ color: tokens.primary, fontSize: 14 }} />
                        <Text strong style={{ color: tokens.primary, fontSize: 13.5 }}>
                          Overall Total Prospects
                        </Text>
                      </Space>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1}>
                      <Text strong style={{ color: '#475569', fontSize: 12 }}>
                        Sum of All Marketing ({marketingCount.toLocaleString()}) + CS ({csCount.toLocaleString()})
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      <Tag
                        color="geekblue"
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          padding: '2px 10px',
                          margin: 0,
                          borderRadius: 4,
                        }}
                      >
                        {overallTotal.toLocaleString()}
                      </Tag>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3}>
                      <div style={{ minWidth: 120 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={{ fontSize: 11, color: '#64748b' }}>Total</Text>
                          <Text strong style={{ fontSize: 12, color: tokens.primary }}>
                            100%
                          </Text>
                        </div>
                        <Progress percent={100} strokeColor={tokens.primary} size="small" showInfo={false} />
                      </div>
                    </Table.Summary.Cell>
                    {showNavigationButtons && (
                      <Table.Summary.Cell index={4} align="center">
                        <Tag color="purple" style={{ margin: 0, fontSize: 10, fontWeight: 700 }}>
                          EXACT SUM
                        </Tag>
                      </Table.Summary.Cell>
                    )}
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </div>
        </div>
      )}
    </Card>
  );
};
