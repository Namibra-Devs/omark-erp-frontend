// src/contexts/BranchContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useBranchesQuery, useCreateBranchMutation, useUpdateBranchMutation, useDeleteBranchMutation, type BranchEntity } from '@/api/branches';

export type Branch = BranchEntity;

const VIEWING_STORAGE_KEY = 'omark_viewing_branch_id';

interface BranchContextType {
  branches: Branch[];
  isLoading: boolean;
  addBranch: (branch: { name: string; branchCode: string; location: string; phone?: string; managerUserId?: string; targetRevenueMinor?: number; approvalLimitMinor?: number }) => Promise<Branch>;
  updateBranch: (id: string, updates: Partial<Branch>) => Promise<void>;
  deleteBranch: (id: string) => Promise<void>;
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
  const { data: branches = [], isLoading } = useBranchesQuery();
  const createBranchMutation = useCreateBranchMutation();
  const updateBranchMutation = useUpdateBranchMutation();
  const deleteBranchMutation = useDeleteBranchMutation();

  const [viewingBranchId, setViewingBranchIdState] = useState<string | null>(
    () => localStorage.getItem(VIEWING_STORAGE_KEY) || null
  );

  useEffect(() => {
    if (viewingBranchId) {
      localStorage.setItem(VIEWING_STORAGE_KEY, viewingBranchId);
    } else {
      localStorage.removeItem(VIEWING_STORAGE_KEY);
    }
  }, [viewingBranchId]);

  const addBranch = async (branch: { name: string; branchCode: string; location: string; phone?: string; managerUserId?: string; targetRevenueMinor?: number; approvalLimitMinor?: number }) => {
    return await createBranchMutation.mutateAsync(branch);
  };

  const updateBranch = async (id: string, updates: Partial<Branch>) => {
    await updateBranchMutation.mutateAsync({ id, payload: updates });
  };

  const deleteBranch = async (id: string) => {
    await deleteBranchMutation.mutateAsync(id);
    setViewingBranchIdState((current) => (current === id ? null : current));
  };

  const setViewingBranchId = (branchId: string | null) => setViewingBranchIdState(branchId);
  const viewingBranch = branches.find((b: Branch) => b.id === viewingBranchId) ?? null;

  return (
    <BranchContext.Provider
      value={{
        branches,
        isLoading,
        addBranch,
        updateBranch,
        deleteBranch,
        viewingBranchId,
        viewingBranch,
        setViewingBranchId,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
};
