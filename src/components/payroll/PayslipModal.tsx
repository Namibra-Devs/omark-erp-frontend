// src/components/payroll/PayslipModal.tsx
import React from 'react';
import { Modal, Row, Col, Typography, Tag, Space, Button } from 'antd';
import {
  PrinterOutlined,
  CheckCircleOutlined,
  BankOutlined,
  DollarOutlined,
  UserOutlined,
  CalendarOutlined,
  FileProtectOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { PayrollRecord } from '@/api/payroll';
import { salaryTypeLabels, paymentMethodLabels } from '@/mock/staffCompensation';
import { tokens } from '@/constants/tokens';

const { Title, Text } = Typography;

interface PayslipModalProps {
  open: boolean;
  onClose: () => void;
  record: PayrollRecord | null;
}

export const PayslipModal: React.FC<PayslipModalProps> = ({ open, onClose, record }) => {
  if (!record) return null;

  const basePayGHS = (record.baseSalaryMinor || 0) / 100;
  const overtimeGHS = (record.overtimeMinor || 0) / 100;
  const transportGHS = (record.transportAllowanceMinor || 0) / 100;
  const housingGHS = (record.housingAllowanceMinor || 0) / 100;
  const mealGHS = (record.mealAllowanceMinor || 0) / 100;
  const otherAllowanceGHS = (record.otherAllowanceMinor || 0) / 100;

  const commissionGHS = (record.commissionMinor || 0) / 100;
  const salesBonusGHS = (record.salesBonusMinor || 0) / 100;
  const attendanceBonusGHS = (record.attendanceBonusMinor || 0) / 100;
  const punctualityBonusGHS = (record.punctualityBonusMinor || 0) / 100;
  const productivityBonusGHS = (record.productivityBonusMinor || 0) / 100;
  const projectCompletionBonusGHS = (record.projectCompletionBonusMinor || 0) / 100;
  const genericBonusGHS =
    ((record.bonusMinor || 0) -
      (commissionGHS + salesBonusGHS + attendanceBonusGHS + punctualityBonusGHS + productivityBonusGHS + projectCompletionBonusGHS) * 100 > 0)
      ? ((record.bonusMinor || 0) -
          (commissionGHS + salesBonusGHS + attendanceBonusGHS + punctualityBonusGHS + productivityBonusGHS + projectCompletionBonusGHS) * 100) / 100
      : 0;

  const totalAllowancesGHS = transportGHS + housingGHS + mealGHS + otherAllowanceGHS;
  const totalBonusesGHS =
    (record.bonusMinor || 0) / 100 ||
    (commissionGHS + salesBonusGHS + attendanceBonusGHS + punctualityBonusGHS + productivityBonusGHS + projectCompletionBonusGHS);
  const grossPayGHS = basePayGHS + overtimeGHS + totalAllowancesGHS + totalBonusesGHS;

  const taxSSNITGHS = (record.statutoryDeductionMinor || 0) / 100;
  const latenessGHS = (record.latenessDeductionMinor || 0) / 100;
  const absenceGHS = (record.absenceDeductionMinor || 0) / 100;
  const loanGHS = (record.loanDeductionMinor || 0) / 100;
  const advanceGHS = (record.advanceDeductionMinor || 0) / 100;
  const otherDeductionGHS = (record.otherDeductionMinor || 0) / 100;
  const totalDeductionsGHS =
    (record.deductionsMinor || 0) / 100 ||
    (taxSSNITGHS + latenessGHS + absenceGHS + loanGHS + advanceGHS + otherDeductionGHS);

  const netPayGHS = (record.netSalaryMinor || 0) / 100 || (grossPayGHS - totalDeductionsGHS);

  const earningsItems = [
    { label: 'Basic Salary', amount: basePayGHS, bold: true },
    ...(overtimeGHS > 0 ? [{ label: 'Overtime Pay', amount: overtimeGHS }] : []),
    ...(transportGHS > 0 ? [{ label: 'Transport Allowance', amount: transportGHS }] : []),
    ...(housingGHS > 0 ? [{ label: 'Housing Allowance', amount: housingGHS }] : []),
    ...(mealGHS > 0 ? [{ label: 'Meal Allowance', amount: mealGHS }] : []),
    ...(otherAllowanceGHS > 0 ? [{ label: 'Other Allowance', amount: otherAllowanceGHS }] : []),
    ...(commissionGHS > 0 ? [{ label: 'Sales Commission', amount: commissionGHS, tag: 'Commission' }] : []),
    ...(salesBonusGHS > 0 ? [{ label: 'Plot Sales Bonus', amount: salesBonusGHS, tag: 'Bonus' }] : []),
    ...(attendanceBonusGHS > 0 ? [{ label: 'Attendance Bonus', amount: attendanceBonusGHS, tag: 'Bonus' }] : []),
    ...(punctualityBonusGHS > 0 ? [{ label: 'Punctuality Bonus', amount: punctualityBonusGHS, tag: 'Bonus' }] : []),
    ...(productivityBonusGHS > 0 ? [{ label: 'Productivity Incentive', amount: productivityBonusGHS, tag: 'Bonus' }] : []),
    ...(projectCompletionBonusGHS > 0 ? [{ label: 'Project Milestone Bonus', amount: projectCompletionBonusGHS, tag: 'Bonus' }] : []),
    ...(genericBonusGHS > 0 ? [{ label: 'Performance Bonus', amount: genericBonusGHS, tag: 'Bonus' }] : []),
  ];

  const deductionItems = [
    ...(taxSSNITGHS > 0 ? [{ label: 'SSNIT & Income Tax (PAYE)', amount: taxSSNITGHS }] : []),
    ...(latenessGHS > 0 ? [{ label: 'Lateness Deductions', amount: latenessGHS }] : []),
    ...(absenceGHS > 0 ? [{ label: 'Absence Deductions', amount: absenceGHS }] : []),
    ...(loanGHS > 0 ? [{ label: 'Staff Loan Repayment', amount: loanGHS }] : []),
    ...(advanceGHS > 0 ? [{ label: 'Salary Advance Recovery', amount: advanceGHS }] : []),
    ...(otherDeductionGHS > 0 ? [{ label: 'Other Deductions', amount: otherDeductionGHS }] : []),
    ...(deductionItemsFallback(taxSSNITGHS, latenessGHS, absenceGHS, loanGHS, advanceGHS, totalDeductionsGHS)),
  ];

  function deductionItemsFallback(tax: number, late: number, abs: number, loan: number, adv: number, total: number) {
    if (tax === 0 && late === 0 && abs === 0 && loan === 0 && adv === 0 && total > 0) {
      return [{ label: 'General Deductions', amount: total }];
    }
    return [];
  }

  const salaryTypeConfig = record.salaryType ? salaryTypeLabels[record.salaryType] : undefined;
  const paymentMethodConfig = record.paymentMethod ? paymentMethodLabels[record.paymentMethod] : undefined;

  // Clean, dedicated pop-up print handler
  const handlePrint = () => {
    const container = document.getElementById('payslip-print-content');
    if (!container) {
      window.print();
      return;
    }

    const printWin = window.open('', '_blank', 'width=960,height=800');
    if (!printWin) {
      window.print();
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Payslip - ${record.staffName || 'Staff'} (${record.month})</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
            body { background: #ffffff; color: #1e293b; padding: 24px; font-size: 13px; line-height: 1.5; }
            table { border-collapse: collapse; width: 100%; }
            @page { size: A4 portrait; margin: 12mm; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${container.innerHTML}
        </body>
      </html>
    `);

    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
      printWin.close();
    }, 300);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={940}
      style={{ maxWidth: '96%', top: 20 }}
      footer={[
        <Button key="close" size="large" onClick={onClose}>
          Close
        </Button>,
        <Button key="print" size="large" type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
          Print Payslip
        </Button>,
      ]}
    >
      <div id="payslip-print-content" style={{ padding: '8px 12px' }}>
        {/* Header Branding */}
        <div style={{ borderBottom: '3px solid #2E5E8C', paddingBottom: 16, marginBottom: 20 }}>
          <Row justify="space-between" align="middle" gutter={[16, 16]}>
            <Col xs={24} sm={14}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    minWidth: 48,
                    borderRadius: 8,
                    background: '#2E5E8C',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    fontWeight: 800,
                  }}
                >
                  O
                </div>
                <div>
                  <Title level={3} style={{ color: '#2E5E8C', margin: 0, fontWeight: 800, letterSpacing: -0.3, lineHeight: 1.2 }}>
                    OMARK REAL ESTATE
                  </Title>
                  <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, display: 'block', marginTop: 2 }}>
                    Staff Monthly Compensation & Payout Statement
                  </Text>
                </div>
              </div>
            </Col>
            <Col xs={24} sm={10} style={{ textAlign: 'right' }}>
              <Tag
                color={record.status === 'paid' ? 'green' : record.status === 'approved' ? 'blue' : 'gold'}
                style={{ fontSize: 13, padding: '5px 14px', fontWeight: 700, borderRadius: 12 }}
              >
                {record.status === 'paid'
                  ? 'PAID & DISBURSED'
                  : record.status === 'approved'
                  ? 'APPROVED (READY FOR PAYOUT)'
                  : 'PENDING APPROVAL'}
              </Tag>
              <div style={{ marginTop: 6 }}>
                <Text strong style={{ fontSize: 14, color: '#334155' }}>
                  Pay Period: {record.month}
                </Text>
                {record.code && (
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                    ({record.code})
                  </Text>
                )}
              </div>
            </Col>
          </Row>
        </div>

        {/* Employee & Compensation Info Grid (Robust HTML Table for Reliable Screen & Print Alignment) */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 16, background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ width: '18%', background: '#f8fafc', padding: '9px 12px', fontWeight: 600, color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                  Employee Name
                </td>
                <td style={{ width: '32%', padding: '9px 12px', fontWeight: 700, color: '#1e293b', borderRight: '1px solid #e2e8f0' }}>
                  {record.staffName || 'Staff Member'}
                </td>
                <td style={{ width: '18%', background: '#f8fafc', padding: '9px 12px', fontWeight: 600, color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                  Staff ID
                </td>
                <td style={{ width: '32%', padding: '9px 12px', color: '#0958d9', fontFamily: 'monospace', fontWeight: 600 }}>
                  {record.staffUserId}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ background: '#f8fafc', padding: '9px 12px', fontWeight: 600, color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                  Role / Designation
                </td>
                <td style={{ padding: '9px 12px', color: '#1e293b', borderRight: '1px solid #e2e8f0' }}>
                  {record.staffRole || 'Office Staff'}
                </td>
                <td style={{ background: '#f8fafc', padding: '9px 12px', fontWeight: 600, color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                  Branch Location
                </td>
                <td style={{ padding: '9px 12px', color: '#1e293b' }}>
                  {record.branchName || 'Head Office'}
                </td>
              </tr>
              <tr>
                <td style={{ background: '#f8fafc', padding: '9px 12px', fontWeight: 600, color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                  Salary Structure
                </td>
                <td style={{ padding: '9px 12px', color: '#1e293b', borderRight: '1px solid #e2e8f0' }}>
                  <Tag color={salaryTypeConfig?.color || 'blue'} style={{ fontWeight: 600 }}>
                    {salaryTypeConfig?.label || 'Standard Fixed'}
                  </Tag>
                </td>
                <td style={{ background: '#f8fafc', padding: '9px 12px', fontWeight: 600, color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                  Payment Channel
                </td>
                <td style={{ padding: '9px 12px', color: '#1e293b' }}>
                  <span>{paymentMethodConfig?.icon} {paymentMethodConfig?.label || 'Bank Transfer'}</span>
                  {record.paymentReference && <Tag color="default" style={{ marginLeft: 6 }}>{record.paymentReference}</Tag>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Official Disbursement Receipt Voucher Ribbon (When Paid) */}
        {record.status === 'paid' && (
          <div
            style={{
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 20,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                <Text strong style={{ color: '#274916', fontSize: 14 }}>
                  Official Disbursement & Settlement Receipt
                </Text>
                <Tag color="success" style={{ fontWeight: 700, margin: 0 }}>PAID</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Ref: <strong style={{ color: '#1e293b', fontFamily: 'monospace' }}>{record.paymentReference || record.code || 'N/A'}</strong>
                {record.paidAt && (
                  <span> · Paid on {dayjs(record.paidAt).format('DD MMM YYYY, hh:mm A')}</span>
                )}
              </Text>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Amount Disbursed</Text>
              <Text strong style={{ fontSize: 16, color: '#389e0d' }}>
                GH₵ {netPayGHS.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </div>
          </div>
        )}

        {/* Itemized Components Breakdown Grid */}
        <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
          {/* Earnings Column */}
          <Col xs={24} md={12}>
            <div
              style={{
                background: '#f6ffed',
                border: '1px solid #b7eb8f',
                borderRadius: 8,
                padding: '16px 18px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <Text strong style={{ color: '#237804', fontSize: 15, display: 'block', marginBottom: 12 }}>
                  ➕ Earnings & Allowances
                </Text>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <tbody>
                    {earningsItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e8f5e9', height: 32 }}>
                        <td style={{ padding: '6px 0', verticalAlign: 'middle' }}>
                          <span style={{ fontWeight: item.bold ? 600 : 400, color: '#262626' }}>{item.label}</span>
                          {item.tag && (
                            <Tag color="green" style={{ fontSize: 10, marginLeft: 8, borderRadius: 10 }}>
                              {item.tag}
                            </Tag>
                          )}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: item.bold ? 700 : 500,
                            padding: '6px 0',
                            fontVariantNumeric: 'tabular-nums',
                            color: '#135200',
                          }}
                        >
                          GH₵ {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ borderTop: '2px solid #b7eb8f', paddingTop: 10, marginTop: 14 }}>
                <Row justify="space-between" align="middle">
                  <Col>
                    <Text strong style={{ color: '#237804', fontSize: 14 }}>
                      Gross Total Earnings
                    </Text>
                  </Col>
                  <Col>
                    <Text strong style={{ color: '#237804', fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
                      GH₵ {grossPayGHS.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </Col>
                </Row>
              </div>
            </div>
          </Col>

          {/* Deductions Column */}
          <Col xs={24} md={12}>
            <div
              style={{
                background: '#fff1f0',
                border: '1px solid #ffa39e',
                borderRadius: 8,
                padding: '16px 18px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <Text strong style={{ color: '#cf1322', fontSize: 15, display: 'block', marginBottom: 12 }}>
                  ➖ Deductions & Recoveries
                </Text>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <tbody>
                    {deductionItems.length > 0 ? (
                      deductionItems.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #ffebe8', height: 32 }}>
                          <td style={{ padding: '6px 0', color: '#262626', verticalAlign: 'middle' }}>{item.label}</td>
                          <td
                            style={{
                              textAlign: 'right',
                              color: '#cf1322',
                              fontWeight: 500,
                              padding: '6px 0',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            - GH₵ {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr style={{ height: 32 }}>
                        <td colSpan={2} style={{ color: '#8c8c8c', fontStyle: 'italic', padding: '6px 0' }}>
                          No statutory or loan deductions recorded
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ borderTop: '2px solid #ffa39e', paddingTop: 10, marginTop: 14 }}>
                <Row justify="space-between" align="middle">
                  <Col>
                    <Text strong style={{ color: '#cf1322', fontSize: 14 }}>
                      Total Deductions
                    </Text>
                  </Col>
                  <Col>
                    <Text strong style={{ color: '#cf1322', fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
                      - GH₵ {totalDeductionsGHS.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </Col>
                </Row>
              </div>
            </div>
          </Col>
        </Row>

        {/* Net Pay Executive Summary Banner */}
        <div
          style={{
            background: '#f0f5ff',
            border: '2px solid #adc6ff',
            borderRadius: 8,
            padding: '16px 24px',
            marginBottom: 16,
          }}
        >
          <Row justify="space-between" align="middle" gutter={[16, 16]}>
            <Col xs={24} sm={14}>
              <Text strong style={{ fontSize: 16, color: '#1d39c4', display: 'block' }}>
                NET PAYABLE SALARY
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Disbursed to employee for pay period {record.month}
              </Text>
            </Col>
            <Col xs={24} sm={10} style={{ textAlign: 'right' }}>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: tokens.primary,
                  fontVariantNumeric: 'tabular-nums',
                  display: 'inline-block',
                }}
              >
                GH₵ {netPayGHS.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </Col>
          </Row>
        </div>

        {/* Notes & Remarks */}
        {record.notes && (
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 6, marginBottom: 16, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <strong>HR / Accounting Notes:</strong> {record.notes}
            </Text>
          </div>
        )}

        {/* Official Signatures Section for Printed Statements */}
        <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid #cbd5e1' }}>
          <Row justify="space-between" gutter={48}>
            <Col span={10}>
              <div style={{ borderBottom: '1px solid #64748b', height: 36, marginBottom: 6 }}></div>
              <Text strong style={{ fontSize: 12, display: 'block', color: '#334155' }}>Prepared By: Accounts Officer</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>Date: {dayjs().format('DD/MM/YYYY')}</Text>
            </Col>
            <Col span={10}>
              <div style={{ borderBottom: '1px solid #64748b', height: 36, marginBottom: 6 }}></div>
              <Text strong style={{ fontSize: 12, display: 'block', color: '#334155' }}>Approved By: Managing Director / Admin</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>Date: {dayjs().format('DD/MM/YYYY')}</Text>
            </Col>
          </Row>
        </div>

        {/* Footer Disclaimer */}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 10 }}>
            Official computer-generated payslip from Omark Real Estate ERP. Generated on {dayjs().format('MMMM D, YYYY h:mm A')}.
          </Text>
        </div>
      </div>
    </Modal>
  );
};
