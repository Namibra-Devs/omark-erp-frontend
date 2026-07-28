// src/pages/branches/PayrollPage.tsx
// ⚠️ PROTOTYPE — see src/mock/payroll.ts. Sample data only.
//
// "Manage bonuses and salaries" + "all payroll records are branch-aware."
// There is no payroll module anywhere in the real app (no endpoints, no
// payroll or bonus concept at all) — this page lets Accounts actually run
// payroll (add entries, track bonuses, advance status) using the coded-
// record format (e.g. KMA-PAYR-2026-001), entirely client-side.
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Row, Select, Statistic, Table, Tag, message } from 'antd';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/shared/PageHeader';
import { MockDataBanner } from '@/components/shared/MockDataBanner';
import { useBranchContext } from '@/contexts/BranchContext';
import { addPayrollRecord, updatePayrollStatus, useAllPayroll, type PayrollRecord, type PayrollStatus } from '@/mock/payroll';

const statusColor: Record<PayrollStatus, string> = { pending: 'gold', processed: 'blue', paid: 'green' };
const NEXT_STATUS: Record<PayrollStatus, PayrollStatus | null> = { pending: 'processed', processed: 'paid', paid: null };

export const PayrollPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { branches } = useBranchContext();
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form] = Form.useForm();

  const allPayroll = useAllPayroll();
  const payroll = allPayroll.filter((p) => !branchId || p.branchId === branchId);

  const totalNetMinor = payroll.reduce((sum, p) => sum + p.netPayMinor, 0);
  const totalBonusMinor = payroll.reduce((sum, p) => sum + p.bonusMinor, 0);
  const pendingCount = payroll.filter((p) => p.status === 'pending').length;

  const isAccountsContext = location.pathname.startsWith('/accounts');
  const backTarget = isAccountsContext ? '/accounts/dashboard' : '/head-office';
  const backLabel = isAccountsContext ? 'Accounts Dashboard' : 'Head Office';

  const handleAdd = (values: { branchId: string; staffName: string; role: string; month: string; basePayGHS: number; bonusGHS: number; deductionsGHS: number }) => {
    addPayrollRecord({
      branchId: values.branchId,
      staffName: values.staffName,
      role: values.role,
      month: values.month,
      basePayMinor: Math.round(values.basePayGHS * 100),
      bonusMinor: Math.round((values.bonusGHS || 0) * 100),
      deductionsMinor: Math.round((values.deductionsGHS || 0) * 100),
    });
    message.success('Payroll entry added');
    form.resetFields();
    setAddModalOpen(false);
  };

  const advanceStatus = (record: PayrollRecord) => {
    const next = NEXT_STATUS[record.status];
    if (!next) return;
    updatePayrollStatus(record.id, next);
    message.success(`${record.code} marked ${next}`);
  };

  const columns = [
    { title: 'Branch ID', dataIndex: 'code', key: 'code', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: 'Branch',
      key: 'branch',
      render: (_: any, record: PayrollRecord) => branches.find((b) => b.id === record.branchId)?.name ?? record.branchId,
    },
    { title: 'Staff', dataIndex: 'staffName', key: 'staffName' },
    { title: 'Role', dataIndex: 'role', key: 'role' },
    { title: 'Month', dataIndex: 'month', key: 'month' },
    { title: 'Base Pay', key: 'base', render: (_: any, r: PayrollRecord) => `GHS ${(r.basePayMinor / 100).toLocaleString()}` },
    {
      title: 'Bonus',
      key: 'bonus',
      render: (_: any, r: PayrollRecord) => r.bonusMinor > 0
        ? <Tag color="green">GHS {(r.bonusMinor / 100).toLocaleString()}</Tag>
        : <span style={{ color: '#bbb' }}>—</span>,
    },
    { title: 'Deductions', key: 'deductions', render: (_: any, r: PayrollRecord) => `GHS ${(r.deductionsMinor / 100).toLocaleString()}` },
    { title: 'Net Pay', key: 'net', render: (_: any, r: PayrollRecord) => <strong>GHS {(r.netPayMinor / 100).toLocaleString()}</strong> },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, r: PayrollRecord) => (
        <Tag
          color={statusColor[r.status]}
          style={{ cursor: NEXT_STATUS[r.status] ? 'pointer' : 'default' }}
          onClick={() => advanceStatus(r)}
        >
          {r.status}{NEXT_STATUS[r.status] ? ` → click to mark ${NEXT_STATUS[r.status]}` : ''}
        </Tag>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Bonuses & Salaries"
        actions={[
          { label: 'Add Payroll Entry', onClick: () => setAddModalOpen(true), icon: <PlusOutlined /> },
          { label: backLabel, onClick: () => navigate(backTarget), icon: <ArrowLeftOutlined />, type: 'default' },
        ]}
      />
      <MockDataBanner />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Net Payroll (sample)" value={totalNetMinor / 100} prefix="GHS" precision={2} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Bonuses Paid Out (sample)" value={totalBonusMinor / 100} prefix="GHS" precision={2} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Pending Runs (sample)" value={pendingCount} valueStyle={{ color: pendingCount > 0 ? '#faad14' : '#52c41a' }} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Select
              allowClear
              placeholder="Filter by branch"
              style={{ width: '100%' }}
              value={branchId}
              onChange={setBranchId}
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Payroll Records (sample)">
        <Table columns={columns} dataSource={payroll} rowKey="id" pagination={false} size="small" />
      </Card>

      <Modal title="Add Payroll Entry" open={addModalOpen} onCancel={() => setAddModalOpen(false)} footer={null} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item name="branchId" label="Branch" rules={[{ required: true, message: 'Please select a branch' }]}>
            <Select placeholder="Select branch" options={branches.map((b) => ({ value: b.id, label: b.name }))} />
          </Form.Item>
          <Form.Item name="staffName" label="Staff Name" rules={[{ required: true, message: 'Please enter a name' }]}>
            <Input placeholder="Full name" />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Please enter a role' }]}>
            <Input placeholder="e.g. Customer Service" />
          </Form.Item>
          <Form.Item name="month" label="Month" rules={[{ required: true, message: 'Please enter a month' }]}>
            <Input placeholder="e.g. August 2026" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="basePayGHS" label="Base Pay (GHS)" rules={[{ required: true, message: 'Required' }]}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="bonusGHS" label="Bonus (GHS)" initialValue={0}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="deductionsGHS" label="Deductions (GHS)" initialValue={0}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>Add Entry</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
