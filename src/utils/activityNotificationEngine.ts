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
  return [];
};

const getInitialSeedActivities = (): ActivityFeedItem[] => {
  return [];
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
