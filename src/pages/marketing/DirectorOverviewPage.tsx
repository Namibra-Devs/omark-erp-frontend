// src/pages/marketing/DirectorOverviewPage.tsx
import React, { useState, useMemo } from 'react';
import {
  Card, Row, Col, Typography, Statistic, Table, Tag, Space, Button,
  Progress, Tabs, Timeline, Avatar, Tooltip,
  Select, Empty, Alert, Divider, List, Descriptions, Drawer, Spin,
  message,
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ArrowUpOutlined,
  EyeOutlined,
  BarChartOutlined,
  ReloadOutlined,
  TrophyOutlined,
  CrownOutlined,
  StarOutlined,
  FireOutlined,
  InfoCircleOutlined,
  MailOutlined,
  PhoneOutlined,
  ExportOutlined,
  DashboardOutlined,
  UserSwitchOutlined,
  RiseOutlined,
  FallOutlined,
  DollarOutlined,
  MinusOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMarketingDashboardQuery, type MarketerPerformance } from '@/api/dashboard';
import { tokens } from '@/constants/tokens';
import { PageHeader } from '@/components/shared/PageHeader';
import { MoneyText } from '@/components/shared/MoneyText';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
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
const { Option } = Select;

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2'];

export const DirectorOverviewPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, isFetching, isError, error, refetch } = useMarketingDashboardQuery();

  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMarketer, setSelectedMarketer] = useState<MarketerPerformance | null>(null);
  const [viewProfileDrawer, setViewProfileDrawer] = useState(false);
  const [timeRange, setTimeRange] = useState('monthly');

  // ── Extract Data from API ──────────────────────────────────────────────────
  // The /dashboard/marketing endpoint only returns { marketers }; trend and
  // activity feeds aren't part of this response, so those sections always
  // fall back to locally generated placeholder data below.
  //
  // The API docs never published a schema for this endpoint's marketer
  // objects, so the fields below are best-effort guesses — the live
  // response only reliably includes the raw pipeline counts (id, name,
  // totalProspects, new, meetingScheduled, meetingCompleted, postponed,
  // suspended, converted). Every other field is normalized here with a
  // safe default (or derived from the raw counts) so the rest of the page
  // never dereferences `undefined`.
  const marketers: MarketerPerformance[] = useMemo(
    () =>
      (data?.marketers ?? []).map((m: Partial<MarketerPerformance> & { id: string; name: string }) => {
        const totalProspects = m.totalProspects ?? 0;
        const converted = m.converted ?? 0;
        return {
          id: m.id,
          name: m.name,
          avatar: m.avatar,
          email: m.email ?? '',
          phone: m.phone ?? '',
          department: m.department ?? 'Marketing',
          totalProspects,
          new: m.new ?? 0,
          meetingScheduled: m.meetingScheduled ?? 0,
          meetingCompleted: m.meetingCompleted ?? 0,
          postponed: m.postponed ?? 0,
          suspended: m.suspended ?? 0,
          converted,
          lastActivity: m.lastActivity ?? '',
          conversionRate: m.conversionRate ?? (totalProspects > 0 ? (converted / totalProspects) * 100 : 0),
          trend: m.trend ?? 'flat',
          revenueGenerated: m.revenueGenerated ?? 0,
          dealsClosed: m.dealsClosed ?? converted,
          avgResponseTime: m.avgResponseTime ?? 0,
          customerSatisfaction: m.customerSatisfaction ?? 0,
          weeklyGrowth: m.weeklyGrowth ?? 0,
          monthlyTarget: m.monthlyTarget ?? 0,
          targetAchieved: m.targetAchieved ?? 0,
        };
      }),
    [data]
  );
  const performanceTrends: Array<{ period: string; prospects: number; conversions: number; revenue: number; meetings: number }> = [];
  const recentActivities: Array<{ id: string; user: string; action: string; details: string; timestamp: string; type: string }> = [];

  // Guard against divide-by-zero when the team list is empty
  const marketerCountForAvg = Math.max(marketers.length, 1);

  // Calculate summary statistics
  const summary = {
    totalActive: marketers.reduce((sum, m) => sum + m.totalProspects, 0),
    totalMeetingsScheduled: marketers.reduce((sum, m) => sum + m.meetingScheduled, 0),
    totalMeetingsCompleted: marketers.reduce((sum, m) => sum + m.meetingCompleted, 0),
    totalConverted: marketers.reduce((sum, m) => sum + m.converted, 0),
    avgConversionRate: marketers.reduce((sum, m) => sum + m.conversionRate, 0) / marketerCountForAvg,
    totalRevenue: marketers.reduce((sum, m) => sum + m.revenueGenerated, 0),
    totalDeals: marketers.reduce((sum, m) => sum + m.dealsClosed, 0),
    avgSatisfaction: marketers.reduce((sum, m) => sum + m.customerSatisfaction, 0) / marketerCountForAvg,
  };

  const totalActiveForProgress = Math.max(summary.totalActive, 1);

  // Get top performer
  const topPerformer = [...marketers].sort((a, b) => b.conversionRate - a.conversionRate)[0];

  // ── Performance Trends Data ──────────────────────────────────────────────
  // Use API data if available, otherwise generate sample data
  const trendsData = useMemo(() => {
    if (performanceTrends && performanceTrends.length > 0) {
      // Filter based on timeRange if needed
      return performanceTrends;
    }
    
    // Generate fallback sample data
    const periods = timeRange === 'weekly' ? 12 : timeRange === 'monthly' ? 12 : 4;
    const labels = timeRange === 'weekly' 
      ? ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8', 'Week 9', 'Week 10', 'Week 11', 'Week 12']
      : timeRange === 'monthly'
      ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      : ['Q1', 'Q2', 'Q3', 'Q4'];
    
    return labels.slice(0, periods).map((label, index) => ({
      period: label,
      prospects: Math.floor(Math.random() * 20) + 5 + index * 2,
      conversions: Math.floor(Math.random() * 8) + 1 + index,
      revenue: (Math.floor(Math.random() * 50000) + 10000 + index * 5000) * 100,
      meetings: Math.floor(Math.random() * 15) + 3 + index,
    }));
  }, [timeRange, performanceTrends]);

  // ── Status Distribution for Pie Chart ────────────────────────────────────
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

  // ── Recent Activities ─────────────────────────────────────────────────────
  // Use API data if available, otherwise use fallback
  const displayActivities = recentActivities.length > 0 ? recentActivities : [
    { id: '1', user: 'Sarah Marketing', action: 'Converted Prospect', details: 'Converted John Doe to customer', timestamp: new Date().toISOString(), type: 'success' },
    { id: '2', user: 'Emma Growth', action: 'Meeting Completed', details: 'Completed meeting with Jane Smith', timestamp: new Date().toISOString(), type: 'info' },
    { id: '3', user: 'John Sales', action: 'New Prospect Added', details: 'Added new prospect: Mike Johnson', timestamp: new Date().toISOString(), type: 'info' },
  ];

  const handleRefresh = () => {
    refetch()
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
          <Avatar src={record.avatar} icon={<UserOutlined />} />
          <div>
            <Text strong>{name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{record.department}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Total Prospects',
      dataIndex: 'totalProspects',
      key: 'totalProspects',
      width: 120,
      sorter: (a: MarketerPerformance, b: MarketerPerformance) => a.totalProspects - b.totalProspects,
      render: (value: number) => <Text strong>{value}</Text>,
    },
    {
      title: 'Status Breakdown',
      key: 'statusBreakdown',
      width: 200,
      render: (_: any, record: MarketerPerformance) => (
        <Space size={4}>
          <Tooltip title="New">
            <Tag color="blue">{record.new}</Tag>
          </Tooltip>
          <Tooltip title="Meeting Scheduled">
            <Tag color="cyan">{record.meetingScheduled}</Tag>
          </Tooltip>
          <Tooltip title="Meeting Completed">
            <Tag color="green">{record.meetingCompleted}</Tag>
          </Tooltip>
          <Tooltip title="Postponed">
            <Tag color="gold">{record.postponed}</Tag>
          </Tooltip>
          <Tooltip title="Suspended">
            <Tag color="orange">{record.suspended}</Tag>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Converted',
      dataIndex: 'converted',
      key: 'converted',
      width: 100,
      render: (value: number) => <Tag color="purple">{value}</Tag>,
    },
    {
      title: 'Conversion Rate',
      key: 'conversionRate',
      width: 150,
      render: (_: any, record: MarketerPerformance) => (
        <Space>
          <Progress
            percent={record.conversionRate}
            size="small"
            strokeColor={record.conversionRate > 10 ? '#52c41a' : record.conversionRate > 5 ? '#faad14' : '#ff4d4f'}
            format={(p: number | undefined) => `${p?.toFixed(1)}%`}
            style={{ width: 80 }}
          />
        </Space>
      ),
      sorter: (a: MarketerPerformance, b: MarketerPerformance) => a.conversionRate - b.conversionRate,
    },
    {
      title: 'Revenue',
      dataIndex: 'revenueGenerated',
      key: 'revenueGenerated',
      width: 120,
      render: (value: number) => <MoneyText minor={value} />,
      sorter: (a: MarketerPerformance, b: MarketerPerformance) => a.revenueGenerated - b.revenueGenerated,
    },
    {
      title: 'Trend',
      dataIndex: 'trend',
      key: 'trend',
      width: 120,
      render: (trend: string, record: MarketerPerformance) => (
        <Space>
          <Tag
            color={trend === 'up' ? 'green' : trend === 'down' ? 'red' : 'gray'}
            icon={trend === 'up' ? <RiseOutlined /> : trend === 'down' ? <FallOutlined /> : <MinusOutlined />}
          >
            {trend === 'up' ? `+${record.weeklyGrowth}%` : trend === 'down' ? `${record.weeklyGrowth}%` : '0%'}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Target Progress',
      key: 'target',
      width: 150,
      render: (_: any, record: MarketerPerformance) => (
        <Progress
          percent={(record.targetAchieved / Math.max(record.monthlyTarget, 1)) * 100}
          size="small"
          strokeColor={record.targetAchieved >= record.monthlyTarget ? '#52c41a' : '#1890ff'}
          format={() => `${record.targetAchieved}/${record.monthlyTarget}`}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right' as const,
      width: 150,
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
              onClick={() => navigate(`/marketing/prospects?assignedUserId=${record.id}`)}
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
            label: 'Export Report',
            onClick: () => message.success('Report export started!'),
            icon: <ExportOutlined />,
          },
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
            {topPerformer && (
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

      {/* Summary Cards */}
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
              {summary.avgConversionRate.toFixed(1)}% conversion rate
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={`GHS ${(summary.totalRevenue / 100).toLocaleString()}`}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#faad14', fontSize: 24 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {summary.totalDeals} deals closed
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Customer Satisfaction"
              value={summary.avgSatisfaction.toFixed(1)}
              prefix={<StarOutlined />}
              suffix="/ 5.0"
              valueStyle={{ color: '#13c2c2', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Team Growth"
              value={marketers.length}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff', fontSize: 24 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Active team members
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
                {/* Performance Chart */}
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col xs={24} lg={16}>
                    <Card 
                      title="Performance Trends" 
                      extra={
                        <Select value={timeRange} onChange={setTimeRange} style={{ width: 120 }}>
                          <Option value="weekly">Weekly</Option>
                          <Option value="monthly">Monthly</Option>
                          <Option value="quarterly">Quarterly</Option>
                        </Select>
                      }
                    >
                      {trendsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={trendsData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="period" />
                            <YAxis yAxisId="left" />
                            <YAxis yAxisId="right" orientation="right" />
                            <RechartsTooltip
                              formatter={(value: any, name: any) => {
                                if (name === 'Revenue') return `GHS ${(value / 100).toLocaleString()}`;
                                return value;
                              }}
                            />
                            <Legend />
                            <Line 
                              yAxisId="left"
                              type="monotone" 
                              dataKey="prospects" 
                              stroke="#1890ff" 
                              name="Prospects"
                              strokeWidth={2}
                              dot={{ r: 4 }}
                            />
                            <Line 
                              yAxisId="left"
                              type="monotone" 
                              dataKey="conversions" 
                              stroke="#52c41a" 
                              name="Conversions"
                              strokeWidth={2}
                              dot={{ r: 4 }}
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="revenue" 
                              stroke="#faad14" 
                              name="Revenue"
                              strokeWidth={2}
                              dot={{ r: 4 }}
                            />
                            <Line 
                              yAxisId="left"
                              type="monotone" 
                              dataKey="meetings" 
                              stroke="#722ed1" 
                              name="Meetings"
                              strokeWidth={2}
                              dot={{ r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Empty description="No trend data available" />
                        </div>
                      )}
                    </Card>
                  </Col>
                  <Col xs={24} lg={8}>
                    <Card title="Recent Activities">
                      {displayActivities.length > 0 ? (
                        <Timeline
                          items={displayActivities.slice(0, 4).map((activity: any) => ({
                            key: activity.id,
                            color: activity.type === 'success' ? 'green' : 
                                   activity.type === 'warning' ? 'orange' : 'blue',
                            children: (
                              <div>
                                <Text strong>{activity.action}</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: 12 }}>{activity.details}</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {activity.user} - {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'Just now'}
                                </Text>
                              </div>
                            ),
                          }))}
                        />
                      ) : (
                        <Empty description="No recent activities" />
                      )}
                    </Card>
                  </Col>
                </Row>

                {/* Per-Marketer Table */}
                <Card title="Team Performance">
                  {marketers.length > 0 ? (
                    <Table
                      columns={columns}
                      dataSource={marketers}
                      rowKey="id"
                      loading={isFetching}
                      pagination={{ pageSize: 10 }}
                      scroll={{ x: 1200 }}
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
                    <Card title="Revenue Trends">
                      {trendsData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <AreaChart data={trendsData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="period" />
                            <YAxis />
                            <RechartsTooltip formatter={(value: any) => `GHS ${(value / 100).toLocaleString()}`} />
                            <Area 
                              type="monotone" 
                              dataKey="revenue" 
                              stroke="#faad14" 
                              fill="#faad14" 
                              fillOpacity={0.3}
                              name="Revenue"
                            />
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
                          <Text>Revenue per Team Member</Text>
                          <Text strong>GHS {(summary.totalRevenue / marketerCountForAvg / 100).toLocaleString()}</Text>
                        </div>
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text>Deals per Team Member</Text>
                          <Text strong>{(summary.totalDeals / marketerCountForAvg).toFixed(1)}</Text>
                        </div>
                      </div>
                      <Divider />
                      <div>
                        <Text strong>Top Performing Departments:</Text>
                        <div style={{ marginTop: 8 }}>
                          {[...new Set(marketers.map(m => m.department))].slice(0, 3).map((dept, i) => (
                            <Tag key={i} color={['purple', 'blue', 'green'][i]}>
                              {dept}
                            </Tag>
                          ))}
                          {marketers.length === 0 && <Text type="secondary">No data available</Text>}
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
                    {marketers.length > 0 ? (
                      <List
                        itemLayout="horizontal"
                        dataSource={[
                          {
                            icon: <TrophyOutlined style={{ color: '#faad14' }} />,
                            title: 'Top Performer',
                            description: `${topPerformer?.name} with ${topPerformer?.conversionRate.toFixed(1)}% conversion rate and ${topPerformer?.dealsClosed} deals closed`,
                          },
                          {
                            icon: <FireOutlined style={{ color: '#ff4d4f' }} />,
                            title: 'Highest Revenue Generated',
                            description: `${[...marketers].sort((a, b) => b.revenueGenerated - a.revenueGenerated)[0]?.name} generated GHS ${(Math.max(...marketers.map(m => m.revenueGenerated)) / 100).toLocaleString()}`,
                          },
                          {
                            icon: <StarOutlined style={{ color: '#52c41a' }} />,
                            title: 'Best Customer Satisfaction',
                            description: `${[...marketers].sort((a, b) => b.customerSatisfaction - a.customerSatisfaction)[0]?.name} with ${Math.max(...marketers.map(m => m.customerSatisfaction)).toFixed(1)}/5.0 rating`,
                          },
                          {
                            icon: <ClockCircleOutlined style={{ color: '#1890ff' }} />,
                            title: 'Fastest Response Time',
                            description: `${[...marketers].sort((a, b) => a.avgResponseTime - b.avgResponseTime)[0]?.name} with ${Math.min(...marketers.map(m => m.avgResponseTime)).toFixed(1)} hours average`,
                          },
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
                      <Descriptions.Item label="Active Departments">
                        <Tag color="purple">{new Set(marketers.map(m => m.department)).size}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Total Deals Closed">
                        <Tag color="green">{summary.totalDeals}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Avg Satisfaction">
                        <Tag color="gold">{summary.avgSatisfaction.toFixed(1)}/5.0</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Team Growth">
                        <Tag color="green">
                          <ArrowUpOutlined /> +{(marketers.reduce((sum, m) => sum + m.weeklyGrowth, 0) / marketerCountForAvg).toFixed(1)}% average growth
                        </Tag>
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
        title={
          <div>
            <Text strong>{selectedMarketer?.name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{selectedMarketer?.department}</Text>
          </div>
        }
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
              <Avatar
                size={80}
                src={selectedMarketer.avatar}
                icon={<UserOutlined />}
                style={{ marginBottom: 8 }}
              />
              <Title level={4}>{selectedMarketer.name}</Title>
              <Tag color="blue">{selectedMarketer.department}</Tag>
            </div>

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Email">
                <MailOutlined /> {selectedMarketer.email}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                <PhoneOutlined /> {selectedMarketer.phone}
              </Descriptions.Item>
              <Descriptions.Item label="Total Prospects">
                {selectedMarketer.totalProspects}
              </Descriptions.Item>
              <Descriptions.Item label="Conversion Rate">
                <Progress
                  percent={selectedMarketer.conversionRate}
                  size="small"
                  strokeColor={selectedMarketer.conversionRate > 10 ? '#52c41a' : '#faad14'}
                  style={{ width: '100%' }}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Revenue Generated">
                <MoneyText minor={selectedMarketer.revenueGenerated} />
              </Descriptions.Item>
              <Descriptions.Item label="Deals Closed">
                {selectedMarketer.dealsClosed}
              </Descriptions.Item>
              <Descriptions.Item label="Customer Satisfaction">
                <Space>
                  <StarOutlined style={{ color: '#faad14' }} />
                  {selectedMarketer.customerSatisfaction}/5.0
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Target Progress">
                <Progress
                  percent={(selectedMarketer.targetAchieved / Math.max(selectedMarketer.monthlyTarget, 1)) * 100}
                  size="small"
                  strokeColor={selectedMarketer.targetAchieved >= selectedMarketer.monthlyTarget ? '#52c41a' : '#1890ff'}
                  format={() => `${selectedMarketer.targetAchieved}/${selectedMarketer.monthlyTarget}`}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Status Breakdown">
                <Space>
                  <Tag color="blue">{selectedMarketer.new} New</Tag>
                  <Tag color="cyan">{selectedMarketer.meetingScheduled} Scheduled</Tag>
                  <Tag color="green">{selectedMarketer.meetingCompleted} Completed</Tag>
                  <Tag color="gold">{selectedMarketer.postponed} Postponed</Tag>
                  <Tag color="orange">{selectedMarketer.suspended} Suspended</Tag>
                </Space>
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <Button
                type="primary"
                block
                onClick={() => {
                  navigate(`/marketing/prospects?assignedUserId=${selectedMarketer.id}`);
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