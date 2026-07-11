// src/pages/dashboard/AdminDashboardPage.tsx
import React, { useState } from 'react';
import { Tabs, Typography, Space, Button, Alert, Badge, message, Tooltip } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  ReloadOutlined,
  ExportOutlined,
  PlusOutlined,
  BellOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminDashboard } from './admin/hooks/useAdminDashboard';
import { StatsCards } from './admin/components/StatsCards';
import { QuickActions } from './admin/components/QuickActions';
import { RecentActivity } from './admin/components/RecentActivity';
import { UserManagement } from './admin/components/UserManagement';
import { AddUserModal } from './admin/components/AddUserModal';
import { EditUserDrawer } from './admin/components/EditUserDrawer';
import { ExportModal } from './admin/components/ExportModal';

const { Title, Text } = Typography;

// ── Greeting based on time of day ──────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Subtle animated dot for live indicator ─────────────────────────────────
const LiveDot: React.FC = () => (
  <>
    <style>{`
      @keyframes adp-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%       { opacity: 0.5; transform: scale(1.5); }
      }
      @keyframes adp-fadein {
        from { opacity: 0; transform: translateY(-8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes adp-slideup {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .adp-header {
        animation: adp-fadein 0.5s ease both;
      }
      .adp-stats {
        animation: adp-slideup 0.55s ease 0.1s both;
      }
      .adp-actions {
        animation: adp-slideup 0.55s ease 0.2s both;
      }
      .adp-tabs {
        animation: adp-slideup 0.55s ease 0.3s both;
      }
      .adp-tab-label {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 2px 0;
      }
      .adp-header-actions .ant-btn {
        border-radius: 8px !important;
        font-weight: 500;
      }
      .adp-tabs .ant-tabs-tab {
        font-weight: 500;
        font-size: 14px;
      }
      .adp-tabs .ant-tabs-tab-active {
        font-weight: 600;
      }
    `}</style>
    <span
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: '#52c41a',
        marginRight: 7,
        verticalAlign: 'middle',
        animation: 'adp-pulse 2s ease-in-out infinite',
      }}
    />
  </>
);

// ─────────────────────────────────────────────────────────────────────────────
export const AdminDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const {
    users,
    activityLogs,
    stats,
    loading,
    searchText,
    setSearchText,
    filterRole,
    setFilterRole,
    addUser,
    editUser,
    deleteUser,
    toggleUserStatus,
    exportData,
    refreshDashboard,
  } = useAdminDashboard();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('1');
  const [addUserModal, setAddUserModal] = useState(false);
  const [editUserDrawer, setEditUserDrawer] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [exportModal, setExportModal] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleExport = (format: 'excel' | 'csv' | 'pdf' | 'json') => {
    exportData(format);
    setExportModal(false);
  };

 const handleAddUser = (values: any) => {
  console.log("Parent component received values for submission:", values);
  addUser(values);
  setAddUserModal(false);
};
  const handleEditUser = (values: any) => {
    editUser(selectedUser.id, values);
    setEditUserDrawer(false);
    setSelectedUser(null);
  };

  const handleRefresh = () => {
    refreshDashboard();
    message.success({ content: 'Dashboard refreshed', key: 'refresh', duration: 2 });
  };

  // ── Tab items ─────────────────────────────────────────────────────────────
  const tabItems = [
    {
      key: '1',
      label: (
        <span className="adp-tab-label">
          <DashboardOutlined />
          Overview
        </span>
      ),
      children: (
        <RecentActivity
          activities={activityLogs}
          loading={loading}
        />
      ),
    },
    {
      key: '2',
      label: (
        <span className="adp-tab-label">
          <UserOutlined />
          User Management
          {stats.totalUsers > 0 && (
            <span
              style={{
                background: '#f0f0f0',
                borderRadius: 10,
                padding: '1px 7px',
                fontSize: 11,
                fontWeight: 600,
                color: '#555',
                marginLeft: 2,
              }}
            >
              {stats.totalUsers}
            </span>
          )}
        </span>
      ),
      children: (
        <UserManagement
          users={users}
          loading={loading}
          searchText={searchText}
          filterRole={filterRole}
          onSearchChange={setSearchText}
          onFilterChange={setFilterRole}
          onAddUser={() => setAddUserModal(true)}
          onEditUser={(u: any) => {
            setSelectedUser(u);
            setEditUserDrawer(true);
          }}
          onDeleteUser={deleteUser}
          onToggleStatus={toggleUserStatus}
        />
      ),
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="admin-dashboard">

      {/* ── PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="adp-header" style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          {/* Left: greeting + title */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <LiveDot />
              <Text type="secondary" style={{ fontSize: 13 }}>
                {getGreeting()}, {user?.firstName}
              </Text>
            </div>
            <Title level={2} style={{ margin: 0, lineHeight: 1.2 }}>
              Admin Dashboard
            </Title>
            <Text type="secondary" style={{ fontSize: 13, marginTop: 4, display: 'block' }}>
              Here's your system overview for today
            </Text>
          </div>

          {/* Right: action buttons */}
          <Space wrap className="adp-header-actions">
            <Tooltip title="View notifications">
              <button
                onClick={() => message.info('Notifications feature coming soon!')}
                style={{
                  position: 'relative',
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: '1px solid #d9d9d9',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#595959',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                aria-label="Notifications"
              >
                <BellOutlined style={{ fontSize: 16 }} />
              </button>
            </Tooltip>

            <Tooltip title="Export data">
              <Button
                icon={<ExportOutlined />}
                onClick={() => setExportModal(true)}
                style={{ borderRadius: 8 }}
              >
                Export
              </Button>
            </Tooltip>

            <Tooltip title="Refresh all data">
              <Button
                icon={<ReloadOutlined spin={loading} />}
                onClick={handleRefresh}
                loading={loading}
                style={{ borderRadius: 8 }}
              >
                Refresh
              </Button>
            </Tooltip>

            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddUserModal(true)}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Add Staff
            </Button>
          </Space>
        </div>
      </div>

      {/* ── STATS ────────────────────────────────────────────────────────── */}
      <div className="adp-stats">
        <StatsCards stats={stats} loading={loading} />
      </div>

      {/* ── QUICK ACTIONS ────────────────────────────────────────────────── */}
      <div className="adp-actions" style={{ marginTop: 20, marginBottom: 20 }}>
        <QuickActions
          onAddUser={() => setAddUserModal(true)}
          onManageUsers={() => setActiveTab('2')}
          onExport={() => setExportModal(true)}
        />
      </div>

      {/* ── MAIN TABS ────────────────────────────────────────────────────── */}
      <div className="adp-tabs">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="middle"
          tabBarStyle={{ marginBottom: 16 }}
        />
      </div>

      {/* ── MODALS & DRAWERS ─────────────────────────────────────────────── */}
      <AddUserModal
        open={addUserModal}
        onCancel={() => setAddUserModal(false)}
        onAdd={handleAddUser}
        loading={loading}
      />

      <EditUserDrawer
        open={editUserDrawer}
        user={selectedUser}
        onClose={() => { setEditUserDrawer(false); setSelectedUser(null); }}
        onEdit={handleEditUser}
        loading={loading}
      />

      <ExportModal
        open={exportModal}
        onCancel={() => setExportModal(false)}
        onExport={handleExport}
        loading={loading}
      />
    </div>
  );
};