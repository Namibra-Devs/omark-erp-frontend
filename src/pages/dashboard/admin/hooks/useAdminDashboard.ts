// src/pages/dashboard/admin/hooks/useAdminDashboard.ts
import { useState, useEffect } from 'react';
import { message, Modal } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminDashboardOverviewQuery } from '@/api/dashboard';
import { 
  useUsersQuery, 
  useUpdateUserMutation, 
  useCreateUserMutation,
  useDeleteUserMutation,
  usersKeys, 
  type UserEntity 
} from '@/api/users';
import { useProspectsQuery } from '@/api/prospects';
import { useCustomersQuery } from '@/api/customers';
import type { User, SystemStats, ActivityLog } from '../types';

// Maps backend UserEntity -> local User shape used by admin dashboard UI.
const mapApiUserToLocalUser = (entity: UserEntity): User => {
  const name =
    entity.name ??
    [entity.firstName, entity.lastName].filter(Boolean).join(' ').trim() ??
    entity.email;

  const phone =
    typeof entity.phone === 'string'
      ? entity.phone
      : (entity.phone as { number?: string; value?: string } | undefined)?.number ??
        (entity.phone as { number?: string; value?: string } | undefined)?.value ??
        entity.phoneNumber ??
        '';

  return {
    id: entity.id,
    name,
    email: entity.email,
    phone,
    role: entity.role,
    status: entity.isActive ? 'active' : 'inactive',
    department: entity.department || undefined,
    joined: entity.createdAt?.split('T')[0] ?? '',
    lastActive: entity.updatedAt?.split('T')[0] ?? '',
  } as User;
};

export const useAdminDashboard = () => {
  const queryClient = useQueryClient();

  // ── Live API queries ────────────────────────────────────────────────────
  const { data: apiStats, isLoading: statsLoading } = useAdminDashboardOverviewQuery();
  const { data: apiUsers, isLoading: usersLoading, refetch: refetchUsers } = useUsersQuery();
  
  // ── Additional queries for prospects and customers if dashboard doesn't provide them ──
  const { data: prospectsData, isLoading: prospectsLoading } = useProspectsQuery({
    source: 'marketing',
    page: 1,
    pageSize: 1,
  });
  
  const { data: customersData, isLoading: customersLoading } = useCustomersQuery({
    page: 1,
    limit: 1,
  });

  // ── Mutations ───────────────────────────────────────────────────────────
  const createUserMutation = useCreateUserMutation();
  const updateUserMutation = useUpdateUserMutation();
  const deleteUserMutation = useDeleteUserMutation();

  // ── Local UI state ─────────────────────────────────────────────────────
  const [localActivityLogs, setLocalActivityLogs] = useState<ActivityLog[]>([]);
  const [searchText, setSearchText] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  const loading =
    statsLoading || usersLoading || prospectsLoading || customersLoading || 
    createUserMutation.isPending || updateUserMutation.isPending || deleteUserMutation.isPending;

  // ── Log API data for debugging ──────────────────────────────────────────
  useEffect(() => {
    console.log('📊 API Stats Response:', apiStats);
    console.log('📊 Total Prospects from API:', apiStats?.totalProspects);
    console.log('📊 Total Customers from API:', apiStats?.totalCustomers);
    console.log('📊 Total Users from API:', apiStats?.totalUsers);
  }, [apiStats]);

  // ── Map live users list to local User shape ────────────────────────────
  // Handle different response structures
  let users: User[] = [];
  
  if (apiUsers) {
    console.log('📊 Raw API Users Response:', apiUsers);
    
    // Try different response formats
    let userEntities: UserEntity[] = [];
    
    // Format 1: { data: { items: [] } }
    if (apiUsers.data && apiUsers.data.items) {
      userEntities = apiUsers.data.items;
    }
    // Format 2: { items: [] }
    else if (apiUsers.items) {
      userEntities = apiUsers.items;
    }
    // Format 3: { data: [] }
    else if (Array.isArray(apiUsers.data)) {
      userEntities = apiUsers.data;
    }
    // Format 4: [] (direct array)
    else if (Array.isArray(apiUsers)) {
      userEntities = apiUsers;
    }
    // Format 5: Single object
    else if (apiUsers.id) {
      userEntities = [apiUsers];
    }
    
    console.log('📊 Extracted User Entities:', userEntities);
    users = userEntities.map(mapApiUserToLocalUser);
    console.log('📊 Mapped Users:', users);
  }

  // ── Extract prospects and customers counts from API or fallback ────────
  const totalProspects = apiStats?.totalProspects ?? 
    (prospectsData as any)?.total ?? 
    (prospectsData as any)?.data?.total ?? 
    0;

  const totalCustomers = apiStats?.totalCustomers ?? 
    (customersData as any)?.total ?? 
    (customersData as any)?.data?.total ?? 
    0;

  console.log('📊 Final Total Prospects:', totalProspects);
  console.log('📊 Final Total Customers:', totalCustomers);

  // ── Map API stats to SystemStats shape ────────────────────────────────
  const stats: SystemStats = {
    totalUsers: apiStats?.totalUsers ?? users.length,
    activeUsers: apiStats?.activeUsers ?? users.filter(u => u.status === 'active').length,
    totalProspects: totalProspects,
    totalCustomers: totalCustomers,
    totalPaymentPlans: apiStats?.totalPaymentPlans ?? 0,
    activePaymentPlans: apiStats?.activePaymentPlans ?? 0,
    totalDeeds: apiStats?.totalDeeds ?? 0,
    totalNotifications: apiStats?.totalNotifications ?? 0,
    pendingNotifications: apiStats?.pendingNotifications ?? 0,
    monthlyRevenue: apiStats?.monthlyRevenue ?? 0,
    growthRate: apiStats?.growthRate ?? 0,
    conversionRate: apiStats?.conversionRate ?? 0,
  };

  console.log('📊 Final Stats Object:', stats);

  const activityLogs = localActivityLogs;

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
  const addUser = (userData: any) => {
    console.log('🔍 addUser received:', userData);

    // Extract fields - handle both naming conventions
    const firstName = userData.firstName || '';
    const lastName = userData.lastName || '';
    const fullName = userData.name || `${firstName} ${lastName}`.trim();
    
    // Get phone from either field
    const phone = userData.phoneNumber || userData.phone || '';

    // Validate required fields
    if (!firstName || firstName.trim() === '') {
      message.error('First name is required');
      return;
    }

    if (!lastName || lastName.trim() === '') {
      message.error('Last name is required');
      return;
    }

    if (!userData.email || userData.email.trim() === '') {
      message.error('Email is required');
      return;
    }

    if (!phone || phone.trim() === '') {
      message.error('Phone number is required');
      return;
    }

    // Generate a secure password
    const generateSecurePassword = () => {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
      let password = '';
      for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    };

    const password = userData.password || generateSecurePassword();

    // Map role to API format
    const roleMap: Record<string, string> = {
      'admin': 'admin',
      'marketing_director': 'marketing_director',
      'marketing_staff': 'marketing_staff',
      'customer_service': 'customer_service',
      'secretary': 'secretary',
      'accounts': 'accounts',
    };

    const role = roleMap[userData.role] || 'marketing_staff';

    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: userData.email.trim(),
      phoneNumber: phone.trim(),
      password: password,
      role: role as any,
      department: userData.department || 'Marketing',
      isActive: true,
    };

    console.log('📤 Sending registration payload:', payload);

    createUserMutation.mutate(payload, {
      onSuccess: (response) => {
        console.log('✅ Registration successful:', response);
        setLocalActivityLogs(prev => [
          makeLog('User Created', `Created new user: ${fullName || firstName}`, 'success'),
          ...prev,
        ]);
        
        // Show password in success message (without JSX)
        const passwordMessage = `User ${fullName || firstName} added successfully!\n\nTemporary password: ${password}\n\nPlease share this password with the user. They can change it after first login.`;
        
        message.success({
          content: passwordMessage,
          duration: 10,
        });
        
        // Force refetch users with a delay to ensure backend has processed
        setTimeout(() => {
          refetchUsers();
          queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
          queryClient.invalidateQueries({ queryKey: usersKeys.list() });
          queryClient.invalidateQueries({ queryKey: ['users'] });
          queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
        }, 500);
      },
      onError: (err: any) => {
        console.error('❌ Registration error:', err);
        const errorData = err?.response?.data || err?.error || err;
        const msg = errorData?.message || 'Failed to create user';
        
        if (errorData?.errors) {
          const errorMessages = Object.values(errorData.errors).flat().join(', ');
          message.error(`Validation error: ${errorMessages}`);
        } else {
          message.error(msg);
        }
      },
    });
  };

  const editUser = (id: string, userData: Partial<User>) => {
    const [firstName, ...rest] = (userData.name ?? '').split(' ');

    const payload: any = {};
    
    if (userData.name) {
      payload.firstName = firstName;
      payload.lastName = rest.join(' ');
    }
    if (userData.email) payload.email = userData.email;
    if (userData.phone) payload.phoneNumber = userData.phone;
    if (userData.role) payload.role = userData.role;
    if (userData.status) payload.isActive = userData.status === 'active';
    if (userData.department) payload.department = userData.department;

    updateUserMutation.mutate(
      { id, payload },
      {
        onSuccess: () => {
          setLocalActivityLogs(prev => [
            makeLog('User Updated', `Updated user: ${userData.name ?? 'Unknown'}`, 'info'),
            ...prev,
          ]);
          message.success('User updated successfully!');
          refetchUsers();
          queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
          queryClient.invalidateQueries({ queryKey: usersKeys.detail(id) });
        },
        onError: (err: any) => {
          console.error('❌ Update error:', err);
          const errorData = err?.response?.data || err?.error || err;
          const msg = errorData?.message || 'Failed to update user';
          message.error(msg);
        },
      }
    );
  };

  const deleteUser = (id: string) => {
    const target = users.find(u => u.id === id);

    if (!target) {
      message.error('User not found');
      return;
    }

    // Confirm deletion with Modal
    Modal.confirm({
      title: 'Delete User',
      content: `Are you sure you want to permanently delete ${target.name}?\n\nWarning: This action cannot be undone. All associated data will be permanently removed.\n\nEmail: ${target.email}\nRole: ${target.role}`,
      okText: 'Yes, Delete Permanently',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteUserMutation.mutateAsync(id);
          setLocalActivityLogs(prev => [
            makeLog('User Deleted', `Permanently deleted user: ${target.name}`, 'error'),
            ...prev,
          ]);
          message.success(`User ${target.name} has been permanently deleted.`);
          
          // Refetch users to update the list
          setTimeout(() => {
            refetchUsers();
            queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
            queryClient.invalidateQueries({ queryKey: usersKeys.list() });
            queryClient.invalidateQueries({ queryKey: ['users'] });
          }, 300);
        } catch (err: any) {
          console.error('❌ Delete error:', err);
          const errorData = err?.response?.data || err?.error || err;
          const msg = errorData?.message || 'Failed to delete user';
          message.error(msg);
        }
      },
    });
  };

  const toggleUserStatus = (id: string) => {
    const target = users.find(u => u.id === id);
    if (!target) {
      message.error('User not found');
      return;
    }

    const nextIsActive = target.status !== 'active';

    updateUserMutation.mutate(
      { id, payload: { isActive: nextIsActive } },
      {
        onSuccess: () => {
          message.success(`User ${nextIsActive ? 'activated' : 'deactivated'} successfully!`);
          setLocalActivityLogs(prev => [
            makeLog(
              'User Status Changed',
              `${target.name} set to ${nextIsActive ? 'active' : 'inactive'}`,
              'info'
            ),
            ...prev,
          ]);
          refetchUsers();
          queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
        },
        onError: (err: any) => {
          console.error('❌ Status toggle error:', err);
          const errorData = err?.response?.data || err?.error || err;
          const msg = errorData?.message || 'Failed to update user status';
          message.error(msg);
        },
      }
    );
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
      ['Name', 'Email', 'Phone', 'Role', 'Status', 'Department'],
      ...users.map(u => [u.name, u.email, u.phone, u.role, u.status, u.department ?? '']),
    ];

    switch (format) {
      case 'json': {
        const blob = new Blob(
          [
            JSON.stringify(
              { users, activityLogs, stats, exportedAt: new Date().toISOString() },
              null,
              2
            ),
          ],
          { type: 'application/json' }
        );
        downloadFile(blob, `${fileName}.json`);
        break;
      }
      case 'csv': {
        const blob = new Blob([csvRows.map(row => row.join(',')).join('\n')], {
          type: 'text/csv',
        });
        downloadFile(blob, `${fileName}.csv`);
        break;
      }
      case 'excel': {
        const blob = new Blob([csvRows.map(row => row.join('\t')).join('\n')], {
          type: 'application/vnd.ms-excel',
        });
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
    queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
    queryClient.invalidateQueries({ queryKey: usersKeys.list() });
    queryClient.invalidateQueries({ queryKey: ['users'] });
    refetchUsers();
    setLocalActivityLogs(prev => [
      makeLog('Dashboard Refreshed', 'Manual dashboard refresh', 'info'),
      ...prev,
    ]);
    message.success('Dashboard refreshed!');
  };

  // ── Filtered users ────────────────────────────────────────────────────────
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