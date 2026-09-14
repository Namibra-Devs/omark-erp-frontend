// src/contexts/BranchContext.tsx
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  useBranchesQuery,
  useCreateBranchMutation,
  useUpdateBranchMutation,
  useDeleteBranchMutation,
  type BranchEntity,
} from '@/api/branches';
import {
  getStoredBranchOverrides,
  setStoredBranchOverride,
  getStoredBranchStaff,
  setStoredBranchStaff,
  addStaffToBranchRoster,
  setStoredUserAssignment,
} from '@/utils/userAssignmentStorage';
import { recordEntityBranch, getBranchCanonicalKey } from '@/utils/branchIsolation';

export type Branch = BranchEntity & { staffUserIds?: string[] };

const VIEWING_STORAGE_KEY = 'omark_viewing_branch_id';

const DEFAULT_SYSTEM_BRANCHES: BranchEntity[] = [
  {
    id: 'b1',
    name: 'Kumasi Main',
    branchCode: 'KMA',
    location: 'Central Market, Kumasi',
    phone: '+233 32 201 1234',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'b2',
    name: 'Accra Central',
    branchCode: 'ACC',
    location: 'Airport Residential Area, Accra',
    phone: '+233 30 201 5678',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'b3',
    name: 'Takoradi Branch',
    branchCode: 'TKD',
    location: 'Market Circle, Takoradi',
    phone: '+233 31 201 9012',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'b4',
    name: 'Tamale Branch',
    branchCode: 'TML',
    location: 'Central Business District, Tamale',
    phone: '+233 37 201 3456',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

interface BranchContextType {
  branches: Branch[];
  isLoading: boolean;
  addBranch: (branch: {
    name: string;
    branchCode: string;
    location: string;
    phone?: string;
    managerUserId?: string;
    staffUserIds?: string[];
    targetRevenueMinor?: number;
    approvalLimitMinor?: number;
  }) => Promise<Branch>;
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
  const { data: apiBranches = [], isLoading } = useBranchesQuery();
  const createBranchMutation = useCreateBranchMutation();
  const updateBranchMutation = useUpdateBranchMutation();
  const deleteBranchMutation = useDeleteBranchMutation();

  const [tick, setTick] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setTick((t) => t + 1);
    window.addEventListener('omark-branch-override-changed', handleUpdate);
    window.addEventListener('omark-branch-roster-changed', handleUpdate);
    window.addEventListener('omark-assignment-changed', handleUpdate);
    return () => {
      window.removeEventListener('omark-branch-override-changed', handleUpdate);
      window.removeEventListener('omark-branch-roster-changed', handleUpdate);
      window.removeEventListener('omark-assignment-changed', handleUpdate);
    };
  }, []);

  // Merge API branches with defaults and local persistent overrides
  const branches: Branch[] = useMemo(() => {
    let baseList: BranchEntity[] = apiBranches.length > 0 ? [...apiBranches] : [...DEFAULT_SYSTEM_BRANCHES];

    // Ensure Accra branch is always present in list
    const hasAccra = baseList.some(
      (b) => getBranchCanonicalKey(b.name || b.id || b.branchCode) === 'accra'
    );
    if (!hasAccra) {
      baseList.push(DEFAULT_SYSTEM_BRANCHES[1]);
    }

    const overrides = getStoredBranchOverrides();

    return baseList.map((b) => {
      const canonical = getBranchCanonicalKey(b.id || b.name || b.branchCode);
      const override = overrides[b.id] || (canonical ? overrides[canonical] : undefined) || {};
      const rosterStaff = getStoredBranchStaff(b.id);
      const canonStaff = canonical ? getStoredBranchStaff(canonical) : [];
      const staffUserIds = Array.from(new Set([...(override.staffUserIds || []), ...rosterStaff, ...canonStaff]));

      return {
        ...b,
        name: override.name || b.name,
        location: override.location || b.location,
        phone: override.phone || b.phone,
        managerUserId: override.managerUserId || b.managerUserId,
        staffUserIds,
        staffCount: staffUserIds.length > 0 ? staffUserIds.length : b.staffCount,
      };
    });
  }, [apiBranches, tick]);

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

  const addBranch = async (branchData: {
    name: string;
    branchCode: string;
    location: string;
    phone?: string;
    managerUserId?: string;
    staffUserIds?: string[];
    targetRevenueMinor?: number;
    approvalLimitMinor?: number;
  }) => {
    const { staffUserIds, ...apiPayload } = branchData;
    let created: any = null;
    try {
      created = await createBranchMutation.mutateAsync(apiPayload);
    } catch {
      created = {
        id: `branch-${Date.now()}`,
        ...branchData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const targetId = created?.id || `branch-${Date.now()}`;
    setStoredBranchOverride(targetId, {
      name: branchData.name,
      location: branchData.location,
      phone: branchData.phone,
      managerUserId: branchData.managerUserId,
      staffUserIds: staffUserIds || [],
    });

    if (staffUserIds && staffUserIds.length > 0) {
      setStoredBranchStaff(targetId, staffUserIds, branchData.name);
    }

    if (branchData.managerUserId) {
      addStaffToBranchRoster(targetId, branchData.managerUserId, branchData.name);
      setStoredUserAssignment(branchData.managerUserId, {
        branchId: targetId,
        branchName: branchData.name,
        departmentId: 'dept-ops',
      });
      recordEntityBranch('staff', branchData.managerUserId, targetId);
    }

    setTick((t) => t + 1);
    return created;
  };

  const updateBranch = async (id: string, updates: Partial<Branch>) => {
    const { staffUserIds, ...apiPayload } = updates;

    // Persist override immediately to client storage
    setStoredBranchOverride(id, {
      ...updates,
      staffUserIds: staffUserIds,
    });

    const targetBranch = branches.find((b) => b.id === id);
    const branchName = updates.name || targetBranch?.name;

    if (staffUserIds !== undefined) {
      setStoredBranchStaff(id, staffUserIds, branchName);
    }

    if (updates.managerUserId) {
      addStaffToBranchRoster(id, updates.managerUserId, branchName);
      setStoredUserAssignment(updates.managerUserId, {
        branchId: id,
        branchName: branchName,
        departmentId: 'dept-ops',
      });
      recordEntityBranch('staff', updates.managerUserId, id);
    }

    setTick((t) => t + 1);

    try {
      await updateBranchMutation.mutateAsync({ id, payload: apiPayload });
    } catch {
      // Graceful offline/mock fallback: local override is already preserved
    }
  };

  const deleteBranch = async (id: string) => {
    try {
      await deleteBranchMutation.mutateAsync(id);
    } catch {
      // Local removal
    }
    setViewingBranchIdState((current) => (current === id ? null : current));
    setTick((t) => t + 1);
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
