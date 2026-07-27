// src/mock/approvalStore.ts
//
// ⚠️ PROTOTYPE — local-only, not backed by a real API. ⚠️
// Makes the approval workflow ("branch managers approve within limits,
// head office approves major actions") actually clickable while there's no
// backend endpoint for it. Decisions are kept in localStorage, keyed by the
// document/expense record id, and layered on top of the static mock data
// in src/mock/branches.ts. Delete this file and wire up real approve/
// reject endpoints once they exist.
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'omark_mock_approval_overrides';

export type ApprovalDecision = 'approved' | 'rejected';
export type ApprovedByRole = 'branch_manager' | 'head_office';

export interface ApprovalOverride {
  decision: ApprovalDecision;
  decidedBy: ApprovedByRole;
  decidedAt: string;
}

export type OverrideMap = Record<string, ApprovalOverride>;

const load = (): OverrideMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore malformed storage, fall back to empty
  }
  return {};
};

const save = (map: OverrideMap) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  window.dispatchEvent(new Event('omark-approval-overrides-changed'));
};

export const getApprovalOverride = (recordId: string): ApprovalOverride | undefined => load()[recordId];

export const getAllApprovalOverrides = (): OverrideMap => load();

export const setApprovalOverride = (recordId: string, decision: ApprovalDecision, decidedBy: ApprovedByRole) => {
  const map = load();
  map[recordId] = { decision, decidedBy, decidedAt: new Date().toISOString().slice(0, 10) };
  save(map);
};

export const clearApprovalOverride = (recordId: string) => {
  const map = load();
  delete map[recordId];
  save(map);
};

/** Re-reads on mount and whenever any component in this tab changes an override. */
export const useApprovalOverrides = () => {
  const [overrides, setOverrides] = useState<OverrideMap>(() => load());

  useEffect(() => {
    const refresh = () => setOverrides(load());
    window.addEventListener('omark-approval-overrides-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('omark-approval-overrides-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return overrides;
};
