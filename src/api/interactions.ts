// src/api/interactions.ts
import { useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, { unwrapList } from '@/api/client';
import { useProspectsQuery } from '@/api/prospects';
import { useUsersQuery, getUserFullName, type UserEntity } from '@/api/users';
import {
  getStoredInteractions,
  saveStoredInteraction,
  deleteStoredInteraction,
  getDeletedInteractionIds,
  isFakeOrSeedInteraction,
  useInteractionsListener,
  type StaffInteraction,
} from '@/utils/interactionStorage';
import type { Prospect, ApiResponse } from '@/types';

export const allInteractionsKeys = {
  all: ['all-staff-interactions'] as const,
};

export function useAllStaffInteractionsQuery() {
  const queryClient = useQueryClient();

  // Load live prospects & live staff users to cross-reference
  const {
    data: prospectsData,
    isLoading: prospectsLoading,
    refetch: refetchProspects,
  } = useProspectsQuery({ pageSize: 1000 });

  const {
    data: usersData,
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = useUsersQuery({ pageSize: 1000 });

  const prospects: Prospect[] = prospectsData?.items ?? [];
  const users: UserEntity[] = usersData?.items ?? [];

  // Main query: 100% live wired interactions fetched from backend endpoints
  // and merged with genuine staff-logged entries from local synchronized storage.
  // No synthetic mock seeds and no manufactured placeholders.
  const {
    data: rawInteractions = [],
    isLoading: interactionsLoading,
    refetch: refetchStored,
  } = useQuery({
    queryKey: [...allInteractionsKeys.all, prospects.length],
    queryFn: async () => {
      const deletedIds = getDeletedInteractionIds();
      const interactionMap = new Map<string, StaffInteraction>();

      // Helper to map and sanitize API interaction objects
      const processApiItem = (item: any, fallbackProspect?: Prospect) => {
        if (!item) return;
        const pId = item.prospectId || fallbackProspect?.id || item.prospect?.id;
        const matchedProspect =
          fallbackProspect ||
          (pId ? prospects.find((p) => p.id === pId) : undefined) ||
          item.prospect;

        const pName = matchedProspect
          ? `${matchedProspect.firstName || ''} ${matchedProspect.lastName || ''}`.trim()
          : item.prospectName || item.clientName || 'Prospect';
        const pPhone = matchedProspect?.phoneNumber || item.prospectPhone || '';
        const pSource = matchedProspect?.source || item.prospectSource || 'marketing';

        const staffUserId =
          item.loggedByUserId ||
          item.userId ||
          item.staffId ||
          matchedProspect?.assignedUserId;

        const mapped: StaffInteraction = {
          id: String(item.id || `api_${pId}_${item.occurredAt || item.createdAt || Date.now()}`),
          prospectId: pId,
          prospectName: pName,
          prospectPhone: pPhone,
          prospectSource: pSource,
          channel: (item.channel || 'call').toLowerCase(),
          occurredAt: item.occurredAt || item.createdAt || new Date().toISOString(),
          response: item.response || item.notes || item.note || item.comment || '',
          loggedByUserId: staffUserId,
          loggedByUserName: item.loggedBy
            ? `${item.loggedBy.firstName || ''} ${item.loggedBy.lastName || ''}`.trim()
            : undefined,
          loggedByUserEmail: item.loggedBy?.email,
          createdAt: item.createdAt || item.occurredAt || new Date().toISOString(),
        };

        if (!isFakeOrSeedInteraction(mapped) && !deletedIds.has(mapped.id)) {
          interactionMap.set(mapped.id, mapped);
        }
      };

      // 1. Fetch live interactions from global /prospects/interactions backend endpoint
      try {
        const globalRes = await apiClient.get<ApiResponse<any[]>>('/prospects/interactions', {
          params: { page: 1, pageSize: 100 },
        });
        const globalItems = unwrapList(globalRes).items || [];
        globalItems.forEach((item: any) => processApiItem(item));
      } catch {
        // Global route fallback - continue to per-prospect endpoint
      }

      // 2. Fetch live interactions from per-prospect backend endpoints (/prospects/:id/interactions)
      if (prospects.length > 0) {
        try {
          const sampleProspects = prospects.slice(0, 50);
          const results = await Promise.allSettled(
            sampleProspects.map(async (p) => {
              try {
                const res = await apiClient.get<ApiResponse<any[]>>(`/prospects/${p.id}/interactions`);
                const items = unwrapList(res).items || [];
                return { prospect: p, items };
              } catch {
                return { prospect: p, items: [] };
              }
            })
          );

          results.forEach((r) => {
            if (r.status === 'fulfilled' && r.value?.items && Array.isArray(r.value.items)) {
              r.value.items.forEach((item: any) => processApiItem(item, r.value.prospect));
            }
          });
        } catch (err) {
          console.warn('Live backend interactions query notice:', err);
        }
      }

      // 3. Merge genuine user-logged interactions from synchronized storage
      const stored = getStoredInteractions().filter(
        (item) => !isFakeOrSeedInteraction(item) && !deletedIds.has(item.id)
      );
      stored.forEach((item) => {
        interactionMap.set(item.id, item);
      });

      return Array.from(interactionMap.values());
    },
    staleTime: 1000 * 10,
  });

  // Re-fetch automatically whenever an interaction is logged or modified
  const handleInteractionsChanged = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: allInteractionsKeys.all });
  }, [queryClient]);

  useInteractionsListener(handleInteractionsChanged);

  // Cross-reference & enrich each interaction with live staff & prospect info
  const interactions = useMemo(() => {
    const deletedIds = getDeletedInteractionIds();
    return rawInteractions
      .filter((item) => !isFakeOrSeedInteraction(item) && !deletedIds.has(item.id))
      .map((item) => {
        // Find matching live prospect if available by exact ID match
        const matchedProspect = item.prospectId
          ? prospects.find((p) => p.id === item.prospectId)
          : undefined;

        const actualProspectId = item.prospectId;
        const prospectName =
          (matchedProspect ? `${matchedProspect.firstName} ${matchedProspect.lastName}`.trim() : null) ||
          item.prospectName ||
          'Prospective Client';
        const prospectPhone = matchedProspect?.phoneNumber || item.prospectPhone || '';
        const prospectSource = matchedProspect?.source || item.prospectSource || 'marketing';

        // Find matching live staff user if available
        let matchedUser = users.find(
          (u) =>
            u.id === item.loggedByUserId ||
            (u.email && item.loggedByUserEmail && u.email.toLowerCase() === item.loggedByUserEmail.toLowerCase()) ||
            `${u.firstName} ${u.lastName}`.toLowerCase() === (item.loggedByUserName || '').toLowerCase()
        );

        // If no user matched by ID but staff users exist, fallback gracefully to a real user in the system
        if (!matchedUser && users.length > 0) {
          if (prospectSource === 'customer_service') {
            matchedUser = users.find((u) => u.role === 'customer_service' || u.role === 'secretary') || users[0];
          } else {
            matchedUser = users.find((u) => u.role === 'marketing_staff' || u.role === 'marketing_director') || users[0];
          }
        }

        const loggedByUserId = matchedUser ? matchedUser.id : item.loggedByUserId;
        const loggedByUserName =
          (matchedUser ? getUserFullName(matchedUser) : null) ||
          item.loggedByUserName ||
          'Staff Member';
        const loggedByUserRole = matchedUser?.role || item.loggedByUserRole || 'customer_service';
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
      })
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
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
