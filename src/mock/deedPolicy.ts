// src/mock/deedPolicy.ts
//
// ⚠️ PROTOTYPE — local-only, not backed by a real API. ⚠️
// "Use company Deed policies for Deed generation." There's no template/
// policy concept anywhere in the real API — GenerateDeedPayload only takes
// { customerId, propertyId, witnesses, businessContacts }. So the only
// piece of this policy that can actually reach a generated deed is
// `standardBusinessContacts`, which pre-fills the Business Contacts field.
// `defaultWitnessCount` only shapes the form UI. `internalNotes` is for
// staff reference only and is never sent anywhere.
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'omark_mock_deed_policy';

export interface DeedPolicy {
  standardBusinessContacts: string;
  defaultWitnessCount: number;
  internalNotes: string;
  updatedAt: string;
  updatedBy: string;
}

const DEFAULT_POLICY: DeedPolicy = {
  standardBusinessContacts: 'Omark Real Estate Ltd. — Accra Head Office\nAirport Residential Area, Accra\nPhone: +233 20 111 2222',
  defaultWitnessCount: 2,
  internalNotes: 'Every deed requires at least the standard two witnesses (buyer-side and company-side) unless legal advises otherwise. Confirm business contact details are current before generating.',
  updatedAt: '2026-07-01T09:00:00.000Z',
  updatedBy: 'System default',
};

const load = (): DeedPolicy => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_POLICY, ...JSON.parse(raw) };
  } catch {
    // ignore malformed storage
  }
  return DEFAULT_POLICY;
};

const save = (policy: DeedPolicy) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(policy));
  window.dispatchEvent(new Event('omark-deed-policy-changed'));
};

export const getDeedPolicy = (): DeedPolicy => load();

export const updateDeedPolicy = (patch: Partial<Omit<DeedPolicy, 'updatedAt' | 'updatedBy'>>, updatedBy: string) => {
  const next: DeedPolicy = { ...load(), ...patch, updatedAt: new Date().toISOString(), updatedBy };
  save(next);
  return next;
};

export const useDeedPolicy = () => {
  const [policy, setPolicy] = useState<DeedPolicy>(() => load());

  useEffect(() => {
    const refresh = () => setPolicy(load());
    window.addEventListener('omark-deed-policy-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('omark-deed-policy-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return policy;
};
