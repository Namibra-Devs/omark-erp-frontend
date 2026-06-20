// src/pages/dashboard/admin/components/ExportModal.tsx
import React, { useState } from 'react';
import { Modal, Radio, Button, Space, Typography, Alert } from 'antd';
import { 
  FileExcelOutlined, 
  FileTextOutlined, 
  FilePdfOutlined, 
  CodeOutlined,
  DownloadOutlined
} from '@ant-design/icons';

const { Text } = Typography;

interface ExportModalProps {
  open: boolean;
  onCancel: () => void;
  onExport: (format: 'excel' | 'csv' | 'pdf' | 'json') => void;
  loading?: boolean;
}

export const ExportModal: React.FC<ExportModalProps> = ({ open, onCancel, onExport, loading }) => {
  const [format, setFormat] = useState<'excel' | 'csv' | 'pdf' | 'json'>('excel');

  const exportOptions = [
    { value: 'excel', label: 'Excel (.xls)', icon: <FileExcelOutlined style={{ color: '#217346' }} /> },
    { value: 'csv', label: 'CSV (.csv)', icon: <FileTextOutlined style={{ color: '#1890ff' }} /> },
    { value: 'pdf', label: 'PDF (.pdf)', icon: <FilePdfOutlined style={{ color: '#ff4d4f' }} /> },
    { value: 'json', label: 'JSON (.json)', icon: <CodeOutlined style={{ color: '#722ed1' }} /> },
  ];

  const handleExport = () => {
    onExport(format);
  };

  return (
    <Modal
      title="Export Data"
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button 
          key="export" 
          type="primary" 
          icon={<DownloadOutlined />}
          onClick={handleExport}
          loading={loading}
        >
          Export
        </Button>,
      ]}
      width={500}
    >
      <Alert
        message="Select Export Format"
        description="Choose the format you want to export your data in."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Radio.Group 
        value={format} 
        onChange={(e) => setFormat(e.target.value)}
        style={{ width: '100%' }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {exportOptions.map(option => (
            <Radio key={option.value} value={option.value} style={{ width: '100%' }}>
              <Space>
                {option.icon}
                <Text strong>{option.label}</Text>
              </Space>
            </Radio>
          ))}
        </Space>
      </Radio.Group>

      <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <FileTextOutlined /> The export will include all users, activity logs, and system statistics.
        </Text>
      </div>
    </Modal>
  );
};