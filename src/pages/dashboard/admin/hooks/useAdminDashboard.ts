// src/pages/dashboard/admin/hooks/useAdminDashboard.ts
import { useState } from 'react';
import { message } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import {
  useDashboardStatsQuery,
  useDashboardActivityQuery,
  type ActivityLog as ApiActivityLog,
} from '@/api/dashboard';
import { useRegisterMutation } from '@/api/auth';
import type { User, SystemStats, ActivityLog } from '../types';

export const useAdminDashboard = () => {
  const queryClient = useQueryClient();

  // ── Live API queries ────────────────────────────────────────────────────
  const { data: apiStats, isLoading: statsLoading } = useDashboardStatsQuery();
  const { data: apiActivity, isLoading: activityLoading } = useDashboardActivityQuery();

  // ── Mutations ───────────────────────────────────────────────────────────
  const registerMutation = useRegisterMutation();

  // ── Local UI state ──────────────────────────────────────────────────────
  const [localUsers, setLocalUsers] = useState<User[]>([]);
  const [localActivityLogs, setLocalActivityLogs] = useState<ActivityLog[]>([]);
  const [searchText, setSearchText] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  const loading = statsLoading || activityLoading || registerMutation.isPending;

  // ── Map API stats to SystemStats shape ────────────────────────────────
  const stats: SystemStats = {
    totalUsers: apiStats?.totalUsers ?? localUsers.length,
    activeUsers: apiStats?.activeUsers ?? localUsers.filter(u => u.status === 'active').length,
    totalProspects: apiStats?.totalProspects ?? 0,
    totalCustomers: apiStats?.totalCustomers ?? 0,
    totalPaymentPlans: apiStats?.totalPaymentPlans ?? 0,
    activePaymentPlans: apiStats?.activePaymentPlans ?? 0,
    totalDeeds: apiStats?.totalDeeds ?? 0,
    totalNotifications: apiStats?.totalNotifications ?? 0,
    pendingNotifications: apiStats?.pendingNotifications ?? 0,
    monthlyRevenue: apiStats?.monthlyRevenue ?? 0,
    growthRate: apiStats?.growthRate ?? 0,
    conversionRate: apiStats?.conversionRate ?? 0,
  };

  // ── Map API activity logs to local ActivityLog shape ──────────────────
  const apiActivityMapped: ActivityLog[] = Array.isArray(apiActivity)
    ? apiActivity.map((log: ApiActivityLog) => ({
        id: String(log.id),
        user: log.user,
        action: log.action,
        details: log.description,
        timestamp: log.timestamp,
        type: 'info' as const,
      }))
    : [];

  const activityLogs = [...localActivityLogs, ...apiActivityMapped];

  // ── Helpers ──────────────────────────────────────────────────────────────
  const makeLog = (
    action: string,
    details: string,
    type: ActivityLog['type'] = 'info'
  ): ActivityLog => ({
    id: Date.now().toString(),
    user: 'Admin',
    action,
    details,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    type,
  });

  const downloadFile = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success(`${fileName} downloaded successfully!`);
  };

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const addUser = (userData: Omit<User, 'id' | 'joined' | 'lastActive'>) => {
    // Map to RegisterDto shape required by the API
    const nameParts = userData.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    registerMutation.mutate(
      {
        firstName,
        lastName,
        email: userData.email,
        phoneNumber: userData.phone,
        password: Math.random().toString(36).slice(-10) + 'A1!', // temp password
        role: userData.role as any,
      },
      {
        onSuccess: (response: any) => {
          const newUser: User = {
            id: response?.data?.id ?? Date.now().toString(),
            name: userData.name,
            email: userData.email,
            phone: userData.phone,
            role: userData.role,
            status: 'active',
            department: userData.department,
            joined: new Date().toISOString().split('T')[0],
            lastActive: new Date().toISOString().split('T')[0],
          };
          setLocalUsers(prev => [...prev, newUser]);
          setLocalActivityLogs(prev => [
            makeLog('User Created', `Created new user: ${userData.name}`, 'success'),
            ...prev,
          ]);
          message.success('User added successfully!');
          // Invalidate any user-related queries
          queryClient.invalidateQueries({ queryKey: ['auth'] });
        },
        onError: (err: any) => {
          const msg = err?.error?.message || 'Failed to create user';
          message.error(msg);
        },
      }
    );
  };

  const editUser = (id: string, userData: Partial<User>) => {
    setLocalUsers(prev => prev.map(u => (u.id === id ? { ...u, ...userData } : u)));
    setLocalActivityLogs(prev => [
      makeLog('User Updated', `Updated user: ${userData.name ?? 'Unknown'}`, 'info'),
      ...prev,
    ]);
    message.success('User updated successfully!');
  };

  const deleteUser = (id: string) => {
    const target = localUsers.find(u => u.id === id);
    setLocalUsers(prev => prev.filter(u => u.id !== id));
    if (target) {
      setLocalActivityLogs(prev => [
        makeLog('User Deleted', `Deleted user: ${target.name}`, 'warning'),
        ...prev,
      ]);
    }
    message.success('User deleted successfully!');
  };

  const toggleUserStatus = (id: string) => {
    setLocalUsers(prev =>
      prev.map(u =>
        u.id === id ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' } : u
      )
    );
    message.success('User status updated!');
  };

  const addActivityLog = (log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
    setLocalActivityLogs(prev => [
      {
        id: Date.now().toString(),
        ...log,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      },
      ...prev,
    ]);
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const exportData = (format: 'excel' | 'csv' | 'pdf' | 'json') => {
    const fileName = `omark-export-${new Date().toISOString().split('T')[0]}`;

    const csvRows: string[][] = [
      ['Name', 'Email', 'Role', 'Status', 'Department'],
      ...localUsers.map(u => [u.name, u.email, u.role, u.status, u.department ?? '']),
    ];

    switch (format) {
      case 'json': {
        const blob = new Blob(
          [JSON.stringify({ users: localUsers, activityLogs, stats, exportedAt: new Date().toISOString() }, null, 2)],
          { type: 'application/json' }
        );
        downloadFile(blob, `${fileName}.json`);
        break;
      }
      case 'csv': {
        const blob = new Blob(
          [csvRows.map(row => row.join(',')).join('\n')],
          { type: 'text/csv' }
        );
        downloadFile(blob, `${fileName}.csv`);
        break;
      }
      case 'excel': {
        const blob = new Blob(
          [csvRows.map(row => row.join('\t')).join('\n')],
          { type: 'application/vnd.ms-excel' }
        );
        downloadFile(blob, `${fileName}.xls`);
        break;
      }
      case 'pdf': {
        message.info('PDF export would generate a formatted report');
        break;
      }
    }

    setLocalActivityLogs(prev => [
      makeLog('Data Exported', `Exported data in ${format.toUpperCase()} format`, 'info'),
      ...prev,
    ]);
  };

  // ── Refresh ───────────────────────────────────────────────────────────────
  const refreshDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    setLocalActivityLogs(prev => [makeLog('Dashboard Refreshed', 'Manual dashboard refresh', 'info'), ...prev]);
  };

  // ── Filtered users ────────────────────────────────────────────────────────
  const filteredUsers = localUsers.filter(u => {
    const q = searchText.toLowerCase();
    const matchSearch = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole = filterRole === 'all' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  return {
    users: filteredUsers,
    allUsers: localUsers,
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
    addActivityLog,
    exportData,
    refreshDashboard,
  };
};