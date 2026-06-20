// src/pages/dashboard/admin/hooks/useAdminDashboard.ts
import { useState } from 'react';
import { message } from 'antd';
import type { User, SystemStats, ActivityLog } from '../types';

// Initial mock data
const initialUsers: User[] = [
  {
    id: '1',
    name: 'John Admin',
    email: 'john@omark.com',
    role: 'admin',
    status: 'active',
    joined: '2024-01-01',
    lastActive: '2024-01-15',
    phone: '+233201234567',
    department: 'Administration',
  },
  {
    id: '2',
    name: 'Sarah Marketing',
    email: 'sarah@omark.com',
    role: 'marketing_staff',
    status: 'active',
    joined: '2024-01-02',
    lastActive: '2024-01-15',
    phone: '+233201234568',
    department: 'Marketing',
  },
  {
    id: '3',
    name: 'Mike Johnson',
    email: 'mike@omark.com',
    role: 'customer_service',
    status: 'inactive',
    joined: '2024-01-03',
    lastActive: '2024-01-10',
    phone: '+233201234569',
    department: 'Customer Service',
  },
  {
    id: '4',
    name: 'David Secretary',
    email: 'david@omark.com',
    role: 'secretary',
    status: 'active',
    joined: '2024-01-04',
    lastActive: '2024-01-14',
    phone: '+233201234570',
    department: 'Administration',
  },
  {
    id: '5',
    name: 'Lisa Accounts',
    email: 'lisa@omark.com',
    role: 'accounts',
    status: 'active',
    joined: '2024-01-05',
    lastActive: '2024-01-15',
    phone: '+233201234571',
    department: 'Finance',
  },
  {
    id: '6',
    name: 'Emma Director',
    email: 'emma@omark.com',
    role: 'marketing_director',
    status: 'active',
    joined: '2024-01-06',
    lastActive: '2024-01-15',
    phone: '+233201234572',
    department: 'Marketing',
  },
];

const initialActivityLogs: ActivityLog[] = [
  {
    id: '1',
    user: 'John Admin',
    action: 'User Created',
    details: 'Created new user: Sarah Marketing',
    timestamp: '2024-01-15 14:30:00',
    type: 'success',
  },
  {
    id: '2',
    user: 'Sarah Marketing',
    action: 'Prospect Added',
    details: 'Added new prospect: James Brown',
    timestamp: '2024-01-15 13:45:00',
    type: 'info',
  },
  {
    id: '3',
    user: 'System',
    action: 'Payment Processed',
    details: 'Payment of GHS 2,500.00 from John Doe',
    timestamp: '2024-01-15 12:20:00',
    type: 'success',
  },
  {
    id: '4',
    user: 'David Secretary',
    action: 'Deed Generated',
    details: 'Generated deed for property #102A',
    timestamp: '2024-01-15 11:00:00',
    type: 'info',
  },
  {
    id: '5',
    user: 'System',
    action: 'Notification Sent',
    details: 'SMS reminder sent to 5 customers',
    timestamp: '2024-01-15 10:30:00',
    type: 'info',
  },
  {
    id: '6',
    user: 'Admin',
    action: 'Settings Updated',
    details: 'System settings were modified',
    timestamp: '2024-01-14 16:20:00',
    type: 'warning',
  },
  {
    id: '7',
    user: 'System',
    action: 'Error Logged',
    details: 'API timeout error occurred',
    timestamp: '2024-01-14 15:00:00',
    type: 'error',
  },
];

export const useAdminDashboard = () => {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(initialActivityLogs);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  // System stats
  const stats: SystemStats = {
    totalUsers: users.length,
    activeUsers: users.filter(u => u.status === 'active').length,
    totalProspects: 234,
    totalCustomers: 156,
    totalPaymentPlans: 89,
    activePaymentPlans: 67,
    totalDeeds: 67,
    totalNotifications: 143,
    pendingNotifications: 23,
    monthlyRevenue: 12500000,
    growthRate: 12.5,
    conversionRate: 38.7,
  };

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
    setLoading(true);
    setTimeout(() => {
      const newUser: User = {
        id: Date.now().toString(),
        ...userData,
        joined: new Date().toISOString().split('T')[0],
        lastActive: new Date().toISOString().split('T')[0],
      };
      setUsers(prev => [...prev, newUser]);
      setActivityLogs(prev => [makeLog('User Created', `Created new user: ${userData.name}`, 'success'), ...prev]);
      message.success('User added successfully!');
      setLoading(false);
    }, 500);
  };

  const editUser = (id: string, userData: Partial<User>) => {
    setLoading(true);
    setTimeout(() => {
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...userData } : u)));
      setActivityLogs(prev => [makeLog('User Updated', `Updated user: ${userData.name ?? 'Unknown'}`, 'info'), ...prev]);
      message.success('User updated successfully!');
      setLoading(false);
    }, 500);
  };

  const deleteUser = (id: string) => {
    setLoading(true);
    setTimeout(() => {
      const target = users.find(u => u.id === id);
      setUsers(prev => prev.filter(u => u.id !== id));
      if (target) {
        setActivityLogs(prev => [makeLog('User Deleted', `Deleted user: ${target.name}`, 'warning'), ...prev]);
      }
      message.success('User deleted successfully!');
      setLoading(false);
    }, 500);
  };

  const toggleUserStatus = (id: string) => {
    setLoading(true);
    setTimeout(() => {
      setUsers(prev =>
        prev.map(u =>
          u.id === id ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' } : u
        )
      );
      message.success('User status updated!');
      setLoading(false);
    }, 500);
  };

  const addActivityLog = (log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
    setActivityLogs(prev => [
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
    setLoading(true);
    setTimeout(() => {
      const fileName = `omark-export-${new Date().toISOString().split('T')[0]}`;

      // Build rows once — used by both csv and excel cases
      const csvRows: string[][] = [
        ['Name', 'Email', 'Role', 'Status', 'Department'],
        ...users.map(u => [u.name, u.email, u.role, u.status, u.department ?? '']),
      ];

      switch (format) {
        case 'json': {
          const blob = new Blob(
            [JSON.stringify({ users, activityLogs, stats, exportedAt: new Date().toISOString() }, null, 2)],
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

      setActivityLogs(prev => [
        makeLog('Data Exported', `Exported data in ${format.toUpperCase()} format`, 'info'),
        ...prev,
      ]);
      setLoading(false);
    }, 500);
  };

  // ── Refresh ───────────────────────────────────────────────────────────────
  const refreshDashboard = () => {
    setLoading(true);
    setTimeout(() => {
      setActivityLogs(prev => [makeLog('Dashboard Refreshed', 'Manual dashboard refresh', 'info'), ...prev]);
      setLoading(false);
    }, 500);
  };

  // ── Filtered users for consumer ───────────────────────────────────────────
  const filteredUsers = users.filter(u => {
    const q = searchText.toLowerCase();
    const matchSearch = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole = filterRole === 'all' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  return {
    users: filteredUsers,
    allUsers: users,
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