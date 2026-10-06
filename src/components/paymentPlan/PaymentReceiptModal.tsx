// src/components/paymentPlan/PaymentReceiptModal.tsx
import React, { useRef } from 'react';
import { Modal, Button, Typography, Space, Tag, Divider, Row, Col, Card } from 'antd';
import {
  PrinterOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  UserOutlined,
  HomeOutlined,
  CalendarOutlined,
  SafetyCertificateOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { tokens } from '@/constants/tokens';

const { Title, Text, Paragraph } = Typography;

export interface PaymentReceiptData {
  receiptNumber: string;
  customerName: string;
  customerPhone?: string;
  propertyName?: string;
  amountPaidGHS: number;
  paymentDate: string;
  paymentMethod: string;
  reference?: string;
  recordedBy?: string;
  planId?: string;
  installmentOrdinal?: string; // e.g. "1st", "2nd"
  installmentSequence?: number;
  expectedAmountGHS?: number;
  isPartialPayment?: boolean;
  isOverpayment?: boolean;
  deficitRolledOverGHS?: number;
  surplusAppliedGHS?: number;
  newOutstandingBalanceGHS: number;
  totalContractGHS?: number;
}

export interface PaymentReceiptModalProps {
  open: boolean;
  onClose: () => void;
  receipt: PaymentReceiptData | null;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  open,
  onClose,
  receipt,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!receipt) return null;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Official Payment Receipt — ${receipt.receiptNumber}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #1f1f1f;
              margin: 0;
              padding: 24px;
              background: #fff;
            }
            .receipt-box {
              max-width: 650px;
              margin: 0 auto;
              border: 1px solid #d9d9d9;
              border-radius: 8px;
              padding: 30px;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #0050b3;
              padding-bottom: 16px;
              margin-bottom: 20px;
            }
            .brand {
              font-size: 22px;
              font-weight: bold;
              color: #0050b3;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .sub-brand {
              font-size: 12px;
              color: #8c8c8c;
              margin-top: 4px;
            }
            .badge-paid {
              display: inline-block;
              background: #f6ffed;
              border: 1px solid #b7eb8f;
              color: #52c41a;
              padding: 4px 12px;
              border-radius: 4px;
              font-weight: bold;
              font-size: 13px;
              margin-top: 8px;
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              margin-bottom: 20px;
            }
            .grid-item {
              font-size: 13px;
            }
            .grid-label {
              color: #8c8c8c;
              font-size: 11px;
              text-transform: uppercase;
              margin-bottom: 2px;
            }
            .grid-val {
              font-weight: 600;
              color: #262626;
            }
            .amount-banner {
              background: #fafafa;
              border: 1px dashed #d9d9d9;
              border-radius: 6px;
              padding: 16px;
              text-align: center;
              margin-bottom: 20px;
            }
            .amount-val {
              font-size: 26px;
              font-weight: bold;
              color: #0050b3;
            }
            .allocation-box {
              background: #f0f5ff;
              border-left: 4px solid #1890ff;
              padding: 12px 16px;
              border-radius: 4px;
              font-size: 12px;
              margin-bottom: 20px;
            }
            .footer {
              text-align: center;
              font-size: 11px;
              color: #8c8c8c;
              border-top: 1px solid #f0f0f0;
              padding-top: 16px;
              margin-top: 24px;
            }
            @media print {
              body { padding: 0; }
              .receipt-box { border: none; padding: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-box">
            <div class="header">
              <div class="brand">OMARK REAL ESTATE</div>
              <div class="sub-brand">Official Customer Payment Receipt & Ledger Acknowledgment</div>
              <div class="badge-paid">✓ PAYMENT CONFIRMED & CREDITED</div>
            </div>

            <div class="amount-banner">
              <div class="grid-label">Total Amount Paid</div>
              <div class="amount-val">GHS ${receipt.amountPaidGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div style="font-size: 12px; color: #595959; margin-top: 4px;">
                Payment Method: <strong>${receipt.paymentMethod.toUpperCase().replace('_', ' ')}</strong> ${receipt.reference ? `| Ref: ${receipt.reference}` : ''}
              </div>
            </div>

            <div class="grid">
              <div class="grid-item">
                <div class="grid-label">Receipt Number</div>
                <div class="grid-val">${receipt.receiptNumber}</div>
              </div>
              <div class="grid-item">
                <div class="grid-label">Date of Payment</div>
                <div class="grid-val">${dayjs(receipt.paymentDate).format('DD MMMM YYYY')}</div>
              </div>
              <div class="grid-item">
                <div class="grid-label">Customer Name</div>
                <div class="grid-val">${receipt.customerName}</div>
              </div>
              <div class="grid-item">
                <div class="grid-label">Customer Contact</div>
                <div class="grid-val">${receipt.customerPhone || 'N/A'}</div>
              </div>
              <div class="grid-item">
                <div class="grid-label">Allocated Property</div>
                <div class="grid-val">${receipt.propertyName || 'Standard Estate Unit'}</div>
              </div>
              <div class="grid-item">
                <div class="grid-label">Recorded By</div>
                <div class="grid-val">${receipt.recordedBy || 'Authorized Secretary'}</div>
              </div>
            </div>

            <div class="allocation-box">
              <div style="font-weight: bold; margin-bottom: 6px;">Dynamic Amortization & Balance Update:</div>
              <div>• Applied against: <strong>${receipt.installmentOrdinal ? `${receipt.installmentOrdinal} Monthly Installment` : 'Installment Schedule'}</strong></div>
              ${
                receipt.expectedAmountGHS
                  ? `<div>• Scheduled Monthly Amount: <strong>GHS ${receipt.expectedAmountGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>`
                  : ''
              }
              ${
                receipt.isPartialPayment && receipt.deficitRolledOverGHS
                  ? `<div style="color: #d46b08; font-weight: 600;">• Partial Payment: Unpaid deficit of GHS ${receipt.deficitRolledOverGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} automatically rolled over into subsequent installments.</div>`
                  : ''
              }
              ${
                receipt.isOverpayment && receipt.surplusAppliedGHS
                  ? `<div style="color: #389e0d; font-weight: 600;">• Overpayment: Surplus of GHS ${receipt.surplusAppliedGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} credited towards reducing future installments.</div>`
                  : ''
              }
              <div style="margin-top: 6px; font-weight: bold; color: #0050b3;">• Updated Total Outstanding Balance: GHS ${receipt.newOutstandingBalanceGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>

            <div class="footer">
              This receipt was digitally generated by Omark ERP Financial System. Keep this document for your records.
              <br/>Contact front desk or accounts for reconciliation inquiries.
            </div>
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

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={560}
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
          Print Official Receipt
        </Button>,
      ]}
      title={
        <Space>
          <SafetyCertificateOutlined style={{ color: '#52c41a' }} />
          <span>Payment Receipt Confirmation</span>
        </Space>
      }
    >
      <div ref={printRef} style={{ padding: '8px 4px' }}>
        {/* Top Header Card */}
        <div
          style={{
            textAlign: 'center',
            padding: '16px 12px',
            background: 'linear-gradient(135deg, #003a8c 0%, #0050b3 100%)',
            borderRadius: 8,
            color: '#fff',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.5 }}>
            OMARK REAL ESTATE
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
            Official Payment Receipt & Statement Acknowledgment
          </div>
          <Tag color="success" style={{ marginTop: 8, fontWeight: 600 }}>
            <CheckCircleOutlined /> Payment Confirmed
          </Tag>
        </div>

        {/* Amount Paid Banner */}
        <div
          style={{
            background: '#fafafa',
            border: '1px dashed #d9d9d9',
            borderRadius: 8,
            padding: '14px 16px',
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase' }}>
            Amount Credited (Cash Received)
          </Text>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: '#0050b3',
              margin: '4px 0',
            }}
          >
            GHS {receipt.amountPaidGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <Text style={{ fontSize: 12, color: '#595959' }}>
            Method: <strong>{receipt.paymentMethod.toUpperCase().replace('_', ' ')}</strong>
            {receipt.reference ? ` | Ref: ${receipt.reference}` : ''}
          </Text>
        </div>

        {/* Details Grid */}
        <Row gutter={[16, 12]} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
              RECEIPT NO.
            </Text>
            <Text strong style={{ fontSize: 13 }}>{receipt.receiptNumber}</Text>
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
              DATE OF PAYMENT
            </Text>
            <Text strong style={{ fontSize: 13 }}>
              {dayjs(receipt.paymentDate).format('DD MMM YYYY')}
            </Text>
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
              CUSTOMER
            </Text>
            <Text strong style={{ fontSize: 13 }}>{receipt.customerName}</Text>
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
              CONTACT PHONE
            </Text>
            <Text strong style={{ fontSize: 13 }}>{receipt.customerPhone || 'N/A'}</Text>
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
              ALLOCATED PROPERTY
            </Text>
            <Text strong style={{ fontSize: 13 }}>{receipt.propertyName || 'Standard Estate Unit'}</Text>
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
              RECORDED BY
            </Text>
            <Text strong style={{ fontSize: 13 }}>{receipt.recordedBy || 'Secretary'}</Text>
          </Col>
        </Row>

        {/* Dynamic Amortization Breakdown Box */}
        <div
          style={{
            background: '#f0f5ff',
            border: '1px solid #d6e4ff',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 700, color: '#0050b3', marginBottom: 6 }}>
            Dynamic Schedule Recalculation:
          </div>
          <div>
            • Target Installment:{' '}
            <strong>
              {receipt.installmentOrdinal
                ? `${receipt.installmentOrdinal} Monthly Installment`
                : 'Payment Plan Schedule'}
            </strong>
          </div>
          {receipt.expectedAmountGHS !== undefined && (
            <div>
              • Expected Monthly Amount:{' '}
              <strong>
                GHS {receipt.expectedAmountGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
          )}
          {receipt.isPartialPayment && (
            <div style={{ color: '#d46b08', fontWeight: 600, marginTop: 4 }}>
              ⚠️ Partial Payment: Deficit of GHS{' '}
              {receipt.deficitRolledOverGHS?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              has been rolled over into subsequent monthly installments.
            </div>
          )}
          {receipt.isOverpayment && (
            <div style={{ color: '#389e0d', fontWeight: 600, marginTop: 4 }}>
              ✨ Overpayment: Surplus of GHS{' '}
              {receipt.surplusAppliedGHS?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              has been credited directly against upcoming installments.
            </div>
          )}
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, color: '#262626' }}>Total Outstanding Balance:</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#0050b3' }}>
              GHS {receipt.newOutstandingBalanceGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
