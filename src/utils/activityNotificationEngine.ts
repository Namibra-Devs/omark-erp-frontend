// src/utils/activityNotificationEngine.ts
import dayjs from 'dayjs';

export type ActivityCategory =
  | 'attendance'
  | 'payroll'
  | 'payment'
  | 'prospect'
  | 'appointment'
  | 'deed'
  | 'security'
  | 'system';

export type ActivityType = 'success' | 'info' | 'warning' | 'error';

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  category: ActivityCategory;
  type: ActivityType;
  timestamp: string; // ISO string or formatted
  read: boolean;
  actor?: {
    id?: string;
    name: string;
    role?: string;
  };
  targetUserId?: string; // If provided, strictly delivered only to this user (and admin)
  targetRole?: string | string[]; // If provided, delivered to users with this role
  targetBranchId?: string; // If provided, delivered to users assigned to this branch
  isBroadcast?: boolean;
  branchName?: string;
  link?: string;
  meta?: Record<string, any>;
}

export interface ActivityFeedItem {
  id: string;
  user: string;
  action: string;
  details: string;
  timestamp: string;
  type: ActivityType;
  category: ActivityCategory;
  branchName?: string;
  refId?: string;
  link?: string;
}

const STORAGE_NOTIFICATIONS_KEY = 'omark_system_notifications_store';
const STORAGE_ACTIVITY_KEY = 'omark_system_activity_store';

// ── Initial Seed Data ────────────────────────────────────────────────────────
const getInitialSeedNotifications = (): SystemNotification[] => {
  const today = dayjs().format('YYYY-MM-DD');
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');

  return [
    {
      id: 'notif-att-1',
      title: 'Daily Attendance Register Closed',
      message: `Daily attendance register for ${today} was successfully finalized and locked by Admin.`,
      category: 'attendance',
      type: 'info',
      timestamp: `${today} 18:30:00`,
      read: false,
      actor: { name: 'System Automations', role: 'admin' },
      branchName: 'All Branches',
      link: '/attendance',
    },
    {
      id: 'notif-att-2',
      title: 'Punctuality Bonus Qualified',
      message: 'Kwame Mensah attained 95.5% monthly punctuality rate and qualified for GH₵ 150 incentive.',
      category: 'attendance',
      type: 'success',
      timestamp: `${today} 16:45:00`,
      read: false,
      actor: { name: 'Analytics Sentinel', role: 'system' },
      branchName: 'Accra Head Office',
      link: '/attendance',
    },
    {
      id: 'notif-leave-1',
      title: 'Annual Leave Approved',
      message: 'Annual leave request for Abena Osei (Sep 10 – Sep 15, 2026) was approved by HR.',
      category: 'attendance',
      type: 'success',
      timestamp: `${today} 14:20:00`,
      read: false,
      actor: { name: 'Sarah Director', role: 'marketing_director' },
      branchName: 'Kumasi Branch',
      link: '/attendance',
    },
    {
      id: 'notif-pay-1',
      title: 'Monthly Payroll Approved & Disbursed',
      message: 'Monthly payroll batch for Takoradi Branch was approved and bank disbursement receipts issued.',
      category: 'payroll',
      type: 'success',
      timestamp: `${today} 11:30:00`,
      read: true,
      actor: { name: 'Chief Financial Officer', role: 'accounts' },
      branchName: 'Takoradi Branch',
      link: '/branches/payroll',
    },
    {
      id: 'notif-sec-1',
      title: 'Anti-Fraud Sentinel: Geofence Verification',
      message: 'Morning check-in for Kofi Antwi passed precision 45m GPS geofencing & biometric validation.',
      category: 'security',
      type: 'info',
      timestamp: `${today} 08:14:00`,
      read: true,
      actor: { name: 'Kofi Antwi', role: 'staff' },
      branchName: 'Accra Head Office',
      link: '/attendance',
    },
    {
      id: 'notif-pay-2',
      title: 'Payment Received & Official Receipt Issued',
      message: 'Installment payment of GH₵ 12,500.00 received from Dr. Samuel Mensah for Plot 44B East Legon.',
      category: 'payment',
      type: 'success',
      timestamp: `${yesterday} 15:10:00`,
      read: true,
      actor: { name: 'Accounts Department', role: 'accounts' },
      branchName: 'Accra Head Office',
      link: '/payments',
    },
    {
      id: 'notif-deed-1',
      title: 'Deed Document Generated',
      message: 'Official Title Deed #OMK-2026-8812 was generated and queued for executive sign-off.',
      category: 'deed',
      type: 'info',
      timestamp: `${yesterday} 10:45:00`,
      read: true,
      actor: { name: 'Legal Registry', role: 'secretary' },
      branchName: 'Accra Head Office',
      link: '/deeds',
    },
  ];
};

const getInitialSeedActivities = (): ActivityFeedItem[] => {
  const today = dayjs().format('YYYY-MM-DD');
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');

  return [
    {
      id: 'act-att-close',
      user: 'System Daemon',
      action: 'Shift Register Closed',
      details: `Daily attendance register auto-finalized for ${today} across all 5 branches`,
      timestamp: `${today} 18:30:00`,
      type: 'info',
      category: 'attendance',
      branchName: 'All Branches',
      link: '/attendance',
    },
    {
      id: 'act-att-bonus',
      user: 'Analytics Sentinel',
      action: 'Punctuality Bonus Qualified',
      details: 'Kwame Mensah qualified for GH₵ 150 Monthly On-Time Attendance Bonus',
      timestamp: `${today} 16:45:00`,
      type: 'success',
      category: 'payroll',
      branchName: 'Accra Head Office',
      link: '/attendance',
    },
    {
      id: 'act-leave-app',
      user: 'HR Management',
      action: 'Leave Request Approved',
      details: 'Approved 5 days Annual Leave for Abena Osei (Kumasi Branch)',
      timestamp: `${today} 14:20:00`,
      type: 'success',
      category: 'attendance',
      branchName: 'Kumasi Branch',
      link: '/attendance',
    },
    {
      id: 'act-pay-disb',
      user: 'Finance Desk',
      action: 'Payroll Disbursed',
      details: 'Processed and issued bank remittance receipts for Takoradi Branch workforce',
      timestamp: `${today} 11:30:00`,
      type: 'success',
      category: 'payroll',
      branchName: 'Takoradi Branch',
      link: '/branches/payroll',
    },
    {
      id: 'act-att-punch',
      user: 'Kofi Antwi',
      action: 'Staff Verified Clock-In',
      details: 'Clocked in at Accra Head Office (08:14 AM · 45m GPS Precision · On Time)',
      timestamp: `${today} 08:14:00`,
      type: 'success',
      category: 'attendance',
      branchName: 'Accra Head Office',
      link: '/attendance',
    },
    {
      id: 'act-pay-rcpt',
      user: 'Accounts Department',
      action: 'Payment Receipt Issued',
      details: 'GH₵ 12,500.00 installment recorded for Dr. Samuel Mensah (Receipt #RCP-9921)',
      timestamp: `${yesterday} 15:10:00`,
      type: 'success',
      category: 'payment',
      branchName: 'Accra Head Office',
      link: '/payments',
    },
    {
      id: 'act-deed-gen',
      user: 'Legal Registry',
      action: 'Deed Document Generated',
      details: 'Indenture and Title Deed #OMK-2026-8812 compiled for Plot 44B East Legon',
      timestamp: `${yesterday} 10:45:00`,
      type: 'info',
      category: 'deed',
      branchName: 'Accra Head Office',
      link: '/deeds',
    },
  ];
};

// ── Storage Accessors ────────────────────────────────────────────────────────

export function getStoredNotifications(
  currentUserId?: string,
  currentUserRole?: string,
  currentUserBranchId?: string
): SystemNotification[] {
  let list: SystemNotification[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_NOTIFICATIONS_KEY);
    if (!raw) {
      list = getInitialSeedNotifications();
      localStorage.setItem(STORAGE_NOTIFICATIONS_KEY, JSON.stringify(list));
    } else {
      list = JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to load notifications from storage:', err);
    list = getInitialSeedNotifications();
  }

  // If no user context provided or user is admin, return full list
  if (!currentUserId && !currentUserRole) return list;
  if (currentUserRole === 'admin') return list;

  // Filter for non-admin: only show what is targeted to them or broadcast
  return list.filter((n) => {
    // 1. Specifically targeted to this user
    if (n.targetUserId && n.targetUserId === currentUserId) return true;
    // 2. Authored/Acted by this user
    if (n.actor?.id && n.actor.id === currentUserId) return true;
    // 3. If specifically targeted to another user, DO NOT SHOW IT
    if (n.targetUserId && n.targetUserId !== currentUserId) return false;

    // 4. Role target check
    if (n.targetRole) {
      const roles = Array.isArray(n.targetRole) ? n.targetRole : [n.targetRole];
      if (currentUserRole && roles.includes(currentUserRole)) {
        if (!n.targetBranchId || n.targetBranchId === currentUserBranchId) return true;
      }
      return false;
    }

    // 5. Branch target check
    if (n.targetBranchId && currentUserBranchId) {
      return n.targetBranchId === currentUserBranchId;
    }

    // 6. Global broadcast (no specific target)
    return !n.targetUserId && !n.targetRole && !n.targetBranchId;
  });
}

export function saveStoredNotifications(notifications: SystemNotification[]): void {
  try {
    localStorage.setItem(STORAGE_NOTIFICATIONS_KEY, JSON.stringify(notifications));
    window.dispatchEvent(
      new CustomEvent('omark-notifications-changed', {
        detail: { count: notifications.filter((n) => !n.read).length },
      })
    );
  } catch (err) {
    console.error('Failed to persist notifications:', err);
  }
}

export function getStoredActivities(): ActivityFeedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_ACTIVITY_KEY);
    if (!raw) {
      const initial = getInitialSeedActivities();
      localStorage.setItem(STORAGE_ACTIVITY_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load activities from storage:', err);
    return getInitialSeedActivities();
  }
}

export function saveStoredActivities(activities: ActivityFeedItem[]): void {
  try {
    localStorage.setItem(STORAGE_ACTIVITY_KEY, JSON.stringify(activities));
    window.dispatchEvent(new CustomEvent('omark-activity-changed'));
  } catch (err) {
    console.error('Failed to persist activities:', err);
  }
}

// ── Public Dispatch API ──────────────────────────────────────────────────────

/**
 * Dispatches a real-time event that logs both to recent activity feeds and notification drawers.
 */
export function recordSystemEvent(event: {
  title: string;
  details: string;
  category: ActivityCategory;
  type?: ActivityType;
  actorName?: string;
  actorRole?: string;
  actorId?: string;
  targetUserId?: string;
  targetRole?: string | string[];
  targetBranchId?: string;
  isBroadcast?: boolean;
  branchName?: string;
  link?: string;
  refId?: string;
  meta?: Record<string, any>;
}): void {
  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const type = event.type || 'info';
  const id = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // 1. Prepend to Notifications
  const notifications = getStoredNotifications();
  const newNotif: SystemNotification = {
    id: `notif-${id}`,
    title: event.title,
    message: event.details,
    category: event.category,
    type,
    timestamp,
    read: false,
    actor: event.actorName ? { id: event.actorId, name: event.actorName, role: event.actorRole } : undefined,
    targetUserId: event.targetUserId,
    targetRole: event.targetRole,
    targetBranchId: event.targetBranchId,
    isBroadcast: event.isBroadcast,
    branchName: event.branchName,
    link: event.link,
    meta: event.meta,
  };
  notifications.unshift(newNotif);
  // Cap to latest 100 notifications
  saveStoredNotifications(notifications.slice(0, 100));

  // 2. Prepend to Activity Feed
  const activities = getStoredActivities();
  const newAct: ActivityFeedItem = {
    id: `act-${id}`,
    user: event.actorName || 'System',
    action: event.title,
    details: event.details,
    timestamp,
    type,
    category: event.category,
    branchName: event.branchName,
    refId: event.refId,
    link: event.link,
  };
  activities.unshift(newAct);
  // Cap to latest 150 activities
  saveStoredActivities(activities.slice(0, 150));
}

/**
 * Marks a notification as read.
 */
export function markNotificationAsRead(id: string): void {
  const list = getStoredNotifications();
  const updated = list.map((n) => (n.id === id ? { ...n, read: true } : n));
  saveStoredNotifications(updated);
}

/**
 * Marks all notifications as read.
 */
export function markAllNotificationsAsRead(): void {
  const list = getStoredNotifications();
  const updated = list.map((n) => ({ ...n, read: true }));
  saveStoredNotifications(updated);
}

/**
 * Clears all notifications.
 */
export function clearAllNotifications(): void {
  saveStoredNotifications([]);
}

/**
 * Retrieves unread notification count.
 */
export function getUnreadNotificationCount(
  currentUserId?: string,
  currentUserRole?: string,
  currentUserBranchId?: string
): number {
  return getStoredNotifications(currentUserId, currentUserRole, currentUserBranchId).filter((n) => !n.read).length;
}
