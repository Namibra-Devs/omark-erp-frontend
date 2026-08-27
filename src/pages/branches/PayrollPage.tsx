// src/pages/branches/PayrollPage.tsx
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Row, Select, Statistic, Table, Tag, message } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { PageHeader } from '@/components/shared/PageHeader';
import { useBranchContext } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUsersQuery, getUserFullName } from '@/api/users';
import {
  usePayrollQuery,
  useCreatePayrollMutation,
  useBulkPayrollRunMutation,
  useUpdatePayrollMutation,
  type PayrollRecord,
} from '@/api/payroll';

const statusColor: Record<string, string> = { pending: 'gold', approved: 'blue', paid: 'green' };
const NEXT_STATUS: Record<string, 'approved' | 'paid' | null> = { pending: 'approved', approved: 'paid', paid: null };

export const PayrollPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { branches } = useBranchContext();
  const { user } = useAuth();
  const { data: usersData } = useUsersQuery();
  const staffUsers = usersData?.items ?? [];

  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [bulkForm] = Form.useForm();

  const { data: payrollData, isLoading } = usePayrollQuery({ branchId });
  const payroll = payrollData?.items ?? [];
  const createPayroll = useCreatePayrollMutation();
  const bulkPayrollRun = useBulkPayrollRunMutation();
  const updatePayroll = useUpdatePayrollMutation();

  const totalNetMinor = payroll.reduce((sum, p) => sum + (p.netSalaryMinor || 0), 0);
  const totalBonusMinor = payroll.reduce((sum, p) => sum + (p.bonusMinor || 0), 0);
  const pendingCount = payroll.filter((p) => p.status === 'pending').length;

  const isAccountsContext = location.pathname.startsWith('/accounts');
  const backTarget = isAccountsContext ? '/accounts/dashboard' : '/head-office';
  const backLabel = isAccountsContext ? 'Accounts Dashboard' : 'Head Office';

  const handleAdd = async (values: any) => {
    try {
      await createPayroll.mutateAsync({
        staffUserId: values.staffUserId,
        month: values.month,
        baseSalaryMinor: Math.round(values.basePayGHS * 100),
        bonusMinor: Math.round((values.bonusGHS || 0) * 100),
        deductionsMinor: Math.round((values.deductionsGHS || 0) * 100),
        notes: values.notes,
      });
      message.success('Payroll entry added');
      form.resetFields();
      setAddModalOpen(false);
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Failed to add payroll record');
    }
  };

  const handleBulkRun = async (values: any) => {
    try {
      await bulkPayrollRun.mutateAsync({
        month: values.month,
        branchId: values.branchId,
      });
      message.success('Bulk payroll run generated successfully');
      bulkForm.resetFields();
      setBulkModalOpen(false);
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Failed to run bulk payroll');
    }
  };

  const advanceStatus = async (record: PayrollRecord) => {
    const next = NEXT_STATUS[record.status];
    if (!next) return;
    try {
      await updatePayroll.mutateAsync({
        id: record.id,
        payload: { status: next },
      });
      message.success(`Payroll record updated to ${next}`);
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Update failed');
    }
  };

  const columns = [
    { title: 'Staff Member', dataIndex: 'staffName', key: 'staffName', render: (v: string) => v || 'N/A' },
    { title: 'Month', dataIndex: 'month', key: 'month' },
    { title: 'Base Pay', key: 'base', render: (_: any, r: PayrollRecord) => `GHS ${(r.baseSalaryMinor / 100).toLocaleString()}` },
    {
      title: 'Bonus',
      key: 'bonus',
      render: (_: any, r: PayrollRecord) => r.bonusMinor > 0
        ? <Tag color="green">GHS {(r.bonusMinor / 100).toLocaleString()}</Tag>
        : <span style={{ color: '#bbb' }}>—</span>,
    },
    { title: 'Deductions', key: 'deductions', render: (_: any, r: PayrollRecord) => `GHS ${((r.deductionsMinor || 0) / 100).toLocaleString()}` },
    { title: 'Net Pay', key: 'net', render: (_: any, r: PayrollRecord) => <strong>GHS {(r.netSalaryMinor / 100).toLocaleString()}</strong> },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, r: PayrollRecord) => (
        <Tag
          color={statusColor[r.status] || 'default'}
          style={{ cursor: NEXT_STATUS[r.status] ? 'pointer' : 'default' }}
          onClick={() => advanceStatus(r)}
        >
          {r.status}{NEXT_STATUS[r.status] ? ` → mark ${NEXT_STATUS[r.status]}` : ''}
        </Tag>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Bonuses & Salaries"
        actions={[
          { label: 'Bulk Payroll Run', onClick: () => setBulkModalOpen(true), icon: <PlayCircleOutlined /> },
          { label: 'Add Payroll Entry', onClick: () => setAddModalOpen(true), icon: <PlusOutlined /> },
          { label: backLabel, onClick: () => navigate(backTarget), icon: <ArrowLeftOutlined />, type: 'default' },
        ]}
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Net Payroll" value={totalNetMinor / 100} prefix="GHS" precision={2} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Bonuses Paid Out" value={totalBonusMinor / 100} prefix="GHS" precision={2} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Pending Runs" value={pendingCount} valueStyle={{ color: pendingCount > 0 ? '#faad14' : '#52c41a' }} /></Card>
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

      <Card title="Payroll Records">
        <Table columns={columns} dataSource={payroll} rowKey="id" loading={isLoading} pagination={false} size="small" />
      </Card>

      {/* Add Single Payroll Entry Modal */}
      <Modal title="Add Payroll Entry" open={addModalOpen} onCancel={() => setAddModalOpen(false)} footer={null} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item name="staffUserId" label="Staff Member" rules={[{ required: true, message: 'Please select staff' }]}>
            <Select
              showSearch
              placeholder="Select staff member"
              options={staffUsers.map((u) => ({ value: u.id, label: `${getUserFullName(u)} (${u.role})` }))}
            />
          </Form.Item>
          <Form.Item name="month" label="Month (YYYY-MM)" rules={[{ required: true, message: 'Please enter month' }]}>
            <Input placeholder="e.g. 2026-08" />
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
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Optional notes" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={createPayroll.isPending} block>Add Entry</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Bulk Run Modal */}
      <Modal title="Generate Bulk Payroll Run" open={bulkModalOpen} onCancel={() => setBulkModalOpen(false)} footer={null} destroyOnClose>
        <Form form={bulkForm} layout="vertical" onFinish={handleBulkRun}>
          <Form.Item name="month" label="Month (YYYY-MM)" rules={[{ required: true, message: 'Please enter month' }]}>
            <Input placeholder="e.g. 2026-08" />
          </Form.Item>
          <Form.Item name="branchId" label="Branch (Optional)">
            <Select allowClear placeholder="All branches" options={branches.map((b) => ({ value: b.id, label: b.name }))} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={bulkPayrollRun.isPending} block>Generate Bulk Run</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
