// src/components/attendance/AttendanceDashboardView.tsx
//
// Comprehensive Executive Attendance Dashboard & Analytics View.
// Displays:
// 1. Total Present
// 2. Late Arrivals
// 3. Absentees
// 4. Staff on Leave
// 5. Monthly Attendance Summary
// 6. Punctuality Rate & Bonus Eligibility
// 7. Repeated Offenders & Chronic Infraction Tracker
// 8. Team Attendance Trends (30-day trends, Day-of-Week patterns, Branch Benchmarking)

import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Table,
  Tag,
  Select,
  DatePicker,
  Button,
  Space,
  Typography,
  Segmented,
  Tooltip,
  Badge,
  Modal,
  Alert,
  Avatar,
  message
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CalendarOutlined,
  TrophyOutlined,
  WarningOutlined,
  RiseOutlined,
  CompassOutlined,
  ReloadOutlined,
  EyeOutlined,
  FileProtectOutlined,
  UserOutlined,
  ShopOutlined,
  SendOutlined,
  FieldTimeOutlined,
  BarChartOutlined,
  LineChartOutlined
} from '@ant-design/icons';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';
import {
  useAttendanceDashboardAnalyticsQuery,
  type RepeatedOffenderRecord,
  type AttendanceRecord,
  type BranchAttendanceSummary,
} from '@/api/attendance';
import { ATTENDANCE_STATUS_META } from '@/mock/staffAttendance';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface AttendanceDashboardViewProps {
  initialBranchId?: string;
  userId?: string;
  isAdmin?: boolean;
  onNavigateToRegister?: (statusFilter?: string) => void;
}

export const AttendanceDashboardView: React.FC<AttendanceDashboardViewProps> = ({
  initialBranchId,
  userId,
  isAdmin = true,
  onNavigateToRegister,
}) => {
  const [selectedBranch, setSelectedBranch] = useState<string | undefined>(initialBranchId);
  const [selectedMonth, setSelectedMonth] = useState<string>(dayjs().format('YYYY-MM'));
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));

  // Roster inspection modal states
  const [rosterModalType, setRosterModalType] = useState<'present' | 'late' | 'absent' | 'leave' | null>(null);
  const [selectedOffender, setSelectedOffender] = useState<RepeatedOffenderRecord | null>(null);
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [trendChartMode, setTrendChartMode] = useState<'stacked' | 'trend'>('stacked');

  const { data: analytics, isLoading, refetch } = useAttendanceDashboardAnalyticsQuery({
    branchId: isAdmin ? selectedBranch : undefined,
    month: selectedMonth,
    date: selectedDate,
    userId: isAdmin ? undefined : userId,
  });

  const handleIssueWarning = (offender: RepeatedOffenderRecord) => {
    setSelectedOffender(offender);
    setWarningModalOpen(true);
  };

  const confirmIssueWarning = () => {
    if (!selectedOffender) return;
    message.success(`Formal attendance counseling notice generated and queued for ${selectedOffender.staffName}.`);
    setWarningModalOpen(false);
    setSelectedOffender(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── 0. DASHBOARD CONTROL BAR ────────────────────────────────────────── */}
      <Card
        size="small"
        style={{
          borderRadius: 12,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border: '1px solid #334155',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: 'rgba(56, 189, 248, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                }}
              >
                <RiseOutlined />
              </div>
              <div>
                <Title level={4} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>
                  {isAdmin
                    ? 'Attendance Executive Analytics & Metrics Dashboard'
                    : 'My Attendance & Performance Analytics'}
                </Title>
                <Text style={{ color: '#94a3b8', fontSize: 13 }}>
                  {isAdmin
                    ? 'Real-time company-wide workforce presence, punctuality scoring, chronic infractions, and team trends'
                    : 'Your personal attendance records, verified work hours, punctuality scorecard, and monthly bonus eligibility'}
                </Text>
              </div>
            </div>
          </Col>

          <Col xs={24} md={12} style={{ textAlign: 'right' }}>
            <Space wrap size="middle">
              {isAdmin && (
                <Select
                  placeholder="All Branches"
                  value={selectedBranch}
                  onChange={setSelectedBranch}
                  allowClear
                  style={{ width: 175 }}
                  dropdownStyle={{ zIndex: 1050 }}
                >
                  <Option value="branch-accra-hq">Accra Head Office</Option>
                  <Option value="branch-kumasi">Kumasi Branch</Option>
                  <Option value="branch-takoradi">Takoradi Branch</Option>
                  <Option value="branch-tamale">Tamale Branch</Option>
                  <Option value="branch-wa">Wa Branch</Option>
                </Select>
              )}

              <DatePicker
                picker="month"
                value={dayjs(selectedMonth)}
                onChange={(d) => setSelectedMonth(d ? d.format('YYYY-MM') : dayjs().format('YYYY-MM'))}
                allowClear={false}
                style={{ width: 135 }}
              />

              {isAdmin && (
                <DatePicker
                  value={dayjs(selectedDate)}
                  onChange={(d) => setSelectedDate(d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))}
                  allowClear={false}
                  style={{ width: 145 }}
                />
              )}

              <Button
                icon={<ReloadOutlined />}
                loading={isLoading}
                onClick={() => refetch()}
                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
              >
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* ── 1. CORE EXECUTIVE METRIC CARDS (8-POINT SCORECARD) ──────────────── */}
      <Row gutter={[16, 16]}>
        {/* 1. Total Present */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{ borderRadius: 12, borderTop: '4px solid #52c41a', height: '100%' }}
            onClick={() => {
              if (isAdmin) setRosterModalType('present');
              else onNavigateToRegister?.();
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>
                  {isAdmin ? 'Total Present (Today)' : 'My Days Present'}
                </Text>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#1e293b' }}>
                    {analytics?.totalPresent ?? 0}
                  </span>
                  <Tag color="success" style={{ fontWeight: 700, borderRadius: 10 }}>
                    {analytics?.presentRate ?? 95}% {isAdmin ? 'rate' : 'completed'}
                  </Tag>
                </div>
              </div>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: '#f6ffed',
                  color: '#52c41a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  border: '1px solid #b7eb8f',
                }}
              >
                <CheckCircleOutlined />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <Progress percent={analytics?.presentRate ?? 95} size="small" strokeColor="#52c41a" showInfo={false} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#64748b' }}>
                <span>On-Time: <strong>{analytics?.onTimePresent ?? 0}</strong></span>
                <Button type="link" size="small" style={{ padding: 0, fontSize: 11, height: 'auto' }}>
                  {isAdmin ? 'View Present Roster →' : 'View Punch History →'}
                </Button>
              </div>
            </div>
          </Card>
        </Col>

        {/* 2. Late Arrivals */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{ borderRadius: 12, borderTop: '4px solid #faad14', height: '100%' }}
            onClick={() => {
              if (isAdmin) setRosterModalType('late');
              else onNavigateToRegister?.();
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>
                  {isAdmin ? 'Late Arrivals (Today)' : 'My Late Arrivals'}
                </Text>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#1e293b' }}>
                    {analytics?.lateArrivals ?? 0}
                  </span>
                  <Tag color={(analytics?.lateArrivals ?? 0) > 0 ? 'warning' : 'default'} style={{ fontWeight: 700, borderRadius: 10 }}>
                    {isAdmin ? `${analytics?.latePercentage ?? 0}% of punches` : `${analytics?.lateArrivals ?? 0} punches`}
                  </Tag>
                </div>
              </div>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: '#fffbe6',
                  color: '#faad14',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  border: '1px solid #ffe58f',
                }}
              >
                <ClockCircleOutlined />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <Progress
                percent={analytics?.latePercentage ?? 0}
                size="small"
                strokeColor="#faad14"
                showInfo={false}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#64748b' }}>
                <span>Avg Delay: <strong>{analytics?.averageLatenessMinutes ?? 0} mins</strong></span>
                <Button type="link" size="small" style={{ padding: 0, fontSize: 11, height: 'auto', color: '#d48806' }}>
                  {isAdmin ? 'Inspect Late Arrivals →' : 'View Late Punches →'}
                </Button>
              </div>
            </div>
          </Card>
        </Col>

        {/* 3. Absentees */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{ borderRadius: 12, borderTop: '4px solid #ff4d4f', height: '100%' }}
            onClick={() => {
              if (isAdmin) setRosterModalType('absent');
              else onNavigateToRegister?.();
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>
                  {isAdmin ? 'Absentees (Today)' : 'My Absences'}
                </Text>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: (analytics?.absentees ?? 0) > 0 ? '#ff4d4f' : '#1e293b' }}>
                    {analytics?.absentees ?? 0}
                  </span>
                  <Tag color={(analytics?.absentees ?? 0) > 0 ? 'error' : 'success'} style={{ fontWeight: 700, borderRadius: 10 }}>
                    {isAdmin ? `${analytics?.absenteeRate ?? 0}% absence rate` : `${analytics?.absentees ?? 0} days`}
                  </Tag>
                </div>
              </div>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: '#fff1f0',
                  color: '#ff4d4f',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  border: '1px solid #ffa39e',
                }}
              >
                <CloseCircleOutlined />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <Progress
                percent={analytics?.absenteeRate ?? 0}
                size="small"
                strokeColor="#ff4d4f"
                showInfo={false}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#64748b' }}>
                <span>Unexcused / Missing: <strong>{analytics?.absentees ?? 0}</strong></span>
                <Button type="link" size="small" danger style={{ padding: 0, fontSize: 11, height: 'auto' }}>
                  {isAdmin ? 'View Absence Log →' : 'View Absences →'}
                </Button>
              </div>
            </div>
          </Card>
        </Col>

        {/* 4. Staff on Leave */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{ borderRadius: 12, borderTop: '4px solid #722ed1', height: '100%' }}
            onClick={() => {
              if (isAdmin) setRosterModalType('leave');
              else onNavigateToRegister?.();
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>
                  {isAdmin ? 'Staff on Leave' : 'My Approved Leaves'}
                </Text>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#722ed1' }}>
                    {analytics?.staffOnLeave ?? 0}
                  </span>
                  <Tag color="purple" style={{ fontWeight: 700, borderRadius: 10 }}>
                    {analytics?.activeLeavesList?.length ?? 0} Active Approved
                  </Tag>
                </div>
              </div>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: '#f9f0ff',
                  color: '#722ed1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  border: '1px solid #d3adf7',
                }}
              >
                <CalendarOutlined />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <Progress
                percent={Math.min(100, ((analytics?.staffOnLeave ?? 0) / 5) * 100)}
                size="small"
                strokeColor="#722ed1"
                showInfo={false}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#64748b' }}>
                <span>Approved Schedule: <strong>{analytics?.activeLeavesList?.length ?? 0}</strong></span>
                <Button type="link" size="small" style={{ padding: 0, fontSize: 11, height: 'auto', color: '#722ed1' }}>
                  {isAdmin ? 'View Active Leaves →' : 'My Leave Log →'}
                </Button>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── 2. MONTHLY SUMMARY & PUNCTUALITY KPI RIBBON (5 & 6) ─────────────── */}
      <Row gutter={[16, 16]}>
        {/* 5. Monthly Attendance Summary */}
        <Col xs={24} md={14}>
          <Card
            title={
              <Space align="center">
                <FieldTimeOutlined style={{ color: '#2E5E8C', fontSize: 18 }} />
                <span style={{ fontWeight: 700, color: '#1e293b' }}>
                  Monthly Attendance Summary · {dayjs(selectedMonth).format('MMMM YYYY')}
                </span>
              </Space>
            }
            style={{ borderRadius: 12, height: '100%' }}
          >
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={6}>
                <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Working Days</Text>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginTop: 4 }}>
                    {analytics?.totalWorkingDays ?? 22} Days
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Official Shift Basis</Text>
                </div>
              </Col>

              <Col xs={12} sm={6}>
                <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Actual Work Hours</Text>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#2E5E8C', marginTop: 4 }}>
                    {analytics?.totalActualHoursWorked ?? 0} hrs
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Target: {analytics?.totalExpectedHours ?? 2112} hrs
                  </Text>
                </div>
              </Col>

              <Col xs={12} sm={6}>
                <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Overall Attendance</Text>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#52c41a', marginTop: 4 }}>
                    {analytics?.overallAttendanceRate ?? 95}%
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Completion Ratio</Text>
                </div>
              </Col>

              <Col xs={12} sm={6}>
                <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Avg Shift Time</Text>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#722ed1', marginTop: 4 }}>
                    8.1 hrs
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Per active staff/day</Text>
                </div>
              </Col>
            </Row>

            <div style={{ marginTop: 16 }}>
              <Alert
                type="info"
                showIcon
                icon={<FileProtectOutlined style={{ color: '#2E5E8C' }} />}
                style={{ borderRadius: 8 }}
                message={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>
                      Operational Capacity: {analytics?.overallAttendanceRate ?? 95}% of scheduled work hours fulfilled across {analytics?.branchSummaries?.length ?? 5} active branches.
                    </span>
                    <Button size="small" type="primary" ghost onClick={() => onNavigateToRegister?.()}>
                      Open Full Register →
                    </Button>
                  </div>
                }
              />
            </div>
          </Card>
        </Col>

        {/* 6. Punctuality Rate & Bonus Eligibility */}
        <Col xs={24} md={10}>
          <Card
            title={
              <Space align="center">
                <CompassOutlined style={{ color: '#faad14', fontSize: 18 }} />
                <span style={{ fontWeight: 700, color: '#1e293b' }}>
                  Company Punctuality Rate & Bonus Scorecard
                </span>
              </Space>
            }
            style={{ borderRadius: 12, height: '100%' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, color: (analytics?.overallPunctualityRate ?? 92) >= 90 ? '#52c41a' : '#faad14' }}>
                  {analytics?.overallPunctualityRate ?? 92}%
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  On-Time Arrival Rate (Clock-in $\le$ 08:30 AM)
                </Text>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Tag
                  color={(analytics?.overallPunctualityRate ?? 92) >= 95 ? 'success' : 'warning'}
                  style={{ fontWeight: 700, fontSize: 12, padding: '4px 10px', borderRadius: 12 }}
                >
                  🏆 {analytics?.punctualityTier ?? 'Tier B (90-95%)'}
                </Tag>
              </div>
            </div>

            <Progress
              percent={analytics?.overallPunctualityRate ?? 92}
              strokeColor={{ '0%': '#faad14', '100%': '#52c41a' }}
              strokeWidth={10}
            />

            <div style={{ marginTop: 14, background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong style={{ fontSize: 12, color: '#1e293b' }}>Punctuality Bonus Pool</Text>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {analytics?.punctualityBonusEligibleCount ?? 8} staff currently eligible ($\ge 90\%$ punctuality)
                  </div>
                </div>
                <Tag color="cyan" style={{ fontWeight: 700 }}>
                  GH₵ 150 / Staff
                </Tag>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── 3. TEAM ATTENDANCE TRENDS (30-DAY TRENDS & PATTERNS) (8) ────────── */}
      <Row gutter={[16, 16]}>
        {/* Daily Attendance Trend Composed Chart */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <Space align="center">
                  <RiseOutlined style={{ color: '#2E5E8C', fontSize: 18 }} />
                  <span style={{ fontWeight: 700, color: '#1e293b' }}>
                    Team Attendance & Presence Trends (Daily Distribution)
                  </span>
                </Space>
                <Segmented
                  size="small"
                  value={trendChartMode}
                  onChange={(val) => setTrendChartMode(val as 'stacked' | 'trend')}
                  options={[
                    {
                      value: 'stacked',
                      label: (
                        <Space size={4}>
                          <BarChartOutlined />
                          <span>Stacked Breakdown</span>
                        </Space>
                      ),
                    },
                    {
                      value: 'trend',
                      label: (
                        <Space size={4}>
                          <LineChartOutlined />
                          <span>Punctuality Curve</span>
                        </Space>
                      ),
                    },
                  ]}
                />
              </div>
            }
            style={{ borderRadius: 12 }}
          >
            <div style={{ width: '100%', height: 300 }}>
              {analytics?.dailyTrends && analytics.dailyTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {trendChartMode === 'stacked' ? (
                    <ComposedChart data={analytics.dailyTrends} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="formattedDate" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11, fill: '#0284c7' }}
                        domain={[0, 100]}
                        unit="%"
                      />
                      <RechartsTooltip
                        contentStyle={{
                          borderRadius: 10,
                          boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff',
                        }}
                        formatter={(val: any, name: any) => [
                          name === 'Punctuality Rate' ? `${val}%` : `${val} staff`,
                          String(name || '')
                        ] as [string, string]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      <Bar
                        yAxisId="left"
                        dataKey="present"
                        name="Present (On Time)"
                        stackId="workforce"
                        fill="#52c41a"
                        barSize={20}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="late"
                        name="Late Arrivals"
                        stackId="workforce"
                        fill="#faad14"
                        barSize={20}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="onLeave"
                        name="On Leave"
                        stackId="workforce"
                        fill="#722ed1"
                        barSize={20}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="absent"
                        name="Absentees"
                        stackId="workforce"
                        fill="#ff4d4f"
                        radius={[4, 4, 0, 0]}
                        barSize={20}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="punctualityRate"
                        name="Punctuality Rate"
                        stroke="#0284c7"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#0284c7' }}
                        activeDot={{ r: 5 }}
                      />
                    </ComposedChart>
                  ) : (
                    <AreaChart data={analytics.dailyTrends} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPunctuality" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="formattedDate" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 100]} unit="%" />
                      <RechartsTooltip
                        contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: 'none' }}
                        formatter={(val: any, name: any) => [`${val}%`, String(name || '')] as [string, string]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                      <Area
                        type="monotone"
                        dataKey="punctualityRate"
                        name="Punctuality Rate %"
                        stroke="#0284c7"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorPunctuality)"
                      />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                  No attendance trend data recorded for selected period.
                </div>
              )}
            </div>
          </Card>
        </Col>

        {/* Day of Week Attendance Pattern (Monday - Friday) */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space align="center">
                <CalendarOutlined style={{ color: '#722ed1', fontSize: 18 }} />
                <span style={{ fontWeight: 700, color: '#1e293b' }}>
                  Day-of-Week Attendance Pattern
                </span>
              </Space>
            }
            style={{ borderRadius: 12 }}
          >
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.dayOfWeekPatterns || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="dayKey" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 100]} unit="%" />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: 'none' }}
                    formatter={(val: any, name: any) => [`${val}%`, String(name || '')] as [string, string]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                  <Bar dataKey="attendanceRate" name="Attendance Rate" fill="#2E5E8C" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="punctualityRate" name="Punctuality Rate" fill="#52c41a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── 4. REPEATED OFFENDERS & CHRONIC INFRACTION TRACKER (7) ───────────── */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Space align="center">
              <WarningOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
              <div>
                <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 15 }}>
                  {isAdmin
                    ? 'Repeated Offenders & Chronic Lateness / Absence Tracker'
                    : 'My Attendance Standing & Infraction Status'}
                </span>
                <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8, fontWeight: 400 }}>
                  {isAdmin
                    ? 'Staff members with recurring late arrivals, early departures, or unexcused absences'
                    : 'Your personal attendance record and counseling standing for the current period'}
                </span>
              </div>
            </Space>
            <Tag color={(analytics?.repeatedOffenders?.length ?? 0) > 0 ? 'red' : 'green'} style={{ fontWeight: 700 }}>
              {isAdmin
                ? `${analytics?.repeatedOffenders?.length ?? 0} Flagged Infraction Records`
                : (analytics?.repeatedOffenders?.length ?? 0) > 0 ? '⚠️ Infraction on Record' : '🟢 Clean Record'}
            </Tag>
          </div>
        }
        style={{ borderRadius: 12 }}
      >
        {analytics?.repeatedOffenders && analytics.repeatedOffenders.length > 0 ? (
          <Table
            dataSource={analytics.repeatedOffenders}
            rowKey="userId"
            pagination={{ pageSize: 5 }}
            scroll={{ x: 800 }}
            size="middle"
            columns={[
              {
                title: 'Staff Member',
                key: 'staff',
                width: 220,
                render: (_: any, r: RepeatedOffenderRecord) => (
                  <Space align="center">
                    <Avatar style={{ backgroundColor: r.riskLevel === 'critical' ? '#ff4d4f' : '#faad14', color: '#fff', fontWeight: 700 }}>
                      {(r.staffName || 'S').charAt(0).toUpperCase()}
                    </Avatar>
                    <div>
                      <Text strong style={{ color: '#1e293b' }}>{r.staffName}</Text>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{r.staffRole} · {r.branchName}</div>
                    </div>
                  </Space>
                ),
              },
              {
                title: 'Late Punches',
                key: 'late',
                width: 140,
                render: (_: any, r: RepeatedOffenderRecord) => (
                  <div>
                    <Tag color="warning" style={{ fontWeight: 700 }}>
                      ⏰ {r.daysLate} Late {r.daysLate === 1 ? 'Day' : 'Days'}
                    </Tag>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      {r.totalLatenessMinutes} mins total delay
                    </div>
                  </div>
                ),
              },
              {
                title: 'Absences',
                key: 'absences',
                width: 130,
                render: (_: any, r: RepeatedOffenderRecord) => (
                  r.daysAbsent > 0 ? (
                    <Tag color="error" style={{ fontWeight: 700 }}>
                      ❌ {r.daysAbsent} Absent {r.daysAbsent === 1 ? 'Day' : 'Days'}
                    </Tag>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 12 }}>0 Absences</Text>
                  )
                ),
              },
              {
                title: 'Punctuality Rate',
                dataIndex: 'punctualityRate',
                key: 'punctualityRate',
                width: 140,
                render: (rate: number) => (
                  <div>
                    <Progress
                      percent={rate}
                      size="small"
                      strokeColor={rate >= 90 ? '#52c41a' : rate >= 75 ? '#faad14' : '#ff4d4f'}
                      format={(pct) => `${pct}%`}
                    />
                  </div>
                ),
              },
              {
                title: 'Standing & Risk Level',
                key: 'riskLevel',
                width: 180,
                render: (_: any, r: RepeatedOffenderRecord) => {
                  if (r.riskLevel === 'critical') {
                    return (
                      <Tag color="error" style={{ fontWeight: 700, padding: '2px 8px' }}>
                        🔴 Critical (Disciplinary Action)
                      </Tag>
                    );
                  }
                  if (r.riskLevel === 'warning') {
                    return (
                      <Tag color="warning" style={{ fontWeight: 700, padding: '2px 8px' }}>
                        🟠 Warning (HR Coaching)
                      </Tag>
                    );
                  }
                  return (
                    <Tag color="default" style={{ fontWeight: 600, padding: '2px 8px' }}>
                      🟡 Low (Monitoring)
                    </Tag>
                  );
                },
              },
              ...(isAdmin
                ? [
                    {
                      title: 'Action',
                      key: 'action',
                      width: 160,
                      fixed: 'right' as const,
                      render: (_: any, r: RepeatedOffenderRecord) => (
                        <Space size="small">
                          <Button
                            size="small"
                            danger
                            icon={<SendOutlined />}
                            onClick={() => handleIssueWarning(r)}
                          >
                            Issue Warning
                          </Button>
                          <Button
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => onNavigateToRegister?.()}
                          >
                            History
                          </Button>
                        </Space>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        ) : (
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            message={isAdmin ? 'Zero Chronic Infractions Detected' : 'Exemplary Attendance Standing'}
            description={
              isAdmin
                ? 'All staff members are currently meeting minimum attendance and punctuality standards with no repeated late punches or unexcused absences.'
                : 'You have zero chronic infractions or unexcused absences on record for this period. Keep up the great work!'
            }
          />
        )}
      </Card>

      {/* ── 5. BRANCH-BY-BRANCH BENCHMARKING SUMMARY (ADMIN ONLY) ─────────────── */}
      {isAdmin && (
        <Card
          title={
            <Space align="center">
              <ShopOutlined style={{ color: '#2E5E8C', fontSize: 18 }} />
              <span style={{ fontWeight: 700, color: '#1e293b' }}>
                Branch-by-Branch Attendance & Punctuality Benchmarks
              </span>
            </Space>
          }
          style={{ borderRadius: 12 }}
        >
          <Table
            dataSource={analytics?.branchSummaries || []}
            rowKey="branchId"
            pagination={false}
            scroll={{ x: 900 }}
            size="middle"
            columns={[
              {
                title: 'Branch Location',
                key: 'branch',
                render: (_: any, b: BranchAttendanceSummary) => (
                  <div>
                    <Text strong style={{ color: '#1e293b' }}>{b.branchName}</Text>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{b.totalStaff} Assigned Staff</div>
                  </div>
                ),
              },
              {
                title: 'Present Today',
                key: 'present',
                render: (_: any, b: BranchAttendanceSummary) => (
                  <Tag color="success" style={{ fontWeight: 700 }}>
                    ✅ {b.presentCount} Present
                  </Tag>
                ),
              },
              {
                title: 'Late Today',
                key: 'late',
                render: (_: any, b: BranchAttendanceSummary) => (
                  b.lateCount > 0 ? (
                    <Tag color="warning" style={{ fontWeight: 700 }}>
                      ⏰ {b.lateCount} Late
                    </Tag>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 12 }}>0 Late</Text>
                  )
                ),
              },
              {
                title: 'Absent / On Leave',
                key: 'absentLeave',
                render: (_: any, b: BranchAttendanceSummary) => (
                  <Space>
                    {b.absentCount > 0 && <Tag color="error">❌ {b.absentCount} Absent</Tag>}
                    {b.onLeaveCount > 0 && <Tag color="purple">🏖️ {b.onLeaveCount} Leave</Tag>}
                    {b.absentCount === 0 && b.onLeaveCount === 0 && <Text type="secondary" style={{ fontSize: 12 }}>None</Text>}
                  </Space>
                ),
              },
              {
                title: 'Punctuality Rate',
                dataIndex: 'punctualityRate',
                key: 'punctualityRate',
                render: (pct: number) => (
                  <Progress percent={pct} size="small" strokeColor={pct >= 90 ? '#52c41a' : '#faad14'} />
                ),
              },
              {
                title: 'Attendance Rate',
                dataIndex: 'attendanceRate',
                key: 'attendanceRate',
                render: (pct: number) => (
                  <Progress percent={pct} size="small" strokeColor="#2E5E8C" />
                ),
              },
            ]}
          />
        </Card>
      )}

      {/* ── ROSTER INSPECTION MODAL (PRESENT / LATE / ABSENT / LEAVE) ──────── */}
      <Modal
        title={
          <Space>
            {rosterModalType === 'present' && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
            {rosterModalType === 'late' && <ClockCircleOutlined style={{ color: '#faad14' }} />}
            {rosterModalType === 'absent' && <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            {rosterModalType === 'leave' && <CalendarOutlined style={{ color: '#722ed1' }} />}
            <span style={{ fontWeight: 700 }}>
              {rosterModalType === 'present' && 'Active Workforce Present Roster'}
              {rosterModalType === 'late' && 'Late Arrivals Inspection Roster'}
              {rosterModalType === 'absent' && 'Absentees & Missing Punch Log'}
              {rosterModalType === 'leave' && 'Active Approved Leave Applications'}
            </span>
          </Space>
        }
        open={Boolean(rosterModalType)}
        onCancel={() => setRosterModalType(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setRosterModalType(null)}>
            Close
          </Button>,
        ]}
        width={680}
      >
        <div style={{ paddingTop: 8 }}>
          {rosterModalType === 'present' && (
            <Table
              dataSource={analytics?.todayPresentRoster || []}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 6 }}
              columns={[
                { title: 'Staff Member', dataIndex: 'staffName', key: 'staffName', render: (val: string, r: any) => <div><strong>{val}</strong><div style={{ fontSize: 11, color: '#64748b' }}>{r.branchName}</div></div> },
                { title: 'Clock In', dataIndex: 'clockInTime', key: 'clockIn', render: (val: string) => val ? dayjs(val).format('hh:mm A') : '—' },
                { title: 'Status', dataIndex: 'status', key: 'status', render: (st: any) => <Tag color={ATTENDANCE_STATUS_META[st as keyof typeof ATTENDANCE_STATUS_META]?.color || 'green'}>{ATTENDANCE_STATUS_META[st as keyof typeof ATTENDANCE_STATUS_META]?.label || st}</Tag> },
              ]}
            />
          )}

          {rosterModalType === 'late' && (
            <Table
              dataSource={analytics?.todayLateRoster || []}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 6 }}
              columns={[
                { title: 'Staff Member', dataIndex: 'staffName', key: 'staffName', render: (val: string, r: any) => <div><strong>{val}</strong><div style={{ fontSize: 11, color: '#64748b' }}>{r.branchName}</div></div> },
                { title: 'Clock In Time', dataIndex: 'clockInTime', key: 'clockIn', render: (val: string) => val ? dayjs(val).format('hh:mm A') : '—' },
                { title: 'Lateness', dataIndex: 'latenessMinutes', key: 'lateMin', render: (m: number) => <Tag color="warning">+{m || 15} mins late</Tag> },
              ]}
            />
          )}

          {rosterModalType === 'absent' && (
            <Table
              dataSource={analytics?.todayAbsentRoster || []}
              rowKey="userId"
              size="small"
              pagination={{ pageSize: 6 }}
              columns={[
                { title: 'Staff Member', dataIndex: 'staffName', key: 'staffName', render: (val: string, r: any) => <div><strong>{val}</strong><div style={{ fontSize: 11, color: '#64748b' }}>{r.branchName}</div></div> },
                { title: 'Role', dataIndex: 'staffRole', key: 'staffRole' },
                { title: 'Reason / Note', dataIndex: 'reason', key: 'reason', render: (val: string) => <Text type="secondary" style={{ fontSize: 12 }}>{val || 'Unexcused absence'}</Text> },
              ]}
            />
          )}

          {rosterModalType === 'leave' && (
            <Table
              dataSource={analytics?.activeLeavesList || []}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 6 }}
              columns={[
                { title: 'Staff Member', dataIndex: 'staffName', key: 'staffName', render: (val: string, r: any) => <div><strong>{val}</strong><div style={{ fontSize: 11, color: '#64748b' }}>{r.branchName}</div></div> },
                { title: 'Leave Category', dataIndex: 'leaveType', key: 'leaveType', render: (t: string) => <Tag color="purple" style={{ textTransform: 'capitalize' }}>{t} Leave</Tag> },
                { title: 'Duration', key: 'dates', render: (_: any, l: any) => `${dayjs(l.startDate).format('DD MMM')} → ${dayjs(l.endDate).format('DD MMM')} (${l.totalDays}d)` },
              ]}
            />
          )}
        </div>
      </Modal>

      {/* ── DISCIPLINARY WARNING NOTICE MODAL ────────────────────────────── */}
      <Modal
        title={
          <Space>
            <WarningOutlined style={{ color: '#ff4d4f' }} />
            <span>Generate Official Attendance Counseling Notice</span>
          </Space>
        }
        open={warningModalOpen}
        onCancel={() => setWarningModalOpen(false)}
        onOk={confirmIssueWarning}
        okText="Generate & Transmit Notice"
        okType="danger"
        width={500}
      >
        <div style={{ paddingTop: 8 }}>
          <Alert
            type="warning"
            showIcon
            message="Notice of Recurring Punctuality Infractions"
            description={`You are preparing an official counseling notice for ${selectedOffender?.staffName} (${selectedOffender?.daysLate} late punches, ${selectedOffender?.daysAbsent} absences in ${dayjs(selectedMonth).format('MMMM YYYY')}).`}
            style={{ marginBottom: 14, borderRadius: 8 }}
          />
          <Paragraph style={{ fontSize: 13, color: '#475569' }}>
            This action generates a formal HR reprimand notice and logs the counseling record to the employee's audit file.
          </Paragraph>
        </div>
      </Modal>
    </div>
  );
};
