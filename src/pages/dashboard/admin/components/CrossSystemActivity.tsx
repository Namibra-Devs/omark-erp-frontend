// src/pages/dashboard/admin/components/CrossSystemActivity.tsx
// Live operational summary cards for Accounts, Finance, Complaints & Governance Approvals.
import React, { useState, useMemo } from 'react';
import {
  Card,
  Col,
  Row,
  Statistic,
  Tag,
  Typography,
  Modal,
  Table,
  Button,
  Space,
  Input,
  Badge,
} from 'antd';
import {
  ExperimentOutlined,
  IdcardOutlined,
  MessageOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getStoredExpenses, type ExpenseEntity } from '@/api/expenses';
import { getStoredStaffBonuses, type StaffBonusRecord } from '@/api/bonuses';
import { getStoredComplaints, type ComplaintEntity } from '@/api/complaints';
import { getStoredApprovals, type ApprovalItem } from '@/api/approvals';
import type { MockActivityStats } from '../hooks/useMockActivityFeed';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface CrossSystemActivityProps {
  stats: MockActivityStats;
  /** Name of the branch this data is scoped to, if the viewer is assigned to one. */
  branchName?: string;
}

type DrillDownType = 'expenses' | 'bonuses' | 'complaints' | 'approvals' | null;

export const CrossSystemActivity: React.FC<CrossSystemActivityProps> = ({ stats, branchName }) => {
  const navigate = useNavigate();
  const [drillDown, setDrillDown] = useState<DrillDownType>(null);
  const [modalSearch, setModalSearch] = useState('');

  // Live collections for modal drill-down
  const expenses = useMemo(() => getStoredExpenses(), [drillDown]);
  const bonuses = useMemo(() => getStoredStaffBonuses(), [drillDown]);
  const complaints = useMemo(() => getStoredComplaints(), [drillDown]);
  const approvals = useMemo(() => getStoredApprovals(), [drillDown]);

  // Filtered lists based on search inside modal
  const filteredExpenses = useMemo(() => {
    if (!modalSearch.trim()) return expenses;
    const q = modalSearch.toLowerCase();
    return expenses.filter(
      (e) =>
        e.category?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.code?.toLowerCase().includes(q) ||
        e.branchName?.toLowerCase().includes(q)
    );
  }, [expenses, modalSearch]);

  const filteredBonuses = useMemo(() => {
    if (!modalSearch.trim()) return bonuses;
    const q = modalSearch.toLowerCase();
    return bonuses.filter(
      (b) =>
        b.staffName?.toLowerCase().includes(q) ||
        b.ruleName?.toLowerCase().includes(q) ||
        b.reason?.toLowerCase().includes(q) ||
        b.branchName?.toLowerCase().includes(q)
    );
  }, [bonuses, modalSearch]);

  const filteredComplaints = useMemo(() => {
    if (!modalSearch.trim()) return complaints;
    const q = modalSearch.toLowerCase();
    return complaints.filter(
      (c) =>
        c.customerName?.toLowerCase().includes(q) ||
        c.subject?.toLowerCase().includes(q) ||
        c.message?.toLowerCase().includes(q)
    );
  }, [complaints, modalSearch]);

  const filteredApprovals = useMemo(() => {
    if (!modalSearch.trim()) return approvals;
    const q = modalSearch.toLowerCase();
    return approvals.filter(
      (a) =>
        a.title?.toLowerCase().includes(q) ||
        a.requestedBy?.toLowerCase().includes(q) ||
        a.branchName?.toLowerCase().includes(q) ||
        a.reason?.toLowerCase().includes(q)
    );
  }, [approvals, modalSearch]);

  const handleOpenModal = (type: DrillDownType) => {
    setModalSearch('');
    setDrillDown(type);
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <Title level={5} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span>Accounts, Finance & Branch Activity</span>
        <Tag color="green" style={{ fontWeight: 500, borderRadius: 4 }}>
          <CheckCircleOutlined style={{ marginRight: 4 }} />
          Live & Synced
        </Tag>
        {branchName && (
          <Tag color="blue" style={{ fontWeight: 500, borderRadius: 4 }}>
            Scoped to {branchName}
          </Tag>
        )}
      </Title>

      <Row gutter={[16, 16]}>
        {/* Card 1: Total Expenses */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{
              borderRadius: 10,
              borderTop: '3px solid #ff4d4f',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              cursor: 'pointer',
              height: '100%',
            }}
            onClick={() => handleOpenModal('expenses')}
          >
            <Statistic
              title={
                <span style={{ fontWeight: 600, color: '#595959', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ExperimentOutlined style={{ color: '#ff4d4f' }} /> Total Expenses
                </span>
              }
              value={stats.totalExpensesMinor / 100}
              prefix="GHS"
              precision={2}
              valueStyle={{ color: '#ff4d4f', fontSize: 22, fontWeight: 700 }}
            />
            <div style={{ marginTop: 8, fontSize: 11, color: '#8c8c8c' }}>
              Internal: GHS {(stats.internalExpensesMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} · External: GHS {(stats.externalExpensesMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: '#1890ff', fontWeight: 500 }}>
              Click to view itemized expenses →
            </div>
          </Card>
        </Col>

        {/* Card 2: Bonuses Paid */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{
              borderRadius: 10,
              borderTop: '3px solid #52c41a',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              cursor: 'pointer',
              height: '100%',
            }}
            onClick={() => handleOpenModal('bonuses')}
          >
            <Statistic
              title={
                <span style={{ fontWeight: 600, color: '#595959', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IdcardOutlined style={{ color: '#52c41a' }} /> Bonuses & Commissions
                </span>
              }
              value={stats.totalBonusesMinor / 100}
              prefix="GHS"
              precision={2}
              valueStyle={{ color: '#52c41a', fontSize: 22, fontWeight: 700 }}
            />
            <div style={{ marginTop: 8, fontSize: 11, color: '#8c8c8c' }}>
              Staff conversion awards, commissions & punctuality streaks
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: '#1890ff', fontWeight: 500 }}>
              Click to view staff bonus breakdown →
            </div>
          </Card>
        </Col>

        {/* Card 3: Open Complaints */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{
              borderRadius: 10,
              borderTop: `3px solid ${stats.openComplaintsCount > 0 ? '#faad14' : '#52c41a'}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              cursor: 'pointer',
              height: '100%',
            }}
            onClick={() => handleOpenModal('complaints')}
          >
            <Statistic
              title={
                <span style={{ fontWeight: 600, color: '#595959', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MessageOutlined style={{ color: stats.openComplaintsCount > 0 ? '#faad14' : '#52c41a' }} /> Open Complaints
                </span>
              }
              value={stats.openComplaintsCount}
              valueStyle={{
                color: stats.openComplaintsCount > 0 ? '#faad14' : '#52c41a',
                fontSize: 22,
                fontWeight: 700,
              }}
            />
            <div style={{ marginTop: 8, fontSize: 11, color: '#8c8c8c' }}>
              Customer inquiries & service tickets requiring resolution
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: '#1890ff', fontWeight: 500 }}>
              Click to view customer service tickets →
            </div>
          </Card>
        </Col>

        {/* Card 4: Pending Approvals */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{
              borderRadius: 10,
              borderTop: `3px solid ${stats.pendingApprovalsCount > 0 ? '#1890ff' : '#52c41a'}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              cursor: 'pointer',
              height: '100%',
            }}
            onClick={() => handleOpenModal('approvals')}
          >
            <Statistic
              title={
                <span style={{ fontWeight: 600, color: '#595959', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AuditOutlined style={{ color: stats.pendingApprovalsCount > 0 ? '#1890ff' : '#52c41a' }} /> Pending Approvals
                </span>
              }
              value={stats.pendingApprovalsCount}
              valueStyle={{
                color: stats.pendingApprovalsCount > 0 ? '#1890ff' : '#52c41a',
                fontSize: 22,
                fontWeight: 700,
              }}
            />
            <div style={{ marginTop: 8, fontSize: 11, color: '#8c8c8c' }}>
              Branch expenditures & pricing overrides awaiting head office sign-off
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: '#1890ff', fontWeight: 500 }}>
              Click to review governance approvals →
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── DRILL-DOWN MODAL ──────────────────────────────────────────────── */}
      <Modal
        open={drillDown !== null}
        onCancel={() => setDrillDown(null)}
        width={850}
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
            <span>
              {drillDown === 'expenses' && '💰 Total Operational Expenses'}
              {drillDown === 'bonuses' && '🏆 Staff Bonuses & Commissions'}
              {drillDown === 'complaints' && '💬 Customer Service Complaints'}
              {drillDown === 'approvals' && '🛡️ Branch Governance Approvals'}
            </span>
            {drillDown === 'expenses' && (
              <Button type="primary" size="small" onClick={() => { setDrillDown(null); navigate('/accounts/expenses'); }}>
                Open Expenses Management <ArrowRightOutlined />
              </Button>
            )}
            {drillDown === 'bonuses' && (
              <Button type="primary" size="small" onClick={() => { setDrillDown(null); navigate('/accounts/payroll'); }}>
                Open Payroll & Bonuses <ArrowRightOutlined />
              </Button>
            )}
            {drillDown === 'complaints' && (
              <Button type="primary" size="small" onClick={() => { setDrillDown(null); navigate('/admin/complaints'); }}>
                Open Complaints Portal <ArrowRightOutlined />
              </Button>
            )}
            {drillDown === 'approvals' && (
              <Button type="primary" size="small" onClick={() => { setDrillDown(null); navigate('/head-office/approvals'); }}>
                Open Approvals Portal <ArrowRightOutlined />
              </Button>
            )}
          </div>
        }
        footer={[
          <Button key="close" onClick={() => setDrillDown(null)}>
            Close
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="Search within this list..."
            value={modalSearch}
            onChange={(e) => setModalSearch(e.target.value)}
            allowClear
          />
        </div>

        {/* Expenses Table */}
        {drillDown === 'expenses' && (
          <Table
            dataSource={filteredExpenses}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 6 }}
            columns={[
              {
                title: 'Category & Code',
                key: 'category',
                render: (_, r: ExpenseEntity) => (
                  <div>
                    <Text strong>{r.category}</Text>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.code}</div>
                  </div>
                ),
              },
              {
                title: 'Type',
                dataIndex: 'type',
                key: 'type',
                render: (t) => (
                  <Tag color={t === 'internal' ? 'blue' : 'purple'}>
                    {t === 'internal' ? 'Internal' : 'External'}
                  </Tag>
                ),
              },
              {
                title: 'Amount (GHS)',
                dataIndex: 'amountMinor',
                key: 'amount',
                align: 'right',
                render: (val) => (
                  <Text strong style={{ color: '#ff4d4f' }}>
                    GHS {(val / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                ),
              },
              {
                title: 'Branch',
                dataIndex: 'branchName',
                key: 'branch',
                render: (b) => b || 'Head Office',
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                render: (s) => (
                  <Tag color={s === 'approved' ? 'green' : s === 'pending' ? 'gold' : 'red'}>
                    {s?.toUpperCase()}
                  </Tag>
                ),
              },
              {
                title: 'Date',
                dataIndex: 'incurredOn',
                key: 'date',
                render: (d) => dayjs(d).format('MMM D, YYYY'),
              },
            ]}
          />
        )}

        {/* Bonuses Table */}
        {drillDown === 'bonuses' && (
          <Table
            dataSource={filteredBonuses}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 6 }}
            columns={[
              {
                title: 'Staff Member',
                key: 'staff',
                render: (_, r: StaffBonusRecord) => (
                  <div>
                    <Text strong>{r.staffName || 'Staff Member'}</Text>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.staffEmail}</div>
                  </div>
                ),
              },
              {
                title: 'Rule / Reason',
                key: 'rule',
                render: (_, r: StaffBonusRecord) => (
                  <div>
                    <Text>{r.ruleName || r.bonusType}</Text>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.reason}</div>
                  </div>
                ),
              },
              {
                title: 'Amount (GHS)',
                key: 'amount',
                align: 'right',
                render: (_, r: StaffBonusRecord) => (
                  <Text strong style={{ color: '#52c41a' }}>
                    GHS {((r.amountMinor || r.amountGHS * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                ),
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                render: (s) => (
                  <Tag color={s === 'PAID' ? 'green' : 'gold'}>
                    {s}
                  </Tag>
                ),
              },
              {
                title: 'Earned Date',
                dataIndex: 'earnedAt',
                key: 'date',
                render: (d) => dayjs(d).format('MMM D, YYYY'),
              },
            ]}
          />
        )}

        {/* Complaints Table */}
        {drillDown === 'complaints' && (
          <Table
            dataSource={filteredComplaints}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 6 }}
            columns={[
              {
                title: 'Customer',
                key: 'customer',
                render: (_, r: ComplaintEntity) => (
                  <div>
                    <Text strong>{r.customerName || 'Client'}</Text>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.customerPhone}</div>
                  </div>
                ),
              },
              {
                title: 'Subject & Details',
                key: 'subject',
                render: (_, r: ComplaintEntity) => (
                  <div>
                    <Text strong>{r.subject}</Text>
                    <div style={{ fontSize: 11, color: '#595959' }}>{r.message}</div>
                  </div>
                ),
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                render: (s) => (
                  <Tag color={s === 'resolved' ? 'green' : s === 'in_progress' ? 'blue' : 'gold'}>
                    {s?.replace('_', ' ').toUpperCase()}
                  </Tag>
                ),
              },
              {
                title: 'Logged At',
                dataIndex: 'createdAt',
                key: 'date',
                render: (d) => dayjs(d).format('MMM D, YYYY · h:mm A'),
              },
            ]}
          />
        )}

        {/* Approvals Table */}
        {drillDown === 'approvals' && (
          <Table
            dataSource={filteredApprovals}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 6 }}
            columns={[
              {
                title: 'Approval Item',
                key: 'title',
                render: (_, r: ApprovalItem) => (
                  <div>
                    <Text strong>{r.title}</Text>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.description || r.reason}</div>
                  </div>
                ),
              },
              {
                title: 'Requested By',
                key: 'requestedBy',
                render: (_, r: ApprovalItem) => (
                  <div>
                    <Text>{r.requestedBy || 'Branch Operations'}</Text>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.branchName || 'Branch'}</div>
                  </div>
                ),
              },
              {
                title: 'Amount',
                dataIndex: 'amountMinor',
                key: 'amount',
                render: (val) =>
                  val ? (
                    <Text strong style={{ color: '#ff4d4f' }}>
                      GHS {(val / 100).toLocaleString()}
                    </Text>
                  ) : (
                    '—'
                  ),
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                render: (s) => (
                  <Tag color={s === 'approved' ? 'green' : s === 'pending' ? 'gold' : 'red'}>
                    {String(s).toUpperCase()}
                  </Tag>
                ),
              },
              {
                title: 'Date',
                dataIndex: 'createdAt',
                key: 'date',
                render: (d) => dayjs(d).format('MMM D, YYYY'),
              },
            ]}
          />
        )}
      </Modal>
    </div>
  );
};
