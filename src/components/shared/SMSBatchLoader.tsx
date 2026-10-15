import React from 'react';
import { Card, Progress, Space, Typography, Tag } from 'antd';
import { LoadingOutlined, CheckCircleFilled, ThunderboltOutlined } from '@ant-design/icons';
import type { SMSBatchProgress } from '@/api/notifications';

const { Text } = Typography;

export interface SMSBatchLoaderProps {
  progress: SMSBatchProgress | null;
  style?: React.CSSProperties;
}

export const SMSBatchLoader: React.FC<SMSBatchLoaderProps> = ({ progress, style }) => {
  if (!progress) return null;

  const isComplete = progress.isComplete || progress.percent >= 100;

  return (
    <Card
      size="small"
      style={{
        marginTop: 12,
        marginBottom: 12,
        border: isComplete ? '1px solid #b7eb8f' : '1px solid #91caff',
        background: isComplete ? '#f6ffed' : '#f0f5ff',
        borderRadius: 8,
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Space size={8}>
          {isComplete ? (
            <CheckCircleFilled style={{ color: '#52c41a', fontSize: 18 }} />
          ) : (
            <LoadingOutlined spin style={{ color: '#1677ff', fontSize: 18 }} />
          )}
          <Text strong style={{ fontSize: 13, color: isComplete ? '#389e0d' : '#0958d9' }}>
            {isComplete ? 'SMS Broadcast Dispatch Complete' : 'Sequential SMS Batching Active'}
          </Text>
        </Space>
        <Space size={6}>
          <Tag color={isComplete ? 'success' : 'processing'} style={{ fontWeight: 600 }}>
            Batch {progress.currentBatch} of {progress.totalBatches}
          </Tag>
          <Tag color="cyan" icon={<ThunderboltOutlined />}>
            500 msgs / batch
          </Tag>
        </Space>
      </div>

      <Progress
        percent={progress.percent}
        status={isComplete ? 'success' : 'active'}
        strokeColor={{ '0%': '#1677ff', '100%': '#52c41a' }}
        style={{ marginBottom: 6 }}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11,
          color: '#595959',
          flexWrap: 'wrap',
          gap: 4,
        }}
      >
        <span>
          <strong>{progress.processedRecipients.toLocaleString()}</strong> of{' '}
          <strong>{progress.totalRecipients.toLocaleString()}</strong> recipients processed ({progress.percent}%)
        </span>
        <span>
          {progress.statusText || (isComplete ? 'All messages delivered.' : 'Triggering next batch automatically...')}
        </span>
      </div>

      {!isComplete && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#8c8c8c', fontStyle: 'italic' }}>
          ℹ️ Messages are automatically batched in groups of 500. Next batches trigger sequentially until 100% of messages are delivered. Please keep this dialog open.
        </div>
      )}
    </Card>
  );
};
