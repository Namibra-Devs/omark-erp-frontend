// src/components/paymentPlan/CustomerStatementModal.tsx
import React, { useRef } from 'react';
import {
  Modal,
  Button,
  Typography,
  Space,
  Tag,
  Divider,
  Row,
  Col,
  Table,
  Card,
  Progress,
  Badge,
} from 'antd';
import {
  PrinterOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  DollarOutlined,
  UserOutlined,
  HomeOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { PaymentPlan } from '@/types';
import {
  buildPaymentPlanSchedule,
  getPlanPaymentOverrides,
  type PaymentPlanScheduleInfo,
  type ScheduleInstallmentRow,
} from '@/utils/paymentPlanSchedule';
import { tokens } from '@/constants/tokens';

const { Title, Text, Paragraph } = Typography;

export interface CustomerStatementModalProps {
  open: boolean;
  onClose: () => void;
  plan: (Partial<PaymentPlan> & { id: string }) | null;
  customerName?: string;
  customerPhone?: string;
  propertyName?: string;
}

export const CustomerStatementModal: React.FC<CustomerStatementModalProps> = ({
  open,
  onClose,
  plan,
  customerName = 'Valued Customer',
  customerPhone,
  propertyName,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!plan) return null;

  const scheduleInfo: PaymentPlanScheduleInfo = buildPaymentPlanSchedule(plan);
  const overrides = getPlanPaymentOverrides(plan.id);
  const transactions = overrides?.transactions || [];

  const totalContractGHS = (plan.totalAmountMinor || scheduleInfo.totalAmountMinor || 0) / 100;
  const downPaymentGHS = (plan.downPaymentMinor || scheduleInfo.downPaymentMinor || 0) / 100;
  const scheduledLiabilityGHS = scheduleInfo.totalScheduledMinor / 100;
  const totalPaidGHS = scheduleInfo.totalPaidGHS;
  const currentBalanceGHS = scheduleInfo.currentBalanceGHS;
  const percentPaid =
    scheduledLiabilityGHS > 0
      ? Math.min(100, Math.round((totalPaidGHS / scheduledLiabilityGHS) * 100))
      : 100;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    const rowsHtml = scheduleInfo.rows
      .map(
        (r) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #e8e8e8; text-align: center; font-weight: 600;">${r.ordinal}</td>
          <td style="padding: 8px; border: 1px solid #e8e8e8;">${r.dueDateFormatted}</td>
          <td style="padding: 8px; border: 1px solid #e8e8e8; text-align: right;">GHS ${r.baseInstallmentGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding: 8px; border: 1px solid #e8e8e8; text-align: right; font-weight: 600;">GHS ${r.installmentGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding: 8px; border: 1px solid #e8e8e8; text-align: right; color: ${r.paidAmountGHS > 0 ? '#389e0d' : '#8c8c8c'};">GHS ${r.paidAmountGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding: 8px; border: 1px solid #e8e8e8; font-size: 11px;">
            ${r.deficitGHS > 0 ? `<span style="color: #d46b08;">Deficit: -GHS ${r.deficitGHS.toLocaleString()}</span>` : ''}
            ${r.surplusAppliedGHS > 0 ? `<span style="color: #389e0d;">Surplus: +GHS ${r.surplusAppliedGHS.toLocaleString()}</span>` : ''}
            ${r.deficitGHS === 0 && r.surplusAppliedGHS === 0 ? '—' : ''}
          </td>
          <td style="padding: 8px; border: 1px solid #e8e8e8; text-align: right; font-weight: 600;">GHS ${r.remainingBalanceGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding: 8px; border: 1px solid #e8e8e8; text-align: center;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: ${
              r.status === 'completed' ? '#f6ffed; color: #52c41a;' : r.status === 'partially_paid' ? '#fffbe6; color: #d48806;' : r.status === 'overdue' ? '#fff1f0; color: #f5222d;' : '#e6f7ff; color: #1890ff;'
            }">
              ${r.statusLabel}
            </span>
          </td>
        </tr>
      `
      )
      .join('');

    const txRowsHtml =
      transactions.length > 0
        ? transactions
            .map(
              (tx) => `
          <tr>
            <td style="padding: 6px; border: 1px solid #e8e8e8;">${dayjs(tx.paidOn).format('DD MMM YYYY')}</td>
            <td style="padding: 6px; border: 1px solid #e8e8e8;">${tx.reference || '—'}</td>
            <td style="padding: 6px; border: 1px solid #e8e8e8; text-transform: uppercase;">${String(tx.method).replace('_', ' ')}</td>
            <td style="padding: 6px; border: 1px solid #e8e8e8; text-align: right; font-weight: 600;">GHS ${(tx.amountMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td style="padding: 6px; border: 1px solid #e8e8e8;">Installment #${tx.sequence || 1}</td>
          </tr>
        `
            )
            .join('')
        : `<tr><td colspan="5" style="text-align: center; padding: 8px; color: #8c8c8c;">No ledger transactions logged yet.</td></tr>`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Statement of Account — ${customerName}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #1f1f1f;
              margin: 0;
              padding: 30px;
            }
            .statement-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #0050b3;
              padding-bottom: 16px;
              margin-bottom: 24px;
            }
            .brand {
              font-size: 24px;
              font-weight: bold;
              color: #0050b3;
              text-transform: uppercase;
            }
            .sub-title {
              font-size: 13px;
              color: #595959;
              margin-top: 4px;
            }
            .summary-cards {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin-bottom: 24px;
            }
            .card {
              background: #fafafa;
              border: 1px solid #e8e8e8;
              border-radius: 6px;
              padding: 12px;
              text-align: center;
            }
            .card-label {
              font-size: 11px;
              text-transform: uppercase;
              color: #8c8c8c;
              margin-bottom: 4px;
            }
            .card-val {
              font-size: 16px;
              font-weight: bold;
              color: #1f1f1f;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
              margin-bottom: 24px;
            }
            th {
              background: #f0f5ff;
              color: #0050b3;
              font-weight: 600;
              padding: 8px;
              border: 1px solid #d6e4ff;
              text-align: left;
            }
            .section-title {
              font-size: 15px;
              font-weight: bold;
              color: #0050b3;
              margin-bottom: 10px;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="statement-header">
            <div>
              <div class="brand">OMARK REAL ESTATE</div>
              <div class="sub-title">Official Customer Statement of Account & Dynamic Amortization Schedule</div>
              <div style="font-size: 12px; color: #8c8c8c; margin-top: 6px;">Generated: ${dayjs().format('DD MMMM YYYY, HH:mm')}</div>
            </div>
            <div style="text-align: right; font-size: 13px;">
              <div>Client: <strong>${customerName}</strong></div>
              <div>Phone: <strong>${customerPhone || 'N/A'}</strong></div>
              <div>Property: <strong>${propertyName || 'Standard Estate Unit'}</strong></div>
              <div>Plan ID: <strong>${plan.id}</strong></div>
            </div>
          </div>

          <div class="summary-cards">
            <div class="card">
              <div class="card-label">Total Contract Price</div>
              <div class="card-val">GHS ${totalContractGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="card">
              <div class="card-label">Down Payment Paid</div>
              <div class="card-val">GHS ${downPaymentGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="card">
              <div class="card-label">Installments Paid</div>
              <div class="card-val" style="color: #389e0d;">GHS ${totalPaidGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="card">
              <div class="card-label">Current Outstanding Balance</div>
              <div class="card-val" style="color: #0050b3;">GHS ${currentBalanceGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div class="section-title">Dynamic Amortization Breakdown (${scheduleInfo.numMonths} Monthly Installments)</div>
          <table>
            <thead>
              <tr>
                <th style="text-align: center;">Inst.</th>
                <th>Due Date</th>
                <th style="text-align: right;">Base Scheduled</th>
                <th style="text-align: right;">Adjusted Expected</th>
                <th style="text-align: right;">Paid Amount</th>
                <th>Deficit / Surplus</th>
                <th style="text-align: right;">Remaining Balance</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="section-title">Payment Transaction History</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Method</th>
                <th style="text-align: right;">Amount (GHS)</th>
                <th>Target Installment</th>
              </tr>
            </thead>
            <tbody>
              ${txRowsHtml}
            </tbody>
          </table>

          <div style="font-size: 11px; color: #8c8c8c; text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 12px;">
            This statement reflects real-time amortization adjustments based on actual cash receipts. For questions, contact Omark ERP Front Desk & Accounts.
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const columns: any[] = [
    {
      title: 'Inst.',
      dataIndex: 'ordinal',
      key: 'ordinal',
      width: 75,
      align: 'center',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDateFormatted',
      key: 'dueDate',
      width: 120,
    },
    {
      title: 'Base (₵)',
      dataIndex: 'baseInstallmentGHS',
      key: 'baseInstallmentGHS',
      width: 110,
      align: 'right',
      render: (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
    {
      title: 'Adjusted Expected (₵)',
      dataIndex: 'installmentGHS',
      key: 'installmentGHS',
      width: 150,
      align: 'right',
      render: (v: number, r: ScheduleInstallmentRow) => (
        <Space direction="vertical" size={0} style={{ textAlign: 'right', width: '100%' }}>
          <Text strong style={{ color: r.deficitGHS > 0 ? '#d46b08' : undefined }}>
            ₵{v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          {r.surplusAppliedGHS > 0 && (
            <Text type="secondary" style={{ fontSize: 10, color: '#52c41a' }}>
              (Reduced by ₵{r.surplusAppliedGHS.toLocaleString()} surplus)
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Paid Cash (₵)',
      dataIndex: 'paidAmountGHS',
      key: 'paidAmountGHS',
      width: 120,
      align: 'right',
      render: (v: number) => (
        <Text strong style={{ color: v > 0 ? '#52c41a' : '#8c8c8c' }}>
          {v > 0 ? `₵${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
        </Text>
      ),
    },
    {
      title: 'Deficit / Surplus (₵)',
      key: 'adjustment',
      width: 140,
      render: (_: any, r: ScheduleInstallmentRow) => {
        if (r.deficitGHS > 0) {
          return (
            <Tag color="orange" style={{ fontSize: 11 }}>
              -₵{r.deficitGHS.toLocaleString()} deficit rolled
            </Tag>
          );
        }
        if (r.surplusAppliedGHS > 0) {
          return (
            <Tag color="green" style={{ fontSize: 11 }}>
              +₵{r.surplusAppliedGHS.toLocaleString()} surplus
            </Tag>
          );
        }
        return <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Remaining Balance (₵)',
      dataIndex: 'remainingBalanceGHS',
      key: 'remainingBalanceGHS',
      width: 140,
      align: 'right',
      render: (v: number) => (
        <Text strong style={{ color: v === 0 ? '#52c41a' : '#0050b3' }}>
          ₵{v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center',
      render: (_: any, r: ScheduleInstallmentRow) => {
        if (r.status === 'completed') {
          return (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              Paid
            </Tag>
          );
        }
        if (r.status === 'partially_paid') {
          return (
            <Tag color="gold" icon={<ClockCircleOutlined />}>
              Partially Paid
            </Tag>
          );
        }
        if (r.status === 'overdue') {
          return (
            <Tag color="red" icon={<WarningOutlined />}>
              Overdue
            </Tag>
          );
        }
        return <Tag color="blue">Upcoming</Tag>;
      },
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={900}
      style={{ top: 20 }}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
        <Button
          key="print"
          type="primary"
          icon={<PrinterOutlined />}
          onClick={handlePrint}
          style={{ background: tokens.primary, borderColor: tokens.primary }}
        >
          Print Official Statement
        </Button>,
      ]}
      title={
        <Space>
          <FileTextOutlined style={{ color: tokens.primary }} />
          <span>Customer Statement of Account & Dynamic Schedule</span>
        </Space>
      }
    >
      <div ref={printRef}>
        {/* Customer & Contract Header */}
        <Card
          size="small"
          style={{
            marginBottom: 16,
            background: '#f9fbfd',
            borderColor: '#e6f0fa',
            borderRadius: 8,
          }}
        >
          <Row gutter={[16, 8]}>
            <Col xs={24} sm={12}>
              <Space direction="vertical" size={2}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  CUSTOMER INFORMATION
                </Text>
                <Title level={5} style={{ margin: 0 }}>
                  <UserOutlined /> {customerName}
                </Title>
                {customerPhone && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Phone: {customerPhone}
                  </Text>
                )}
              </Space>
            </Col>
            <Col xs={24} sm={12}>
              <Space direction="vertical" size={2}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  PROPERTY & PLAN
                </Text>
                <Text strong style={{ fontSize: 13 }}>
                  <HomeOutlined /> {propertyName || 'Standard Estate Property Unit'}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Plan ID: {plan.id} | Duration: {scheduleInfo.numMonths} Months
                </Text>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Financial KPI Banner */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                TOTAL CONTRACT
              </Text>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#262626', marginTop: 2 }}>
                ₵{totalContractGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                DOWN PAYMENT
              </Text>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#595959', marginTop: 2 }}>
                ₵{downPaymentGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                TOTAL PAID TO DATE
              </Text>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#52c41a', marginTop: 2 }}>
                ₵{totalPaidGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ textAlign: 'center', borderRadius: 8, background: '#f0f5ff' }}>
              <Text type="secondary" style={{ fontSize: 11, color: '#0050b3' }}>
                OUTSTANDING BALANCE
              </Text>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0050b3', marginTop: 2 }}>
                ₵{currentBalanceGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </Card>
          </Col>
        </Row>

        {/* Progress Bar */}
        <div style={{ marginBottom: 16, padding: '0 4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span>Installment Settlement Progress</span>
            <span style={{ fontWeight: 700 }}>{percentPaid}% Settled</span>
          </div>
          <Progress percent={percentPaid} strokeColor="#52c41a" status={percentPaid >= 100 ? 'success' : 'active'} />
        </div>

        {/* Dynamic Breakdown Table */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: '#262626' }}>
            Dynamic Monthly Installment Amortization Breakdown:
          </div>
          <Table
            dataSource={scheduleInfo.rows}
            columns={columns}
            rowKey="id"
            pagination={false}
            size="small"
            bordered
            scroll={{ x: 780 }}
          />
        </div>

        {/* Transaction History Subtable */}
        {transactions.length > 0 && (
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8, color: '#262626' }}>
              Payment Receipts & Transaction Ledger:
            </div>
            <Table
              dataSource={transactions}
              rowKey="id"
              pagination={false}
              size="small"
              bordered
              columns={[
                {
                  title: 'Date',
                  dataIndex: 'paidOn',
                  key: 'paidOn',
                  render: (v: string) => dayjs(v).format('DD MMM YYYY'),
                },
                {
                  title: 'Receipt Reference',
                  dataIndex: 'reference',
                  key: 'reference',
                  render: (v: string) => <Tag color="blue">{v || '—'}</Tag>,
                },
                {
                  title: 'Method',
                  dataIndex: 'method',
                  key: 'method',
                  render: (v: string) => String(v).toUpperCase().replace('_', ' '),
                },
                {
                  title: 'Amount (₵)',
                  dataIndex: 'amountMinor',
                  key: 'amountMinor',
                  align: 'right',
                  render: (v: number) => (
                    <Text strong style={{ color: '#52c41a' }}>
                      ₵{(v / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  ),
                },
                {
                  title: 'Allocated Installment',
                  dataIndex: 'sequence',
                  key: 'sequence',
                  render: (v: number) => `Installment #${v || 1}`,
                },
              ]}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
