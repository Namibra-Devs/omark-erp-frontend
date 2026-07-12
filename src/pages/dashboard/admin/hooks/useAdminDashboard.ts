// src/pages/dashboard/admin/hooks/useAdminDashboard.ts
import { useState, useMemo } from 'react';
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
import { useAppointmentsQuery } from '@/api/appointments';
import { usePropertiesQuery } from '@/api/properties';
import { useDeedsQuery } from '@/api/deeds';
import type { Role } from '@/types';
import type { User, SystemStats, ActivityLog } from '../types';

// There is no activity-log endpoint anywhere in this API — "recent
// activity" spanning prospects/appointments/properties/customers/deeds is
// built here by fetching the latest page of each real entity list and
// merging them into one timeline, sorted by their actual createdAt. This
// is genuinely live data, just assembled client-side instead of coming
// from a single backend feed.
type LiveActivityEntry = ActivityLog & { _sortKey: string };

const buildLiveActivityLog = (params: {
  prospects: Array<{ id: string; firstName: string; lastName: string; source: string; status: string; createdAt: string }>;
  customers: Array<{ id: string; firstName: string; lastName: string; type: string; createdAt: string }>;
  appointments: Array<{ id: string; source: string; status: string; scheduledFor: string; createdAt: string }>;
  properties: Array<{ id: string; houseNumber: string; offerNumber: string; createdAt: string }>;
  deeds: Array<{ id: string; generatedAt: string; createdAt?: string }>;
}): ActivityLog[] => {
  const formatTs = (iso: string) => iso ? iso.replace('T', ' ').slice(0, 19) : '';

  const entries: LiveActivityEntry[] = [
    ...params.prospects.map((p): LiveActivityEntry => ({
      id: `prospect-${p.id}`,
      user: 'System',
      action: 'New Prospect',
      details: `${p.firstName} ${p.lastName} — ${p.source.replace('_', ' ')} (${p.status.replace('_', ' ')})`,
      timestamp: formatTs(p.createdAt),
      type: 'info',
      _sortKey: p.createdAt,
    })),
    ...params.customers.map((c): LiveActivityEntry => ({
      id: `customer-${c.id}`,
      user: 'System',
      action: 'New Customer',
      details: `${c.firstName} ${c.lastName} — ${c.type.replace('_', ' ')}`,
      timestamp: formatTs(c.createdAt),
      type: 'success',
      _sortKey: c.createdAt,
    })),
    ...params.appointments.map((a): LiveActivityEntry => ({
      id: `appointment-${a.id}`,
      user: 'System',
      action: 'Appointment ' + (a.status === 'canceled' ? 'Canceled' : a.status === 'completed' ? 'Completed' : 'Scheduled'),
      details: `${a.source === 'website' ? 'Website booking' : 'Staff booking'} for ${formatTs(a.scheduledFor)}`,
      timestamp: formatTs(a.createdAt),
      type: a.status === 'canceled' ? 'warning' : 'info',
      _sortKey: a.createdAt,
    })),
    ...params.properties.map((p): LiveActivityEntry => ({
      id: `property-${p.id}`,
      user: 'System',
      action: 'Property Added',
      details: `${p.houseNumber} - ${p.offerNumber}`,
      timestamp: formatTs(p.createdAt),
      type: 'info',
      _sortKey: p.createdAt,
    })),
    ...params.deeds.map((d): LiveActivityEntry => ({
      id: `deed-${d.id}`,
      user: 'System',
      action: 'Deed Generated',
      details: `Deed document #${d.id.slice(0, 8).toUpperCase()} generated`,
      timestamp: formatTs(d.generatedAt || d.createdAt || ''),
      type: 'success',
      _sortKey: d.generatedAt || d.createdAt || '',
    })),
  ];

  return entries
    .filter((e) => e._sortKey)
    .sort((a, b) => (a._sortKey < b._sortKey ? 1 : -1))
    .map(({ _sortKey, ...rest }) => rest);
};

// Maps backend UserEntity -> local User shape used by admin dashboard UI.
// `createdPasswords` is an in-memory (never persisted) map of userId -> the
// plaintext password set at creation time, for users created earlier in this
// browser session — the backend hashes passwords and never returns them, so
// this is the only way to let an admin view/copy what they just set.
const mapApiUserToLocalUser = (entity: UserEntity, createdPasswords: Record<string, string>): User => {
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
    firstName: entity.firstName,
    lastName: entity.lastName,
    email: entity.email,
    phone,
    role: entity.role,
    status: entity.isActive ? 'active' : 'inactive',
    department: entity.department || undefined,
    joined: entity.createdAt?.split('T')[0] ?? '',
    lastActive: entity.updatedAt?.split('T')[0] ?? '',
    createdPassword: createdPasswords[entity.id],
  } as User;
};

export const useAdminDashboard = () => {
  const queryClient = useQueryClient();

  // ── Live API queries ────────────────────────────────────────────────────
  const { data: apiStats, isLoading: statsLoading } = useAdminDashboardOverviewQuery();
  const { data: apiUsers, isLoading: usersLoading, refetch: refetchUsers } = useUsersQuery();
  
  // pageSize: 10 (not 1) — these double as both the count fallback (via
  // `.total`, accurate regardless of page size) and the source data for the
  // live "Recent Activity" feed below, so we need actual rows, not just a count.
  const { data: prospectsData, isLoading: prospectsLoading } = useProspectsQuery({
    page: 1,
    pageSize: 10,
  });

  const { data: customersData, isLoading: customersLoading } = useCustomersQuery({
    page: 1,
    pageSize: 10,
  });

  // ── Additional live sources for the Recent Activity feed ────────────────
  // There is no activity-log endpoint in this API — these are the real,
  // most-recent rows from each entity type, merged below into one timeline.
  const { data: appointmentsData, isLoading: appointmentsLoading } = useAppointmentsQuery({ pageSize: 10 });
  const { data: propertiesData, isLoading: propertiesLoading } = usePropertiesQuery({ pageSize: 10 });
  const { data: deedsData, isLoading: deedsLoading } = useDeedsQuery({ pageSize: 10 });

  // ── Mutations ───────────────────────────────────────────────────────────
  const createUserMutation = useCreateUserMutation();
  const updateUserMutation = useUpdateUserMutation();
  const deleteUserMutation = useDeleteUserMutation();

  // ── Local UI state ─────────────────────────────────────────────────────
  const [localActivityLogs, setLocalActivityLogs] = useState<ActivityLog[]>([]);
  const [searchText, setSearchText] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  // userId -> plaintext password, populated only when a user is created in
  // this session (see addUser below). Never persisted, never re-fetched.
  const [createdPasswords, setCreatedPasswords] = useState<Record<string, string>>({});

  const loading =
    statsLoading || usersLoading || prospectsLoading || customersLoading ||
    appointmentsLoading || propertiesLoading || deedsLoading ||
    createUserMutation.isPending || updateUserMutation.isPending || deleteUserMutation.isPending;

  // ── Map live users list to local User shape ────────────────────────────
  // useUsersQuery now always resolves to a flat { items, total, page, pageSize }
  // shape (see src/api/users.ts), so no format-sniffing is needed here.
  const users: User[] = (apiUsers?.items ?? []).map((u) => mapApiUserToLocalUser(u, createdPasswords));

  // ── Extract prospects and customers counts from API ────────────────────
  // useProspectsQuery/useCustomersQuery also resolve to flat { items, total, ... }
  // shapes now, so these no longer need defensive fallback-chasing.
  const totalProspects = apiStats?.totalProspects ?? prospectsData?.total ?? 0;
  const totalCustomers = apiStats?.totalCustomers ?? customersData?.total ?? 0;

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

  // Live activity assembled from real recent rows (prospects, customers,
  // appointments, properties, deeds), merged with this session's own
  // user-management actions (also real, just observed client-side since
  // they happened through this hook), sorted newest-first.
  const activityLogs: ActivityLog[] = useMemo(() => {
    const live = buildLiveActivityLog({
      prospects: prospectsData?.items ?? [],
      customers: customersData?.items ?? [],
      appointments: appointmentsData?.items ?? [],
      properties: propertiesData?.items ?? [],
      deeds: deedsData?.items ?? [],
    });
    return [...localActivityLogs, ...live]
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
      .slice(0, 30);
  }, [prospectsData, customersData, appointmentsData, propertiesData, deedsData, localActivityLogs]);

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

    const role = (roleMap[userData.role] || 'marketing_staff') as Role;

    // NOTE: `department` and `isActive` are intentionally NOT sent — POST /users
    // only accepts { firstName, lastName, email, phoneNumber?, password, role }.
    // The backend has no department concept, and isActive defaults server-side.
    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: userData.email.trim(),
      phoneNumber: phone.trim(),
      password: password,
      role,
    };

    createUserMutation.mutate(payload, {
      onSuccess: (response) => {
        console.log('✅ Registration successful:', response);
        if (response?.id) {
          setCreatedPasswords(prev => ({ ...prev, [response.id]: password }));
        }
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
    // NOTE: `department` is intentionally NOT sent — PATCH /users/{id} doesn't
    // accept it; the backend has no department concept. It's kept on the
    // local `User` display type only.

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
      ...users.map(u => [u.name, u.email, u.phone ?? '', u.role, u.status, u.department ?? '']),
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
    queryClient.invalidateQueries({ queryKey: ['prospects'] });
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
    queryClient.invalidateQueries({ queryKey: ['properties'] });
    queryClient.invalidateQueries({ queryKey: ['deeds'] });
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