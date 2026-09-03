// src/components/attendance/ReceptionQRModal.tsx
//
// Reception Kiosk Display Mode for front-desk QR verification.
// Renders dynamic daily rotating QR token and PIN for arriving staff to scan.

import React, { useState, useEffect } from 'react';
import { Modal, Typography, Card, Tag, Space, Button, Row, Col, QRCode, Select } from 'antd';
import {
  QrcodeOutlined,
  SyncOutlined,
  PrinterOutlined,
  ShopOutlined,
  SafetyCertificateOutlined,
  KeyOutlined
} from '@ant-design/icons';
import { BRANCH_GEOFENCES, generateReceptionQR } from '@/mock/staffAttendance';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface ReceptionQRModalProps {
  open: boolean;
  onClose: () => void;
  defaultBranchId?: string;
}

export const ReceptionQRModal: React.FC<ReceptionQRModalProps> = ({
  open,
  onClose,
  defaultBranchId = 'branch-accra-hq',
}) => {
  const [selectedBranch, setSelectedBranch] = useState(defaultBranchId);
  const [rotationMode, setRotationMode] = useState<'daily' | 'weekly'>('daily');
  const [currentTime, setCurrentTime] = useState(dayjs());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(dayjs()), 1000);
    return () => clearInterval(timer);
  }, []);

  const branchGeofence = BRANCH_GEOFENCES[selectedBranch] || BRANCH_GEOFENCES['branch-accra-hq'];
  const todayQr = generateReceptionQR(branchGeofence.branchId, rotationMode);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={680}
      title={
        <Space align="center">
          <QrcodeOutlined style={{ color: '#2E5E8C', fontSize: 22 }} />
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
            Branch Reception QR Code Check-In Station
          </span>
        </Space>
      }
      footer={[
        <Button key="close" size="large" onClick={onClose}>
          Close Station
        </Button>,
        <Button
          key="print"
          size="large"
          type="primary"
          icon={<PrinterOutlined />}
          style={{ background: '#2E5E8C', borderColor: '#2E5E8C' }}
          onClick={() => window.print()}
        >
          Print Reception Placard
        </Button>,
      ]}
    >
      <div style={{ textAlign: 'center', padding: '16px 8px' }}>
        {/* Location & Rotation Mode Selector */}
        <div style={{ marginBottom: 20 }}>
          <Space align="center" wrap style={{ justifyContent: 'center' }}>
            <ShopOutlined style={{ color: '#64748b' }} />
            <Text strong>Location:</Text>
            <Select
              value={selectedBranch}
              onChange={(val) => setSelectedBranch(val)}
              style={{ width: 190, textAlign: 'left' }}
            >
              <Option value="branch-accra-hq">Accra Head Office</Option>
              <Option value="branch-kumasi">Kumasi Branch</Option>
              <Option value="branch-takoradi">Takoradi Branch</Option>
              <Option value="branch-tamale">Tamale Branch</Option>
              <Option value="branch-wa">Wa Branch</Option>
            </Select>

            <SyncOutlined style={{ color: '#64748b', marginLeft: 8 }} />
            <Text strong>Rotation Cycle:</Text>
            <Select
              value={rotationMode}
              onChange={(val) => setRotationMode(val)}
              style={{ width: 160, textAlign: 'left' }}
            >
              <Option value="daily">🔄 Daily (Midnight)</Option>
              <Option value="weekly">📅 Weekly (Mon 00:00)</Option>
            </Select>
          </Space>
        </div>

        {/* Big QR Kiosk Card */}
        <Card
          style={{
            maxWidth: 440,
            margin: '0 auto',
            borderRadius: 16,
            boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
            border: '2px solid #2E5E8C',
            background: '#ffffff',
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <Tag color="geekblue" style={{ fontSize: 13, padding: '4px 12px', borderRadius: 12, fontWeight: 700 }}>
              OFFICIAL ATTENDANCE PUNCH POINT
            </Tag>
            <Title level={3} style={{ margin: '8px 0 2px 0', color: '#2E5E8C', fontWeight: 800 }}>
              {branchGeofence.branchName}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {currentTime.format('dddd, DD MMMM YYYY · hh:mm:ss A')}
            </Text>
          </div>

          {/* QR Code Graphic */}
          <div
            style={{
              padding: 18,
              background: '#f8fafc',
              borderRadius: 12,
              display: 'inline-block',
              border: '1px solid #e2e8f0',
              marginBottom: 16,
            }}
          >
            <QRCode
              value={todayQr.token}
              size={220}
              bordered={false}
              color="#2E5E8C"
            />
          </div>

          <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>
            Scan this QR code using the <strong>Omark ERP Attendance App</strong> upon arrival at reception.
          </Paragraph>

          {/* Daily 4-digit PIN Box for Manual Entry */}
          <div
            style={{
              background: '#f0fdf4',
              border: '1px dashed #86efac',
              borderRadius: 8,
              padding: '10px 16px',
            }}
          >
            <Space align="center">
              <KeyOutlined style={{ color: '#16a34a', fontSize: 16 }} />
              <Text strong style={{ color: '#15803d', fontSize: 13 }}>
                Today's Reception PIN:
              </Text>
              <Tag color="success" style={{ fontSize: 18, fontWeight: 800, letterSpacing: 3, padding: '4px 12px' }}>
                {todayQr.pin}
              </Tag>
            </Space>
          </div>
        </Card>

        <Text type="secondary" style={{ display: 'block', marginTop: 16, fontSize: 12 }}>
          🔒 Anti-Fraud: This QR code rotates {rotationMode === 'daily' ? 'daily at midnight' : 'weekly on Monday 00:00'} (Valid until {dayjs(todayQr.expiresAt).format('DD MMM, hh:mm A')}) to prevent off-site check-in abuse.
        </Text>
      </div>
    </Modal>
  );
};
