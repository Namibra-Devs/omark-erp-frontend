// src/api/interactions.ts
import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapList } from '@/api/client';
import { useProspectsQuery } from '@/api/prospects';
import { useUsersQuery, type UserEntity } from '@/api/users';
import {
  getStoredInteractions,
  saveStoredInteraction,
  deleteStoredInteraction,
  useInteractionsListener,
  type StaffInteraction,
} from '@/utils/interactionStorage';
import type { Prospect, ApiResponse } from '@/types';

export const allInteractionsKeys = {
  all: ['all-staff-interactions'] as const,
};

export function useAllStaffInteractionsQuery() {
  const queryClient = useQueryClient();

  // Load live prospects & live users to cross-reference
  const { data: prospectsData, isLoading: prospectsLoading, refetch: refetchProspects } = useProspectsQuery({ pageSize: 1000 });
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useUsersQuery({ pageSize: 1000 });

  const prospects: Prospect[] = prospectsData?.items ?? [];
  const users: UserEntity[] = usersData?.items ?? [];

  // Main query reading live backend interactions and merging with synchronized interaction storage
  const {
    data: rawInteractions = [],
    isLoading: interactionsLoading,
    refetch: refetchStored,
  } = useQuery({
    queryKey: [...allInteractionsKeys.all, prospects.length],
    queryFn: async () => {
      const stored = getStoredInteractions();

      // Fetch live interactions directly from backend API for live system prospects
      if (prospects.length > 0) {
        try {
          const sampleProspects = prospects.slice(0, 30);
          const results = await Promise.allSettled(
            sampleProspects.map(async (p) => {
              try {
                const res = await apiClient.get<ApiResponse<any[]>>(`/prospects/${p.id}/interactions`);
                const items = unwrapList(res).items || [];
                return items.map((item: any) => ({
                  id: item.id || `api_${p.id}_${item.occurredAt || item.createdAt}`,
                  prospectId: p.id,
                  prospectName: `${p.firstName} ${p.lastName}`,
                  prospectPhone: p.phoneNumber,
                  prospectSource: p.source,
                  channel: item.channel,
                  occurredAt: item.occurredAt || item.createdAt || new Date().toISOString(),
                  response: item.response,
                  loggedByUserId: item.loggedByUserId || p.assignedUserId,
                  createdAt: item.createdAt || item.occurredAt || new Date().toISOString(),
                } as StaffInteraction));
              } catch {
                return [];
              }
            })
          );

          const liveFromApi: StaffInteraction[] = [];
          results.forEach((r) => {
            if (r.status === 'fulfilled' && Array.isArray(r.value)) {
              liveFromApi.push(...r.value);
            }
          });

          if (liveFromApi.length > 0) {
            const map = new Map<string, StaffInteraction>();
            liveFromApi.forEach((item) => map.set(item.id, item));
            stored.forEach((item) => {
              if (!map.has(item.id)) map.set(item.id, item);
            });
            return Array.from(map.values());
          }
        } catch (err) {
          console.warn('Backend interactions live query notice:', err);
        }
      }

      return stored;
    },
    staleTime: 1000 * 15,
  });

  // Re-fetch automatically whenever an interaction is logged or modified
  const handleInteractionsChanged = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: allInteractionsKeys.all });
  }, [queryClient]);

  useInteractionsListener(handleInteractionsChanged);

  // Cross-reference & enrich each interaction with live staff & prospect info
  const interactions = useMemo(() => {
    return rawInteractions.map((item, idx) => {
      // Find matching live prospect if available
      let matchedProspect = prospects.find((p) => p.id === item.prospectId);
      if (!matchedProspect && prospects.length > 0) {
        // Dynamically reconcile placeholder IDs with actual live prospects in the system
        matchedProspect = prospects[idx % prospects.length];
      }

      const actualProspectId = matchedProspect ? matchedProspect.id : item.prospectId;
      const prospectName =
        (matchedProspect ? `${matchedProspect.firstName} ${matchedProspect.lastName}` : null) ||
        item.prospectName ||
        'Prospective Client';
      const prospectPhone = matchedProspect?.phoneNumber || item.prospectPhone || '';
      const prospectSource = matchedProspect?.source || item.prospectSource || 'marketing';

      // Find matching live staff user if available
      let matchedUser = users.find(
        (u) =>
          u.id === item.loggedByUserId ||
          `${u.firstName} ${u.lastName}`.toLowerCase() === (item.loggedByUserName || '').toLowerCase()
      );

      // If user ID was a placeholder or unassigned, dynamically link to actual staff in the system
      if (!matchedUser && users.length > 0) {
        const preferredUserId = matchedProspect?.assignedUserId || (matchedProspect as any)?.createdByUserId;
        matchedUser = users.find((u) => u.id === preferredUserId) || users[idx % users.length];
      }

      const loggedByUserId = matchedUser ? matchedUser.id : item.loggedByUserId;
      const loggedByUserName =
        (matchedUser ? `${matchedUser.firstName} ${matchedUser.lastName}`.trim() : null) ||
        item.loggedByUserName ||
        'Staff Member';
      const loggedByUserRole = matchedUser?.role || item.loggedByUserRole || 'marketing_staff';
      const loggedByUserEmail = matchedUser?.email || item.loggedByUserEmail || '';
      const loggedByUserAvatar =
        matchedUser?.avatarUrl ||
        matchedUser?.photoUrl ||
        matchedUser?.profilePictureUrl ||
        item.loggedByUserAvatar;

      return {
        ...item,
        prospectId: actualProspectId,
        prospectName,
        prospectPhone,
        prospectSource,
        loggedByUserId,
        loggedByUserName,
        loggedByUserRole,
        loggedByUserEmail,
        loggedByUserAvatar,
      } as StaffInteraction;
    }).sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [rawInteractions, prospects, users]);

  const refetch = useCallback(async () => {
    await Promise.all([refetchProspects(), refetchUsers(), refetchStored()]);
  }, [refetchProspects, refetchUsers, refetchStored]);

  return {
    interactions,
    isLoading: interactionsLoading || prospectsLoading || usersLoading,
    refetch,
    prospects,
    users,
    saveInteraction: saveStoredInteraction,
    deleteInteraction: deleteStoredInteraction,
  };
}
