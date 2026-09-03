// src/pages/accounts/ExpensesPage.tsx
import React, { useState, useMemo } from 'react';
import {
  Card, Row, Col, Typography, Statistic, Table, Tag, Space, Button,
  Modal, Form, Input, InputNumber, Select, DatePicker, message, Tooltip,
  Popconfirm, Divider, Alert
} from 'antd';
import {
  DollarOutlined,
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  ExportOutlined,
  CalendarOutlined,
  FileTextOutlined,
  ShopOutlined,
  BankOutlined,
  CheckCircleOutlined,
  FilterOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/PageHeader';
import { useExpensesQuery, useCreateExpenseMutation, type ExpenseEntity } from '@/api/expenses';
import { useBranchContext } from '@/contexts/BranchContext';
import { filterEntitiesByBranch } from '@/utils/branchIsolation';
import { tokens } from '@/constants/tokens';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export const ExpensesPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const { branches } = useBranchContext();
  const { data: expensesData, isLoading, refetch } = useExpensesQuery();
  const createExpenseMutation = useCreateExpenseMutation();

  const rawExpenses = expensesData?.items ?? [];
  const branchExpenses = filterEntitiesByBranch(rawExpenses, user, branches);

  // ── State ─────────────────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'internal' | 'external'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('monthly');
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form] = Form.useForm();

  // ── Filter Expenses ───────────────────────────────────────────────────────
  const filteredExpenses = useMemo(() => {
    return branchExpenses.filter((e) => {
      // Search
      if (searchText) {
        const query = searchText.toLowerCase();
        const matchesCategory = (e.category || '').toLowerCase().includes(query);
        const matchesDesc = (e.description || '').toLowerCase().includes(query);
        const matchesCode = (e.code || '').toLowerCase().includes(query);
        if (!matchesCategory && !matchesDesc && !matchesCode) return false;
      }

      // Category
      if (categoryFilter !== 'all' && e.category !== categoryFilter) {
        return false;
      }

      // Type
      if (typeFilter !== 'all' && e.type !== typeFilter) {
        return false;
      }

      // Date
      if (dateFilter !== 'all') {
        const date = dayjs(e.incurredOn || e.createdAt);
        const now = dayjs();
        if (dateFilter === 'today' && !date.isSame(now, 'day')) return false;
        if (dateFilter === 'weekly' && !date.isSame(now, 'week')) return false;
        if (dateFilter === 'monthly' && !date.isSame(now, 'month')) return false;
        if (dateFilter === 'yearly' && !date.isSame(now, 'year')) return false;
        if (dateFilter === 'custom' && customDateRange && customDateRange[0] && customDateRange[1]) {
          const start = customDateRange[0].startOf('day');
          const end = customDateRange[1].endOf('day');
          if (date.isBefore(start) || date.isAfter(end)) return false;
        }
      }

      return true;
    });
  }, [branchExpenses, searchText, categoryFilter, typeFilter, dateFilter, customDateRange]);

  // ── Metrics ───────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const totalMinor = filteredExpenses.reduce((sum, e) => sum + (e.amountMinor || 0), 0);
    const internalMinor = filteredExpenses.filter((e) => e.type === 'internal').reduce((sum, e) => sum + (e.amountMinor || 0), 0);
    const externalMinor = filteredExpenses.filter((e) => e.type === 'external').reduce((sum, e) => sum + (e.amountMinor || 0), 0);
    const count = filteredExpenses.length;

    return {
      totalGHS: totalMinor / 100,
      internalGHS: internalMinor / 100,
      externalGHS: externalMinor / 100,
      count,
    };
  }, [filteredExpenses]);

  // ── Handle Add Expense ────────────────────────────────────────────────────
  const handleAddExpense = async (values: any) => {
    try {
      await createExpenseMutation.mutateAsync({
        branchId: values.branchId || user?.branchId,
        category: values.category,
        description: values.description,
        amountMinor: Math.round(values.amountGHS * 100),
        type: values.type,
        incurredOn: values.date ? values.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      });
      message.success('Expense recorded successfully');
      setAddModalOpen(false);
      form.resetFields();
      refetch();
    } catch (err: any) {
      message.error(err?.error?.message || err?.message || 'Failed to record expense');
    }
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    branchExpenses.forEach((e) => {
      if (e.category) set.add(e.category);
    });
    return Array.from(set);
  }, [branchExpenses]);

  const columns = [
    {
      title: 'Expense Code & Description',
      key: 'desc',
      render: (_: any, r: ExpenseEntity) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{r.description || r.category || 'General Operational Expense'}</Text>
          {r.code && (
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>Code: {r.code}</Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (v: string) => <Tag color="blue">{v || 'Operations'}</Tag>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => (
        <Tag color={v === 'internal' ? 'cyan' : 'purple'}>
          {v === 'internal' ? '🏢 Internal Operations' : '🚚 External / Project'}
        </Tag>
      ),
    },
    {
      title: 'Branch',
      key: 'branch',
      render: (_: any, r: ExpenseEntity) => {
        const branch = branches.find((b) => b.id === r.branchId);
        return <Tag color="geekblue">{branch ? branch.name : 'Main HQ'}</Tag>;
      },
    },
    {
      title: 'Incurred Date',
      key: 'date',
      render: (_: any, r: ExpenseEntity) => dayjs(r.incurredOn || r.createdAt).format('MMM D, YYYY'),
    },
    {
      title: 'Amount (GH₵)',
      key: 'amount',
      align: 'right' as const,
      render: (_: any, r: ExpenseEntity) => (
        <strong style={{ color: '#cf1322', fontSize: 14 }}>
          GH₵ {(r.amountMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </strong>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden', padding: '0 4px' }}>
      <PageHeader
        title="Expense Management Hub"
        actions={[
          {
            label: 'Record New Expense',
            onClick: () => setAddModalOpen(true),
            icon: <PlusOutlined />,
          },
          {
            label: 'Refresh',
            onClick: () => {
              refetch();
              message.success('Refreshed expenses');
            },
            icon: <ReloadOutlined />,
          },
        ]}
      />

      {/* ── METRIC STAT CARDS ────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ borderRadius: 8, borderLeft: '4px solid #cf1322' }}>
            <Statistic
              title="Total Filtered Expenses"
              value={metrics.totalGHS}
              prefix="GH₵"
              precision={2}
              valueStyle={{ color: '#cf1322', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ borderRadius: 8, borderLeft: '4px solid #13c2c2' }}>
            <Statistic
              title="Internal Operational Costs"
              value={metrics.internalGHS}
              prefix="GH₵"
              precision={2}
              valueStyle={{ color: '#13c2c2', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ borderRadius: 8, borderLeft: '4px solid #722ed1' }}>
            <Statistic
              title="External / Project Costs"
              value={metrics.externalGHS}
              prefix="GH₵"
              precision={2}
              valueStyle={{ color: '#722ed1', fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ borderRadius: 8, borderLeft: '4px solid #1890ff' }}>
            <Statistic
              title="Expense Items Recorded"
              value={metrics.count}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff', fontWeight: 600 }}
            />
          </Card>
        </Col>
      </Row>

      {/* ── FILTERS BAR ──────────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 16, borderRadius: 8 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Search category, description, code..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="middle"
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Expense Type"
              value={typeFilter}
              onChange={setTypeFilter}
              size="middle"
            >
              <Option value="all">All Types</Option>
              <Option value="internal">🏢 Internal Operations</Option>
              <Option value="external">🚚 External / Projects</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Category"
              value={categoryFilter}
              onChange={setCategoryFilter}
              size="middle"
            >
              <Option value="all">All Categories</Option>
              <Option value="Office Supplies">Office Supplies</Option>
              <Option value="Fuel & Transport">Fuel & Transport</Option>
              <Option value="Utilities & Internet">Utilities & Internet</Option>
              <Option value="Site Survey & Equipment">Site Survey & Equipment</Option>
              <Option value="Marketing & Advertising">Marketing & Advertising</Option>
              <Option value="Legal & Documentation">Legal & Documentation</Option>
              <Option value="Maintenance & Repairs">Maintenance & Repairs</Option>
              {categories.map((c) => (
                <Option key={c} value={c}>{c}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              style={{ width: '100%' }}
              value={dateFilter}
              onChange={(val) => {
                setDateFilter(val);
                if (val !== 'custom') setCustomDateRange(null);
              }}
              size="middle"
              prefix={<CalendarOutlined style={{ color: '#8c8c8c' }} />}
            >
              <Option value="today">☀️ Today</Option>
              <Option value="weekly">📆 This Week</Option>
              <Option value="monthly">🗓️ This Month</Option>
              <Option value="yearly">📊 This Year</Option>
              <Option value="all">📅 All Time</Option>
              <Option value="custom">🎯 Custom Range</Option>
            </Select>
          </Col>
          {dateFilter === 'custom' && (
            <Col xs={24} sm={12} md={4}>
              <DatePicker.RangePicker
                style={{ width: '100%' }}
                value={customDateRange}
                onChange={(dates: any) => setCustomDateRange(dates)}
                format="YYYY-MM-DD"
              />
            </Col>
          )}
          <Col xs={24} sm={24} md={dateFilter === 'custom' ? 2 : 6}>
            <Text type="secondary" style={{ display: 'block', textAlign: 'right', fontWeight: 500 }}>
              Showing {filteredExpenses.length} expense items
            </Text>
          </Col>
        </Row>
      </Card>

      {/* ── TABLE ────────────────────────────────────────────────────────── */}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <Table
          columns={columns}
          dataSource={filteredExpenses}
          rowKey="id"
          loading={isLoading}
          size="middle"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} expense items`,
          }}
        />
      </div>

      {/* ── RECORD NEW EXPENSE MODAL ─────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <DollarOutlined style={{ color: tokens.primary }} />
            <span>Record Branch / Operational Expense</span>
          </Space>
        }
        open={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        footer={null}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleAddExpense}>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="category" label="Expense Category" rules={[{ required: true, message: 'Please pick category' }]}>
                <Select placeholder="Select category">
                  <Option value="Office Supplies">Office Supplies</Option>
                  <Option value="Fuel & Transport">Fuel & Transport</Option>
                  <Option value="Utilities & Internet">Utilities & Internet</Option>
                  <Option value="Site Survey & Equipment">Site Survey & Equipment</Option>
                  <Option value="Marketing & Advertising">Marketing & Advertising</Option>
                  <Option value="Legal & Documentation">Legal & Documentation</Option>
                  <Option value="Maintenance & Repairs">Maintenance & Repairs</Option>
                  <Option value="Refreshments & Hospitality">Refreshments & Hospitality</Option>
                  <Option value="Other">Other Operational Cost</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="type" label="Expense Type" initialValue="internal" rules={[{ required: true }]}>
                <Select>
                  <Option value="internal">🏢 Internal Operations</Option>
                  <Option value="external">🚚 External / Project</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="amountGHS" label="Amount (GH₵)" rules={[{ required: true, message: 'Enter amount' }]}>
                <InputNumber style={{ width: '100%' }} min={1} precision={2} prefix="GH₵" placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="date" label="Incurred Date" initialValue={dayjs()} rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>

          {hasRole(['admin', 'branch_manager']) && (
            <Form.Item name="branchId" label="Branch" initialValue={user?.branchId}>
              <Select placeholder="Select branch">
                {branches.map((b) => (
                  <Option key={b.id} value={b.id}>{b.name}</Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item name="description" label="Detailed Description / Purpose" rules={[{ required: true, message: 'Enter description' }]}>
            <TextArea rows={2} placeholder="Explain what this expense was incurred for..." />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAddModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={createExpenseMutation.isPending}>
                Save Expense
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
