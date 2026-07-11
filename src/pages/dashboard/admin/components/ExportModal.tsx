// src/pages/dashboard/admin/components/ExportModal.tsx
import React, { useState } from 'react';
import { Modal, Radio, Button, Space, Typography, Alert, Divider, Tag } from 'antd';
import { 
  FileExcelOutlined, 
  FileTextOutlined, 
  FilePdfOutlined, 
  CodeOutlined,
  DownloadOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  CloseOutlined
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface ExportModalProps {
  open: boolean;
  onCancel: () => void;
  onExport: (format: 'excel' | 'csv' | 'pdf' | 'json') => void;
  loading?: boolean;
  totalRecords?: number;
}

export const ExportModal: React.FC<ExportModalProps> = ({ 
  open, 
  onCancel, 
  onExport, 
  loading,
  totalRecords = 0 
}) => {
  const [format, setFormat] = useState<'excel' | 'csv' | 'pdf' | 'json'>('excel');

  const exportOptions = [
    { 
      value: 'excel', 
      label: 'Excel (.xls)', 
      icon: <FileExcelOutlined style={{ color: '#217346', fontSize: 20 }} />,
      description: 'Best for data analysis and editing',
      tag: 'Popular'
    },
    { 
      value: 'csv', 
      label: 'CSV (.csv)', 
      icon: <FileTextOutlined style={{ color: '#1890ff', fontSize: 20 }} />,
      description: 'Compatible with most spreadsheet apps',
      tag: 'Universal'
    },
    { 
      value: 'pdf', 
      label: 'PDF (.pdf)', 
      icon: <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />,
      description: 'For printing and sharing',
      tag: 'Print'
    },
    { 
      value: 'json', 
      label: 'JSON (.json)', 
      icon: <CodeOutlined style={{ color: '#722ed1', fontSize: 20 }} />,
      description: 'For developers and API integration',
      tag: 'Developer'
    },
  ];

  const handleExport = () => {
    onExport(format);
  };

  const getFormatDescription = () => {
    const option = exportOptions.find(o => o.value === format);
    return option?.description || '';
  };

  return (
    <Modal
      title={
        <Space>
          <DatabaseOutlined style={{ color: '#1890ff', fontSize: 18 }} />
          <Text strong style={{ fontSize: 16 }}>Export Data</Text>
        </Space>
      }
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel} icon={<CloseOutlined />}>
          Cancel
        </Button>,
        <Button 
          key="export" 
          type="primary" 
          icon={<DownloadOutlined />}
          onClick={handleExport}
          loading={loading}
          size="large"
        >
          Export {format.toUpperCase()}
        </Button>,
      ]}
      width={560}
      styles={{
        content: { borderRadius: 12 },
        body: { padding: '24px' },
      }}
    >
      <Alert
        message={
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <Text strong>Ready to Export</Text>
          </Space>
        }
        description={
          <div>
            <Text>
              {totalRecords > 0 
                ? `${totalRecords} records will be exported.` 
                : 'All data will be exported.'}
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Select the format that best suits your needs below.
            </Text>
          </div>
        }
        type="info"
        showIcon={false}
        style={{ marginBottom: 24, borderRadius: 8 }}
      />

      <Text strong style={{ display: 'block', marginBottom: 12 }}>
        Choose Export Format
      </Text>

      <Radio.Group 
        value={format} 
        onChange={(e) => setFormat(e.target.value)}
        style={{ width: '100%' }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          {exportOptions.map(option => {
            const isSelected = format === option.value;
            return (
              <Radio 
                key={option.value} 
                value={option.value} 
                style={{ 
                  width: '100%',
                  margin: 0,
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: `2px solid ${isSelected ? '#1890ff' : '#f0f0f0'}`,
                  background: isSelected ? '#e6f7ff' : '#fafafa',
                  transition: 'all 0.3s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                  <div style={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: 8, 
                    background: isSelected ? '#1890ff10' : '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {option.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Text strong style={{ fontSize: 14 }}>{option.label}</Text>
                      <Tag 
                        color={isSelected ? 'blue' : 'default'} 
                        style={{ 
                          fontSize: 10, 
                          padding: '0 8px',
                          borderRadius: 12,
                          margin: 0
                        }}
                      >
                        {option.tag}
                      </Tag>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {option.description}
                    </Text>
                  </div>
                  {isSelected && (
                    <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 18, flexShrink: 0 }} />
                  )}
                </div>
              </Radio>
            );
          })}
        </Space>
      </Radio.Group>

      <Divider style={{ margin: '16px 0' }} />

      <div style={{ 
        padding: '12px 16px', 
        background: '#f5f7fa', 
        borderRadius: 8,
        border: '1px solid #e8e8e8'
      }}>
        <Space direction="vertical" size={4}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <FileTextOutlined /> {format.toUpperCase()} format selected
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <DatabaseOutlined /> {getFormatDescription()}
          </Text>
          {format === 'excel' && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              💡 Recommended for data analysis and reporting
            </Text>
          )}
          {format === 'csv' && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              💡 Compatible with Excel, Google Sheets, and most data tools
            </Text>
          )}
          {format === 'pdf' && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              💡 Best for printing and sharing with stakeholders
            </Text>
          )}
          {format === 'json' && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              💡 Ideal for developers and API integrations
            </Text>
          )}
        </Space>
      </div>
    </Modal>
  );
};