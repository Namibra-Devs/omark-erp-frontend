// src/pages/branches/ApprovalWorkflowPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Col, List, message, Row, Space, Statistic, Table, Tag, Typography, Modal, Input, Form } from 'antd';
import { ArrowLeftOutlined, AuditOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/shared/PageHeader';
import { useBranchContext } from '@/contexts/BranchContext';
import { useApprovalsQuery, useApproveMutation, useRejectMutation, type ApprovalItem } from '@/api/approvals';

const { Text } = Typography;

export const ApprovalWorkflowPage: React.FC = () => {
  const navigate = useNavigate();
  const { branches } = useBranchContext();
  const { data: approvals = [], isLoading } = useApprovalsQuery();
  const approveMutation = useApproveMutation();
  const rejectMutation = useRejectMutation();

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const decidedApprovals = approvals.filter((a) => a.status !== 'pending');

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync({ id, reason: 'Approved by Head Office' });
      message.success('Request approved successfully');
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Approval failed');
    }
  };

  const handleRejectConfirm = async () => {
    if (!targetId) return;
    try {
      await rejectMutation.mutateAsync({ id: targetId, reason: rejectReason });
      message.success('Request rejected');
      setRejectModalOpen(false);
      setRejectReason('');
      setTargetId(null);
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Rejection failed');
    }
  };

  const branchColumns = [
    { title: 'Branch Code', dataIndex: 'branchCode', key: 'branchCode', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'Branch Name', dataIndex: 'name', key: 'name' },
    { title: 'Location', dataIndex: 'location', key: 'location' },
    {
      title: 'Approval Limit',
      dataIndex: 'approvalLimitMinor',
      key: 'approvalLimitMinor',
      render: (v?: number) => v ? `GHS ${(v / 100).toLocaleString()}` : 'Standard Threshold',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Approval Workflow"
        actions={[{ label: 'Head Office', onClick: () => navigate('/head-office'), icon: <ArrowLeftOutlined /> }]}
      />

      <Alert
        style={{ marginBottom: 24 }}
        type="info"
        showIcon
        icon={<AuditOutlined />}
        message="Governance Rule"
        description="Branch managers can approve day-to-day operations up to their branch threshold limit. Major financial requests, policy exceptions, and document approvals escalate to Head Office here."
      />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12}>
          <Card><Statistic title="Awaiting Head Office Decision" value={pendingApprovals.length} valueStyle={{ color: pendingApprovals.length > 0 ? '#ff4d4f' : '#52c41a' }} /></Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card><Statistic title="Decided Requests" value={decidedApprovals.length} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
      </Row>

      <Card title="Branch Delegated Limits" style={{ marginBottom: 24 }}>
        <Table columns={branchColumns} dataSource={branches} rowKey="id" pagination={false} size="small" />
      </Card>

      <Card title="Escalated Pending Approvals" style={{ marginBottom: 24 }} loading={isLoading}>
        {pendingApprovals.length > 0 ? (
          <List
            dataSource={pendingApprovals}
            renderItem={(item: ApprovalItem) => (
              <List.Item
                extra={
                  <Space direction="vertical" align="end" size={4}>
                    {item.amountMinor ? <Text strong>GHS {(item.amountMinor / 100).toLocaleString()}</Text> : null}
                    <Space size={4}>
                      <Button size="small" type="primary" loading={approveMutation.isPending} onClick={() => handleApprove(item.id)}>Approve</Button>
                      <Button size="small" danger onClick={() => { setTargetId(item.id); setRejectModalOpen(true); }}>Reject</Button>
                    </Space>
                  </Space>
                }
              >
                <List.Item.Meta
                  title={<span>{item.title} <Tag color="gold" style={{ marginLeft: 8 }}>{item.type}</Tag></span>}
                  description={`${item.requestedBy || 'Staff'} · ${item.branchName || 'Branch'}`}
                />
              </List.Item>
            )}
          />
        ) : (
          <Text type="secondary">Nothing is currently waiting on a Head Office decision.</Text>
        )}
      </Card>

      <Card title="Recently Decided">
        {decidedApprovals.length > 0 ? (
          <List
            dataSource={decidedApprovals}
            renderItem={(item: ApprovalItem) => (
              <List.Item
                extra={
                  <Tag color={item.status === 'approved' ? 'green' : 'red'}>
                    {item.status.toUpperCase()}
                  </Tag>
                }
              >
                <List.Item.Meta
                  title={<span>{item.title} <Tag style={{ marginLeft: 8 }}>{item.type}</Tag></span>}
                  description={`${item.requestedBy || 'Staff'} · ${item.reason || 'No reason provided'}`}
                />
              </List.Item>
            )}
          />
        ) : (
          <Text type="secondary">No decisions recorded yet.</Text>
        )}
      </Card>

      <Modal
        title="Reject Approval Request"
        open={rejectModalOpen}
        onCancel={() => setRejectModalOpen(false)}
        onOk={handleRejectConfirm}
        okText="Confirm Rejection"
        okButtonProps={{ danger: true, loading: rejectMutation.isPending }}
      >
        <Form layout="vertical">
          <Form.Item label="Reason for Rejection" required>
            <Input.TextArea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="State why this request was rejected"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
