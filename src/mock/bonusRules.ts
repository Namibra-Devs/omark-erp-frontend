// src/mock/bonusRules.ts
//
// Rule-Based Staff Bonus & Incentive Engine
// Supports defined bonus types: Sales Bonus, Project Completion, Attendance, Punctuality, Productivity
import { useEffect, useState } from 'react';
import type { Role } from '@/types';
import { getUserBranchId } from '@/utils/branchIsolation';
import { recordSystemEvent } from '@/utils/activityNotificationEngine';

const RULES_STORAGE_KEY = 'omark_mock_bonus_rules';
const BONUSES_STORAGE_KEY = 'omark_mock_staff_bonuses';

export type BonusType =
  | 'sales_bonus'
  | 'project_completion_bonus'
  | 'attendance_bonus'
  | 'punctuality_bonus'
  | 'productivity_bonus'
  | 'custom';

export type BonusEventType =
  | 'prospect_added'
  | 'meeting_completed'
  | 'prospect_purchased'
  | 'project_completed'
  | 'monthly_attendance'
  | 'punctuality_record'
  | 'target_achieved'
  | 'custom';

export interface BonusRule {
  id: string;
  bonusType: BonusType;
  eventType: BonusEventType;
  name: string;
  amountGHS: number;
  amountMinor: number;
  applicableRoles: Role[];
  isActive: boolean;
  description: string;
  criteria?: string;
  updatedAt: string;
}

export interface StaffBonusRecord {
  id: string;
  userId: string;
  staffName: string;
  role: Role | string;
  branchId?: string;
  bonusType: BonusType;
  amountGHS: number;
  amountMinor: number;
  ruleId: string;
  ruleName: string;
  reason: string;
  referenceEntityId?: string;
  status: 'pending' | 'approved' | 'paid';
  earnedAt: string;
}

export const bonusTypeLabels: Record<BonusType, { label: string; color: string; icon: string; desc: string }> = {
  sales_bonus: {
    label: 'Sales Bonus',
    color: 'green',
    icon: '💰',
    desc: 'Awarded for closing property sales, land allocations, and prospect conversions',
  },
  project_completion_bonus: {
    label: 'Project Completion Bonus',
    color: 'blue',
    icon: '🏗️',
    desc: 'Awarded upon reaching development, site grading, or deed completion milestones',
  },
  attendance_bonus: {
    label: 'Attendance Bonus',
    color: 'purple',
    icon: '📅',
    desc: 'Awarded for full scheduled monthly attendance without unexcused absences',
  },
  punctuality_bonus: {
    label: 'Punctuality Bonus',
    color: 'cyan',
    icon: '⏰',
    desc: 'Awarded for zero late check-ins during the work cycle',
  },
  productivity_bonus: {
    label: 'Productivity Bonus',
    color: 'gold',
    icon: '🚀',
    desc: 'Awarded for surpassing prospect acquisition, client booking, or collection targets',
  },
  custom: {
    label: 'Special Incentive',
    color: 'default',
    icon: '⭐',
    desc: 'Discretionary performance reward approved by Director/Admin',
  },
};

export const DEFAULT_BONUS_RULES: BonusRule[] = [
  {
    id: 'rule-sales-bonus',
    bonusType: 'sales_bonus',
    eventType: 'prospect_purchased',
    name: 'Plot Sale Conversion Bonus',
    amountGHS: 500,
    amountMinor: 50000,
    applicableRoles: ['marketing_staff', 'marketing_director', 'customer_service', 'branch_manager'],
    isActive: true,
    description: 'Awarded to marketing agent and handler when a prospect completes initial deposit for a plot.',
    criteria: 'Successful deposit receipt on approved property.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rule-productivity-bonus',
    bonusType: 'productivity_bonus',
    eventType: 'prospect_added',
    name: 'High-Volume Prospect Incentive',
    amountGHS: 150,
    amountMinor: 15000,
    applicableRoles: ['marketing_staff', 'marketing_director', 'customer_service'],
    isActive: true,
    description: 'Awarded when verified new prospective clients are registered and engaged.',
    criteria: 'Register 5+ verified prospective clients.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rule-project-completion',
    bonusType: 'project_completion_bonus',
    eventType: 'project_completed',
    name: 'Deed & Documentation Milestone',
    amountGHS: 350,
    amountMinor: 35000,
    applicableRoles: ['secretary', 'admin', 'branch_manager'],
    isActive: true,
    description: 'Awarded for expedited processing and delivery of completed Deed of Assignment packets.',
    criteria: 'Client deed packet fully vetted and signed.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rule-attendance-bonus',
    bonusType: 'attendance_bonus',
    eventType: 'monthly_attendance',
    name: 'Perfect Monthly Attendance Bonus',
    amountGHS: 200,
    amountMinor: 20000,
    applicableRoles: ['secretary', 'customer_service', 'accounts', 'marketing_staff', 'branch_manager'],
    isActive: true,
    description: 'Awarded to staff with 100% scheduled presence throughout the calendar month.',
    criteria: 'Zero unapproved absences in month.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rule-punctuality-bonus',
    bonusType: 'punctuality_bonus',
    eventType: 'punctuality_record',
    name: 'Punctuality & Early Bird Bonus',
    amountGHS: 100,
    amountMinor: 10000,
    applicableRoles: ['secretary', 'customer_service', 'accounts', 'marketing_staff'],
    isActive: true,
    description: 'Awarded for consistent on-time check-ins and desk readiness.',
    criteria: 'Zero late check-ins recorded for the month.',
    updatedAt: new Date().toISOString(),
  },
];

export const getBonusRules = (): BonusRule[] => {
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  saveBonusRules(DEFAULT_BONUS_RULES);
  return DEFAULT_BONUS_RULES;
};

export const saveBonusRules = (rules: BonusRule[]) => {
  localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
  window.dispatchEvent(new Event('omark-bonus-rules-changed'));
};

export const addBonusRule = (rule: Omit<BonusRule, 'id' | 'amountMinor' | 'updatedAt'>): BonusRule => {
  const rules = getBonusRules();
  const newRule: BonusRule = {
    id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    ...rule,
    amountMinor: Math.round(rule.amountGHS * 100),
    updatedAt: new Date().toISOString(),
  };
  saveBonusRules([newRule, ...rules]);
  return newRule;
};

export const updateBonusRule = (id: string, updates: Partial<BonusRule>): BonusRule => {
  const rules = getBonusRules();
  const index = rules.findIndex((r) => r.id === id);
  if (index === -1) {
    throw new Error('Bonus rule not found');
  }
  const updated = {
    ...rules[index],
    ...updates,
    amountMinor: updates.amountGHS !== undefined ? Math.round(updates.amountGHS * 100) : rules[index].amountMinor,
    updatedAt: new Date().toISOString(),
  };
  rules[index] = updated;
  saveBonusRules(rules);
  return updated;
};

export const deleteBonusRule = (id: string) => {
  const rules = getBonusRules();
  saveBonusRules(rules.filter((r) => r.id !== id));
};

export const getStaffBonuses = (userId?: string): StaffBonusRecord[] => {
  try {
    const raw = localStorage.getItem(BONUSES_STORAGE_KEY);
    if (raw) {
      const records: StaffBonusRecord[] = JSON.parse(raw);
      if (userId) {
        return records.filter((b) => b.userId === userId);
      }
      return records;
    }
  } catch {
    // fallback
  }
  return [];
};

export const saveStaffBonuses = (bonuses: StaffBonusRecord[]) => {
  localStorage.setItem(BONUSES_STORAGE_KEY, JSON.stringify(bonuses));
  window.dispatchEvent(new Event('omark-bonuses-changed'));
};

/**
 * Automatically triggers and records a rule-based bonus when staff completes a qualifying action.
 */
export const awardBonusForEvent = (
  eventType: BonusEventType,
  user: any,
  meta?: { prospectName?: string; prospectId?: string; notes?: string; customAmountGHS?: number; bonusType?: BonusType }
): StaffBonusRecord | null => {
  if (!user?.id) return null;

  const rules = getBonusRules();
  let rule = rules.find((r) => r.eventType === eventType && r.isActive);

  if (!rule && eventType === 'custom') {
    rule = {
      id: 'custom-reward',
      bonusType: meta?.bonusType || 'custom',
      eventType: 'custom',
      name: meta?.notes || 'Direct Performance Reward',
      amountGHS: meta?.customAmountGHS || 200,
      amountMinor: (meta?.customAmountGHS || 200) * 100,
      applicableRoles: ['admin', 'marketing_staff', 'marketing_director', 'customer_service', 'secretary', 'accounts', 'branch_manager'],
      isActive: true,
      description: meta?.notes || 'Special performance incentive awarded by management.',
      updatedAt: new Date().toISOString(),
    };
  }

  if (!rule) return null;

  const userRole = (user.role || 'marketing_staff') as Role;
  if (!rule.applicableRoles.includes(userRole) && userRole !== 'admin') {
    return null;
  }

  const staffName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Staff';
  const branchId = getUserBranchId(user);
  const now = new Date().toISOString();

  const finalAmountGHS = meta?.customAmountGHS !== undefined ? meta.customAmountGHS : rule.amountGHS;

  const newBonus: StaffBonusRecord = {
    id: `bonus-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    userId: user.id,
    staffName,
    role: userRole,
    branchId,
    bonusType: rule.bonusType,
    amountGHS: finalAmountGHS,
    amountMinor: Math.round(finalAmountGHS * 100),
    ruleId: rule.id,
    ruleName: rule.name,
    reason: meta?.prospectName
      ? `${rule.name}: Added ${meta.prospectName}`
      : (meta?.notes || rule.name),
    referenceEntityId: meta?.prospectId,
    status: 'approved',
    earnedAt: now,
  };

  const existing = getStaffBonuses();
  saveStaffBonuses([newBonus, ...existing]);

  try {
    recordSystemEvent({
      title: 'Performance Bonus Awarded',
      details: `GH₵ ${finalAmountGHS.toLocaleString(undefined, { minimumFractionDigits: 2 })} awarded to ${staffName} (${newBonus.reason})`,
      category: 'payroll',
      type: 'success',
      actorName: 'Management Desk',
      actorRole: 'admin',
      actorId: user.id,
      link: '/branches/payroll',
      refId: newBonus.id,
    });
  } catch (err) {
    console.error('Failed to broadcast bonus event:', err);
  }

  return newBonus;
};

export const useBonusRules = () => {
  const [rules, setRules] = useState<BonusRule[]>(() => getBonusRules());

  useEffect(() => {
    const refresh = () => setRules(getBonusRules());
    window.addEventListener('omark-bonus-rules-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('omark-bonus-rules-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return {
    rules,
    addRule: addBonusRule,
    updateRule: updateBonusRule,
    deleteRule: deleteBonusRule,
    saveRules: saveBonusRules,
  };
};

export const deleteStaffBonus = (id: string) => {
  const bonuses = getStaffBonuses();
  saveStaffBonuses(bonuses.filter((b) => b.id !== id));
};

export const clearStaffBonuses = (userId?: string) => {
  const bonuses = getStaffBonuses();
  if (userId) {
    saveStaffBonuses(bonuses.filter((b) => b.userId !== userId));
  } else {
    saveStaffBonuses([]);
  }
};

export const useStaffBonuses = (userId?: string) => {
  const [bonuses, setBonuses] = useState<StaffBonusRecord[]>(() => getStaffBonuses(userId));

  useEffect(() => {
    const refresh = () => setBonuses(getStaffBonuses(userId));
    window.addEventListener('omark-bonuses-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('omark-bonuses-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [userId]);

  const totalBonusGHS = bonuses.reduce((sum, b) => sum + (b.amountGHS || 0), 0);
  const totalBonusMinor = bonuses.reduce((sum, b) => sum + (b.amountMinor || 0), 0);

  return {
    bonuses,
    totalBonusGHS,
    totalBonusMinor,
    deleteBonus: deleteStaffBonus,
    clearBonuses: () => clearStaffBonuses(userId),
  };
};
