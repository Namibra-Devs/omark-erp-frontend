// src/pages/marketing/DirectorOverviewPage.tsx
import React, { useState } from 'react';
import { 
  Card, Row, Col, Typography, Statistic, Table, Tag, Space, Button, 
  Progress, Tabs, Timeline, Avatar, Badge, Tooltip, Dropdown, MenuProps,
  Select, DatePicker, Empty, Alert, Divider, List, Modal, Form, Input,
  message, Switch, Descriptions, Drawer
} from 'antd';
import { 
  UserOutlined, 
  TeamOutlined, 
  CalendarOutlined, 
  CheckCircleOutlined,
  ClockCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EyeOutlined,
  BarChartOutlined,
  PieChartOutlined,
  LineChartOutlined,
  DownloadOutlined,
  ReloadOutlined,
  FilterOutlined,
  SearchOutlined,
  TrophyOutlined,
  CrownOutlined,
  StarOutlined,
  FireOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  MoreOutlined,
  MailOutlined,
  PhoneOutlined,
  GlobalOutlined,
  ExportOutlined,
  PrinterOutlined,
  DashboardOutlined,
  UserSwitchOutlined,
  PercentageOutlined,
  RiseOutlined,
  FallOutlined,
  DollarOutlined,
  MinusOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { tokens } from '@/constants/tokens';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusTag } from '@/components/shared/StatusTag';
import { ProgressCell } from '@/components/shared/ProgressCell';
import { MoneyText } from '@/components/shared/MoneyText';
import type { ProspectStatus } from '@/types';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// Enhanced mock data with more metrics
const mockMarketers = [
  {
    id: '1',
    name: 'Sarah Marketing',
    avatar: 'https://i.pravatar.cc/150?img=1',
    email: 'sarah@omark.com',
    phone: '+233201234568',
    department: 'Residential Sales',
    totalProspects: 45,
    new: 12,
    meetingScheduled: 8,
    meetingCompleted: 15,
    postponed: 3,
    suspended: 2,
    converted: 5,
    lastActivity: '2024-01-15T14:30:00Z',
    conversionRate: 11.1,
    trend: 'up' as const,
    revenueGenerated: 4500000,
    dealsClosed: 3,
    avgResponseTime: 2.5,
    customerSatisfaction: 4.8,
    weeklyGrowth: 8,
    monthlyTarget: 12,
    targetAchieved: 8,
  },
  {
    id: '2',
    name: 'John Sales',
    avatar: 'https://i.pravatar.cc/150?img=2',
    email: 'john@omark.com',
    phone: '+233201234569',
    department: 'Commercial Sales',
    totalProspects: 38,
    new: 8,
    meetingScheduled: 10,
    meetingCompleted: 12,
    postponed: 4,
    suspended: 1,
    converted: 3,
    lastActivity: '2024-01-14T16:45:00Z',
    conversionRate: 7.9,
    trend: 'down' as const,
    revenueGenerated: 2800000,
    dealsClosed: 2,
    avgResponseTime: 3.2,
    customerSatisfaction: 4.2,
    weeklyGrowth: -3,
    monthlyTarget: 10,
    targetAchieved: 5,
  },
  {
    id: '3',
    name: 'Emma Growth',
    avatar: 'https://i.pravatar.cc/150?img=3',
    email: 'emma@omark.com',
    phone: '+233201234570',
    department: 'Luxury Properties',
    totalProspects: 52,
    new: 15,
    meetingScheduled: 12,
    meetingCompleted: 18,
    postponed: 2,
    suspended: 0,
    converted: 5,
    lastActivity: '2024-01-15T11:20:00Z',
    conversionRate: 9.6,
    trend: 'up' as const,
    revenueGenerated: 6200000,
    dealsClosed: 4,
    avgResponseTime: 1.8,
    customerSatisfaction: 4.9,
    weeklyGrowth: 12,
    monthlyTarget: 15,
    targetAchieved: 11,
  },
  {
    id: '4',
    name: 'Michael Hunter',
    avatar: 'https://i.pravatar.cc/150?img=4',
    email: 'michael@omark.com',
    phone: '+233201234571',
    department: 'Land Sales',
    totalProspects: 29,
    new: 6,
    meetingScheduled: 5,
    meetingCompleted: 10,
    postponed: 3,
    suspended: 2,
    converted: 3,
    lastActivity: '2024-01-13T09:15:00Z',
    conversionRate: 10.3,
    trend: 'up' as const,
    revenueGenerated: 3500000,
    dealsClosed: 2,
    avgResponseTime: 4.1,
    customerSatisfaction: 4.0,
    weeklyGrowth: 5,
    monthlyTarget: 8,
    targetAchieved: 6,
  },
  {
    id: '5',
    name: 'Lisa Prospector',
    avatar: 'https://i.pravatar.cc/150?img=5',
    email: 'lisa@omark.com',
    phone: '+233201234572',
    department: 'International Sales',
    totalProspects: 34,
    new: 10,
    meetingScheduled: 7,
    meetingCompleted: 14,
    postponed: 1,
    suspended: 1,
    converted: 1,
    lastActivity: '2024-01-15T13:00:00Z',
    conversionRate: 2.9,
    trend: 'down' as const,
    revenueGenerated: 1800000,
    dealsClosed: 1,
    avgResponseTime: 5.2,
    customerSatisfaction: 3.8,
    weeklyGrowth: -5,
    monthlyTarget: 6,
    targetAchieved: 3,
  },
];

// Performance trends data
const performanceTrends = [
  { month: 'Jan', conversions: 12, prospects: 45, meetings: 23 },
  { month: 'Feb', conversions: 15, prospects: 52, meetings: 28 },
  { month: 'Mar', conversions: 18, prospects: 48, meetings: 31 },
  { month: 'Apr', conversions: 22, prospects: 56, meetings: 35 },
  { month: 'May', conversions: 19, prospects: 50, meetings: 29 },
  { month: 'Jun', conversions: 25, prospects: 60, meetings: 38 },
];

// Recent activities
const recentActivities = [
  { id: '1', user: 'Sarah Marketing', action: 'Converted Prospect', details: 'Converted John Doe to customer', timestamp: '2024-01-15 14:30', type: 'success' },
  { id: '2', user: 'Emma Growth', action: 'Meeting Completed', details: 'Completed meeting with Jane Smith', timestamp: '2024-01-15 13:45', type: 'info' },
  { id: '3', user: 'John Sales', action: 'New Prospect Added', details: 'Added new prospect: Mike Johnson', timestamp: '2024-01-15 12:20', type: 'info' },
  { id: '4', user: 'Michael Hunter', action: 'Deal Closed', details: 'Closed land sale deal worth GHS 850,000', timestamp: '2024-01-15 11:00', type: 'success' },
  { id: '5', user: 'Lisa Prospector', action: 'Meeting Scheduled', details: 'Scheduled meeting with international client', timestamp: '2024-01-15 10:30', type: 'warning' },
];

export const DirectorOverviewPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMarketer, setSelectedMarketer] = useState<any>(null);
  const [viewProfileDrawer, setViewProfileDrawer] = useState(false);
  const [timeRange, setTimeRange] = useState('monthly');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Calculate summary statistics
  const summary = {
    totalActive: mockMarketers.reduce((sum, m) => sum + m.totalProspects, 0),
    totalMeetingsScheduled: mockMarketers.reduce((sum, m) => sum + m.meetingScheduled, 0),
    totalMeetingsCompleted: mockMarketers.reduce((sum, m) => sum + m.meetingCompleted, 0),
    totalConverted: mockMarketers.reduce((sum, m) => sum + m.converted, 0),
    avgConversionRate: mockMarketers.reduce((sum, m) => sum + m.conversionRate, 0) / mockMarketers.length,
    totalRevenue: mockMarketers.reduce((sum, m) => sum + m.revenueGenerated, 0),
    totalDeals: mockMarketers.reduce((sum, m) => sum + m.dealsClosed, 0),
    avgSatisfaction: mockMarketers.reduce((sum, m) => sum + m.customerSatisfaction, 0) / mockMarketers.length,
  };

  // Get top performer
  const topPerformer = [...mockMarketers].sort((a, b) => b.conversionRate - a.conversionRate)[0];

  const columns = [
    {
      title: 'Marketer',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left' as const,
      width: 200,
      render: (name: string, record: any) => (
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
      sorter: (a: any, b: any) => a.totalProspects - b.totalProspects,
      render: (value: number) => <Text strong>{value}</Text>,
    },
    {
      title: 'Status Breakdown',
      key: 'statusBreakdown',
      width: 200,
      render: (_: any, record: any) => (
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
      render: (_: any, record: any) => (
        <Space>
          <Progress 
            percent={record.conversionRate} 
            size="small" 
            strokeColor={record.conversionRate > 10 ? '#52c41a' : record.conversionRate > 5 ? '#faad14' : '#ff4d4f'}
            format={(p) => `${p?.toFixed(1)}%`}
            style={{ width: 80 }}
          />
        </Space>
      ),
      sorter: (a: any, b: any) => a.conversionRate - b.conversionRate,
    },
    {
      title: 'Revenue',
      dataIndex: 'revenueGenerated',
      key: 'revenueGenerated',
      width: 120,
      render: (value: number) => <MoneyText minor={value} />,
      sorter: (a: any, b: any) => a.revenueGenerated - b.revenueGenerated,
    },
    {
      title: 'Trend',
      dataIndex: 'trend',
      key: 'trend',
      width: 120,
      render: (trend: string, record: any) => (
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
      render: (_: any, record: any) => (
        <Progress 
          percent={(record.targetAchieved / record.monthlyTarget) * 100} 
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
      render: (_: any, record: any) => (
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
            onClick: () => {
              setLoading(true);
              setTimeout(() => {
                setLoading(false);
                message.success('Dashboard refreshed!');
              }, 1000);
            },
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
                <CrownOutlined /> Top Performer: {topPerformer.name} ({topPerformer.conversionRate}% conversion rate)
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
              value={mockMarketers.length}
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
                {/* Performance Chart Placeholder */}
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col xs={24} lg={16}>
                    <Card title="Performance Trends" extra={
                      <Select value={timeRange} onChange={setTimeRange} style={{ width: 120 }}>
                        <Option value="weekly">Weekly</Option>
                        <Option value="monthly">Monthly</Option>
                        <Option value="quarterly">Quarterly</Option>
                      </Select>
                    }>
                      <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                          <BarChartOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                          <br />
                          <Text type="secondary">Interactive chart coming soon</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Showing {timeRange} performance data
                          </Text>
                        </div>
                      </div>
                    </Card>
                  </Col>
                  <Col xs={24} lg={8}>
                    <Card title="Recent Activities">
                      <Timeline>
                        {recentActivities.slice(0, 4).map(activity => (
                          <Timeline.Item 
                            key={activity.id}
                            color={activity.type === 'success' ? 'green' : activity.type === 'warning' ? 'orange' : 'blue'}
                          >
                            <div>
                              <Text strong>{activity.action}</Text>
                              <br />
                              <Text type="secondary" style={{ fontSize: 12 }}>{activity.details}</Text>
                              <br />
                              <Text type="secondary" style={{ fontSize: 11 }}>{activity.user} - {activity.timestamp}</Text>
                            </div>
                          </Timeline.Item>
                        ))}
                      </Timeline>
                    </Card>
                  </Col>
                </Row>

                {/* Per-Marketer Table */}
                <Card title="Team Performance">
                  <Table
                    columns={columns}
                    dataSource={mockMarketers}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1200 }}
                  />
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
                            percent={Math.round((summary.totalMeetingsScheduled / summary.totalActive) * 100)} 
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
                            percent={Math.round((summary.totalMeetingsCompleted / summary.totalActive) * 100)} 
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
                            percent={Math.round((summary.totalConverted / summary.totalActive) * 100)} 
                            strokeColor="#722ed1" 
                            size="small" 
                          />
                        </div>
                      </div>
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
                          <Text strong>GHS {(summary.totalRevenue / mockMarketers.length / 100).toLocaleString()}</Text>
                        </div>
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text>Deals per Team Member</Text>
                          <Text strong>{(summary.totalDeals / mockMarketers.length).toFixed(1)}</Text>
                        </div>
                      </div>
                      <Divider />
                      <div>
                        <Text strong>Top Performing Departments:</Text>
                        <div style={{ marginTop: 8 }}>
                          <Tag color="purple">Luxury Properties (4.9⭐)</Tag>
                          <Tag color="blue">Residential Sales (4.8⭐)</Tag>
                          <Tag color="green">Land Sales (4.0⭐)</Tag>
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
                    <List
                      itemLayout="horizontal"
                      dataSource={[
                        {
                          icon: <TrophyOutlined style={{ color: '#faad14' }} />,
                          title: 'Top Performer',
                          description: `${topPerformer?.name} with ${topPerformer?.conversionRate}% conversion rate and ${topPerformer?.dealsClosed} deals closed`
                        },
                        {
                          icon: <FireOutlined style={{ color: '#ff4d4f' }} />,
                          title: 'Highest Revenue Generated',
                          description: `${mockMarketers.sort((a, b) => b.revenueGenerated - a.revenueGenerated)[0]?.name} generated GHS ${(Math.max(...mockMarketers.map(m => m.revenueGenerated)) / 100).toLocaleString()}`
                        },
                        {
                          icon: <StarOutlined style={{ color: '#52c41a' }} />,
                          title: 'Best Customer Satisfaction',
                          description: `${mockMarketers.sort((a, b) => b.customerSatisfaction - a.customerSatisfaction)[0]?.name} with ${Math.max(...mockMarketers.map(m => m.customerSatisfaction)).toFixed(1)}/5.0 rating`
                        },
                        {
                          icon: <ClockCircleOutlined style={{ color: '#1890ff' }} />,
                          title: 'Fastest Response Time',
                          description: `${mockMarketers.sort((a, b) => a.avgResponseTime - b.avgResponseTime)[0]?.name} with ${Math.min(...mockMarketers.map(m => m.avgResponseTime)).toFixed(1)} hours average`
                        },
                      ]}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={item.icon}
                            title={<Text strong>{item.title}</Text>}
                            description={item.description}
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
                <Col xs={24} lg={8}>
                  <Card title="Team Stats">
                    <Descriptions column={1} bordered size="small">
                      <Descriptions.Item label="Total Team Members">
                        <Tag color="blue">{mockMarketers.length}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Active Departments">
                        <Tag color="purple">{new Set(mockMarketers.map(m => m.department)).size}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Total Deals Closed">
                        <Tag color="green">{summary.totalDeals}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Avg Satisfaction">
                        <Tag color="gold">{summary.avgSatisfaction.toFixed(1)}/5.0</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Team Growth">
                        <Tag color="green">
                          <ArrowUpOutlined /> +{mockMarketers.reduce((sum, m) => sum + m.weeklyGrowth, 0) / mockMarketers.length}% average growth
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
                  percent={(selectedMarketer.targetAchieved / selectedMarketer.monthlyTarget) * 100} 
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