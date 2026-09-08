// src/pages/branches/ApprovalWorkflowPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import { ArrowLeftOutlined, AuditOutlined, PlusOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/shared/PageHeader';
import { useBranchContext } from '@/contexts/BranchContext';
import {
  useApprovalsQuery,
  useApproveMutation,
  useRejectMutation,
  useCreateApprovalMutation,
  type ApprovalItem,
} from '@/api/approvals';

const { Text, Paragraph } = Typography;
const { Option } = Select;

export const ApprovalWorkflowPage: React.FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { branches } = useBranchContext();
  const { data: approvals = [], isLoading } = useApprovalsQuery();
  const approveMutation = useApproveMutation();
  const rejectMutation = useRejectMutation();
  const createApprovalMutation = useCreateApprovalMutation();

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();

  // Defensive array guards
  const approvalsList: ApprovalItem[] = Array.isArray(approvals) ? approvals : [];
  const branchList = Array.isArray(branches) ? branches : [];

  const isPending = (st?: string) => String(st || '').trim().toLowerCase() === 'pending';
  const isApproved = (st?: string) => String(st || '').trim().toLowerCase() === 'approved';

  const pendingApprovals = approvalsList.filter((a) => a && isPending(a.status));
  const decidedApprovals = approvalsList.filter((a) => a && !isPending(a.status));

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
      await rejectMutation.mutateAsync({ id: targetId, reason: rejectReason || 'Rejected by Head Office' });
      message.success('Request rejected');
      setRejectModalOpen(false);
      setRejectReason('');
      setTargetId(null);
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Rejection failed');
    }
  };

  const handleCreateApproval = async (values: any) => {
    try {
      const selectedBranch = branchList.find((b) => b.id === values.branchId);
      await createApprovalMutation.mutateAsync({
        type: values.type,
        title: values.title,
        description: values.description,
        branchId: values.branchId,
        branchName: selectedBranch?.name || 'Head Office',
        amountMinor: values.amountGHS ? Math.round(Number(values.amountGHS) * 100) : undefined,
        reason: values.reason,
        requestedBy: values.requestedBy || 'Branch Staff',
      });
      message.success('Approval request submitted to Head Office');
      setCreateModalOpen(false);
      createForm.resetFields();
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Failed to submit request');
    }
  };

  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'expense':
        return 'orange';
      case 'pricing_override':
        return 'purple';
      case 'policy_exception':
        return 'cyan';
      case 'document':
        return 'blue';
      default:
        return 'gold';
    }
  };

  const getTypeLabel = (type?: string) => {
    switch (type) {
      case 'expense':
        return 'Expense Over Limit';
      case 'pricing_override':
        return 'Pricing Override';
      case 'policy_exception':
        return 'Policy Exception';
      case 'document':
        return 'Document Release';
      default:
        return type || 'Governance';
    }
  };

  const branchColumns = [
    {
      title: 'Branch Code',
      dataIndex: 'branchCode',
      key: 'branchCode',
      render: (v: string) => <Tag color="blue">{v || '—'}</Tag>,
    },
    { title: 'Branch Name', dataIndex: 'name', key: 'name', render: (v: string) => v || 'Unnamed' },
    { title: 'Location', dataIndex: 'location', key: 'location', render: (v: string) => v || '—' },
    {
      title: 'Delegated Approval Limit',
      dataIndex: 'approvalLimitMinor',
      key: 'approvalLimitMinor',
      render: (v?: number) =>
        v != null && !isNaN(Number(v)) && Number(v) > 0
          ? `GHS ${(Number(v) / 100).toLocaleString()}`
          : 'Standard Threshold',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Approval Workflow"
        actions={[
          {
            label: '+ Request Approval',
            onClick: () => setCreateModalOpen(true),
            type: 'primary',
            icon: <PlusOutlined />,
          },
          {
            label: 'Head Office',
            onClick: () => navigate('/head-office'),
            icon: <ArrowLeftOutlined />,
          },
        ]}
      />

      <Alert
        style={{ marginBottom: 24 }}
        type="info"
        showIcon
        icon={<AuditOutlined />}
        message="Governance & Escalation Policy"
        description="Branch managers can approve day-to-day operations up to their branch delegated limit. Major financial outlays, price concessions, policy exceptions, and document authorizations escalate to Head Office here."
      />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic
              title="Awaiting Head Office Decision"
              value={pendingApprovals.length}
              valueStyle={{ color: pendingApprovals.length > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic
              title="Decided Requests"
              value={decidedApprovals.length}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Branch Delegated Limits" style={{ marginBottom: 24 }}>
        <Table
          columns={branchColumns}
          dataSource={branchList}
          rowKey={(r: any) => r?.id || r?.branchCode || Math.random().toString()}
          pagination={false}
          size="small"
        />
      </Card>

      <Card title="Escalated Pending Approvals" style={{ marginBottom: 24 }} loading={isLoading}>
        {pendingApprovals.length > 0 ? (
          <List
            dataSource={pendingApprovals}
            rowKey={(item) => item.id}
            renderItem={(item: ApprovalItem) => (
              <List.Item
                extra={
                  <Space direction="vertical" align="end" size={4}>
                    {item.amountMinor != null && !isNaN(Number(item.amountMinor)) ? (
                      <Text strong style={{ color: '#0f766e', fontSize: 15 }}>
                        GHS {(Number(item.amountMinor) / 100).toLocaleString()}
                      </Text>
                    ) : null}
                    <Space size={4}>
                      <Button
                        size="small"
                        type="primary"
                        loading={approveMutation.isPending}
                        onClick={() => handleApprove(item.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="small"
                        danger
                        onClick={() => {
                          setTargetId(item.id);
                          setRejectModalOpen(true);
                        }}
                      >
                        Reject
                      </Button>
                    </Space>
                  </Space>
                }
              >
                <List.Item.Meta
                  title={
                    <Space size={8}>
                      <span style={{ fontWeight: 600 }}>{item.title || 'Untitled Request'}</span>
                      <Tag color={getTypeColor(item.type)}>{getTypeLabel(item.type)}</Tag>
                    </Space>
                  }
                  description={
                    <div>
                      <div style={{ color: '#475569', marginBottom: 4 }}>
                        {item.description || item.reason || 'Escalated for Head Office executive review.'}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        Requested by {item.requestedBy || 'Branch Staff'} · {item.branchName || 'Branch'}
                        {item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString()}` : ''}
                      </div>
                    </div>
                  }
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
            rowKey={(item) => item.id}
            renderItem={(item: ApprovalItem) => {
              const statusLower = String(item.status || 'decided').toLowerCase();
              const isAppr = isApproved(statusLower);
              const tagColor = isAppr ? 'green' : statusLower === 'rejected' ? 'red' : 'default';
              const displayStatus = String(item.status || 'DECIDED').toUpperCase();

              return (
                <List.Item
                  extra={
                    <Tag color={tagColor} style={{ fontWeight: 700 }}>
                      {displayStatus}
                    </Tag>
                  }
                >
                  <List.Item.Meta
                    title={
                      <Space size={8}>
                        <span>{item.title || 'Untitled Decision'}</span>
                        <Tag color={getTypeColor(item.type)}>{getTypeLabel(item.type)}</Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <div style={{ color: '#64748b' }}>
                          Reason / Remarks: {item.reason || 'No decision remarks provided.'}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          Requested by {item.requestedBy || 'Staff'} · Decided:{' '}
                          {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'Recorded'}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        ) : (
          <Text type="secondary">No decisions recorded yet.</Text>
        )}
      </Card>

      {/* ── Reject Modal ────────────────────────────────────────────────────────── */}
      <Modal
        title="Reject Approval Request"
        open={rejectModalOpen}
        onCancel={() => {
          setRejectModalOpen(false);
          setTargetId(null);
        }}
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
              placeholder="State why this request was rejected so the branch can take corrective action"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Create Approval Modal ───────────────────────────────────────────────── */}
      <Modal
        title="Submit Governance Request for Head Office Approval"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        okText="Submit for Decision"
        confirmLoading={createApprovalMutation.isPending}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateApproval}>
          <Form.Item
            name="type"
            label="Request Category"
            rules={[{ required: true, message: 'Please select category' }]}
            initialValue="expense"
          >
            <Select>
              <Option value="expense">Expense (Over Branch Delegated Threshold)</Option>
              <Option value="pricing_override">Pricing Override / Special Discount</Option>
              <Option value="policy_exception">Policy Exception / Deferred Payment</Option>
              <Option value="document">Executive Document Authorization</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="title"
            label="Subject / Title"
            rules={[{ required: true, message: 'Please provide a title' }]}
          >
            <Input placeholder="e.g. Major Generator Maintenance Overhaul" />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="branchId" label="Originating Branch">
                <Select placeholder="Select branch" allowClear>
                  {branchList.map((b) => (
                    <Option key={b.id} value={b.id}>
                      {b.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="amountGHS" label="Amount (GHS)">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={100}
                  placeholder="e.g. 15000"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="requestedBy" label="Requested By">
            <Input placeholder="e.g. Branch Manager" />
          </Form.Item>

          <Form.Item
            name="reason"
            label="Justification / Business Context"
            rules={[{ required: true, message: 'Please provide justification' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Explain why this request requires Head Office authorization"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

