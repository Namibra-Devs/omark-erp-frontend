// src/pages/marketing/DirectorOverviewPage.tsx
import React, { useState, useMemo } from 'react';
import {
  Card, Row, Col, Typography, Statistic, Table, Tag, Space, Button,
  Progress, Tabs, Tooltip,
  Empty, Alert, List, Descriptions, Drawer, Spin,
  message,
} from 'antd';
import {
  TeamOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  BarChartOutlined,
  ReloadOutlined,
  TrophyOutlined,
  CrownOutlined,
  FireOutlined,
  InfoCircleOutlined,
  MailOutlined,
  PhoneOutlined,
  DashboardOutlined,
  UserSwitchOutlined,
  DollarOutlined,
  StarFilled,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMarketingDashboardQuery, useAnalyticsDashboardQuery, type MarketerPerformance } from '@/api/dashboard';
import { tokens } from '@/constants/tokens';
import { PageHeader } from '@/components/shared/PageHeader';
import { PhotoUpload } from '@/components/shared/PhotoUpload';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const { Title, Text } = Typography;

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2'];

export const DirectorOverviewPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, isFetching, isError, error, refetch } = useMarketingDashboardQuery();

  // GET /dashboard/analytics — admin / accounts / marketing_director only,
  // which covers this page. Provides the only real revenue/trend data in
  // the system; there is no per-marketer revenue or activity-feed endpoint.
  const { data: analyticsData, isLoading: analyticsLoading, refetch: refetchAnalytics } = useAnalyticsDashboardQuery();

  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMarketer, setSelectedMarketer] = useState<MarketerPerformance | null>(null);
  const [viewProfileDrawer, setViewProfileDrawer] = useState(false);

  // ── Extract Data from API ──────────────────────────────────────────────────
  // The API docs never published a schema for /dashboard/marketing, so only

  const marketers: MarketerPerformance[] = useMemo(
    () =>
      (data?.marketers ?? []).map((m: Partial<MarketerPerformance> & { id?: string; userId?: string; name: string }) => {
        const id = m.userId || m.id || '';
        const totalProspects = m.totalProspects ?? 0;
        const converted = m.converted ?? 0;
        const statusNew = m.byStatus?.new ?? m.new ?? 0;
        const statusScheduled = m.byStatus?.meeting_scheduled ?? m.meetingScheduled ?? 0;
        const statusCompleted = m.byStatus?.meeting_completed ?? m.meetingCompleted ?? 0;
        return {
          id,
          userId: id,
          name: m.name,
          avatar: m.avatar,
          email: m.email,
          phone: m.phone,
          totalProspects,
          new: statusNew,
          meetingScheduled: statusScheduled,
          meetingCompleted: statusCompleted,
          postponed: m.postponed ?? 0,
          suspended: m.suspended ?? 0,
          converted,
          conversionRate: m.conversionRate ?? (totalProspects > 0 ? (converted / totalProspects) * 100 : 0),
          satisfaction: m.satisfaction,
          responseTime: m.responseTime,
          targetMinor: m.targetMinor,
          revenueMinor: m.revenueMinor,
          thisMonthProspects: m.thisMonthProspects,
          lastMonthProspects: m.lastMonthProspects,
          growthPercent: m.growthPercent,
          byStatus: m.byStatus,
        };
      }),
    [data]
  );

  const marketerCountForAvg = Math.max(marketers.length, 1);

  const summary = {
    totalActive: marketers.reduce((sum, m) => sum + m.totalProspects, 0),
    totalMeetingsScheduled: marketers.reduce((sum, m) => sum + m.meetingScheduled, 0),
    totalMeetingsCompleted: marketers.reduce((sum, m) => sum + m.meetingCompleted, 0),
    totalConverted: marketers.reduce((sum, m) => sum + m.converted, 0),
    avgConversionRate: marketers.reduce((sum, m) => sum + m.conversionRate, 0) / marketerCountForAvg,
  };

  const totalActiveForProgress = Math.max(summary.totalActive, 1);

  const topPerformer = marketers.length > 0
    ? [...marketers].sort((a, b) => b.conversionRate - a.conversionRate)[0]
    : null;

  // ── Revenue / Trends (real, from GET /dashboard/analytics) ──────────────
  const trendsData = useMemo(
    () => (analyticsData?.timeSeries ?? []).map((point) => ({
      month: point.month,
      revenue: point.revenue ?? 0,
      newProspects: point.newProspects ?? 0,
      newCustomers: point.newCustomers ?? 0,
    })),
    [analyticsData]
  );

  const totalRevenue12mo = trendsData.reduce((sum, p) => sum + p.revenue, 0);

  const topRevenueMarketer = analyticsData?.topMarketers && analyticsData.topMarketers.length > 0
    ? [...analyticsData.topMarketers].sort((a, b) => b.revenueGenerated - a.revenueGenerated)[0]
    : null;

  // ── Status Distribution for Pie Chart (real, from marketer counts) ──────
  const statusDistribution = useMemo(() => {
    const total = marketers.reduce((sum, m) => sum + m.totalProspects, 0);
    if (total === 0) return [];

    const statuses = [
      { name: 'New', value: marketers.reduce((sum, m) => sum + m.new, 0) },
      { name: 'Meeting Scheduled', value: marketers.reduce((sum, m) => sum + m.meetingScheduled, 0) },
      { name: 'Meeting Completed', value: marketers.reduce((sum, m) => sum + m.meetingCompleted, 0) },
      { name: 'Postponed', value: marketers.reduce((sum, m) => sum + m.postponed, 0) },
      { name: 'Suspended', value: marketers.reduce((sum, m) => sum + m.suspended, 0) },
      { name: 'Converted', value: marketers.reduce((sum, m) => sum + m.converted, 0) },
    ];
    return statuses.filter(s => s.value > 0);
  }, [marketers]);

  const handleRefresh = () => {
    Promise.all([refetch(), refetchAnalytics()])
      .then(() => message.success('Dashboard refreshed!'))
      .catch(() => message.error('Failed to refresh dashboard'));
  };

  const columns = [
    {
      title: 'Marketer',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left' as const,
      width: 200,
      render: (name: string, record: MarketerPerformance) => (
        <Space>
          <PhotoUpload entityType="staff" entityId={record.id} size={32} editable={false} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: 'Total Prospects',
      dataIndex: 'totalProspects',
      key: 'totalProspects',
      width: 130,
      sorter: (a: MarketerPerformance, b: MarketerPerformance) => a.totalProspects - b.totalProspects,
      render: (value: number) => <Text strong>{value}</Text>,
    },
    {
      title: 'Status Breakdown',
      key: 'statusBreakdown',
      width: 220,
      render: (_: any, record: MarketerPerformance) => (
        <Space size={4}>
          <Tooltip title="New"><Tag color="blue">{record.new}</Tag></Tooltip>
          <Tooltip title="Meeting Scheduled"><Tag color="cyan">{record.meetingScheduled}</Tag></Tooltip>
          <Tooltip title="Meeting Completed"><Tag color="green">{record.meetingCompleted}</Tag></Tooltip>
          <Tooltip title="Postponed"><Tag color="gold">{record.postponed}</Tag></Tooltip>
          <Tooltip title="Suspended"><Tag color="orange">{record.suspended}</Tag></Tooltip>
        </Space>
      ),
    },
    {
      title: 'Converted',
      dataIndex: 'converted',
      key: 'converted',
      width: 130,
      render: (value: number) => <Tag color="purple" style={{ fontSize: 13, padding: '2px 10px' }}>{value}</Tag>,
      sorter: (a: MarketerPerformance, b: MarketerPerformance) => a.converted - b.converted,
    },
    {
      title: 'Conversion Rate',
      key: 'conversionRate',
      width: 160,
      render: (_: any, record: MarketerPerformance) => (
        <Progress
          percent={record.conversionRate}
          size="small"
          strokeColor={record.conversionRate > 10 ? '#52c41a' : record.conversionRate > 5 ? '#faad14' : '#ff4d4f'}
          format={(p: number | undefined) => `${p?.toFixed(1)}%`}
          style={{ width: 120 }}
        />
      ),
      sorter: (a: MarketerPerformance, b: MarketerPerformance) => a.conversionRate - b.conversionRate,
    },
    {
      title: 'Satisfaction & Speed',
      key: 'satisfaction',
      width: 170,
      render: (_: any, record: MarketerPerformance) => (
        <div>
          {record.satisfaction !== undefined ? (
            <Tag color="gold"><StarFilled /> {record.satisfaction} / 10</Tag>
          ) : null}
          {record.responseTime !== undefined ? (
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
              ⚡ {record.responseTime} mins avg
            </Text>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Revenue / Target',
      key: 'revenue',
      width: 170,
      render: (_: any, record: MarketerPerformance) => {
        if (record.revenueMinor === undefined && record.targetMinor === undefined) return <Text type="secondary">-</Text>;
        const revGhs = (record.revenueMinor ?? 0) / 100;
        const targetGhs = (record.targetMinor ?? 0) / 100;
        const pct = targetGhs > 0 ? Math.min(100, Math.round((revGhs / targetGhs) * 100)) : 0;
        return (
          <div>
            <Text strong style={{ fontSize: 12 }}>GHS {revGhs.toLocaleString()}</Text>
            {targetGhs > 0 && (
              <Progress percent={pct} size="small" strokeColor={pct >= 100 ? '#52c41a' : '#1890ff'} />
            )}
          </div>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right' as const,
      width: 120,
      render: (_: any, record: MarketerPerformance) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedMarketer(record);
                setViewProfileDrawer(true);
              }}
            />
          </Tooltip>
          <Tooltip title="View Prospects">
            <Button
              type="text"
              icon={<TeamOutlined />}
              onClick={() => navigate(`/marketing/prospects?assignedUserId=${record.id}&name=${encodeURIComponent(record.name)}`)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <Spin size="large" tip="Loading dashboard..." />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Failed to load dashboard"
        description={(error as any)?.error?.message || 'Please try again later.'}
        style={{ margin: 24 }}
      />
    );
  }

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden', padding: '0 4px' }}>
      <PageHeader
        title="Marketing Director Overview"
        actions={[
          {
            label: 'Refresh',
            onClick: handleRefresh,
            icon: <ReloadOutlined />,
          },
        ]}
      />

      {/* Top Banner - Welcome & Stats */}
      <Alert
        message={
          <Space>
            <TrophyOutlined style={{ fontSize: 20, color: '#faad14' }} />
            <Text strong>Welcome back, {user?.firstName}!</Text>
          </Space>
        }
        description={
          <div>
            <Text>Here's your team's performance overview for {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
            {topPerformer && topPerformer.totalProspects > 0 && (
              <Tag color="gold" style={{ marginTop: 4 }}>
                <CrownOutlined /> Top Performer: {topPerformer.name} ({topPerformer.conversionRate.toFixed(1)}% conversion rate)
              </Tag>
            )}
          </div>
        }
        type="info"
        showIcon={false}
        style={{ marginBottom: 24 }}
      />

      {/* Summary Cards — every value below is derived directly from live
          API data (marketing dashboard counts + 12-month analytics) */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Total Active Prospects"
              value={summary.totalActive}
              prefix={<TeamOutlined />}
              valueStyle={{ color: tokens.primary, fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Meetings Completed"
              value={summary.totalMeetingsCompleted}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a', fontSize: 24 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              +{summary.totalMeetingsScheduled} scheduled
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Converted"
              value={summary.totalConverted}
              prefix={<UserSwitchOutlined />}
              valueStyle={{ color: '#722ed1', fontSize: 24 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {summary.avgConversionRate.toFixed(1)}% avg. conversion rate
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card loading={analyticsLoading}>
            <Statistic
              title="Revenue (12mo)"
              value={`GHS ${(totalRevenue12mo / 100).toLocaleString()}`}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#faad14', fontSize: 24 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Company-wide, from Analytics
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Team Size"
              value={marketers.length}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff', fontSize: 24 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Active marketers
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'overview',
            label: <span><DashboardOutlined /> Overview</span>,
            children: (
              <>
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={24}>
                    <Card title="Revenue & Pipeline Trends (12 Months)" extra={<Text type="secondary" style={{ fontSize: 12 }}>Company-wide, from Analytics</Text>}>
                      {analyticsLoading ? (
                        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Spin />
                        </div>
                      ) : trendsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={trendsData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis yAxisId="left" />
                            <YAxis yAxisId="right" orientation="right" />
                            <RechartsTooltip
                              formatter={(value: any, name: any) =>
                                name === 'Revenue (GHS)' ? `GHS ${(value / 100).toLocaleString()}` : value
                              }
                            />
                            <Legend />
                            <Line yAxisId="left" type="monotone" dataKey="newProspects" stroke="#1890ff" name="New Prospects" strokeWidth={2} dot={{ r: 4 }} />
                            <Line yAxisId="left" type="monotone" dataKey="newCustomers" stroke="#52c41a" name="New Customers" strokeWidth={2} dot={{ r: 4 }} />
                            <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#faad14" name="Revenue (GHS)" strokeWidth={2} dot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Empty description="No trend data available" />
                        </div>
                      )}
                    </Card>
                  </Col>
                </Row>

                <Card title="Team Performance">
                  {marketers.length > 0 ? (
                    <Table
                      columns={columns}
                      dataSource={marketers}
                      rowKey="id"
                      loading={isFetching}
                      pagination={{ pageSize: 10 }}
                      scroll={{ x: 1000 }}
                    />
                  ) : (
                    <Empty description="No marketers found" />
                  )}
                </Card>
              </>
            ),
          },
          {
            key: 'analytics',
            label: <span><BarChartOutlined /> Analytics</span>,
            children: (
              <div>
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col xs={24} lg={12}>
                    <Card title="Conversion Funnel">
                      <div style={{ padding: '20px 0' }}>
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text>New Prospects</Text>
                            <Text strong>{summary.totalActive}</Text>
                          </div>
                          <Progress percent={100} strokeColor="#1890ff" size="small" />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text>Meetings Scheduled</Text>
                            <Text strong>{summary.totalMeetingsScheduled}</Text>
                          </div>
                          <Progress
                            percent={Math.round((summary.totalMeetingsScheduled / totalActiveForProgress) * 100)}
                            strokeColor="#faad14"
                            size="small"
                          />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text>Meetings Completed</Text>
                            <Text strong>{summary.totalMeetingsCompleted}</Text>
                          </div>
                          <Progress
                            percent={Math.round((summary.totalMeetingsCompleted / totalActiveForProgress) * 100)}
                            strokeColor="#52c41a"
                            size="small"
                          />
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text>Converted</Text>
                            <Text strong>{summary.totalConverted}</Text>
                          </div>
                          <Progress
                            percent={Math.round((summary.totalConverted / totalActiveForProgress) * 100)}
                            strokeColor="#722ed1"
                            size="small"
                          />
                        </div>
                      </div>
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card title="Status Distribution">
                      {statusDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={statusDistribution}
                              cx="50%"
                              cy="50%"
                              labelLine={true}
                              label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {statusDistribution.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Empty description="No data available" />
                        </div>
                      )}
                    </Card>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} lg={12}>
                    <Card title="Revenue Trend" extra={<Text type="secondary" style={{ fontSize: 12 }}>Company-wide, from Analytics</Text>}>
                      {trendsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <AreaChart data={trendsData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <RechartsTooltip formatter={(value: any) => `GHS ${(value / 100).toLocaleString()}`} />
                            <Area type="monotone" dataKey="revenue" stroke="#faad14" fill="#faad14" fillOpacity={0.3} name="Revenue" />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Empty description="No revenue data available" />
                        </div>
                      )}
                    </Card>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Card title="Team Performance Insights">
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text>Average Conversion Rate</Text>
                          <Text strong>{summary.avgConversionRate.toFixed(1)}%</Text>
                        </div>
                        <Progress
                          percent={summary.avgConversionRate}
                          strokeColor={summary.avgConversionRate > 10 ? '#52c41a' : '#faad14'}
                          size="small"
                        />
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text>Prospects per Team Member</Text>
                          <Text strong>{(summary.totalActive / marketerCountForAvg).toFixed(1)}</Text>
                        </div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text>Converted per Team Member</Text>
                          <Text strong>{(summary.totalConverted / marketerCountForAvg).toFixed(1)}</Text>
                        </div>
                      </div>
                    </Card>
                  </Col>
                </Row>
              </div>
            ),
          },
          {
            key: 'insights',
            label: <span><InfoCircleOutlined /> Insights</span>,
            children: (
              <Row gutter={16}>
                <Col xs={24} lg={16}>
                  <Card title="Key Insights">
                    {marketers.length > 0 || topRevenueMarketer ? (
                      <List
                        itemLayout="horizontal"
                        dataSource={[
                          ...(topPerformer && topPerformer.totalProspects > 0 ? [{
                            icon: <TrophyOutlined style={{ color: '#faad14' }} />,
                            title: 'Top Performer (Conversion Rate)',
                            description: `${topPerformer.name} — ${topPerformer.conversionRate.toFixed(1)}% conversion rate, ${topPerformer.converted} converted`,
                          }] : []),
                          ...(topRevenueMarketer ? [{
                            icon: <FireOutlined style={{ color: '#ff4d4f' }} />,
                            title: 'Top Revenue Generator (12mo)',
                            description: `${topRevenueMarketer.name} generated GHS ${(topRevenueMarketer.revenueGenerated / 100).toLocaleString()} across ${topRevenueMarketer.dealsClosed} deals`,
                          }] : []),
                        ]}
                        renderItem={(item: { icon: React.ReactNode; title: string; description: string }) => (
                          <List.Item>
                            <List.Item.Meta
                              avatar={item.icon}
                              title={<Text strong>{item.title}</Text>}
                              description={item.description}
                            />
                          </List.Item>
                        )}
                      />
                    ) : (
                      <Empty description="No data available yet" />
                    )}
                  </Card>
                </Col>
                <Col xs={24} lg={8}>
                  <Card title="Team Stats">
                    <Descriptions column={1} bordered size="small">
                      <Descriptions.Item label="Total Team Members">
                        <Tag color="blue">{marketers.length}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Total Converted">
                        <Tag color="green">{summary.totalConverted}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Avg. Conversion Rate">
                        <Tag color="gold">{summary.avgConversionRate.toFixed(1)}%</Tag>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />

      {/* Marketer Profile Drawer */}
      <Drawer
        title={<Text strong>{selectedMarketer?.name}</Text>}
        open={viewProfileDrawer}
        onClose={() => {
          setViewProfileDrawer(false);
          setSelectedMarketer(null);
        }}
        width={500}
      >
        {selectedMarketer && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ display: 'inline-block', marginBottom: 8 }}>
                <PhotoUpload entityType="staff" entityId={selectedMarketer.id} size={80} />
              </div>
              <Title level={4}>{selectedMarketer.name}</Title>
            </div>

            <Descriptions column={1} bordered size="small">
              {selectedMarketer.email && (
                <Descriptions.Item label="Email">
                  <MailOutlined /> {selectedMarketer.email}
                </Descriptions.Item>
              )}
              {selectedMarketer.phone && (
                <Descriptions.Item label="Phone">
                  <PhoneOutlined /> {selectedMarketer.phone}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Total Prospects">
                {selectedMarketer.totalProspects}
              </Descriptions.Item>
              <Descriptions.Item label="Converted">
                {selectedMarketer.converted}
              </Descriptions.Item>
              <Descriptions.Item label="Conversion Rate">
                <Progress
                  percent={selectedMarketer.conversionRate}
                  size="small"
                  strokeColor={selectedMarketer.conversionRate > 10 ? '#52c41a' : '#faad14'}
                  style={{ width: '100%' }}
                />
              </Descriptions.Item>
              {selectedMarketer.satisfaction !== undefined && (
                <Descriptions.Item label="Satisfaction Score">
                  <Tag color="gold"><StarFilled /> {selectedMarketer.satisfaction} / 10</Tag>
                </Descriptions.Item>
              )}
              {selectedMarketer.responseTime !== undefined && (
                <Descriptions.Item label="Avg Response Time">
                  ⚡ {selectedMarketer.responseTime} minutes
                </Descriptions.Item>
              )}
              {selectedMarketer.revenueMinor !== undefined && (
                <Descriptions.Item label="Revenue Generated">
                  <Text strong color="green">GHS {(selectedMarketer.revenueMinor / 100).toLocaleString()}</Text>
                </Descriptions.Item>
              )}
              {selectedMarketer.targetMinor !== undefined && (
                <Descriptions.Item label="Target">
                  GHS {(selectedMarketer.targetMinor / 100).toLocaleString()}
                </Descriptions.Item>
              )}
              {selectedMarketer.growthPercent !== undefined && (
                <Descriptions.Item label="MoM Growth">
                  <Tag color={selectedMarketer.growthPercent >= 0 ? 'green' : 'volcano'}>
                    {selectedMarketer.growthPercent >= 0 ? `+${selectedMarketer.growthPercent}%` : `${selectedMarketer.growthPercent}%`}
                  </Tag>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Status Breakdown">
                <Space wrap>
                  <Tag color="blue">{selectedMarketer.new} New</Tag>
                  <Tag color="cyan">{selectedMarketer.meetingScheduled} Scheduled</Tag>
                  <Tag color="green">{selectedMarketer.meetingCompleted} Completed</Tag>
                  <Tag color="gold">{selectedMarketer.postponed} Postponed</Tag>
                  <Tag color="orange">{selectedMarketer.suspended} Suspended</Tag>
                </Space>
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 16 }}>
              <Button
                type="primary"
                block
                onClick={() => {
                  navigate(`/marketing/prospects?assignedUserId=${selectedMarketer.id}&name=${encodeURIComponent(selectedMarketer.name)}`);
                  setViewProfileDrawer(false);
                }}
              >
                View Prospects
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
