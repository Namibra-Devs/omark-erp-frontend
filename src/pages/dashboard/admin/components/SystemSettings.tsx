// src/pages/dashboard/admin/components/SystemSettings.tsx
import React from 'react';
import { Card, Switch, Divider, Select, Button, Form, Row, Col, Typography, Modal } from 'antd';
import type { SystemSettings as SystemSettingsType } from '../types';

const { Title, Text } = Typography;
const { Option } = Select;

interface SystemSettingsProps {
  settings: SystemSettingsType;
  onSettingsChange: (settings: SystemSettingsType) => void;
  loading?: boolean;
  open?: boolean;
  onClose?: () => void;
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({
  settings,
  onSettingsChange,
  loading,
  open,
  onClose,
}) => {
  const content = (
    <div style={{ maxWidth: 800 }}>
      <Title level={4}>General Settings</Title>
      <Divider />
      
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
          <div>
            <Text strong>Maintenance Mode</Text>
            <br />
            <Text type="secondary">Put the system in maintenance mode</Text>
          </div>
          <Switch 
            checked={settings.maintenanceMode}
            onChange={(checked) => onSettingsChange({...settings, maintenanceMode: checked})}
          />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
          <div>
            <Text strong>Email Notifications</Text>
            <br />
            <Text type="secondary">Send email notifications to users</Text>
          </div>
          <Switch 
            checked={settings.emailNotifications}
            onChange={(checked) => onSettingsChange({...settings, emailNotifications: checked})}
          />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
          <div>
            <Text strong>SMS Notifications</Text>
            <br />
            <Text type="secondary">Send SMS notifications to users</Text>
          </div>
          <Switch 
            checked={settings.smsNotifications}
            onChange={(checked) => onSettingsChange({...settings, smsNotifications: checked})}
          />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
          <div>
            <Text strong>Auto Backup</Text>
            <br />
            <Text type="secondary">Automatically backup system data daily</Text>
          </div>
          <Switch 
            checked={settings.autoBackup}
            onChange={(checked) => onSettingsChange({...settings, autoBackup: checked})}
          />
        </div>
      </div>

      <Divider />
      <Title level={4}>Regional Settings</Title>
      
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item label="Default Currency">
            <Select 
              value={settings.defaultCurrency}
              onChange={(value) => onSettingsChange({...settings, defaultCurrency: value})}
            >
              <Option value="GHS">GHS - Ghana Cedi</Option>
              <Option value="USD">USD - US Dollar</Option>
              <Option value="EUR">EUR - Euro</Option>
              <Option value="NGN">NGN - Nigerian Naira</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="Time Zone">
            <Select 
              value={settings.timezone}
              onChange={(value) => onSettingsChange({...settings, timezone: value})}
            >
              <Option value="Africa/Accra">Africa/Accra (UTC+0)</Option>
              <Option value="Africa/Lagos">Africa/Lagos (UTC+1)</Option>
              <Option value="Africa/Nairobi">Africa/Nairobi (UTC+3)</Option>
              <Option value="UTC">UTC</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Divider />
      <div style={{ display: 'flex', gap: 12 }}>
        <Button type="primary" loading={loading}>Save Settings</Button>
        <Button>Reset to Default</Button>
      </div>
    </div>
  );

  if (open !== undefined) {
    return (
      <Modal
        title="System Settings"
        open={open}
        onCancel={onClose}
        footer={null}
        width={700}
      >
        {content}
      </Modal>
    );
  }

  return <Card>{content}</Card>;
};