// src/pages/dashboard/admin/hooks/useAdminDashboard.ts
import { useState, useEffect } from 'react';
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
    department: 'Administration'
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
    department: 'Marketing'
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
    department: 'Customer Service'
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
    department: 'Administration'
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
    department: 'Finance'
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
    department: 'Marketing'
  },
];

const initialActivityLogs: ActivityLog[] = [
  { 
    id: '1', 
    user: 'John Admin', 
    action: 'User Created', 
    details: 'Created new user: Sarah Marketing', 
    timestamp: '2024-01-15 14:30:00',
    type: 'success' 
  },
  { 
    id: '2', 
    user: 'Sarah Marketing', 
    action: 'Prospect Added', 
    details: 'Added new prospect: James Brown', 
    timestamp: '2024-01-15 13:45:00',
    type: 'info' 
  },
  { 
    id: '3', 
    user: 'System', 
    action: 'Payment Processed', 
    details: 'Payment of GHS 2,500.00 from John Doe', 
    timestamp: '2024-01-15 12:20:00',
    type: 'success' 
  },
  { 
    id: '4', 
    user: 'David Secretary', 
    action: 'Deed Generated', 
    details: 'Generated deed for property #102A', 
    timestamp: '2024-01-15 11:00:00',
    type: 'info' 
  },
  { 
    id: '5', 
    user: 'System', 
    action: 'Notification Sent', 
    details: 'SMS reminder sent to 5 customers', 
    timestamp: '2024-01-15 10:30:00',
    type: 'info' 
  },
  { 
    id: '6', 
    user: 'Admin', 
    action: 'Settings Updated', 
    details: 'System settings were modified', 
    timestamp: '2024-01-14 16:20:00',
    type: 'warning' 
  },
  { 
    id: '7', 
    user: 'System', 
    action: 'Error Logged', 
    details: 'API timeout error occurred', 
    timestamp: '2024-01-14 15:00:00',
    type: 'error' 
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

  // CRUD Operations
  const addUser = (userData: Omit<User, 'id' | 'joined' | 'lastActive'>) => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      const newUser: User = {
        id: Date.now().toString(),
        ...userData,
        joined: new Date().toISOString().split('T')[0],
        lastActive: new Date().toISOString().split('T')[0],
      };
      setUsers([...users, newUser]);
      
      // Add to activity log
      const newLog: ActivityLog = {
        id: Date.now().toString(),
        user: 'Admin',
        action: 'User Created',
        details: `Created new user: ${userData.name}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        type: 'success',
      };
      setActivityLogs([newLog, ...activityLogs]);
      
      message.success('User added successfully!');
      setLoading(false);
    }, 500);
  };

  const editUser = (id: string, userData: Partial<User>) => {
    setLoading(true);
    setTimeout(() => {
      setUsers(users.map(user => 
        user.id === id ? { ...user, ...userData } : user
      ));
      
      const newLog: ActivityLog = {
        id: Date.now().toString(),
        user: 'Admin',
        action: 'User Updated',
        details: `Updated user: ${userData.name || 'Unknown'}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        type: 'info',
      };
      setActivityLogs([newLog, ...activityLogs]);
      
      message.success('User updated successfully!');
      setLoading(false);
    }, 500);
  };

  const deleteUser = (id: string) => {
    setLoading(true);
    setTimeout(() => {
      const deletedUser = users.find(u => u.id === id);
      setUsers(users.filter(user => user.id !== id));
      
      if (deletedUser) {
        const newLog: ActivityLog = {
          id: Date.now().toString(),
          user: 'Admin',
          action: 'User Deleted',
          details: `Deleted user: ${deletedUser.name}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
          type: 'warning',
        };
        setActivityLogs([newLog, ...activityLogs]);
      }
      
      message.success('User deleted successfully!');
      setLoading(false);
    }, 500);
  };

  const toggleUserStatus = (id: string) => {
    setLoading(true);
    setTimeout(() => {
      setUsers(users.map(user => {
        if (user.id === id) {
          const newStatus = user.status === 'active' ? 'inactive' : 'active';
          return { ...user, status: newStatus };
        }
        return user;
      }));
      
      message.success('User status updated!');
      setLoading(false);
    }, 500);
  };

  const addActivityLog = (log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
    const newLog: ActivityLog = {
      id: Date.now().toString(),
      ...log,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    setActivityLogs([newLog, ...activityLogs]);
  };

  // Export functionality
  const exportData = (format: 'excel' | 'csv' | 'pdf' | 'json') => {
    setLoading(true);
    setTimeout(() => {
      const data = {
        users,
        activityLogs,
        stats,
        exportedAt: new Date().toISOString(),
      };
      
      let fileName = `omark-export-${new Date().toISOString().split('T')[0]}`;
      
      switch (format) {
        case 'json':
          const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          downloadFile(jsonBlob, `${fileName}.json`);
          break;
        case 'csv':
          // Simple CSV export for users
          const csvRows = [
            ['Name', 'Email', 'Role', 'Status', 'Department'],
            ...users.map(u => [u.name, u.email, u.role, u.status, u.department || ''])
          ];
          const csvContent = csvRows.map(row => row.join(',')).join('\n');
          const csvBlob = new Blob([csvContent], { type: 'text/csv' });
          downloadFile(csvBlob, `${fileName}.csv`);
          break;
        case 'excel':
          // For demo, we'll use CSV as Excel
          const excelContent = csvRows.map(row => row.join('\t')).join('\n');
          const excelBlob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
          downloadFile(excelBlob, `${fileName}.xls`);
          break;
        case 'pdf':
          // For demo, we'll just show a message
          message.info('PDF export would generate a formatted report');
          break;
      }
      
      const newLog: ActivityLog = {
        id: Date.now().toString(),
        user: 'Admin',
        action: 'Data Exported',
        details: `Exported data in ${format.toUpperCase()} format`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        type: 'info',
      };
      setActivityLogs([newLog, ...activityLogs]);
      
      setLoading(false);
    }, 500);
  };

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

  // Refresh dashboard
  const refreshDashboard = () => {
    setLoading(true);
    setTimeout(() => {
      // Add refresh activity
      const newLog: ActivityLog = {
        id: Date.now().toString(),
        user: 'Admin',
        action: 'Dashboard Refreshed',
        details: 'Manual dashboard refresh',
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        type: 'info',
      };
      setActivityLogs([newLog, ...activityLogs]);
      message.success('Dashboard refreshed successfully!');
      setLoading(false);
    }, 500);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchText.toLowerCase()) ||
                          user.email.toLowerCase().includes(searchText.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
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