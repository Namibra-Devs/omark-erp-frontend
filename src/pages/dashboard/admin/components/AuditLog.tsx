// src/pages/dashboard/admin/components/AuditLog.tsx
import React, { useState, useMemo } from 'react';
import {
  Modal, Table, Tag, Input, Select, DatePicker, Button, Typography, Avatar, Tooltip,
} from 'antd';
import {
  SearchOutlined, DownloadOutlined,
  CheckCircleFilled, InfoCircleFilled, WarningFilled, CloseCircleFilled,
  UserOutlined, ClockCircleOutlined, FilterOutlined,
} from '@ant-design/icons';
import type { ActivityLog } from '../types';
import type { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;
const { Text } = Typography;
const { Option } = Select;

// ── Type config ────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  success: {
    color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f',
    icon: <CheckCircleFilled />, label: 'Success',
  },
  info: {
    color: '#1890ff', bg: '#e6f7ff', border: '#91d5ff',
    icon: <InfoCircleFilled />, label: 'Info',
  },
  warning: {
    color: '#faad14', bg: '#fffbe6', border: '#ffe58f',
    icon: <WarningFilled />, label: 'Warning',
  },
  error: {
    color: '#ff4d4f', bg: '#fff1f0', border: '#ffa39e',
    icon: <CloseCircleFilled />, label: 'Error',
  },
} as const;

// ── Summary pill ───────────────────────────────────────────────────────────
const SummaryPill: React.FC<{
  type: keyof typeof TYPE_CONFIG;
  count: number;
  active: boolean;
  onClick: () => void;
}> = ({ type, count, active, onClick }) => {
  const cfg = TYPE_CONFIG[type];
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        borderRadius: 20,
        border: `1.5px solid ${active ? cfg.color : '#e8e8e8'}`,
        background: active ? cfg.bg : 'transparent',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ color: cfg.color, fontSize: 14, display: 'flex' }}>{cfg.icon}</span>
      <Text style={{ fontSize: 12, fontWeight: 500, color: active ? cfg.color : '#888' }}>
        {cfg.label}
      </Text>
      <span
        style={{
          minWidth: 20,
          height: 18,
          borderRadius: 9,
          background: active ? cfg.color : '#f0f0f0',
          color: active ? '#fff' : '#999',
          fontSize: 11,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 5px',
          transition: 'all 0.18s ease',
        }}
      >
        {count}
      </span>
    </button>
  );
};

// ── Props ──────────────────────────────────────────────────────────────────
interface AuditLogProps {
  open: boolean;
  onCancel: () => void;
  logs: ActivityLog[];
  loading?: boolean;
}

export const AuditLog: React.FC<AuditLogProps> = ({ open, onCancel, logs, loading }) => {
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  // Counts per type for summary pills
  const counts = useMemo(() => ({
    success: logs.filter(l => l.type === 'success').length,
    info:    logs.filter(l => l.type === 'info').length,
    warning: logs.filter(l => l.type === 'warning').length,
    error:   logs.filter(l => l.type === 'error').length,
  }), [logs]);

  const filteredLogs = useMemo(() => logs.filter(log => {
    const q = searchText.toLowerCase();
    const matchSearch =
      log.action.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      log.user.toLowerCase().includes(q);
    const matchType = filterType === 'all' || log.type === filterType;
    return matchSearch && matchType;
  }), [logs, searchText, filterType]);

  const columns = [
    {
      title: 'User',
      dataIndex: 'user',
      key: 'user',
      width: 150,
      render: (user: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar
            size={28}
            icon={<UserOutlined />}
            style={{
              background: user === 'System' ? '#f0f0f0' : '#e6f4ff',
              color: user === 'System' ? '#999' : '#1677ff',
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {user !== 'System' ? user[0].toUpperCase() : undefined}
          </Avatar>
          <Text style={{ fontSize: 13, fontWeight: 500 }}>{user}</Text>
        </div>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 160,
      render: (action: string) => (
        <Text style={{ fontSize: 13, fontWeight: 600 }}>{action}</Text>
      ),
    },
    {
      title: 'Details',
      dataIndex: 'details',
      key: 'details',
      render: (details: string) => (
        <Tooltip title={details}>
          <Text
            type="secondary"
            style={{
              fontSize: 13,
              display: 'block',
              maxWidth: 320,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {details}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 160,
      render: (ts: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <ClockCircleOutlined style={{ color: '#bbb', fontSize: 12 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>{ts}</Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'type',
      key: 'type',
      width: 110,
      render: (type: string) => {
        const cfg = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.info;
        return (
          <Tag
            icon={<span style={{ marginRight: 4 }}>{cfg.icon}</span>}
            style={{
              borderRadius: 20,
              border: `1px solid ${cfg.border}`,
              background: cfg.bg,
              color: cfg.color,
              fontWeight: 600,
              fontSize: 11,
              padding: '2px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {cfg.label}
          </Tag>
        );
      },
    },
  ];

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={1020}
      destroyOnHidden
      styles={{
        content: { borderRadius: 16, padding: 0, overflow: 'hidden' },
        body: { padding: 0 },
      }}
    >
      {/* ── Gradient header ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          padding: '20px 28px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: 700, display: 'block' }}>
            Audit Log
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
            {logs.length} total events recorded
          </Text>
        </div>
        <Button
          icon={<DownloadOutlined />}
          onClick={() => {}}
          style={{
            borderRadius: 8,
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            fontWeight: 500,
          }}
        >
          Export Log
        </Button>
      </div>

      <div style={{ padding: '20px 24px 0' }}>
        {/* ── Type summary pills ── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {(Object.keys(TYPE_CONFIG) as Array<keyof typeof TYPE_CONFIG>).map(type => (
            <SummaryPill
              key={type}
              type={type}
              count={counts[type]}
              active={filterType === type}
              onClick={() => setFilterType(prev => prev === type ? 'all' : type)}
            />
          ))}
          {filterType !== 'all' && (
            <button
              onClick={() => setFilterType('all')}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                border: '1.5px dashed #d9d9d9',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 12,
                color: '#999',
                fontFamily: 'inherit',
              }}
            >
              Clear filter
            </button>
          )}
        </div>

        {/* ── Search + date row ── */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: 16,
            padding: '12px 14px',
            background: '#fafafa',
            borderRadius: 10,
            border: '1px solid #f0f0f0',
          }}
        >
          <FilterOutlined style={{ color: '#bbb', fontSize: 14 }} />
          <Input
            placeholder="Search user, action, or details…"
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 260, borderRadius: 8 }}
            allowClear
          />
          <RangePicker
            style={{ borderRadius: 8 }}
            onChange={v => setDateRange(v as [Dayjs | null, Dayjs | null] | null)}
          />
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
            Showing{' '}
            <Text strong style={{ color: '#333' }}>{filteredLogs.length}</Text>
            {' '}of{' '}
            <Text strong style={{ color: '#333' }}>{logs.length}</Text>
            {' '}entries
          </Text>
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ padding: '0 24px 24px' }}>
        <Table
          columns={columns}
          dataSource={filteredLogs}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{
            pageSize: 8,
            showSizeChanger: false,
            showTotal: total => `${total} entries`,
            style: { marginTop: 16 },
          }}
          scroll={{ x: 780 }}
          rowClassName={() => 'audit-row'}
          style={{ borderRadius: 12, overflow: 'hidden' }}
          locale={{
            emptyText: (
              <div style={{ padding: '40px 0', color: '#bbb', textAlign: 'center' }}>
                <SearchOutlined style={{ fontSize: 32, marginBottom: 10, display: 'block' }} />
                No entries match your filters
              </div>
            ),
          }}
        />
      </div>

      <style>{`
        .audit-row:hover > td { background: #fafbff !important; }
        .audit-row > td { transition: background 0.15s; }
      `}</style>
    </Modal>
  );
};