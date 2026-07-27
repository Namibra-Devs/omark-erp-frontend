// src/mock/complaints.ts
//
// ⚠️ PROTOTYPE — local-only, not backed by a real API. ⚠️
// There is no complaints/support-ticket entity anywhere in the real
// 32-endpoint API. This is a localStorage-backed store so customers can log
// complaints from the portal and staff can triage them from the admin side,
// entirely client-side, until a real endpoint exists.
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'omark_mock_complaints';

export type ComplaintStatus = 'open' | 'in_progress' | 'resolved';
export type ComplaintCategory = 'payment' | 'property' | 'documentation' | 'service' | 'other';

export interface Complaint {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  category: ComplaintCategory;
  subject: string;
  message: string;
  status: ComplaintStatus;
  staffNote?: string;
  createdAt: string;
  updatedAt: string;
}

const load = (): Complaint[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore malformed storage
  }
  return [];
};

const save = (complaints: Complaint[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(complaints));
  window.dispatchEvent(new Event('omark-complaints-changed'));
};

const nextCode = (complaints: Complaint[]) => {
  const year = new Date().getFullYear();
  const countThisYear = complaints.filter((c) => c.code.includes(`-${year}-`)).length;
  return `CMP-${year}-${String(countThisYear + 1).padStart(3, '0')}`;
};

export const getAllComplaints = (): Complaint[] => load().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const getComplaintsForCustomer = (customerId: string): Complaint[] =>
  getAllComplaints().filter((c) => c.customerId === customerId);

export const addComplaint = (input: {
  customerId: string;
  customerName: string;
  category: ComplaintCategory;
  subject: string;
  message: string;
}): Complaint => {
  const complaints = load();
  const now = new Date().toISOString();
  const complaint: Complaint = {
    id: `complaint-${Date.now()}`,
    code: nextCode(complaints),
    status: 'open',
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  save([...complaints, complaint]);
  return complaint;
};

export const updateComplaintStatus = (id: string, status: ComplaintStatus, staffNote?: string) => {
  const complaints = load();
  const next = complaints.map((c) =>
    c.id === id ? { ...c, status, staffNote: staffNote ?? c.staffNote, updatedAt: new Date().toISOString() } : c
  );
  save(next);
};

export const useComplaints = () => {
  const [complaints, setComplaints] = useState<Complaint[]>(() => getAllComplaints());

  useEffect(() => {
    const refresh = () => setComplaints(getAllComplaints());
    window.addEventListener('omark-complaints-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('omark-complaints-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return complaints;
};
