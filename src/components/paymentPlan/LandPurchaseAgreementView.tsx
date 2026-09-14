// src/components/paymentPlan/LandPurchaseAgreementView.tsx
//
// High-fidelity rendering of the official Omark Real Estate & Construction
// "LAND PURCHASE AGREEMENT (CONTRACT OF SALE)" document.
// Supports preview in portal, print to PDF, and customer acknowledgement.

import React from 'react';
import { Typography, Button, Space, Divider, Tag } from 'antd';
import { PrinterOutlined, DownloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

export interface AgreementScheduleItem {
  installmentNumber: number;
  installmentOrdinal: string;
  dueDate: string;
  installmentAmount: number;
  accumulatedAmount: number;
  remainingBalance: number;
}

export interface LandPurchaseAgreementData {
  agreementDate: string;
  developerName: string;
  developerAddress: string;
  developerPhone: string;
  developerEmail: string;
  purchaserName: string;
  purchaserAddress: string;
  purchaserPhone: string;
  propertyName: string;
  propertyLocation: string;
  projectName: string;
  propertySize: string;
  fullPlotPrice: number;
  fullPlotPriceWords: string;
  halfPlotPrice?: number;
  halfPlotPriceWords?: string;
  initialPayment: number;
  initialPaymentWords: string;
  outstandingBalance: number;
  outstandingBalanceWords: string;
  paymentDurationMonths: number;
  paymentDurationWords: string;
  startDate: string;
  endDate: string;
  schedule: AgreementScheduleItem[];
  secretaryName: string;
  cooName: string;
  ceoName: string;
  purchaserWitnessName?: string;
  purchaserWitnessPhone?: string;
  sentToPortalAt?: string;
  acknowledgedByCustomer?: boolean;
  acknowledgedAt?: string;
}

interface LandPurchaseAgreementViewProps {
  data: LandPurchaseAgreementData;
  showActions?: boolean;
  onAcknowledge?: () => void;
  isCustomerView?: boolean;
}

export const LandPurchaseAgreementView: React.FC<LandPurchaseAgreementViewProps> = ({
  data,
  showActions = true,
  onAcknowledge,
  isCustomerView = false,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const formattedAgreementDate = data.agreementDate
    ? dayjs(data.agreementDate).isValid()
      ? dayjs(data.agreementDate).format('Do [day of] MMMM YYYY')
      : data.agreementDate
    : dayjs().format('Do [day of] MMMM YYYY');

  return (
    <div className="omark-agreement-wrapper" style={{ maxWidth: 860, margin: '0 auto', background: '#fff' }}>
      {/* Top action bar when embedded in preview */}
      {showActions && (
        <div
          className="no-print"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            padding: '12px 16px',
            background: '#f8fafc',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
          }}
        >
          <Space>
            <Tag color="blue" style={{ fontSize: 13, padding: '3px 8px' }}>
              Official Contract of Sale
            </Tag>
            {data.acknowledgedByCustomer && (
              <Tag color="green" icon={<CheckCircleOutlined />}>
                Acknowledged by Purchaser
              </Tag>
            )}
          </Space>
          <Space>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              Print / Save as PDF
            </Button>
            {isCustomerView && !data.acknowledgedByCustomer && onAcknowledge && (
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={onAcknowledge}>
                Sign & Acknowledge
              </Button>
            )}
          </Space>
        </div>
      )}

      {/* Printable Document Container */}
      <div
        id="printable-agreement-content"
        style={{
          fontFamily: "'Times New Roman', Times, serif, 'Segoe UI', Roboto, sans-serif",
          color: '#1a1a1a',
          lineHeight: 1.6,
          padding: '30px 40px',
          background: '#fff',
          boxShadow: showActions ? '0 4px 20px rgba(0,0,0,0.06)' : 'none',
          borderRadius: 8,
        }}
      >
        {/* ================= PAGE 1 ================= */}
        <div className="agreement-page" style={{ minHeight: '900px', position: 'relative' }}>
          {/* Header Banner */}
          <div
            style={{
              background: '#092b5a',
              color: '#ffffff',
              padding: '20px 24px',
              borderRadius: '4px 4px 0 0',
              textAlign: 'center',
              marginBottom: 24,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <div
                style={{
                  background: '#ffffff',
                  color: '#092b5a',
                  padding: '6px 12px',
                  borderRadius: 4,
                  fontWeight: 900,
                  fontSize: 16,
                  letterSpacing: 1.5,
                  display: 'inline-block',
                }}
              >
                OMARK
              </div>
            </div>
            <div
              style={{
                fontSize: 'clamp(18px, 2.5vw, 24px)',
                fontWeight: 800,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              OMARK REAL ESTATE AND CONSTRUCTION COMPANY LTD
            </div>
            <div style={{ fontSize: 13, marginTop: 6, opacity: 0.9 }}>
              Tell: {data.developerPhone || '0546029075'} &nbsp;|&nbsp; Email: {data.developerEmail || 'omark.estate@gmail.com'}
            </div>
          </div>

          {/* Date */}
          <div style={{ textAlign: 'right', marginBottom: 20, fontSize: 14, fontWeight: 600 }}>
            Date: <span style={{ textDecoration: 'underline' }}>{formattedAgreementDate}</span>
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1
              style={{
                fontSize: 'clamp(20px, 3vw, 28px)',
                fontWeight: 900,
                letterSpacing: 1,
                margin: '0 0 6px 0',
                color: '#092b5a',
                textTransform: 'uppercase',
              }}
            >
              LAND PURCHASE AGREEMENT
            </h1>
            <h2
              style={{
                fontSize: 'clamp(16px, 2vw, 20px)',
                fontWeight: 700,
                margin: 0,
                color: '#334155',
              }}
            >
              (CONTRACT OF SALE)
            </h2>
          </div>

          {/* Parties Preamble */}
          <Paragraph style={{ fontSize: 15, textAlign: 'justify', marginBottom: 24, lineHeight: 1.8 }}>
            This Agreement is made on the <strong>{formattedAgreementDate}</strong>, between:
            <br />
            <strong>{data.developerName || 'OMARK REAL ESTATE & CONSTRUCTION'}</strong>,{' '}
            {data.developerAddress || 'P.O. Box T 20, Kumasi, Ghana'}{' '}
            (hereinafter referred to as the <strong>&ldquo;Developer&rdquo;</strong>),
            <br />
            and
            <br />
            <strong>{data.purchaserName}</strong> Address: <strong>{data.purchaserAddress || 'Ghana'}</strong>{' '}
            (hereinafter referred to as the <strong>&ldquo;Purchaser&rdquo;</strong>).
          </Paragraph>

          <Divider style={{ margin: '20px 0' }} />

          {/* 1. Property Description */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#092b5a', marginBottom: 10 }}>
              1. Property Description
            </h3>
            <Paragraph style={{ fontSize: 15, textAlign: 'justify', lineHeight: 1.8 }}>
              The Purchaser agrees to purchase <strong>{data.propertyName || 'the designated plot'}</strong> from the
              Developer, situated at <strong>{data.propertyLocation || 'Kumasi'}</strong>, within the{' '}
              <strong>{data.projectName || 'Pax Hills Estate'}</strong> Community, plot measuring approximately{' '}
              <strong>{data.propertySize || '70ft x 100ft'}</strong>.
            </Paragraph>
          </div>

          {/* 2. Purchase Price */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#092b5a', marginBottom: 10 }}>
              2. Purchase Price
            </h3>
            <ul style={{ listStyleType: 'none', paddingLeft: 0, fontSize: 15, lineHeight: 2 }}>
              <li style={{ marginBottom: 8 }}>
                Total purchase price for the full plots:{' '}
                <strong>
                  ₵{data.fullPlotPrice?.toLocaleString()} ({data.fullPlotPriceWords})
                </strong>
                .
              </li>
              {data.halfPlotPrice ? (
                <li style={{ marginBottom: 8 }}>
                  Price per the half plot:{' '}
                  <strong>
                    ₵{data.halfPlotPrice?.toLocaleString()} ({data.halfPlotPriceWords})
                  </strong>
                  .
                </li>
              ) : null}
              <li style={{ marginBottom: 8 }}>
                Initial payment made:{' '}
                <strong>
                  ₵{data.initialPayment?.toLocaleString()} ({data.initialPaymentWords})
                </strong>
                .
              </li>
              <li style={{ marginBottom: 8 }}>
                Outstanding balance:{' '}
                <strong>
                  ₵{data.outstandingBalance?.toLocaleString()} ({data.outstandingBalanceWords})
                </strong>{' '}
                payable within <strong>{data.paymentDurationWords || `${data.paymentDurationMonths} months`}</strong> from
                the date of this Agreement, either in installments or in full.
              </li>
            </ul>
          </div>
        </div>

        <div className="page-break" style={{ pageBreakBefore: 'always', margin: '40px 0 20px 0' }}>
          <Divider style={{ borderColor: '#cbd5e1' }} />
        </div>

        {/* ================= PAGE 2 ================= */}
        <div className="agreement-page" style={{ minHeight: '900px', position: 'relative' }}>
          {/* Payment Plan Schedule */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#092b5a', marginBottom: 12 }}>
              Payment Plan Schedule:
            </h3>
            <Paragraph style={{ fontSize: 15, textAlign: 'justify', lineHeight: 1.8 }}>
              Both parties have agreed that the remaining amount of{' '}
              <strong>
                ₵{data.outstandingBalance?.toLocaleString()} ({data.outstandingBalanceWords})
              </strong>{' '}
              shall be paid in <strong>{data.paymentDurationWords || `${data.paymentDurationMonths} months`}</strong> equal
              monthly installments starting from <strong>{data.startDate}</strong> and ending in{' '}
              <strong>{data.endDate}</strong>.
            </Paragraph>
            <Paragraph style={{ fontSize: 15, textAlign: 'justify', lineHeight: 1.8 }}>
              Each monthly payment shall be due on or before the 1st day of every month, as detailed below:
            </Paragraph>

            {/* Schedule Table */}
            <div style={{ margin: '20px 0', border: '1px solid #092b5a', borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  background: '#092b5a',
                  color: '#ffffff',
                  padding: '8px 12px',
                  fontWeight: 700,
                  fontSize: 14,
                  textAlign: 'center',
                }}
              >
                [[ SYSTEM GENERATED PAYMENT PLAN ]] &mdash; {data.paymentDurationMonths}-MONTH PAYMENT PLAN (₵
                {data.outstandingBalance?.toLocaleString()} Total)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'center' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '8px 6px', borderRight: '1px solid #cbd5e1' }}>Inst.</th>
                    <th style={{ padding: '8px 6px', borderRight: '1px solid #cbd5e1' }}>Due Date</th>
                    <th style={{ padding: '8px 6px', borderRight: '1px solid #cbd5e1' }}>Installment (₵)</th>
                    <th style={{ padding: '8px 6px', borderRight: '1px solid #cbd5e1' }}>Accumulated (₵)</th>
                    <th style={{ padding: '8px 6px' }}>Remaining Balance (₵)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.schedule && data.schedule.length > 0 ? (
                    data.schedule.map((row, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                        }}
                      >
                        <td style={{ padding: '8px 6px', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
                          {row.installmentOrdinal}
                        </td>
                        <td style={{ padding: '8px 6px', borderRight: '1px solid #e2e8f0' }}>{row.dueDate}</td>
                        <td style={{ padding: '8px 6px', borderRight: '1px solid #e2e8f0' }}>
                          ₵{row.installmentAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '8px 6px', borderRight: '1px solid #e2e8f0' }}>
                          ₵{row.accumulatedAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '8px 6px', fontWeight: idx === data.schedule.length - 1 ? 700 : 400 }}>
                          ₵{row.remainingBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: 12, color: '#64748b' }}>
                        No schedule entries configured
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Paragraph style={{ fontSize: 15, textAlign: 'justify', lineHeight: 1.8, marginTop: 16 }}>
              Upon payment of at least <strong>Eighty percent (80%)</strong> of the total purchase price, the Client shall
              be permitted to commence preliminary construction activities on the land, including fencing and other
              approved initial works.
            </Paragraph>
            <Paragraph style={{ fontSize: 15, textAlign: 'justify', lineHeight: 1.8, fontStyle: 'italic' }}>
              Failure to comply with the payment schedule shall constitute a default as outlined in Clause 6 of this
              Agreement.
            </Paragraph>
          </div>

          <Divider style={{ margin: '20px 0' }} />

          {/* 3. Ownership */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#092b5a', marginBottom: 10 }}>
              3. Ownership
            </h3>
            <Paragraph style={{ fontSize: 15, textAlign: 'justify', lineHeight: 1.8 }}>
              Full ownership and legal rights to the property shall pass to the Purchaser only after full payment of the
              purchase price.
            </Paragraph>
          </div>

          {/* 4. Additional Costs */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#092b5a', marginBottom: 10 }}>
              4. Additional Costs
            </h3>
            <Paragraph style={{ fontSize: 15, lineHeight: 1.8, marginBottom: 6 }}>
              The Purchaser shall not be required to pay for the Site Plan. <strong>(FREE)</strong>
            </Paragraph>
            <Paragraph style={{ fontSize: 15, lineHeight: 1.8, marginBottom: 6 }}>
              The purchaser shall not be required to pay for the indenture. <strong>(FREE)</strong>
            </Paragraph>
            <Paragraph style={{ fontSize: 15, lineHeight: 1.8 }}>
              The Purchaser shall be responsible for the cost of Land Title Registration.
            </Paragraph>
          </div>
        </div>

        <div className="page-break" style={{ pageBreakBefore: 'always', margin: '40px 0 20px 0' }}>
          <Divider style={{ borderColor: '#cbd5e1' }} />
        </div>

        {/* ================= PAGE 3 ================= */}
        <div className="agreement-page" style={{ minHeight: '900px', position: 'relative' }}>
          {/* 5. Refund Policy */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#092b5a', marginBottom: 10 }}>
              5. Refund Policy
            </h3>
            <Paragraph style={{ fontSize: 15, textAlign: 'justify', lineHeight: 1.8 }}>
              If the Purchaser withdraws within <strong>one (1) month</strong>, <strong>90%</strong> of deposits shall be
              refunded.
            </Paragraph>
            <Paragraph style={{ fontSize: 15, textAlign: 'justify', lineHeight: 1.8 }}>
              If withdrawal is made after one (1) month, only <strong>80%</strong> of deposits shall be refunded.
            </Paragraph>
            <Paragraph style={{ fontSize: 15, textAlign: 'justify', lineHeight: 1.8 }}>
              All refunds shall be processed within <strong>twelve (12) weeks</strong> of official request.
            </Paragraph>
          </div>

          <Divider style={{ margin: '20px 0' }} />

          {/* 6. Default on Installment Payments */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#092b5a', marginBottom: 10 }}>
              6. Default on Installment Payments
            </h3>
            <Paragraph style={{ fontSize: 15, textAlign: 'justify', lineHeight: 1.8 }}>
              If the Purchaser defaults for <strong>two (2) consecutive months</strong>, the Developer may relocate the
              Purchaser&rsquo;s plot further inside the site.
            </Paragraph>
            <Paragraph style={{ fontSize: 15, textAlign: 'justify', lineHeight: 1.8 }}>
              If default exceeds <strong>three (3) months</strong>, the Developer may repossess the property and refund
              monies paid, subject to a <strong>20% penalty deduction</strong>. Refunds shall be processed within twelve (12)
              weeks.
            </Paragraph>
            <Paragraph style={{ fontSize: 15, textAlign: 'justify', lineHeight: 1.8 }}>
              Or the Developer may relocate the Purchaser&rsquo;s plot further inside the site.
            </Paragraph>
          </div>

          <Divider style={{ margin: '20px 0' }} />

          {/* 7. Construction & Land Use */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#092b5a', marginBottom: 10 }}>
              7. Construction &amp; Land Use
            </h3>
            <Paragraph style={{ fontSize: 15, textAlign: 'justify', lineHeight: 1.8 }}>
              All building plans must be submitted to the Developer for inspection and approval before construction begins.
            </Paragraph>
            <Paragraph style={{ fontSize: 15, textAlign: 'justify', lineHeight: 1.8 }}>
              Purchasers must construct at least a dwarf wall to secure their boundaries within <strong>one (1) year</strong> of
              purchase. The Developer shall not be liable for encroachment if this is not done.
            </Paragraph>
          </div>

          <Divider style={{ margin: '20px 0' }} />

          {/* 8. Measurements */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#092b5a', marginBottom: 10 }}>
              8. Measurements
            </h3>
            <Paragraph style={{ fontSize: 15, textAlign: 'justify', lineHeight: 1.8 }}>
              All measurements are approximate and provided as a guide only. The Developer shall not be liable for minor
              errors or variations.
            </Paragraph>
          </div>

          <Divider style={{ margin: '20px 0' }} />

          {/* 9. Binding Agreement */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#092b5a', marginBottom: 10 }}>
              9. Binding Agreement
            </h3>
            <Paragraph style={{ fontSize: 15, textAlign: 'justify', lineHeight: 1.8 }}>
              Both parties agree to abide by the terms of this Agreement.
            </Paragraph>
          </div>
        </div>

        <div className="page-break" style={{ pageBreakBefore: 'always', margin: '40px 0 20px 0' }}>
          <Divider style={{ borderColor: '#cbd5e1' }} />
        </div>

        {/* ================= PAGE 4 ================= */}
        <div className="agreement-page" style={{ minHeight: '800px', position: 'relative' }}>
          <div style={{ marginBottom: 32 }}>
            <Paragraph style={{ fontSize: 16, fontWeight: 600, textAlign: 'center', marginBottom: 32 }}>
              Both parties agree to abide by the terms of this Agreement.
            </Paragraph>

            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#092b5a', marginBottom: 24, textAlign: 'center' }}>
              Signed By:
            </h3>

            {/* Signature Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px 40px', marginTop: 24 }}>
              {/* Developer Section */}
              <div style={{ border: '1px dashed #94a3b8', borderRadius: 6, padding: '16px 20px' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#092b5a', textTransform: 'uppercase', marginBottom: 4 }}>
                  Developer
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                  For: OMARK REAL ESTATE &amp; CONSTRUCTION
                </div>

                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ fontSize: 13, display: 'block' }}>
                    SECRETARY:
                  </Text>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                    {data.secretaryName || 'Omark Corporate Secretary'}
                  </div>
                  <div style={{ marginTop: 8, borderBottom: '1px solid #475569', height: 24 }}>
                    <span style={{ fontFamily: 'cursive', fontSize: 15, color: '#092b5a' }}>
                      {data.secretaryName || 'Secretary'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4, color: '#64748b' }}>
                    <span>Signature</span>
                    <span>Date: {formattedAgreementDate}</span>
                  </div>
                </div>

                <div style={{ marginTop: 24 }}>
                  <Text strong style={{ fontSize: 13, display: 'block' }}>
                    CHIEF OPERATION OFFICER:
                  </Text>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                    {data.cooName || 'Chief Operating Officer'}
                  </div>
                  <div style={{ marginTop: 8, borderBottom: '1px solid #475569', height: 24 }}>
                    <span style={{ fontFamily: 'cursive', fontSize: 15, color: '#092b5a' }}>
                      {data.cooName || 'COO'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4, color: '#64748b' }}>
                    <span>Signature</span>
                  </div>
                </div>
              </div>

              {/* Purchaser Section */}
              <div style={{ border: '1px dashed #94a3b8', borderRadius: 6, padding: '16px 20px' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#092b5a', textTransform: 'uppercase', marginBottom: 4 }}>
                  Purchaser
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                  Client / Buyer of Property
                </div>

                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ fontSize: 13, display: 'block' }}>
                    PURCHASER NAME:
                  </Text>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                    {data.purchaserName}
                  </div>
                  <div style={{ marginTop: 8, borderBottom: '1px solid #475569', height: 24 }}>
                    {data.acknowledgedByCustomer ? (
                      <span style={{ fontFamily: 'cursive', fontSize: 16, color: '#15803d' }}>
                        {data.purchaserName}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>
                        (Pending Customer Digital Signature in Portal)
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4, color: '#64748b' }}>
                    <span>Signature</span>
                    <span>Date: {data.acknowledgedAt ? dayjs(data.acknowledgedAt).format('YYYY-MM-DD') : formattedAgreementDate}</span>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4, color: '#334155' }}>
                    TEL: <strong>{data.purchaserPhone || 'N/A'}</strong>
                  </div>
                </div>

                <div style={{ marginTop: 24 }}>
                  <Text strong style={{ fontSize: 13, display: 'block' }}>
                    PURCHASER WITNESS:
                  </Text>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                    {data.purchaserWitnessName || 'Purchaser Witness'}
                  </div>
                  <div style={{ marginTop: 8, borderBottom: '1px solid #475569', height: 24 }}>
                    <span style={{ fontFamily: 'cursive', fontSize: 15, color: '#092b5a' }}>
                      {data.purchaserWitnessName ? data.purchaserWitnessName : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4, color: '#64748b' }}>
                    <span>Signature</span>
                    <span>TEL: {data.purchaserWitnessPhone || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CEO Formal Block */}
            <div style={{ marginTop: 40, textAlign: 'center', padding: '20px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: 1 }}>
                Executive Final Approval
              </div>
              <div style={{ fontFamily: 'cursive', fontSize: 26, color: '#092b5a', margin: '8px 0 2px 0' }}>
                {data.ceoName || 'Hamza Umar'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                {data.ceoName || 'Hamza Umar'}
              </div>
              <div style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>
                Chief Executive Officer
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Omark Real Estate &amp; Construction
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-agreement-content, #printable-agreement-content * {
            visibility: visible;
          }
          #printable-agreement-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-before: always;
            break-before: page;
          }
        }
      `}</style>
    </div>
  );
};
