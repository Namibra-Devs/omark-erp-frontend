// src/utils/interactionStorage.ts
import { useEffect } from 'react';
import type { InteractionChannel, Role } from '@/types';
import type { UserEntity } from '@/api/users';
import dayjs from 'dayjs';

export const INTERACTIONS_STORAGE_KEY = 'omark_all_staff_interactions';
export const INTERACTIONS_CHANGED_EVENT = 'omark-interactions-changed';

export interface StaffInteraction {
  id: string;
  prospectId?: string;
  customerId?: string;
  appointmentId?: string;
  interactionType?: 'communication' | 'booking' | 'status_update' | 'note';
  prospectName?: string;
  prospectPhone?: string;
  prospectSource?: string;
  channel: InteractionChannel;
  occurredAt: string;
  response: string;
  loggedByUserId: string;
  loggedByUserName?: string;
  loggedByUserRole?: Role | string;
  loggedByUserEmail?: string;
  loggedByUserAvatar?: string;
  createdAt: string;
}

// ── Default realistic seeds if storage is empty ──────────────────────────────
const DEFAULT_SEED_INTERACTIONS: StaffInteraction[] = [
  {
    id: 'inter_seed_1',
    prospectId: 'pr_seed_1',
    prospectName: 'Kwame Mensah',
    prospectPhone: '+233 24 123 4567',
    prospectSource: 'marketing',
    channel: 'call',
    occurredAt: dayjs().subtract(45, 'minute').toISOString(),
    response: 'Client confirmed interest in 2-bedroom executive detached house in East Legon Hills. Requested payment plan schedule breakdown.',
    loggedByUserId: 'usr_mkt_1',
    loggedByUserName: 'Kojo Mensah',
    loggedByUserRole: 'marketing_staff',
    loggedByUserEmail: 'kojo.mensah@omark.com',
    createdAt: dayjs().subtract(45, 'minute').toISOString(),
  },
  {
    id: 'inter_seed_2',
    prospectId: 'pr_seed_2',
    prospectName: 'Abena Osei',
    prospectPhone: '+233 20 888 1234',
    prospectSource: 'customer_service',
    channel: 'whatsapp',
    occurredAt: dayjs().subtract(2, 'hour').toISOString(),
    response: 'Sent location brochure and price list for Airport Hills gated community. Client will review with spouse and schedule site viewing.',
    loggedByUserId: 'usr_cs_1',
    loggedByUserName: 'Grace Asante',
    loggedByUserRole: 'customer_service',
    loggedByUserEmail: 'grace.asante@omark.com',
    createdAt: dayjs().subtract(2, 'hour').toISOString(),
  },
  {
    id: 'inter_seed_3',
    prospectId: 'pr_seed_3',
    prospectName: 'Emmanuel Darko',
    prospectPhone: '+233 27 555 9012',
    prospectSource: 'marketing',
    channel: 'in_person',
    occurredAt: dayjs().subtract(5, 'hour').toISOString(),
    response: 'Conducted in-person consultation at head office. Walked client through site map and verified land title clearance documentation.',
    loggedByUserId: 'usr_sec_1',
    loggedByUserName: 'Ama Serwaa',
    loggedByUserRole: 'secretary',
    loggedByUserEmail: 'ama.serwaa@omark.com',
    createdAt: dayjs().subtract(5, 'hour').toISOString(),
  },
  {
    id: 'inter_seed_4',
    prospectId: 'pr_seed_4',
    prospectName: 'Akosua Frimpong',
    prospectPhone: '+233 55 432 1098',
    prospectSource: 'marketing',
    channel: 'call',
    occurredAt: dayjs().subtract(1, 'day').add(2, 'hour').toISOString(),
    response: 'Follow-up phone call after weekend inspection. Prospect agreed to 12-month payment installment option for Tema Comm 25 plot.',
    loggedByUserId: 'usr_mkt_2',
    loggedByUserName: 'Sarah Baidoo',
    loggedByUserRole: 'marketing_staff',
    loggedByUserEmail: 'sarah.baidoo@omark.com',
    createdAt: dayjs().subtract(1, 'day').add(2, 'hour').toISOString(),
  },
  {
    id: 'inter_seed_5',
    prospectId: 'pr_seed_5',
    prospectName: 'Dr. Michael Addo',
    prospectPhone: '+233 24 999 8877',
    prospectSource: 'customer_service',
    channel: 'email',
    occurredAt: dayjs().subtract(1, 'day').subtract(4, 'hour').toISOString(),
    response: 'Emailed draft Land Purchase Agreement and biometric KYC verification checklist following initial office inquiry.',
    loggedByUserId: 'usr_dir_1',
    loggedByUserName: 'David Osei',
    loggedByUserRole: 'marketing_director',
    loggedByUserEmail: 'david.osei@omark.com',
    createdAt: dayjs().subtract(1, 'day').subtract(4, 'hour').toISOString(),
  },
  {
    id: 'inter_seed_6',
    prospectId: 'pr_seed_6',
    prospectName: 'Nana Yaa Boateng',
    prospectPhone: '+233 26 333 4455',
    prospectSource: 'marketing',
    channel: 'sms',
    occurredAt: dayjs().subtract(2, 'day').toISOString(),
    response: 'Sent SMS reminder for site visit scheduled for Saturday 10:00 AM at Oyarifa smart homes enclave.',
    loggedByUserId: 'usr_cs_2',
    loggedByUserName: 'Prince Boateng',
    loggedByUserRole: 'customer_service',
    loggedByUserEmail: 'prince.boateng@omark.com',
    createdAt: dayjs().subtract(2, 'day').toISOString(),
  },
];

// ── Storage getters and setters ──────────────────────────────────────────────
export function getStoredInteractions(): StaffInteraction[] {
  try {
    const raw = localStorage.getItem(INTERACTIONS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(INTERACTIONS_STORAGE_KEY, JSON.stringify(DEFAULT_SEED_INTERACTIONS));
      return DEFAULT_SEED_INTERACTIONS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    localStorage.setItem(INTERACTIONS_STORAGE_KEY, JSON.stringify(DEFAULT_SEED_INTERACTIONS));
    return DEFAULT_SEED_INTERACTIONS;
  } catch (err) {
    console.error('Failed to read stored staff interactions:', err);
    return DEFAULT_SEED_INTERACTIONS;
  }
}

export function saveStoredInteraction(interaction: StaffInteraction): void {
  try {
    const current = getStoredInteractions();
    const existingIndex = current.findIndex((i) => i.id === interaction.id);
    let next: StaffInteraction[];
    if (existingIndex >= 0) {
      next = [...current];
      next[existingIndex] = { ...next[existingIndex], ...interaction };
    } else {
      next = [interaction, ...current];
    }
    localStorage.setItem(INTERACTIONS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(INTERACTIONS_CHANGED_EVENT, { detail: interaction }));
  } catch (err) {
    console.error('Failed to save staff interaction:', err);
  }
}

export function saveStoredInteractions(interactions: StaffInteraction[]): void {
  try {
    localStorage.setItem(INTERACTIONS_STORAGE_KEY, JSON.stringify(interactions));
    window.dispatchEvent(new Event(INTERACTIONS_CHANGED_EVENT));
  } catch (err) {
    console.error('Failed to save staff interactions batch:', err);
  }
}

export function deleteStoredInteraction(id: string): void {
  try {
    const current = getStoredInteractions();
    const next = current.filter((item) => item.id !== id);
    localStorage.setItem(INTERACTIONS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(INTERACTIONS_CHANGED_EVENT));
  } catch (err) {
    console.error('Failed to delete staff interaction:', err);
  }
}

// ── Hook to listen for interaction changes across the app ────────────────────
export function useInteractionsListener(callback: () => void): void {
  useEffect(() => {
    const handler = () => {
      callback();
    };
    window.addEventListener(INTERACTIONS_CHANGED_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(INTERACTIONS_CHANGED_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, [callback]);
}

// ── Query interactions specifically associated with an appointment or contact ─
export function getInteractionsForAppointment(
  appointmentId?: string,
  prospectId?: string,
  customerId?: string
): StaffInteraction[] {
  const all = getStoredInteractions();
  return all.filter((item) => {
    if (appointmentId && item.appointmentId === appointmentId) return true;
    if (prospectId && item.prospectId === prospectId) return true;
    if (customerId && item.customerId === customerId) return true;
    return false;
  }).sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}
