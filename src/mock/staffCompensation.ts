// src/mock/staffCompensation.ts
//
// Staff Compensation Profile Management System
// Defines compensation structure for staff: salary types (fixed, commission, mixed, incentive-only),
// pay frequency, allowances, deductions, payment methods, and bonus/commission rules.
import { useState, useEffect } from 'react';
import type { Role } from '@/types';

const STORAGE_KEY = 'omark_staff_compensation_profiles';

export type SalaryType = 'fixed' | 'commission' | 'mixed' | 'incentive_only';
export type PayFrequency = 'monthly' | 'bi_weekly' | 'weekly';
export type PaymentMethod = 'bank_transfer' | 'momo' | 'cheque' | 'cash';

export interface AllowanceConfig {
  transportGHS: number;
  housingGHS: number;
  mealGHS: number;
  otherGHS: number;
  otherLabel?: string;
}

export interface DeductionConfig {
  taxSSNITGHS: number;
  loanRepaymentGHS: number;
  advanceDeductionGHS: number;
  latenessDeductionGHS: number;
  absenceDeductionGHS: number;
  otherDeductionsGHS: number;
  otherLabel?: string;
}

export interface PaymentDetails {
  method: PaymentMethod;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  branchName?: string;
  momoProvider?: 'MTN' | 'Telecel' | 'AT';
  momoNumber?: string;
}

export interface StaffCompensationProfile {
  userId: string;
  staffName: string;
  role: Role | string;
  branchId?: string;
  salaryType: SalaryType;
  baseSalaryGHS: number;
  payFrequency: PayFrequency;
  allowances: AllowanceConfig;
  deductions: DeductionConfig;
  commissionPercentage: number; // e.g. 2.5% per closed deal
  commissionFlatGHS: number; // flat commission per deal
  eligibleBonusRuleIds: string[];
  paymentDetails: PaymentDetails;
  notes?: string;
  updatedAt: string;
}

export const salaryTypeLabels: Record<SalaryType, { label: string; color: string; desc: string }> = {
  fixed: { label: 'Fixed Salary', color: 'blue', desc: 'Standard monthly fixed salary for admin, HR, and operations' },
  commission: { label: 'Commission-based', color: 'purple', desc: 'Performance and sales commission for active agents' },
  mixed: { label: 'Mixed (Base + Commission + Bonus)', color: 'green', desc: 'Base baseline pay plus sales commissions and incentive bonuses' },
  incentive_only: { label: 'Incentive-Only', color: 'orange', desc: 'Project milestone and task-based rewards only' },
};

export const payFrequencyLabels: Record<PayFrequency, string> = {
  monthly: 'Monthly',
  bi_weekly: 'Bi-Weekly',
  weekly: 'Weekly',
};

export const paymentMethodLabels: Record<PaymentMethod, { label: string; icon: string }> = {
  bank_transfer: { label: 'Bank Transfer', icon: '🏦' },
  momo: { label: 'Mobile Money (MoMo)', icon: '📱' },
  cheque: { label: 'Cheque', icon: '📝' },
  cash: { label: 'Cash', icon: '💵' },
};

const DEFAULT_COMPENSATION_PROFILES: StaffCompensationProfile[] = [
  {
    userId: '1', // John Admin
    staffName: 'John Admin',
    role: 'admin',
    branchId: 'b2',
    salaryType: 'fixed',
    baseSalaryGHS: 7500,
    payFrequency: 'monthly',
    allowances: {
      transportGHS: 800,
      housingGHS: 1200,
      mealGHS: 500,
      otherGHS: 0,
    },
    deductions: {
      taxSSNITGHS: 950,
      loanRepaymentGHS: 0,
      advanceDeductionGHS: 0,
      latenessDeductionGHS: 0,
      absenceDeductionGHS: 0,
      otherDeductionsGHS: 0,
    },
    commissionPercentage: 0,
    commissionFlatGHS: 0,
    eligibleBonusRuleIds: ['rule-sales-bonus', 'rule-project-completion'],
    paymentDetails: {
      method: 'bank_transfer',
      bankName: 'GCB Bank',
      accountNumber: '1029384756',
      accountName: 'John Admin',
      branchName: 'High Street Branch',
    },
    updatedAt: new Date().toISOString(),
  },
  {
    userId: '2', // Sarah Marketing
    staffName: 'Sarah Marketing',
    role: 'marketing_staff',
    branchId: 'b2',
    salaryType: 'mixed',
    baseSalaryGHS: 3500,
    payFrequency: 'monthly',
    allowances: {
      transportGHS: 600,
      housingGHS: 0,
      mealGHS: 400,
      otherGHS: 0,
    },
    deductions: {
      taxSSNITGHS: 420,
      loanRepaymentGHS: 250,
      advanceDeductionGHS: 0,
      latenessDeductionGHS: 0,
      absenceDeductionGHS: 0,
      otherDeductionsGHS: 0,
    },
    commissionPercentage: 3.0,
    commissionFlatGHS: 500,
    eligibleBonusRuleIds: ['rule-sales-bonus', 'rule-productivity-bonus', 'rule-attendance-bonus', 'rule-punctuality-bonus'],
    paymentDetails: {
      method: 'momo',
      momoProvider: 'MTN',
      momoNumber: '0244567890',
      accountName: 'Sarah Mensah',
    },
    updatedAt: new Date().toISOString(),
  },
  {
    userId: '3', // Michael Director
    staffName: 'Michael Director',
    role: 'marketing_director',
    branchId: 'b2',
    salaryType: 'mixed',
    baseSalaryGHS: 6000,
    payFrequency: 'monthly',
    allowances: {
      transportGHS: 1000,
      housingGHS: 800,
      mealGHS: 600,
      otherGHS: 0,
    },
    deductions: {
      taxSSNITGHS: 780,
      loanRepaymentGHS: 0,
      advanceDeductionGHS: 0,
      latenessDeductionGHS: 0,
      absenceDeductionGHS: 0,
      otherDeductionsGHS: 0,
    },
    commissionPercentage: 4.5,
    commissionFlatGHS: 1000,
    eligibleBonusRuleIds: ['rule-sales-bonus', 'rule-productivity-bonus', 'rule-project-completion'],
    paymentDetails: {
      method: 'bank_transfer',
      bankName: 'Ecobank Ghana',
      accountNumber: '1441002345678',
      accountName: 'Michael Director',
      branchName: 'Silver Star Tower Branch',
    },
    updatedAt: new Date().toISOString(),
  },
  {
    userId: '4', // Emma Service
    staffName: 'Emma Service',
    role: 'customer_service',
    branchId: 'b2',
    salaryType: 'fixed',
    baseSalaryGHS: 3200,
    payFrequency: 'monthly',
    allowances: {
      transportGHS: 500,
      housingGHS: 0,
      mealGHS: 350,
      otherGHS: 0,
    },
    deductions: {
      taxSSNITGHS: 380,
      loanRepaymentGHS: 0,
      advanceDeductionGHS: 0,
      latenessDeductionGHS: 0,
      absenceDeductionGHS: 0,
      otherDeductionsGHS: 0,
    },
    commissionPercentage: 0,
    commissionFlatGHS: 100,
    eligibleBonusRuleIds: ['rule-attendance-bonus', 'rule-punctuality-bonus', 'rule-sales-bonus'],
    paymentDetails: {
      method: 'momo',
      momoProvider: 'Telecel',
      momoNumber: '0201234570',
      accountName: 'Emma Service',
    },
    updatedAt: new Date().toISOString(),
  },
  {
    userId: '5', // David Secretary
    staffName: 'David Secretary',
    role: 'secretary',
    branchId: 'b2',
    salaryType: 'fixed',
    baseSalaryGHS: 3400,
    payFrequency: 'monthly',
    allowances: {
      transportGHS: 550,
      housingGHS: 0,
      mealGHS: 350,
      otherGHS: 0,
    },
    deductions: {
      taxSSNITGHS: 390,
      loanRepaymentGHS: 0,
      advanceDeductionGHS: 0,
      latenessDeductionGHS: 0,
      absenceDeductionGHS: 0,
      otherDeductionsGHS: 0,
    },
    commissionPercentage: 0,
    commissionFlatGHS: 0,
    eligibleBonusRuleIds: ['rule-attendance-bonus', 'rule-punctuality-bonus', 'rule-productivity-bonus'],
    paymentDetails: {
      method: 'bank_transfer',
      bankName: 'Fidelity Bank',
      accountNumber: '2093847291',
      accountName: 'David Secretary',
      branchName: 'Ridge Branch',
    },
    updatedAt: new Date().toISOString(),
  },
  {
    userId: '6', // Lisa Accounts
    staffName: 'Lisa Accounts',
    role: 'accounts',
    branchId: 'b2',
    salaryType: 'fixed',
    baseSalaryGHS: 4800,
    payFrequency: 'monthly',
    allowances: {
      transportGHS: 700,
      housingGHS: 400,
      mealGHS: 450,
      otherGHS: 0,
    },
    deductions: {
      taxSSNITGHS: 580,
      loanRepaymentGHS: 0,
      advanceDeductionGHS: 0,
      latenessDeductionGHS: 0,
      absenceDeductionGHS: 0,
      otherDeductionsGHS: 0,
    },
    commissionPercentage: 0,
    commissionFlatGHS: 0,
    eligibleBonusRuleIds: ['rule-attendance-bonus', 'rule-punctuality-bonus', 'rule-productivity-bonus'],
    paymentDetails: {
      method: 'bank_transfer',
      bankName: 'Stanbic Bank',
      accountNumber: '904000382910',
      accountName: 'Lisa Accounts',
      branchName: 'Airport City Branch',
    },
    updatedAt: new Date().toISOString(),
  },
  {
    userId: '7', // Kindo Original
    staffName: 'Kindo Original',
    role: 'branch_manager',
    branchId: 'branch-accra-hq',
    salaryType: 'fixed',
    baseSalaryGHS: 12000,
    payFrequency: 'monthly',
    allowances: {
      transportGHS: 1500,
      housingGHS: 1500,
      mealGHS: 800,
      otherGHS: 0,
    },
    deductions: {
      taxSSNITGHS: 1800,
      loanRepaymentGHS: 0,
      advanceDeductionGHS: 0,
      latenessDeductionGHS: 0,
      absenceDeductionGHS: 0,
      otherDeductionsGHS: 0,
    },
    commissionPercentage: 1.5,
    commissionFlatGHS: 500,
    eligibleBonusRuleIds: ['rule-sales-bonus', 'rule-project-completion', 'rule-productivity-bonus'],
    paymentDetails: {
      method: 'bank_transfer',
      bankName: 'GCB Bank',
      accountNumber: '11002345678',
      accountName: 'Kindo Original',
      branchName: 'Osu Branch',
    },
    updatedAt: new Date().toISOString(),
  },
  {
    userId: '8', // Ama Boateng
    staffName: 'Ama Boateng',
    role: 'branch_manager',
    branchId: 'branch-kumasi',
    salaryType: 'fixed',
    baseSalaryGHS: 8500,
    payFrequency: 'monthly',
    allowances: {
      transportGHS: 1000,
      housingGHS: 800,
      mealGHS: 600,
      otherGHS: 0,
    },
    deductions: {
      taxSSNITGHS: 1200,
      loanRepaymentGHS: 0,
      advanceDeductionGHS: 0,
      latenessDeductionGHS: 0,
      absenceDeductionGHS: 0,
      otherDeductionsGHS: 0,
    },
    commissionPercentage: 1.0,
    commissionFlatGHS: 500,
    eligibleBonusRuleIds: ['rule-sales-bonus', 'rule-project-completion'],
    paymentDetails: {
      method: 'bank_transfer',
      bankName: 'Absa Bank',
      accountNumber: '03410029381',
      accountName: 'Ama Boateng',
      branchName: 'Kumasi Main',
    },
    updatedAt: new Date().toISOString(),
  },
  {
    userId: '9', // Kwesi Mensah
    staffName: 'Kwesi Mensah',
    role: 'branch_manager',
    branchId: 'branch-takoradi',
    salaryType: 'fixed',
    baseSalaryGHS: 7000,
    payFrequency: 'monthly',
    allowances: {
      transportGHS: 800,
      housingGHS: 600,
      mealGHS: 500,
      otherGHS: 0,
    },
    deductions: {
      taxSSNITGHS: 950,
      loanRepaymentGHS: 0,
      advanceDeductionGHS: 0,
      latenessDeductionGHS: 0,
      absenceDeductionGHS: 0,
      otherDeductionsGHS: 0,
    },
    commissionPercentage: 1.0,
    commissionFlatGHS: 500,
    eligibleBonusRuleIds: ['rule-sales-bonus', 'rule-project-completion'],
    paymentDetails: {
      method: 'bank_transfer',
      bankName: 'CalBank',
      accountNumber: '14002938471',
      accountName: 'Kwesi Mensah',
      branchName: 'Takoradi Harbor',
    },
    updatedAt: new Date().toISOString(),
  },
  {
    userId: '10', // Fatima Iddrisu
    staffName: 'Fatima Iddrisu',
    role: 'branch_manager',
    branchId: 'branch-tamale',
    salaryType: 'fixed',
    baseSalaryGHS: 6500,
    payFrequency: 'monthly',
    allowances: {
      transportGHS: 800,
      housingGHS: 500,
      mealGHS: 500,
      otherGHS: 0,
    },
    deductions: {
      taxSSNITGHS: 850,
      loanRepaymentGHS: 0,
      advanceDeductionGHS: 0,
      latenessDeductionGHS: 0,
      absenceDeductionGHS: 0,
      otherDeductionsGHS: 0,
    },
    commissionPercentage: 1.0,
    commissionFlatGHS: 500,
    eligibleBonusRuleIds: ['rule-sales-bonus', 'rule-project-completion'],
    paymentDetails: {
      method: 'momo',
      momoProvider: 'MTN',
      momoNumber: '0249876543',
      accountName: 'Fatima Iddrisu',
    },
    updatedAt: new Date().toISOString(),
  },
];

export const loadStaffCompensationProfiles = (): StaffCompensationProfile[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  saveStaffCompensationProfiles(DEFAULT_COMPENSATION_PROFILES);
  return DEFAULT_COMPENSATION_PROFILES;
};

export const saveStaffCompensationProfiles = (profiles: StaffCompensationProfile[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  window.dispatchEvent(new Event('omark-compensation-changed'));
};

export const getStaffCompensationProfile = (userId: string, defaultStaffName = 'Staff Member', defaultRole: Role = 'customer_service'): StaffCompensationProfile => {
  const profiles = loadStaffCompensationProfiles();
  const index = profiles.findIndex((p) => p.userId === userId);
  
  if (index !== -1) {
    const existing = profiles[index];
    if ((!existing.staffName || existing.staffName === 'Staff Member') && defaultStaffName && defaultStaffName !== 'Staff Member') {
      const updatedProfile = { ...existing, staffName: defaultStaffName };
      profiles[index] = updatedProfile;
      saveStaffCompensationProfiles(profiles);
      return updatedProfile;
    }
    return existing;
  }

  // Generate fallback default based on role
  const isMarketer = defaultRole === 'marketing_staff' || defaultRole === 'marketing_director';
  const defaultProfile: StaffCompensationProfile = {
    userId,
    staffName: defaultStaffName || 'Staff Member',
    role: defaultRole,
    salaryType: isMarketer ? 'mixed' : 'fixed',
    baseSalaryGHS: isMarketer ? 3500 : 3800,
    payFrequency: 'monthly',
    allowances: {
      transportGHS: 500,
      housingGHS: 0,
      mealGHS: 350,
      otherGHS: 0,
    },
    deductions: {
      taxSSNITGHS: 400,
      loanRepaymentGHS: 0,
      advanceDeductionGHS: 0,
      latenessDeductionGHS: 0,
      absenceDeductionGHS: 0,
      otherDeductionsGHS: 0,
    },
    commissionPercentage: isMarketer ? 2.5 : 0,
    commissionFlatGHS: 0,
    eligibleBonusRuleIds: ['rule-sales-bonus', 'rule-attendance-bonus', 'rule-punctuality-bonus'],
    paymentDetails: {
      method: 'bank_transfer',
      bankName: 'Standard Chartered',
      accountNumber: '0100123456789',
      accountName: defaultStaffName || 'Staff Member',
    },
    updatedAt: new Date().toISOString(),
  };

  const updated = [defaultProfile, ...profiles];
  saveStaffCompensationProfiles(updated);
  return defaultProfile;
};

export const updateStaffCompensationProfile = (userId: string, updates: Partial<StaffCompensationProfile>): StaffCompensationProfile => {
  const profiles = loadStaffCompensationProfiles();
  const index = profiles.findIndex((p) => p.userId === userId);
  
  if (index === -1) {
    const newProfile: StaffCompensationProfile = {
      userId,
      staffName: updates.staffName || 'Staff Member',
      role: updates.role || 'office_staff',
      salaryType: updates.salaryType || 'fixed',
      baseSalaryGHS: updates.baseSalaryGHS || 3500,
      payFrequency: updates.payFrequency || 'monthly',
      allowances: updates.allowances || { transportGHS: 0, housingGHS: 0, mealGHS: 0, otherGHS: 0 },
      deductions: updates.deductions || { taxSSNITGHS: 0, loanRepaymentGHS: 0, advanceDeductionGHS: 0, latenessDeductionGHS: 0, absenceDeductionGHS: 0, otherDeductionsGHS: 0 },
      commissionPercentage: updates.commissionPercentage || 0,
      commissionFlatGHS: updates.commissionFlatGHS || 0,
      eligibleBonusRuleIds: updates.eligibleBonusRuleIds || [],
      paymentDetails: updates.paymentDetails || { method: 'bank_transfer' },
      notes: updates.notes,
      updatedAt: new Date().toISOString(),
      ...updates,
    };
    saveStaffCompensationProfiles([newProfile, ...profiles]);
    return newProfile;
  }

  const updated: StaffCompensationProfile = {
    ...profiles[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  profiles[index] = updated;
  saveStaffCompensationProfiles(profiles);
  return updated;
};

export const deleteStaffCompensationProfile = (userId: string) => {
  const profiles = loadStaffCompensationProfiles();
  saveStaffCompensationProfiles(profiles.filter((p) => p.userId !== userId));
};

export const useStaffCompensation = (userId?: string) => {
  const [profiles, setProfiles] = useState<StaffCompensationProfile[]>(() => loadStaffCompensationProfiles());

  useEffect(() => {
    const refresh = () => setProfiles(loadStaffCompensationProfiles());
    window.addEventListener('omark-compensation-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('omark-compensation-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const profile = userId ? profiles.find((p) => p.userId === userId) : undefined;

  return {
    profiles,
    profile,
    getProfile: (id: string, name?: string, role?: Role) => getStaffCompensationProfile(id, name, role),
    updateProfile: updateStaffCompensationProfile,
    deleteProfile: deleteStaffCompensationProfile,
  };
};
