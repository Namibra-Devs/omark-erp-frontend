// src/utils/appointmentBackfill.ts
/**
 * Appointment Backfill Dry-Run Utility
 * Classifies appointments into Strong, Weak, and None tiers.
 * Identifies potential duplicates and records present only in localStorage.
 * Makes ZERO writes.
 */

export interface ClassifiedAppointment {
  id: string;
  source: string;
  scheduledFor: string;
  status: string;
  tier: 'strong' | 'weak' | 'none';
  proposedOwnerId: string;
  proposedOwnerName: string;
  proposedOwnerRole: string;
  reason: string;
  isPossibleDuplicate: boolean;
  duplicateMatches: string;
}

export interface ClassificationResult {
  totalAppointments: number;
  tierCounts: {
    strong: number;
    weak: number;
    none: number;
  };
  duplicateCount: number;
  ownerCounts: Record<string, number>;
  localOnlyByIdCount: number;
  localOnlyBySlotCount: number;
  classified: ClassifiedAppointment[];
}

export function classifyAppointments({
  serverAppointments = [],
  localAppointments = [],
  users = [],
  interactions = [],
  prospects = [],
  customers = [],
}: {
  serverAppointments?: any[];
  localAppointments?: any[];
  users?: any[];
  interactions?: any[];
  prospects?: any[];
  customers?: any[];
}): ClassificationResult {
  const userMap = new Map<string, { id: string; name: string; role: string }>();
  for (const u of users) {
    if (u && u.id) {
      const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || u.email || 'Unknown';
      userMap.set(String(u.id), { id: String(u.id), name, role: u.role || 'staff' });
    }
  }

  // Combine server and local appointments without destructive deduplication
  const allRaw = [...serverAppointments];
  const serverIdSet = new Set(serverAppointments.map((a) => String(a.id)));

  // Track how many local appointments are NOT on the server
  const localOnlyById: any[] = [];
  const localOnlyBySlot: any[] = [];

  for (const local of localAppointments) {
    if (!local || !local.id) continue;
    const isIdOnServer = serverIdSet.has(String(local.id));
    if (!isIdOnServer) {
      localOnlyById.push(local);
    }

    const localTime = new Date(local.scheduledFor || local.date || 0).getTime();
    const isSlotOnServer = serverAppointments.some((sa) => {
      const matchPerson =
        (local.prospectId && sa.prospectId === local.prospectId) ||
        (local.customerId && sa.customerId === local.customerId);
      const saTime = new Date(sa.scheduledFor || sa.date || 0).getTime();
      return matchPerson && Math.abs(saTime - localTime) < 60000;
    });

    if (!isSlotOnServer) {
      localOnlyBySlot.push(local);
    }

    // Add local records that aren't already represented by ID
    if (!isIdOnServer) {
      allRaw.push({ ...local, _fromLocalStorage: true });
    }
  }

  // Interaction map for strong resolution
  const interactionCreatorByApptId = new Map<string, string>();
  for (const i of interactions) {
    if (!i) continue;
    const loggedBy = i.loggedByUserId || i.userId;
    if (loggedBy && i.appointmentId) {
      interactionCreatorByApptId.set(String(i.appointmentId), String(loggedBy));
    }
    if (loggedBy && i.id) {
      interactionCreatorByApptId.set(String(i.id), String(loggedBy));
    }
  }

  // Prospect and customer owner maps for weak resolution
  const prospectOwnerMap = new Map<string, string>();
  for (const p of prospects) {
    if (!p || !p.id) continue;
    const owner = p.assignedUserId || p.createdByUserId || p.registeredByUserId || p.recordedByUserId;
    if (owner) prospectOwnerMap.set(String(p.id), String(owner));
  }

  const customerOwnerMap = new Map<string, string>();
  for (const c of customers) {
    if (!c || !c.id) continue;
    const owner = c.assignedUserId || c.marketerId || c.createdByUserId || c.agentId;
    if (owner) customerOwnerMap.set(String(c.id), String(owner));
  }

  // Detect possible duplicates (same person + same scheduled time)
  const slotMap = new Map<string, string[]>();
  for (const appt of allRaw) {
    const personKey = appt.prospectId ? `p:${appt.prospectId}` : appt.customerId ? `c:${appt.customerId}` : null;
    const timeKey = appt.scheduledFor ? new Date(appt.scheduledFor).toISOString().slice(0, 16) : 'no_time';
    if (personKey && timeKey !== 'no_time') {
      const key = `${personKey}_${timeKey}`;
      if (!slotMap.has(key)) slotMap.set(key, []);
      slotMap.get(key)!.push(String(appt.id));
    }
  }

  const classified: ClassifiedAppointment[] = [];
  const tierCounts = { strong: 0, weak: 0, none: 0 };
  const ownerCounts: Record<string, number> = {};
  let duplicateCount = 0;

  for (const appt of allRaw) {
    const id = String(appt.id);
    const source = appt.source || 'staff';
    const scheduledFor = appt.scheduledFor || appt.date || '';
    const status = appt.status || 'scheduled';

    // Duplicate check
    const personKey = appt.prospectId ? `p:${appt.prospectId}` : appt.customerId ? `c:${appt.customerId}` : null;
    const timeKey = scheduledFor ? new Date(scheduledFor).toISOString().slice(0, 16) : 'no_time';
    const slotMatches = personKey && timeKey !== 'no_time' ? slotMap.get(`${personKey}_${timeKey}`) || [] : [];
    const isPossibleDuplicate = slotMatches.length > 1;
    if (isPossibleDuplicate) duplicateCount++;

    // 1. Check Strong tier
    const directCreator = appt.createdByUserId || appt.createdBy || appt.created_by || appt.created_by_user_id;
    const interactionCreator = interactionCreatorByApptId.get(id);

    if (directCreator && userMap.has(String(directCreator))) {
      const u = userMap.get(String(directCreator))!;
      tierCounts.strong++;
      ownerCounts[u.name] = (ownerCounts[u.name] || 0) + 1;
      classified.push({
        id,
        source,
        scheduledFor,
        status,
        tier: 'strong',
        proposedOwnerId: u.id,
        proposedOwnerName: u.name,
        proposedOwnerRole: u.role,
        reason: 'Explicit createdByUserId on appointment record',
        isPossibleDuplicate,
        duplicateMatches: isPossibleDuplicate ? slotMatches.filter((x) => x !== id).join('; ') : '',
      });
      continue;
    }

    if (interactionCreator && userMap.has(String(interactionCreator))) {
      const u = userMap.get(String(interactionCreator))!;
      tierCounts.strong++;
      ownerCounts[u.name] = (ownerCounts[u.name] || 0) + 1;
      classified.push({
        id,
        source,
        scheduledFor,
        status,
        tier: 'strong',
        proposedOwnerId: u.id,
        proposedOwnerName: u.name,
        proposedOwnerRole: u.role,
        reason: 'Verified loggedByUserId from linked interaction log',
        isPossibleDuplicate,
        duplicateMatches: isPossibleDuplicate ? slotMatches.filter((x) => x !== id).join('; ') : '',
      });
      continue;
    }

    // 2. Check Weak tier (prospect owner, customer owner, or staffId)
    const pOwner = appt.prospectId ? prospectOwnerMap.get(String(appt.prospectId)) : null;
    const cOwner = appt.customerId ? customerOwnerMap.get(String(appt.customerId)) : null;
    const assignedStaff = appt.staffId || appt.assignedUserId;

    const weakCandidateId = pOwner || cOwner || assignedStaff;
    if (weakCandidateId && userMap.has(String(weakCandidateId))) {
      const u = userMap.get(String(weakCandidateId))!;
      tierCounts.weak++;
      ownerCounts[`[WEAK] ${u.name}`] = (ownerCounts[`[WEAK] ${u.name}`] || 0) + 1;
      classified.push({
        id,
        source,
        scheduledFor,
        status,
        tier: 'weak',
        proposedOwnerId: u.id,
        proposedOwnerName: u.name,
        proposedOwnerRole: u.role,
        reason: pOwner
          ? 'Inferred from linked prospect assigned/created owner'
          : cOwner
          ? 'Inferred from linked customer owner'
          : 'Inferred from staffId/assignedUserId',
        isPossibleDuplicate,
        duplicateMatches: isPossibleDuplicate ? slotMatches.filter((x) => x !== id).join('; ') : '',
      });
      continue;
    }

    // 3. None tier
    tierCounts.none++;
    ownerCounts['[UNASSIGNED]'] = (ownerCounts['[UNASSIGNED]'] || 0) + 1;
    classified.push({
      id,
      source,
      scheduledFor,
      status,
      tier: 'none',
      proposedOwnerId: '',
      proposedOwnerName: '',
      proposedOwnerRole: '',
      reason:
        source === 'website'
          ? 'Public website booking'
          : 'Orphan record — no creator or owner found in database',
      isPossibleDuplicate,
      duplicateMatches: isPossibleDuplicate ? slotMatches.filter((x) => x !== id).join('; ') : '',
    });
  }

  return {
    totalAppointments: allRaw.length,
    tierCounts,
    duplicateCount,
    ownerCounts,
    localOnlyByIdCount: localOnlyById.length,
    localOnlyBySlotCount: localOnlyBySlot.length,
    classified,
  };
}

export function generateBackfillCsv(classifiedList: ClassifiedAppointment[]): string {
  const headers = [
    'Appointment ID',
    'Source',
    'Scheduled For',
    'Status',
    'Tier',
    'Proposed Owner ID',
    'Proposed Owner Name',
    'Proposed Owner Role',
    'Reason',
    'Possible Duplicate',
    'Duplicate Matches',
  ];

  const escapeCsv = (str: any) => `"${String(str || '').replace(/"/g, '""')}"`;

  const rows = [
    headers.join(','),
    ...classifiedList.map((item) =>
      [
        escapeCsv(item.id),
        escapeCsv(item.source),
        escapeCsv(item.scheduledFor),
        escapeCsv(item.status),
        escapeCsv(item.tier),
        escapeCsv(item.proposedOwnerId),
        escapeCsv(item.proposedOwnerName),
        escapeCsv(item.proposedOwnerRole),
        escapeCsv(item.reason),
        escapeCsv(item.isPossibleDuplicate ? 'YES' : 'NO'),
        escapeCsv(item.duplicateMatches),
      ].join(',')
    ),
  ];

  return rows.join('\n');
}
