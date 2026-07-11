// src/pages/dashboard/admin/components/SystemSettings.tsx
import React, { useState } from 'react';
import { Card, Switch, Divider, Select, Button, Form, Row, Col, Typography, Modal, message, Input, Space, Alert } from 'antd';
import { 
  SaveOutlined, 
  ReloadOutlined, 
  CheckCircleOutlined, 
  WarningOutlined,
  GlobalOutlined,
  SafetyOutlined,
  MailOutlined,
  PhoneOutlined,
  CloudUploadOutlined
} from '@ant-design/icons';
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaving(true);
    // Simulate API call
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      message.success('Settings saved successfully!');
      setTimeout(() => setSaved(false), 3000);
    }, 1000);
  };

  const handleReset = () => {
    Modal.confirm({
      title: 'Reset to Default Settings',
      content: 'Are you sure you want to reset all settings to their default values?',
      okText: 'Yes, Reset',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        const defaultSettings: SystemSettingsType = {
          maintenanceMode: false,
          emailNotifications: true,
          smsNotifications: true,
          autoBackup: true,
          defaultCurrency: 'GHS',
          timezone: 'Africa/Accra',
          dateFormat: 'YYYY-MM-DD',
        };
        onSettingsChange(defaultSettings);
        message.success('Settings reset to default successfully!');
      },
    });
  };

  const toggleSetting = (key: keyof SystemSettingsType, value: boolean) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const updateSetting = (key: keyof SystemSettingsType, value: any) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const content = (
    <div style={{ maxWidth: 800 }}>
      {saved && (
        <Alert
          message="Settings Saved"
          description="Your settings have been saved successfully."
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          style={{ marginBottom: 16 }}
          closable
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <GlobalOutlined style={{ fontSize: 20, color: '#1890ff' }} />
        <Title level={4} style={{ margin: 0 }}>General Settings</Title>
      </div>
      <Divider style={{ margin: '8px 0 16px' }} />
      
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f5f5f5' }}>
          <div>
            <Text strong>
              <SafetyOutlined style={{ marginRight: 8 }} />
              Maintenance Mode
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>Put the system in maintenance mode</Text>
          </div>
          <Switch 
            checked={settings.maintenanceMode}
            onChange={(checked) => toggleSetting('maintenanceMode', checked)}
          />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f5f5f5' }}>
          <div>
            <Text strong>
              <MailOutlined style={{ marginRight: 8 }} />
              Email Notifications
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>Send email notifications to users</Text>
          </div>
          <Switch 
            checked={settings.emailNotifications}
            onChange={(checked) => toggleSetting('emailNotifications', checked)}
          />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f5f5f5' }}>
          <div>
            <Text strong>
              <PhoneOutlined style={{ marginRight: 8 }} />
              SMS Notifications
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>Send SMS notifications to users</Text>
          </div>
          <Switch 
            checked={settings.smsNotifications}
            onChange={(checked) => toggleSetting('smsNotifications', checked)}
          />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
          <div>
            <Text strong>
              <CloudUploadOutlined style={{ marginRight: 8 }} />
              Auto Backup
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>Automatically backup system data daily</Text>
          </div>
          <Switch 
            checked={settings.autoBackup}
            onChange={(checked) => toggleSetting('autoBackup', checked)}
          />
        </div>
      </div>

      <Divider />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <GlobalOutlined style={{ fontSize: 20, color: '#52c41a' }} />
        <Title level={4} style={{ margin: 0 }}>Regional Settings</Title>
      </div>
      
      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Default Currency" style={{ marginBottom: 12 }}>
            <Select 
              value={settings.defaultCurrency}
              onChange={(value) => updateSetting('defaultCurrency', value)}
              style={{ width: '100%' }}
              prefix={<span style={{ color: '#bbb' }}>💰</span>}
            >
              <Option value="GHS">🇬🇭 GHS - Ghana Cedi</Option>
              <Option value="USD">🇺🇸 USD - US Dollar</Option>
              <Option value="EUR">🇪🇺 EUR - Euro</Option>
              <Option value="NGN">🇳🇬 NGN - Nigerian Naira</Option>
              <Option value="GBP">🇬🇧 GBP - British Pound</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Time Zone" style={{ marginBottom: 12 }}>
            <Select 
              value={settings.timezone}
              onChange={(value) => updateSetting('timezone', value)}
              style={{ width: '100%' }}
              prefix={<span style={{ color: '#bbb' }}>🕐</span>}
            >
              <Option value="Africa/Accra">🌍 Africa/Accra (UTC+0)</Option>
              <Option value="Africa/Lagos">🌍 Africa/Lagos (UTC+1)</Option>
              <Option value="Africa/Nairobi">🌍 Africa/Nairobi (UTC+3)</Option>
              <Option value="Africa/Cairo">🌍 Africa/Cairo (UTC+2)</Option>
              <Option value="Africa/Johannesburg">🌍 Africa/Johannesburg (UTC+2)</Option>
              <Option value="UTC">🌐 UTC</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Date Format" style={{ marginBottom: 12 }}>
            <Select 
              value={settings.dateFormat || 'YYYY-MM-DD'}
              onChange={(value) => updateSetting('dateFormat', value)}
              style={{ width: '100%' }}
              prefix={<span style={{ color: '#bbb' }}>📅</span>}
            >
              <Option value="YYYY-MM-DD">YYYY-MM-DD (2024-01-15)</Option>
              <Option value="DD-MM-YYYY">DD-MM-YYYY (15-01-2024)</Option>
              <Option value="MM-DD-YYYY">MM-DD-YYYY (01-15-2024)</Option>
              <Option value="YYYY/MM/DD">YYYY/MM/DD (2024/01/15)</Option>
              <Option value="DD/MM/YYYY">DD/MM/YYYY (15/01/2024)</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Default Language" style={{ marginBottom: 12 }}>
            <Select 
              value="en"
              style={{ width: '100%' }}
              prefix={<span style={{ color: '#bbb' }}>🌐</span>}
            >
              <Option value="en">🇬🇧 English</Option>
              <Option value="fr">🇫🇷 French</Option>
              <Option value="es">🇪🇸 Spanish</Option>
              <Option value="pt">🇵🇹 Portuguese</Option>
              <Option value="ar">🇸🇦 Arabic</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Divider />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Button 
          type="primary" 
          icon={<SaveOutlined />}
          onClick={handleSave} 
          loading={saving || loading}
          size="large"
          style={{ minWidth: 120 }}
        >
          Save Settings
        </Button>
        <Button 
          icon={<ReloadOutlined />}
          onClick={handleReset}
          size="large"
        >
          Reset to Default
        </Button>
        <Button 
          onClick={() => message.info('Settings reloaded')}
          size="large"
        >
          Reload
        </Button>
      </div>

      <div style={{ marginTop: 16, padding: 12, background: '#f5f7fa', borderRadius: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <WarningOutlined style={{ marginRight: 4 }} />
          Changes to system settings may affect all users. Please review before saving.
        </Text>
      </div>
    </div>
  );

  if (open !== undefined) {
    return (
      <Modal
        title={
          <Space>
            <GlobalOutlined style={{ color: '#1890ff' }} />
            <span>System Settings</span>
          </Space>
        }
        open={open}
        onCancel={onClose}
        footer={null}
        width={700}
        styles={{ body: { padding: '24px', maxHeight: '70vh', overflowY: 'auto' } }}
        destroyOnClose
      >
        {content}
      </Modal>
    );
  }

  return <Card>{content}</Card>;
};