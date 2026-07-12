// src/pages/dashboard/admin/types.ts
export interface User {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'suspended';
  joined: string;
  lastActive: string;
  avatar?: string;
  phone?: string;
  department?: string;
  // Only ever populated for users created earlier in this browser session —
  // the backend never returns passwords (they're hashed server-side), so
  // this can't be recovered after a refresh or for users created elsewhere.
  createdPassword?: string;
}

export interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalProspects: number;
  totalCustomers: number;
  totalPaymentPlans: number;
  activePaymentPlans: number;
  totalDeeds: number;
  totalNotifications: number;
  pendingNotifications: number;
  monthlyRevenue: number;
  growthRate: number;
  conversionRate: number;
}

export interface ActivityLog {
  id: string;
  user: string;
  action: string;
  details: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface SystemSettings {
  maintenanceMode: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  autoBackup: boolean;
  defaultCurrency: string;
  timezone: string;
  dateFormat: string;
}