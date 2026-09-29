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

// ── Purge detector for legacy fake/seed interaction records ──────────────────
export function isFakeOrSeedInteraction(item: any): boolean {
  if (!item) return true;
  const id = String(item.id || '');
  const prospectId = String(item.prospectId || '');
  const staffName = String(item.loggedByUserName || '').toLowerCase();
  const staffEmail = String(item.loggedByUserEmail || '').toLowerCase();
  const response = String(item.response || '').toLowerCase();

  // 1. Synthetic ID patterns
  if (id.startsWith('inter_seed_') || id.includes('_seed_')) return true;
  if (prospectId.startsWith('pr_seed_') || prospectId.includes('_seed_')) return true;

  // 2. Synthetic dummy staff member names
  const fakeNames = [
    'kojo mensah',
    'grace asante',
    'ama serwaa',
    'sarah baidoo',
    'david osei',
    'prince boateng',
  ];
  if (fakeNames.some((name) => staffName.includes(name))) return true;

  // 3. Synthetic staff emails
  const fakeEmails = [
    'kojo.mensah@omark.com',
    'grace.asante@omark.com',
    'ama.serwaa@omark.com',
    'sarah.baidoo@omark.com',
    'david.osei@omark.com',
    'prince.boateng@omark.com',
  ];
  if (fakeEmails.some((email) => staffEmail.includes(email))) return true;

  // 4. Synthetic response contents from the legacy mock seed generator
  const fakePhrases = [
    '2-bedroom executive detached house in east legon hills',
    'airport hills gated community',
    'walked client through site map and verified land title clearance',
    '12-month payment installment option for tema comm 25 plot',
    'draft land purchase agreement and biometric kyc',
    'oyarifa smart homes enclave',
  ];
  if (fakePhrases.some((phrase) => response.includes(phrase))) return true;

  return false;
}

// ── Stored interactions (real user-logged notes only; no synthetic mock seeds) ─
const DEFAULT_SEED_INTERACTIONS: StaffInteraction[] = [];

// ── Storage getters and setters ──────────────────────────────────────────────
export function getStoredInteractions(): StaffInteraction[] {
  try {
    const raw = localStorage.getItem(INTERACTIONS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const deletedIds = getDeletedInteractionIds();
      // Purge all legacy synthetic seeds and deleted items from user's storage
      const clean = parsed.filter(
        (item: StaffInteraction) =>
          item && !isFakeOrSeedInteraction(item) && !deletedIds.has(item.id)
      );
      if (clean.length !== parsed.length) {
        localStorage.setItem(INTERACTIONS_STORAGE_KEY, JSON.stringify(clean));
      }
      return clean;
    }
    return [];
  } catch (err) {
    console.error('Failed to read stored staff interactions:', err);
    return [];
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

export const DELETED_INTERACTIONS_KEY = 'omark_deleted_interaction_ids';

export function getDeletedInteractionIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_INTERACTIONS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function markInteractionDeleted(id: string): void {
  try {
    const set = getDeletedInteractionIds();
    set.add(id);
    localStorage.setItem(DELETED_INTERACTIONS_KEY, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.error('Failed to mark interaction as deleted:', err);
  }
}

export function deleteStoredInteraction(id: string): void {
  try {
    markInteractionDeleted(id);
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
