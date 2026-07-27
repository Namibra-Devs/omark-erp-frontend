// src/pages/branches/BranchDashboard.tsx
// ⚠️ PROTOTYPE — see src/mock/branches.ts. Sample data only.
//
// Per-branch dashboard showing the 8 sections from the spec: today's
// leads, appointments, payments received, pending tasks, attendance
// status, branch expenses, open documents, active projects. Every
// document/transaction reference uses the BRANCHCODE-TYPE-YEAR-### coded
// format (e.g. KMA-SALE-2026-001) so records stay easy to track.
//
// Also supports the filter spec (date range / branch / department / user /
// project / property type) and tags each open document with whether the
// branch manager can approve it locally or it needs Head Office sign-off
// (see src/mock/governance.ts for the approval-limit rules).
import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  List,
  message,
  Progress,
  Result,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  ProjectOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/shared/PageHeader';
import { MockDataBanner } from '@/components/shared/MockDataBanner';
import { tokens } from '@/constants/tokens';
import { useBranchContext } from '@/contexts/BranchContext';
import {
  getBranchAppointments,
  getBranchAttendance,
  getBranchDocuments,
  getBranchExpenseEntries,
  getBranchLeads,
  getBranchMetrics,
  getBranchPayments,
  getBranchProjects,
  getBranchTasks,
  mockBranchDepartments,
  mockPropertyTypes,
} from '@/mock/branches';
import { documentRequiresHQApproval, expenseRequiresHQApproval, getApprovalLimit } from '@/mock/governance';
import { setApprovalOverride, useApprovalOverrides } from '@/mock/approvalStore';
import { BranchFilterBar, EMPTY_FILTERS, type BranchFilterValues } from './components/BranchFilterBar';

const { Text } = Typography;

const appointmentStatusColor: Record<string, string> = {
  scheduled: 'blue',
  completed: 'green',
  canceled: 'red',
};

const attendanceStatusColor: Record<string, string> = {
  present: 'green',
  late: 'gold',
  absent: 'red',
  on_leave: 'purple',
};

const taskPriorityColor: Record<string, string> = {
  high: 'red',
  medium: 'gold',
  low: 'default',
};

const projectStatusColor: Record<string, string> = {
  on_track: 'green',
  at_risk: 'gold',
  delayed: 'red',
};

const inRange = (date: string | undefined, range: [string, string] | null) =>
  !range || !date || (date >= range[0] && date <= range[1]);

export const BranchDashboard: React.FC = () => {
  const { branchId } = useParams<{ branchId: string }>();
  const navigate = useNavigate();
  const { branches } = useBranchContext();
  const [filters, setFilters] = useState<BranchFilterValues>(EMPTY_FILTERS);
  const overrides = useApprovalOverrides();

  const branch = branches.find((b) => b.id === branchId);

  const metrics = branch ? getBranchMetrics(branch.id) : null;
  const allLeads = branch ? getBranchLeads(branch.id) : [];
  const allAppointments = branch ? getBranchAppointments(branch.id) : [];
  const allPayments = branch ? getBranchPayments(branch.id) : [];
  const allTasks = branch ? getBranchTasks(branch.id) : [];
  const allAttendance = branch ? getBranchAttendance(branch.id) : [];
  const allExpenses = branch ? getBranchExpenseEntries(branch.id) : [];
  const allDocuments = branch ? getBranchDocuments(branch.id) : [];
  const allProjects = branch ? getBranchProjects(branch.id) : [];
  const approvalLimit = branch ? getApprovalLimit(branch.id) : null;

  const users = useMemo(() => {
    const names = new Set<string>();
    allLeads.forEach((l) => names.add(l.handledBy));
    allAppointments.forEach((a) => names.add(a.handledBy));
    allPayments.forEach((p) => names.add(p.receivedBy));
    allTasks.forEach((t) => names.add(t.assignee));
    allAttendance.forEach((a) => names.add(a.staffName));
    allDocuments.forEach((d) => names.add(d.submittedBy));
    return Array.from(names).map((name) => ({ name }));
  }, [allLeads, allAppointments, allPayments, allTasks, allAttendance, allDocuments]);

  const projectOptions = allProjects.map((p) => ({ id: p.id, name: p.name, code: p.code }));

  const leads = allLeads.filter((l) =>
    inRange(l.date, filters.dateRange) &&
    (!filters.departmentId || l.departmentId === filters.departmentId) &&
    (!filters.userName || l.handledBy === filters.userName)
  );
  const appointments = allAppointments.filter((a) =>
    inRange(a.date, filters.dateRange) &&
    (!filters.departmentId || a.departmentId === filters.departmentId) &&
    (!filters.userName || a.handledBy === filters.userName)
  );
  const payments = allPayments.filter((p) =>
    inRange(p.date, filters.dateRange) &&
    (!filters.departmentId || p.departmentId === filters.departmentId) &&
    (!filters.userName || p.receivedBy === filters.userName) &&
    (!filters.projectId || p.projectId === filters.projectId)
  );
  const tasks = allTasks.filter((t) =>
    inRange(t.date, filters.dateRange) &&
    (!filters.departmentId || t.departmentId === filters.departmentId) &&
    (!filters.userName || t.assignee === filters.userName)
  );
  const attendance = allAttendance.filter((a) => !filters.userName || a.staffName === filters.userName);
  const expenses = allExpenses.filter((e) =>
    inRange(e.date, filters.dateRange) &&
    (!filters.departmentId || e.departmentId === filters.departmentId)
  );
  const documents = allDocuments.filter((d) =>
    inRange(d.date, filters.dateRange) &&
    (!filters.departmentId || d.departmentId === filters.departmentId) &&
    (!filters.userName || d.submittedBy === filters.userName) &&
    (!filters.projectId || d.projectId === filters.projectId) &&
    (!filters.propertyType || d.propertyType === filters.propertyType)
  );
  const projects = allProjects.filter((p) =>
    (!filters.projectId || p.id === filters.projectId) &&
    (!filters.propertyType || p.propertyType === filters.propertyType)
  );

  if (!branch || !metrics || !approvalLimit) {
    return (
      <Result
        status="404"
        title="Branch not found"
        subTitle="This branch may have been removed from the prototype's local list."
        extra={<Button type="primary" onClick={() => navigate('/branches')}>Back to Branches</Button>}
      />
    );
  }

  const paymentsTotalMinor = payments.reduce((sum, p) => sum + p.amountMinor, 0);
  const expensesTotalMinor = expenses.reduce((sum, e) => sum + e.amountMinor, 0);
  const presentCount = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;

  const decide = (recordId: string, decision: 'approved' | 'rejected', label: string) => {
    setApprovalOverride(recordId, decision, 'branch_manager');
    message.success(`${label} ${decision} by branch manager (mock — not sent anywhere).`);
  };

  return (
    <div>
      <PageHeader
        title={branch.name}
        actions={[{ label: 'All Branches', onClick: () => navigate('/branches'), icon: <ArrowLeftOutlined /> }]}
      />
      <MockDataBanner />

      <Card style={{ marginBottom: 24 }}>
        <Descriptions column={{ xs: 1, sm: 2, md: 5 }}>
          <Descriptions.Item label="Code"><Tag color={tokens.primary}>{branch.code}</Tag></Descriptions.Item>
          <Descriptions.Item label={<span><EnvironmentOutlined /> Location</span>}>{branch.location}</Descriptions.Item>
          <Descriptions.Item label={<span><UserOutlined /> Manager</span>}>{branch.managerName}</Descriptions.Item>
          <Descriptions.Item label={<span><PhoneOutlined /> Phone</span>}><a href={`tel:${branch.phone}`}>{branch.phone}</a></Descriptions.Item>
          <Descriptions.Item label="Staff">{branch.staffCount}</Descriptions.Item>
        </Descriptions>
      </Card>

      <BranchFilterBar
        value={filters}
        onChange={setFilters}
        departments={mockBranchDepartments}
        users={users}
        projects={projectOptions}
        propertyTypes={mockPropertyTypes}
      />

      {/* Quick stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Leads (sample)" value={leads.length} prefix={<UserAddOutlined />} valueStyle={{ color: tokens.primary }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Payments Received (sample)" value={paymentsTotalMinor / 100} prefix="GHS" precision={2} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Branch Expenses (sample)" value={expensesTotalMinor / 100} prefix="GHS" precision={2} valueStyle={{ color: '#ff4d4f' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Attendance (sample)" value={metrics.attendanceRatePercent} suffix="%" prefix={<ClockCircleOutlined />} valueStyle={{ color: '#722ed1' }} /></Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        {/* Today's Leads */}
        <Col xs={24} lg={12}>
          <Card title={<span><UserAddOutlined style={{ marginRight: 8 }} />Leads (sample)</span>} style={{ marginBottom: 24 }}>
            {leads.length > 0 ? (
              <List
                dataSource={leads}
                renderItem={(lead) => (
                  <List.Item extra={<Tag>{lead.code}</Tag>}>
                    <List.Item.Meta
                      avatar={<Avatar icon={<UserOutlined />} />}
                      title={lead.name}
                      description={`${lead.source} · ${lead.phone} · ${lead.date} ${lead.time} · ${lead.handledBy}`}
                    />
                  </List.Item>
                )}
              />
            ) : <Text type="secondary">No leads match the current filters.</Text>}
          </Card>

          {/* Appointments */}
          <Card title={<span><CalendarOutlined style={{ marginRight: 8 }} />Appointments (sample)</span>} style={{ marginBottom: 24 }}>
            {appointments.length > 0 ? (
              <List
                dataSource={appointments}
                renderItem={(a) => (
                  <List.Item extra={<Tag color={appointmentStatusColor[a.status]}>{a.status.replace('_', ' ')}</Tag>}>
                    <List.Item.Meta title={`${a.clientName} — ${a.date} ${a.time}`} description={`${a.code} · ${a.handledBy}`} />
                  </List.Item>
                )}
              />
            ) : <Text type="secondary">No appointments match the current filters.</Text>}
          </Card>

          {/* Payments Received */}
          <Card title={<span><DollarOutlined style={{ marginRight: 8 }} />Payments Received (sample)</span>} style={{ marginBottom: 24 }}>
            {payments.length > 0 ? (
              <List
                dataSource={payments}
                renderItem={(p) => (
                  <List.Item extra={<Text strong>GHS {(p.amountMinor / 100).toLocaleString()}</Text>}>
                    <List.Item.Meta title={p.customerName} description={`${p.code} · ${p.method} · ${p.date} · ${p.receivedBy}`} />
                  </List.Item>
                )}
              />
            ) : <Text type="secondary">No payments match the current filters.</Text>}
          </Card>

          {/* Pending Tasks */}
          <Card title={<span><CheckCircleOutlined style={{ marginRight: 8 }} />Pending Tasks (sample)</span>}>
            {tasks.length > 0 ? (
              <List
                dataSource={tasks}
                renderItem={(t) => (
                  <List.Item extra={<Tag color={taskPriorityColor[t.priority]}>{t.priority}</Tag>}>
                    <List.Item.Meta title={t.title} description={`${t.assignee} · Due: ${t.dueDate}`} />
                  </List.Item>
                )}
              />
            ) : <Text type="secondary">No tasks match the current filters.</Text>}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          {/* Attendance Status */}
          <Card
            title={<span><TeamOutlined style={{ marginRight: 8 }} />Attendance Status (sample)</span>}
            extra={<Text type="secondary">{presentCount}/{attendance.length} in today</Text>}
            style={{ marginBottom: 24 }}
          >
            {attendance.length > 0 ? (
              <List
                dataSource={attendance}
                renderItem={(a) => (
                  <List.Item extra={<Tag color={attendanceStatusColor[a.status]}>{a.status.replace('_', ' ')}</Tag>}>
                    <List.Item.Meta
                      avatar={<Badge status={a.status === 'present' ? 'success' : a.status === 'late' ? 'warning' : 'default'} />}
                      title={a.staffName}
                      description={a.checkInTime ? `Checked in ${a.checkInTime}` : '—'}
                    />
                  </List.Item>
                )}
              />
            ) : <Text type="secondary">No attendance records match the current filters.</Text>}
          </Card>

          {/* Branch Expenses */}
          <Card title={<span><DollarOutlined style={{ marginRight: 8 }} />Branch Expenses (sample)</span>} style={{ marginBottom: 24 }}>
            {expenses.length > 0 ? (
              <List
                dataSource={expenses}
                renderItem={(e) => {
                  const override = overrides[e.id];
                  const needsHQ = expenseRequiresHQApproval(branch.id, e.amountMinor);
                  return (
                    <List.Item
                      extra={
                        <Space direction="vertical" align="end" size={4}>
                          <Text strong>GHS {(e.amountMinor / 100).toLocaleString()}</Text>
                          {override ? (
                            <Tag color={override.decision === 'approved' ? 'green' : 'red'}>
                              {override.decision} · {override.decidedBy === 'head_office' ? 'HQ' : 'Branch Mgr'}
                            </Tag>
                          ) : needsHQ ? (
                            <Tag color="red" style={{ fontSize: 11 }}>Needs HQ approval</Tag>
                          ) : (
                            <Space size={4}>
                              <Button size="small" type="primary" onClick={() => decide(e.id, 'approved', e.category)}>Approve</Button>
                              <Button size="small" danger onClick={() => decide(e.id, 'rejected', e.category)}>Reject</Button>
                            </Space>
                          )}
                        </Space>
                      }
                    >
                      <List.Item.Meta title={e.category} description={`${e.code} · ${e.date}`} />
                    </List.Item>
                  );
                }}
              />
            ) : <Text type="secondary">No expenses match the current filters.</Text>}
          </Card>

          {/* Open Documents */}
          <Card
            title={<span><FileTextOutlined style={{ marginRight: 8 }} />Open Documents (sample)</span>}
            extra={<Button type="link" size="small" onClick={() => navigate('/head-office/approvals')}>Approval rules</Button>}
            style={{ marginBottom: 24 }}
          >
            {documents.length > 0 ? (
              <List
                dataSource={documents}
                renderItem={(d) => {
                  const override = overrides[d.id];
                  const needsHQ = documentRequiresHQApproval(branch.id, d.amountMinor);
                  return (
                    <List.Item
                      extra={
                        <Space direction="vertical" align="end" size={4}>
                          {override ? (
                            <Tag color={override.decision === 'approved' ? 'green' : 'red'}>
                              {override.decision} · {override.decidedBy === 'head_office' ? 'Head Office' : 'Branch Manager'} · {override.decidedAt}
                            </Tag>
                          ) : needsHQ ? (
                            <>
                              <Tag color="red" style={{ fontSize: 11 }}>Needs Head Office approval</Tag>
                              <Button size="small" onClick={() => navigate('/head-office/approvals')}>Send to Head Office</Button>
                            </>
                          ) : (
                            <>
                              <Tag color="blue" style={{ fontSize: 11 }}>Branch manager can approve</Tag>
                              <Space size={4}>
                                <Button size="small" type="primary" onClick={() => decide(d.id, 'approved', d.title)}>Approve</Button>
                                <Button size="small" danger onClick={() => decide(d.id, 'rejected', d.title)}>Reject</Button>
                              </Space>
                            </>
                          )}
                        </Space>
                      }
                    >
                      <List.Item.Meta title={d.title} description={`${d.code} · Submitted by ${d.submittedBy} · ${d.propertyType}`} />
                    </List.Item>
                  );
                }}
              />
            ) : <Text type="secondary">No documents match the current filters.</Text>}
          </Card>

          {/* Active Projects */}
          <Card title={<span><ProjectOutlined style={{ marginRight: 8 }} />Active Projects (sample)</span>}>
            {projects.length > 0 ? (
              <List
                dataSource={projects}
                renderItem={(p) => (
                  <List.Item>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Space size={6}>
                          <Text strong>{p.name}</Text>
                          <Tag>{p.code}</Tag>
                          <Tag color="purple">{p.propertyType}</Tag>
                        </Space>
                        <Tag color={projectStatusColor[p.status]}>{p.status.replace('_', ' ')}</Tag>
                      </div>
                      <Progress percent={p.progressPercent} size="small" strokeColor={tokens.primary} />
                      <Text type="secondary" style={{ fontSize: 12 }}>Due {p.dueDate}</Text>
                    </div>
                  </List.Item>
                )}
              />
            ) : <Text type="secondary">No projects match the current filters.</Text>}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
