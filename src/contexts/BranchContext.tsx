// src/contexts/BranchContext.tsx


import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockBranches as seedBranches, type Branch } from '@/mock/branches';

const BRANCHES_STORAGE_KEY = 'omark_mock_branches';
const VIEWING_STORAGE_KEY = 'omark_mock_viewing_branch_id';

const loadBranches = (): Branch[] => {
  try {
    const raw = localStorage.getItem(BRANCHES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through to seed data
  }
  return seedBranches;
};

interface BranchContextType {
  branches: Branch[];
  addBranch: (branch: Omit<Branch, 'id' | 'createdAt' | 'staffCount'>) => Branch;
  updateBranch: (id: string, updates: Partial<Omit<Branch, 'id' | 'createdAt'>>) => void;
  deleteBranch: (id: string) => void;
  /** null = "Head Office (All Branches)" view */
  viewingBranchId: string | null;
  viewingBranch: Branch | null;
  setViewingBranchId: (branchId: string | null) => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export const useBranchContext = () => {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranchContext must be used within a BranchProvider');
  return ctx;
};

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branches, setBranches] = useState<Branch[]>(loadBranches);
  const [viewingBranchId, setViewingBranchIdState] = useState<string | null>(
    () => localStorage.getItem(VIEWING_STORAGE_KEY) || null
  );

  useEffect(() => {
    localStorage.setItem(BRANCHES_STORAGE_KEY, JSON.stringify(branches));
  }, [branches]);

  useEffect(() => {
    if (viewingBranchId) {
      localStorage.setItem(VIEWING_STORAGE_KEY, viewingBranchId);
    } else {
      localStorage.removeItem(VIEWING_STORAGE_KEY);
    }
  }, [viewingBranchId]);

  const addBranch: BranchContextType['addBranch'] = (branch) => {
    const newBranch: Branch = {
      ...branch,
      id: `branch-${Date.now()}`,
      staffCount: 0,
      createdAt: new Date().toISOString(),
    };
    setBranches((prev) => [...prev, newBranch]);
    return newBranch;
  };

  const updateBranch: BranchContextType['updateBranch'] = (id, updates) => {
    setBranches((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const deleteBranch: BranchContextType['deleteBranch'] = (id) => {
    setBranches((prev) => prev.filter((b) => b.id !== id));
    setViewingBranchIdState((current) => (current === id ? null : current));
  };

  const setViewingBranchId = (branchId: string | null) => setViewingBranchIdState(branchId);
  const viewingBranch = branches.find((b) => b.id === viewingBranchId) ?? null;

  return (
    <BranchContext.Provider
      value={{ branches, addBranch, updateBranch, deleteBranch, viewingBranchId, viewingBranch, setViewingBranchId }}
    >
      {children}
    </BranchContext.Provider>
  );
};
