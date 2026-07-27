// src/mock/staffAssignments.ts
//
// ⚠️ PROTOTYPE — local-only, not backed by a real API. ⚠️
// PATCH /users/{id} on the real backend has no branchId/department fields
// at all — this is a client-only map (userId -> branch/department) so the
// "every staff member belongs to a branch, a department, a role" concept
// can be demoed. Never sent to the API. When the backend adds these
// fields, delete this file and send them through src/api/users.ts instead.
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'omark_mock_staff_assignments';

export interface StaffAssignment {
  branchId?: string;
  departmentId?: string;
}

type AssignmentMap = Record<string, StaffAssignment>;

const load = (): AssignmentMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore malformed storage, fall back to empty
  }
  return {};
};

const save = (map: AssignmentMap) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};

export const getStaffAssignment = (userId: string): StaffAssignment => load()[userId] ?? {};

export const setStaffAssignment = (userId: string, assignment: StaffAssignment) => {
  const map = load();
  map[userId] = { ...map[userId], ...assignment };
  save(map);
};

/** Re-reads on every call to `refresh()` — simple enough for a prototype. */
export const useStaffAssignment = (userId: string | undefined) => {
  const [assignment, setAssignmentState] = useState<StaffAssignment>(() => (userId ? getStaffAssignment(userId) : {}));

  useEffect(() => {
    setAssignmentState(userId ? getStaffAssignment(userId) : {});
  }, [userId]);

  const update = (next: StaffAssignment) => {
    if (!userId) return;
    setStaffAssignment(userId, next);
    setAssignmentState((prev) => ({ ...prev, ...next }));
  };

  return { assignment, update };
};
