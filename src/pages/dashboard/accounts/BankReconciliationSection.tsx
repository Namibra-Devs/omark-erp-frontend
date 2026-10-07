import React, { useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  message,
  Empty,
  Badge,
  Divider,
  Alert,
  Tooltip,
} from 'antd';
import {
  BankOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  UploadOutlined,
  LinkOutlined,
  ReloadOutlined,
  DollarOutlined,
  ThunderboltOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useUnmatchedBankEntriesQuery,
  useImportBankStatementMutation,
  type UnmatchedBankEntry,
  type BankReconciliationSummary,
} from '@/api/bankReconciliation';
import { usePaymentPlansQuery } from '@/api/paymentPlans';
import { useCustomersQuery } from '@/api/customers';
import { recordPlanPaymentWithBackend } from '@/api/paymentPlansPersistence';
import { buildPaymentPlanSchedule } from '@/utils/paymentPlanSchedule';
import { tokens } from '@/constants/tokens';
import type { PaymentPlan, Customer } from '@/types';

const { Text, Title } = Typography;
const { Option } = Select;

const RECONCILED_STORAGE_KEY = 'omark_reconciled_bank_entry_ids';

function getStoredReconciledIds(): string[] {
  try {
    const raw = localStorage.getItem(RECONCILED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveReconciledId(id: string) {
  try {
    const ids = getStoredReconciledIds();
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem(RECONCILED_STORAGE_KEY, JSON.stringify(ids));
    }
  } catch {}
}

export const BankReconciliationSection: React.FC = () => {
  // ── Queries & Mutations ───────────────────────────────────────────────────
  const {
    data: rawUnmatchedEntries = [],
    isLoading: entriesLoading,
    refetch: refetchUnmatched,
  } = useUnmatchedBankEntriesQuery();

  const { data: paymentPlansData, refetch: refetchPlans } = usePaymentPlansQuery({ pageSize: 500 });
  const { data: customersData } = useCustomersQuery({ pageSize: 500 });
  const importBankMutation = useImportBankStatementMutation();

  const paymentPlans: PaymentPlan[] = paymentPlansData?.items ?? [];
  const customers: Customer[] = customersData?.items ?? [];

  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach((c) => map.set(c.id, c));
    return map;
  }, [customers]);

  // ── State ────────────────────────────────────────────────────────────────
  const [importModal, setImportModal] = useState(false);
  const [matchModal, setMatchModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<UnmatchedBankEntry | null>(null);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [importForm] = Form.useForm();
  const [matchForm] = Form.useForm();
  const [reconciledIds, setReconciledIds] = useState<string[]>(getStoredReconciledIds);
  const [reconciliationResult, setReconciliationResult] = useState<BankReconciliationSummary | null>(null);

  // Active entries filtered by locally matched state
  const activeUnmatchedEntries = useMemo(() => {
    return rawUnmatchedEntries.filter((e) => !reconciledIds.includes(e.id));
  }, [rawUnmatchedEntries, reconciledIds]);

  const locallyMatchedCount = rawUnmatchedEntries.length - activeUnmatchedEntries.length;

  // Calculate totals
  const totalUnmatchedMinor = activeUnmatchedEntries.reduce((sum, e) => sum + (e.amountMinor || 0), 0);
  const totalMatchedMinor = rawUnmatchedEntries
    .filter((e) => reconciledIds.includes(e.id))
    .reduce((sum, e) => sum + (e.amountMinor || 0), 0);

  const totalEntriesCount = rawUnmatchedEntries.length;
  const matchRate = totalEntriesCount > 0 ? Math.round((locallyMatchedCount / totalEntriesCount) * 100) : 100;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleOpenMatch = (entry: UnmatchedBankEntry) => {
    setSelectedEntry(entry);
    matchForm.setFieldsValue({
      amountGHS: entry.amountMinor / 100,
      reference: entry.reference || `BNK-${entry.id.slice(0, 8)}`,
      date: entry.date ? dayjs(entry.date) : dayjs(),
    });
    setMatchModal(true);
  };

  const handleConfirmMatch = async (values: any) => {
    if (!selectedEntry) return;
    setMatchingLoading(true);
    try {
      const plan = paymentPlans.find((p) => p.id === values.planId);
      if (!plan) throw new Error('Selected payment plan not found');

      const customer = customerMap.get(plan.customerId);
      const customerName = customer ? `${customer.firstName} ${customer.lastName}` : 'Customer';

      await recordPlanPaymentWithBackend(
        plan,
        {
          amountMinor: Math.round(values.amountGHS * 100),
          paidOn: values.date ? values.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
          method: 'bank_transfer',
          reference: values.reference || selectedEntry.reference || `RECON-${Date.now().toString().slice(-6)}`,
          notes: `Reconciled from Bank Statement entry: ${selectedEntry.description || selectedEntry.reference || ''}`,
        },
        {
          name: customerName,
          phone: customer?.phoneNumber,
        }
      );

      saveReconciledId(selectedEntry.id);
      setReconciledIds((prev) => [...prev, selectedEntry.id]);

      message.success(`Reconciled GH₵ ${values.amountGHS.toFixed(2)} against ${customerName}'s payment plan!`);
      setMatchModal(false);
      matchForm.resetFields();
      setSelectedEntry(null);
      refetchPlans();
      refetchUnmatched();
    } catch (err: any) {
      message.error(err?.message || 'Failed to reconcile entry');
    } finally {
      setMatchingLoading(false);
    }
  };

  const handleLoadDemoStatement = () => {
    // Generate realistic statement transactions based on actual active plans in the ERP
    const sampleTxns: any[] = [];
    const dateStr = dayjs().format('YYYY-MM-DD');

    if (paymentPlans.length > 0) {
      paymentPlans.slice(0, 3).forEach((plan, idx) => {
        const sched = buildPaymentPlanSchedule(plan);
        const nextDue = sched.nextDueRow;
        const amt = nextDue ? nextDue.installmentMinor : 250000;
        const cust = customerMap.get(plan.customerId);
        const name = cust ? `${cust.firstName} ${cust.lastName}` : 'Customer Deposit';
        sampleTxns.push({
          date: dateStr,
          amountMinor: amt,
          reference: `GCB-${100234 + idx}`,
          description: `Direct Bank Transfer - ${name}`,
        });
      });
    }

    // Add an unmatched miscellaneous credit
    sampleTxns.push({
      date: dateStr,
      amountMinor: 350000,
      reference: `STANBIC-${887712}`,
      description: 'Clearing House Inward Wire - Unknown Payer',
    });

    importForm.setFieldsValue({
      jsonText: JSON.stringify(sampleTxns, null, 2),
    });
    message.info('Loaded sample bank statement with ERP customer transactions!');
  };

  return (
    <div>
      {/* ── Summary Stats ──────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" style={{ borderRadius: 8, background: '#fafafa' }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}>Unmatched Statement Variance</Text>}
              value={totalUnmatchedMinor / 100}
              prefix="GH₵"
              precision={2}
              valueStyle={{ color: activeUnmatchedEntries.length > 0 ? '#faad14' : '#52c41a', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" style={{ borderRadius: 8, background: '#fafafa' }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}>Unmatched Entries Count</Text>}
              value={activeUnmatchedEntries.length}
              suffix={`/ ${totalEntriesCount} total`}
              valueStyle={{ color: activeUnmatchedEntries.length > 0 ? '#faad14' : '#52c41a', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" style={{ borderRadius: 8, background: '#fafafa' }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}>Reconciled Amount</Text>}
              value={totalMatchedMinor / 100}
              prefix="GH₵"
              precision={2}
              valueStyle={{ color: '#52c41a', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" style={{ borderRadius: 8, background: '#fafafa' }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}>Reconciliation Match Rate</Text>}
              value={matchRate}
              suffix="%"
              valueStyle={{ color: tokens.primary, fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Main Reconciliation Table Card ─────────────────────────────── */}
      <Card
        title={
          <Space>
            <BankOutlined style={{ color: tokens.primary }} />
            <span>Bank Reconciliation Manager</span>
            {activeUnmatchedEntries.length > 0 && (
              <Badge count={activeUnmatchedEntries.length} style={{ backgroundColor: '#faad14' }} />
            )}
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} size="small" onClick={() => refetchUnmatched()}>
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              size="small"
              onClick={() => {
                setReconciliationResult(null);
                importForm.resetFields();
                setImportModal(true);
              }}
            >
              Import Statement
            </Button>
          </Space>
        }
        style={{ borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
      >
        {activeUnmatchedEntries.length > 0 ? (
          <Table
            dataSource={activeUnmatchedEntries}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 5 }}
            columns={[
              {
                title: 'Transaction Date',
                dataIndex: 'date',
                key: 'date',
                width: 130,
                render: (d: string) => <Text style={{ fontSize: 12 }}>{d ? dayjs(d).format('YYYY-MM-DD') : 'N/A'}</Text>,
              },
              {
                title: 'Reference',
                dataIndex: 'reference',
                key: 'reference',
                render: (ref: string, record: any) => (
                  <Tag color="geekblue" style={{ fontSize: 11, fontFamily: 'monospace' }}>
                    {ref || record.id.slice(0, 10)}
                  </Tag>
                ),
              },
              {
                title: 'Description / Payer',
                dataIndex: 'description',
                key: 'description',
                render: (desc: string) => (
                  <Text strong style={{ fontSize: 12 }}>
                    {desc || 'Bank Statement Deposit'}
                  </Text>
                ),
              },
              {
                title: 'Statement Amount',
                dataIndex: 'amountMinor',
                key: 'amountMinor',
                align: 'right',
                render: (minor: number) => (
                  <Text strong style={{ color: '#1e293b', fontSize: 13 }}>
                    GH₵ {(minor / 100).toFixed(2)}
                  </Text>
                ),
              },
              {
                title: 'Status',
                key: 'status',
                align: 'center',
                render: () => <Tag color="warning">Unmatched</Tag>,
              },
              {
                title: 'Action',
                key: 'action',
                align: 'right',
                render: (_: any, record: UnmatchedBankEntry) => (
                  <Button
                    type="primary"
                    size="small"
                    icon={<LinkOutlined />}
                    onClick={() => handleOpenMatch(record)}
                  >
                    Match to Plan
                  </Button>
                ),
              },
            ]}
          />
        ) : (
          <Empty
            description={
              <span style={{ color: '#52c41a' }}>
                <CheckCircleOutlined style={{ marginRight: 6 }} />
                All bank statement entries are completely reconciled with ERP payment plans!
              </span>
            }
          />
        )}
      </Card>

      {/* ── Match Entry to Payment Plan Modal ──────────────────────────── */}
      <Modal
        title={
          <Space>
            <LinkOutlined style={{ color: tokens.primary }} />
            <span>Match Bank Entry to Customer Payment Plan</span>
          </Space>
        }
        open={matchModal}
        onCancel={() => {
          setMatchModal(false);
          matchForm.resetFields();
          setSelectedEntry(null);
        }}
        footer={null}
        width={560}
      >
        {selectedEntry && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 16,
            }}
          >
            <Row justify="space-between">
              <Col>
                <Text type="secondary" style={{ fontSize: 12 }}>Bank Transaction Reference</Text>
                <div style={{ fontWeight: 600 }}>{selectedEntry.reference || selectedEntry.id}</div>
              </Col>
              <Col style={{ textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Amount Deposited</Text>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#1677ff' }}>
                  GH₵ {(selectedEntry.amountMinor / 100).toFixed(2)}
                </div>
              </Col>
            </Row>
            {selectedEntry.description && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#475569' }}>
                Description: <em>{selectedEntry.description}</em>
              </div>
            )}
          </div>
        )}

        <Form form={matchForm} layout="vertical" onFinish={handleConfirmMatch}>
          <Form.Item
            name="planId"
            label="Select Customer & Payment Plan to Credit"
            rules={[{ required: true, message: 'Please select a customer payment plan' }]}
          >
            <Select
              placeholder="Search by customer name or property..."
              showSearch
              optionFilterProp="children"
            >
              {paymentPlans.map((plan) => {
                const customer = customerMap.get(plan.customerId);
                const name = customer ? `${customer.firstName} ${customer.lastName}` : `Plan ${plan.id.slice(0, 8)}`;
                const phone = customer?.phoneNumber ? ` (${customer.phoneNumber})` : '';
                const bal = ((plan.balanceMinor || 0) / 100).toLocaleString();
                return (
                  <Option key={plan.id} value={plan.id}>
                    {name}{phone} — Balance: GH₵ {bal}
                  </Option>
                );
              })}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="amountGHS"
                label="Amount to Reconcile (GH₵)"
                rules={[{ required: true, message: 'Enter amount' }]}
              >
                <InputNumber style={{ width: '100%' }} precision={2} min={0.01} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="date" label="Value Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="reference" label="Reconciliation Reference Code">
            <Input placeholder="e.g. REC-BANK-0091" />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setMatchModal(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={matchingLoading}>
                Confirm & Reconcile
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Import Statement Modal ─────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <BankOutlined style={{ color: tokens.primary }} />
            <span>Import & Reconcile Bank Statement</span>
          </Space>
        }
        open={importModal}
        onCancel={() => {
          setImportModal(false);
          importForm.resetFields();
          setReconciliationResult(null);
        }}
        footer={null}
        width={620}
      >
        {reconciliationResult ? (
          <div>
            <Alert
              type="success"
              showIcon
              message="Statement Successfully Processed"
              description={`Processed ${reconciliationResult.totalImported} entries: ${reconciliationResult.matchedCount} auto-matched, ${reconciliationResult.unmatchedCount} unmatched.`}
              style={{ marginBottom: 16 }}
            />
            <Button
              type="primary"
              onClick={() => {
                setReconciliationResult(null);
                setImportModal(false);
                refetchUnmatched();
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <Form
            form={importForm}
            layout="vertical"
            initialValues={{ date: dayjs() }}
            onFinish={async (values) => {
              try {
                let transactions: any[] = [];
                if (values.jsonText) {
                  transactions = JSON.parse(values.jsonText);
                } else {
                  transactions = [
                    {
                      date: values.date ? values.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
                      amountMinor: Math.round((values.amountGHS || 0) * 100),
                      reference: values.reference || undefined,
                      description: values.description || undefined,
                    },
                  ];
                }
                const summary = await importBankMutation.mutateAsync({ transactions });
                setReconciliationResult(summary);
                message.success(
                  `Processed statement! ${summary.matchedCount} matched, ${summary.unmatchedCount} unmatched.`
                );
                refetchUnmatched();
              } catch (error: any) {
                message.error(error?.error?.message || error?.message || 'Failed to import bank statement');
              }
            }}
          >
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Import single bank entries or batch statement data.
              </Text>
              <Button
                size="small"
                icon={<ThunderboltOutlined />}
                onClick={handleLoadDemoStatement}
                style={{ color: '#d97706', borderColor: '#fcd34d' }}
              >
                Load Sample Statement
              </Button>
            </div>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="date" label="Transaction Date">
                  <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="amountGHS" label="Amount (GH₵)">
                  <InputNumber style={{ width: '100%' }} prefix="GH₵" precision={2} min={0.01} placeholder="2500.00" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="reference" label="Reference Code">
              <Input placeholder="e.g. GCB-TRANSFER-9921" />
            </Form.Item>

            <Form.Item name="description" label="Description / Narration">
              <Input placeholder="e.g. Direct Inward Wire - Kwabena Mensah" />
            </Form.Item>

            <Divider>OR Paste JSON Array of Statement Transactions</Divider>

            <Form.Item name="jsonText" label="JSON Transactions">
              <Input.TextArea
                rows={4}
                placeholder={`[\n  { "date": "${dayjs().format('YYYY-MM-DD')}", "amountMinor": 250000, "reference": "GCB-9912", "description": "Customer Deposit" }\n]`}
              />
            </Form.Item>

            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={() => setImportModal(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit" loading={importBankMutation.isPending}>
                  Import & Reconcile
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};
