// src/mock/seenTracker.ts
//
// Generic "unseen since last visit" tracker backing the nav badge counters.
// There's no backend concept of read/unread per user for any of this (no
// endpoint tracks it), so it's local to this browser — good enough to
// demo the badge-appears / badge-disappears-on-open / badge-reappears-on-
// change loop, keyed by an arbitrary channel + viewer id (e.g.
// `complaints-staff` + a user id, or `complaints-customer` + a customer id).
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'omark_seen_tracker';
const EPOCH = '1970-01-01T00:00:00.000Z';

type SeenMap = Record<string, string>;

const keyFor = (channel: string, viewerId: string) => `${channel}:${viewerId}`;

const load = (): SeenMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore malformed storage
  }
  return {};
};

const save = (map: SeenMap) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  window.dispatchEvent(new Event('omark-seen-changed'));
};

export const getLastSeen = (channel: string, viewerId: string): string => load()[keyFor(channel, viewerId)] ?? EPOCH;

export const markSeen = (channel: string, viewerId: string) => {
  const map = load();
  map[keyFor(channel, viewerId)] = new Date().toISOString();
  save(map);
};

/**
 * Counts how many of the given timestamps are newer than the last time
 * `viewerId` marked `channel` as seen. Call the returned `markSeen()` when
 * the corresponding page/section is opened to clear the badge.
 */
export const useUnseenCount = (channel: string, viewerId: string | undefined, timestamps: string[]) => {
  const [lastSeen, setLastSeen] = useState(() => (viewerId ? getLastSeen(channel, viewerId) : EPOCH));

  useEffect(() => {
    const refresh = () => setLastSeen(viewerId ? getLastSeen(channel, viewerId) : EPOCH);
    refresh();
    window.addEventListener('omark-seen-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('omark-seen-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [channel, viewerId]);

  const count = viewerId ? timestamps.filter((t) => t > lastSeen).length : 0;

  const markSeenNow = useCallback(() => {
    if (viewerId) markSeen(channel, viewerId);
  }, [channel, viewerId]);

  return { count, markSeen: markSeenNow };
};
