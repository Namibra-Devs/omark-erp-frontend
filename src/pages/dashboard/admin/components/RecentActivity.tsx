// src/pages/dashboard/admin/components/RecentActivity.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Card, Typography, Button, Skeleton, Empty, Tooltip, Space } from 'antd';
import {
  CheckCircleFilled,
  InfoCircleFilled,
  WarningFilled,
  CloseCircleFilled,
  ClockCircleOutlined,
  UserOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ActivityLog } from '../types';

const { Text } = Typography;

// ── Type config ────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  success: {
    icon: <CheckCircleFilled />,
    color: '#52c41a',
    bg: '#f6ffed',
    border: '#b7eb8f',
    trackColor: '#d9f7be',
    label: 'Success',
  },
  info: {
    icon: <InfoCircleFilled />,
    color: '#1890ff',
    bg: '#e6f7ff',
    border: '#91d5ff',
    trackColor: '#bae7ff',
    label: 'Info',
  },
  warning: {
    icon: <WarningFilled />,
    color: '#faad14',
    bg: '#fffbe6',
    border: '#ffe58f',
    trackColor: '#fff1b8',
    label: 'Warning',
  },
  error: {
    icon: <CloseCircleFilled />,
    color: '#ff4d4f',
    bg: '#fff1f0',
    border: '#ffa39e',
    trackColor: '#ffccc7',
    label: 'Error',
  },
} as const;

// ── Intersection-based reveal hook (replaces AOS) ─────────────────────────
function useReveal(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return { ref, visible };
}

// ── Single timeline item ───────────────────────────────────────────────────
const ActivityItem: React.FC<{
  log: ActivityLog;
  index: number;
  isLast: boolean;
  onClick?: () => void;
}> = ({ log, index, isLast, onClick }) => {
  const { ref, visible } = useReveal(index * 110);
  const [hovered, setHovered] = useState(false);
  const cfg = TYPE_CONFIG[log.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.info;

  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        gap: 14,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.45s ease, transform 0.45s ease',
      }}
    >
      {/* ── Left column: icon + connector ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        {/* Icon ring */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: cfg.bg,
            border: `2px solid ${cfg.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            color: cfg.color,
            boxShadow: visible ? `0 0 0 4px ${cfg.trackColor}` : 'none',
            transition: 'box-shadow 0.4s ease 0.2s',
            flexShrink: 0,
            zIndex: 1,
          }}
        >
          {cfg.icon}
        </div>

        {/* Connector line */}
        {!isLast && (
          <div style={{ width: 2, flex: 1, minHeight: 16, marginTop: 4, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: '#f0f0f0' }} />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                background: `linear-gradient(to bottom, ${cfg.color}60, transparent)`,
                height: visible ? '100%' : '0%',
                transition: 'height 0.6s ease 0.3s',
              }}
            />
          </div>
        )}
      </div>

      {/* ── Right column: content card ── */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 16, cursor: onClick ? 'pointer' : 'default' }}>
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={onClick}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: `1px solid ${hovered ? cfg.border : '#f0f0f0'}`,
            background: hovered ? cfg.bg : '#fafafa',
            transition: 'all 0.2s ease',
            cursor: onClick ? 'pointer' : 'default',
          }}
        >
          {/* Top row: action + type pill + timestamp */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: 5,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text strong style={{ fontSize: 13, color: '#1a1a2e' }}>
                {log.action}
              </Text>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '1px 8px',
                borderRadius: 20,
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                color: cfg.color,
                fontSize: 10,
                fontWeight: 700,
                lineHeight: '18px',
              }}>
                {cfg.icon}
                {cfg.label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <ClockCircleOutlined style={{ fontSize: 11, color: '#bbb' }} />
              <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                {log.timestamp}
              </Text>
            </div>
          </div>

          {/* Details */}
          <Text style={{ fontSize: 13, color: '#555', display: 'block', lineHeight: 1.5 }}>
            {log.details}
          </Text>

          {/* By line */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
            <UserOutlined style={{ fontSize: 11, color: '#bbb' }} />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {log.user}
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Skeleton loader ────────────────────────────────────────────────────────
const ActivitySkeleton: React.FC = () => (
  <>
    {[0, 1, 2].map(i => (
      <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
        <Skeleton.Avatar active size={36} shape="circle" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <Skeleton active paragraph={{ rows: 2 }} title={{ width: '40%' }} />
        </div>
      </div>
    ))}
  </>
);

// ── Main component ─────────────────────────────────────────────────────────
interface RecentActivityProps {
  activities: ActivityLog[];
  loading?: boolean;
  onViewAll?: () => void;
  onRefresh?: () => void;
  onActivityClick?: (log: ActivityLog) => void;
  maxItems?: number;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({
  activities,
  loading,
  onViewAll,
  onRefresh,
  onActivityClick,
  maxItems = 5,
}) => {
  const displayed = activities.slice(0, maxItems);
  const hasMore = activities.length > maxItems;

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThunderboltOutlined style={{ color: '#faad14' }} />
          <span>Recent Activity</span>
          {/* Live pulse dot */}
          <span style={{ position: 'relative', display: 'inline-flex', marginLeft: 2 }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#52c41a',
              display: 'inline-block',
              animation: 'ra-pulse 2s ease-in-out infinite',
            }} />
          </span>
          {activities.length > 0 && (
            <Tooltip title={`${activities.length} total activities`}>
              <span style={{
                background: '#f0f0f0',
                borderRadius: 10,
                padding: '0 8px',
                fontSize: 11,
                fontWeight: 600,
                color: '#888',
                lineHeight: '20px',
              }}>
                {activities.length}
              </span>
            </Tooltip>
          )}
        </div>
      }
      extra={
        <Space>
          {onRefresh && (
            <Tooltip title="Refresh activities">
              <Button 
                type="text" 
                size="small" 
                icon={<ReloadOutlined spin={loading} />} 
                onClick={onRefresh}
                disabled={loading}
              />
            </Tooltip>
          )}
          {onViewAll && (
            <Button type="link" onClick={onViewAll} style={{ padding: 0, fontWeight: 500 }}>
              {hasMore ? `View all ${activities.length} →` : 'View all →'}
            </Button>
          )}
        </Space>
      }
      style={{
        marginBottom: 24,
        borderRadius: 14,
        border: '1px solid rgba(0,0,0,0.07)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      }}
      styles={{ body: { paddingTop: 20 } }}
    >
      <style>{`
        @keyframes ra-pulse {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(82,196,26,0.4); }
          50%       { opacity: 0.8; transform: scale(1.3); box-shadow: 0 0 0 5px rgba(82,196,26,0); }
        }
      `}</style>

      {loading ? (
        <ActivitySkeleton />
      ) : displayed.length > 0 ? (
        <div>
          {displayed.map((log, i) => (
            <ActivityItem
              key={log.id}
              log={log}
              index={i}
              isLast={i === displayed.length - 1}
              onClick={onActivityClick ? () => onActivityClick(log) : undefined}
            />
          ))}
          {hasMore && onViewAll && (
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <Button type="link" onClick={onViewAll}>
                <EyeOutlined /> View all {activities.length} activities
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <Text type="secondary">No recent activity</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Activities will appear here as users interact with the system
              </Text>
            </div>
          }
          style={{ padding: '20px 0' }}
        />
      )}
    </Card>
  );
};