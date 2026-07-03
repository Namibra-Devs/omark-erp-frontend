// src/pages/dashboard/AdminDashboardPage.tsx
import React, { useState, useEffect } from 'react';
import { Tabs, Typography, Space, Button, Alert, Badge, message, Tooltip } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  SettingOutlined,
  AuditOutlined,
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
import { SystemSettings } from './admin/components/SystemSettings';
import { AuditLog } from './admin/components/AuditLog';
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
  const [auditLogModal, setAuditLogModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [systemSettings, setSystemSettings] = useState({
    maintenanceMode: false,
    emailNotifications: true,
    smsNotifications: true,
    autoBackup: true,
    defaultCurrency: 'GHS',
    timezone: 'Africa/Accra',
    dateFormat: 'YYYY-MM-DD',
  });

  // Dismiss maintenance alert without turning off the setting
  const [maintenanceDismissed, setMaintenanceDismissed] = useState(false);
  useEffect(() => { setMaintenanceDismissed(false); }, [systemSettings.maintenanceMode]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleExport = (format: 'excel' | 'csv' | 'pdf' | 'json') => {
    exportData(format);
    setExportModal(false);
  };

 const handleAddUser = (values: any) => {
    // Debugging safeguard line: Check your terminal console if things still look strange
    console.log("Parent component received values for submission:", values);

    // Ensure we handle values gracefully even if a field is skipped
    addUser({
      name: `${values.firstName || ''} ${values.lastName || ''}`.trim() || 'New User',
      email: values.email || '',
      phone: values.phone || '',
      role: values.role || 'marketing_staff', // Set your preferred default fallback role here
      status: 'active',
      department: values.department || 'Marketing', // Default fallback department
    });
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
          onViewAll={() => setAuditLogModal(true)}
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
    {
      key: '3',
      label: (
        <span className="adp-tab-label">
          <SettingOutlined />
          System Settings
          {systemSettings.maintenanceMode && (
            <span
              style={{
                background: '#fff7e6',
                border: '1px solid #ffd591',
                borderRadius: 10,
                padding: '0 6px',
                fontSize: 10,
                fontWeight: 700,
                color: '#d46b08',
                marginLeft: 2,
                lineHeight: '18px',
              }}
            >
              MAINT
            </span>
          )}
        </span>
      ),
      children: (
        <SystemSettings
          settings={systemSettings}
          onSettingsChange={setSystemSettings}
          loading={loading}
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
            {/* Replace the existing Tooltip + Badge + Button block */}
<Tooltip title="View notifications">
  <button
    onClick={() => setAuditLogModal(true)}
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
    aria-label={`Notifications — ${stats.pendingNotifications} pending`}
  >
    <BellOutlined style={{ fontSize: 16 }} />

    {stats.pendingNotifications > 0 && (
      <>
        <style>{`
          @keyframes bell-pulse-ring {
            0%   { transform: scale(1);   opacity: 0.6; }
            70%  { transform: scale(2.2); opacity: 0; }
            100% { transform: scale(2.2); opacity: 0; }
          }
          @keyframes bell-pulse-core {
            0%, 100% { transform: scale(1); }
            50%       { transform: scale(0.85); }
          }
        `}</style>

        {/* Ripple ring */}
        <span style={{
          position: 'absolute',
          top: 5,
          right: 5,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#ff4d4f',
          animation: 'bell-pulse-ring 1.8s ease-out infinite',
          pointerEvents: 'none',
        }} />

        {/* Solid dot */}
        <span style={{
          position: 'absolute',
          top: 5,
          right: 5,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#ff4d4f',
          border: '1.5px solid #fff',
          animation: 'bell-pulse-core 1.8s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      </>
    )}
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

            <Tooltip title="System settings">
              <Button
                icon={<SettingOutlined />}
                onClick={() => setSettingsModal(true)}
                style={{ borderRadius: 8 }}
              />
            </Tooltip>
          </Space>
        </div>
      </div>

      {/* ── MAINTENANCE ALERT ────────────────────────────────────────────── */}
      {systemSettings.maintenanceMode && !maintenanceDismissed && (
        <Alert
          icon={<SafetyOutlined />}
          message="Maintenance Mode is Active"
          description="Users cannot access the system. Disable this in System Settings → System Toggles."
          type="warning"
          showIcon
          closable
          onClose={() => setMaintenanceDismissed(true)}
          style={{ marginBottom: 20, borderRadius: 12 }}
        />
      )}

      {/* ── STATS ────────────────────────────────────────────────────────── */}
      <div className="adp-stats">
        <StatsCards stats={stats} loading={loading} />
      </div>

     {/* ── QUICK ACTIONS ────────────────────────────────────────────────── */}
<div className="adp-actions" style={{ marginTop: 20, marginBottom: 20 }}>
  <QuickActions
    onAddUser={() => setAddUserModal(true)}
    onManageUsers={() => setActiveTab('2')}
    onSystemSettings={() => setSettingsModal(true)}
    onExport={() => setExportModal(true)}
    onAuditLog={() => setAuditLogModal(true)}
    onBackup={() => message.success('Backup initiated — you\'ll be notified when complete.')}
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

      <AuditLog
        open={auditLogModal}
        onCancel={() => setAuditLogModal(false)}
        logs={activityLogs}
        loading={loading}
      />

      <SystemSettings
        open={settingsModal}
        settings={systemSettings}
        onSettingsChange={setSystemSettings}
        onClose={() => setSettingsModal(false)}
        loading={loading}
      />
    </div>
  );
};