// src/pages/branches/ApprovalWorkflowPage.tsx
// ⚠️ PROTOTYPE — see src/mock/governance.ts and src/mock/approvalStore.ts.
// Sample data only; decisions made here are saved to localStorage, not to
// any real backend.
//
// "Branch managers approve local activities within limits. Head office
// approves major financial and legal actions." This page shows the limit
// each branch manager currently has, and lets Head Office actually
// approve/reject the open documents and expenses that crossed that limit.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Col, List, message, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, AuditOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/shared/PageHeader';
import { MockDataBanner } from '@/components/shared/MockDataBanner';
import { useBranchContext } from '@/contexts/BranchContext';
import { getBranchDocuments, getBranchExpenseEntries } from '@/mock/branches';
import { documentRequiresHQApproval, expenseRequiresHQApproval, mockApprovalLimits } from '@/mock/governance';
import { setApprovalOverride, useApprovalOverrides } from '@/mock/approvalStore';

const { Text } = Typography;

const formatLimit = (minor: number | null) => (minor === null ? 'No limit (Head Office)' : `Up to GHS ${(minor / 100).toLocaleString()}`);

export const ApprovalWorkflowPage: React.FC = () => {
  const navigate = useNavigate();
  const { branches } = useBranchContext();
  const overrides = useApprovalOverrides();

  const limitColumns = [
    {
      title: 'Branch',
      key: 'branch',
      render: (_: any, record: (typeof mockApprovalLimits)[number]) => branches.find((b) => b.id === record.branchId)?.name ?? record.branchId,
    },
    { title: 'Branch Manager', dataIndex: 'branchManagerName', key: 'branchManagerName' },
    { title: 'Expense Approval Limit', key: 'expense', render: (_: any, r: (typeof mockApprovalLimits)[number]) => formatLimit(r.expenseApprovalLimitMinor) },
    { title: 'Document Approval Limit', key: 'document', render: (_: any, r: (typeof mockApprovalLimits)[number]) => formatLimit(r.documentApprovalLimitMinor) },
  ];

  const allEscalated = branches.flatMap((b) => [
    ...getBranchDocuments(b.id)
      .filter((d) => d.status === 'pending' && documentRequiresHQApproval(b.id, d.amountMinor))
      .map((d) => ({ key: d.id, branchId: b.id, branch: b.name, code: d.code, kind: 'Document', title: d.title, amountMinor: d.amountMinor ?? 0 })),
    ...getBranchExpenseEntries(b.id)
      .filter((e) => expenseRequiresHQApproval(b.id, e.amountMinor))
      .map((e) => ({ key: e.id, branchId: b.id, branch: b.name, code: e.code, kind: 'Expense', title: e.category, amountMinor: e.amountMinor })),
  ]);

  const awaitingDecision = allEscalated.filter((item) => !overrides[item.key]);
  const decided = allEscalated
    .filter((item) => overrides[item.key])
    .map((item) => ({ ...item, override: overrides[item.key] }));

  const decide = (recordId: string, decision: 'approved' | 'rejected', label: string) => {
    setApprovalOverride(recordId, decision, 'head_office');
    message.success(`${label} ${decision} by Head Office (mock — not sent anywhere).`);
  };

  return (
    <div>
      <PageHeader
        title="Approval Workflow"
        actions={[{ label: 'Head Office', onClick: () => navigate('/head-office'), icon: <ArrowLeftOutlined /> }]}
      />
      <MockDataBanner />

      <Alert
        style={{ marginBottom: 24 }}
        type="info"
        showIcon
        icon={<AuditOutlined />}
        message="Governance rule"
        description="Branch managers can approve day-to-day expenses and documents up to their limit below (from each Branch Dashboard). Anything above it — and every major financial or legal action — escalates here for Head Office to decide."
      />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12}>
          <Card><Statistic title="Awaiting Head Office Decision (sample)" value={awaitingDecision.length} valueStyle={{ color: awaitingDecision.length > 0 ? '#ff4d4f' : '#52c41a' }} /></Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card><Statistic title="Branches with Delegated Limits (sample)" value={mockApprovalLimits.filter((a) => a.documentApprovalLimitMinor !== null).length} /></Card>
        </Col>
      </Row>

      <Card title="Branch Manager Approval Limits (sample)" style={{ marginBottom: 24 }}>
        <Table columns={limitColumns} dataSource={mockApprovalLimits} rowKey="branchId" pagination={false} size="small" />
      </Card>

      <Card title="Escalated to Head Office (sample)" style={{ marginBottom: 24 }}>
        {awaitingDecision.length > 0 ? (
          <List
            dataSource={awaitingDecision}
            renderItem={(item) => (
              <List.Item
                extra={
                  <Space direction="vertical" align="end" size={4}>
                    <Text strong>GHS {(item.amountMinor / 100).toLocaleString()}</Text>
                    <Space size={4}>
                      <Button size="small" type="primary" onClick={() => decide(item.key, 'approved', item.title)}>Approve</Button>
                      <Button size="small" danger onClick={() => decide(item.key, 'rejected', item.title)}>Reject</Button>
                    </Space>
                  </Space>
                }
              >
                <List.Item.Meta
                  title={<span>{item.title} <Tag color="red" style={{ marginLeft: 8 }}>{item.kind}</Tag></span>}
                  description={`${item.code} · ${item.branch}`}
                />
              </List.Item>
            )}
          />
        ) : (
          <Text type="secondary">Nothing is currently waiting on a Head Office decision.</Text>
        )}
      </Card>

      <Card title="Recently Decided (sample)">
        {decided.length > 0 ? (
          <List
            dataSource={decided}
            renderItem={(item) => (
              <List.Item
                extra={
                  <Tag color={item.override.decision === 'approved' ? 'green' : 'red'}>
                    {item.override.decision} · {item.override.decidedBy === 'head_office' ? 'Head Office' : 'Branch Manager'} · {item.override.decidedAt}
                  </Tag>
                }
              >
                <List.Item.Meta
                  title={<span>{item.title} <Tag style={{ marginLeft: 8 }}>{item.kind}</Tag></span>}
                  description={`${item.code} · ${item.branch}`}
                />
              </List.Item>
            )}
          />
        ) : (
          <Text type="secondary">No decisions recorded yet.</Text>
        )}
      </Card>
    </div>
  );
};
