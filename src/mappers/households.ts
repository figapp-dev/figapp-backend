import { buildChildDisplayName } from "../lib/child-names.js";
import { isBiologicalParentUnder18ForOwnDailyLog } from "../lib/parenting-assessment.js";
import {
  isActiveHouseholdLinkForToday,
  isCurrentlyActivePlacement,
} from "../lib/placement-status.js";
import type {
  HouseholdCarerDetailDto,
  HouseholdCarerDto,
  HouseholdCarerProfileRow,
  HouseholdCarerRow,
  HouseholdChildRow,
  HouseholdCurrentChildDto,
  HouseholdDetailDto,
  HouseholdListItemDto,
  HouseholdParentPlacementRow,
  HouseholdRow,
  HouseholdStaffMemberDto,
  HouseholdStaffProfileRow,
} from "../types/households.js";
import type { BiologicalParentRow } from "../types/children.js";

function carerDisplayName(profile: {
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
}): string {
  const preferred = profile.preferred_name?.trim();
  if (preferred) return preferred;
  const full = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  return full || "Foster carer";
}

function staffDisplayName(profile: {
  first_name: string | null;
  last_name: string | null;
}): string {
  const full = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  return full || "Staff member";
}

function toStaffMemberDto(
  profile: HouseholdStaffProfileRow,
): HouseholdStaffMemberDto {
  return {
    userId: profile.user_id,
    displayName: staffDisplayName(profile),
    figappId: profile.figapp_id,
    email: profile.email,
    phone: profile.phone,
  };
}

export function toHouseholdListItemDto(params: {
  household: HouseholdRow;
  carerLinks: HouseholdCarerRow[];
  childRows: HouseholdChildRow[];
  profilesByUserId: Map<
    string,
    {
      user_id: string;
      first_name: string | null;
      last_name: string | null;
      preferred_name: string | null;
      figapp_id: string | null;
    }
  >;
  currentUserId: string;
}): HouseholdListItemDto {
  const { household, currentUserId } = params;

  const fosterCarers: HouseholdCarerDto[] = [];
  for (const link of params.carerLinks) {
    if (!isActiveHouseholdLinkForToday(link)) continue;
    const profile = params.profilesByUserId.get(link.user_id);
    if (!profile) continue;
    fosterCarers.push({
      userId: link.user_id,
      displayName: carerDisplayName(profile),
      figappId: profile.figapp_id,
      isSelf: link.user_id === currentUserId,
    });
  }
  fosterCarers.sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });

  const placedChildrenCount = params.childRows.filter((row) =>
    isCurrentlyActivePlacement(row),
  ).length;

  return {
    id: household.id,
    figappId: household.household_id_system,
    name: (household.name ?? "").trim() || "Household",
    status: household.status,
    addressLine1: household.address_line1,
    addressLine2: household.address_line2,
    city: household.city,
    postalCode: household.postal_code,
    country: household.country,
    maxChildren: household.max_children,
    placedChildrenCount,
    fosterCarers,
  };
}

export function toHouseholdDetailDto(params: {
  household: HouseholdRow;
  carerLinks: HouseholdCarerRow[];
  childRows: HouseholdChildRow[];
  parentPlacements: HouseholdParentPlacementRow[];
  carerProfilesByUserId: Map<string, HouseholdCarerProfileRow>;
  staffProfilesByUserId: Map<string, HouseholdStaffProfileRow>;
  childrenById: Map<
    string,
    {
      id: string;
      preferred_name: string | null;
      first_name: string | null;
      middle_name: string | null;
      last_name: string | null;
      legal_name: string | null;
      figapp_id: string | null;
    }
  >;
  parentsById: Map<string, BiologicalParentRow>;
  currentUserId: string;
}): HouseholdDetailDto {
  const { household, currentUserId } = params;

  const fosterCarers: HouseholdCarerDetailDto[] = [];
  const socialWorkerIdSet = new Set<string>();

  for (const link of params.carerLinks) {
    if (!isActiveHouseholdLinkForToday(link)) continue;
    const profile = params.carerProfilesByUserId.get(link.user_id);
    if (!profile) continue;

    fosterCarers.push({
      userId: link.user_id,
      displayName: carerDisplayName(profile),
      figappId: profile.figapp_id,
      email: profile.email,
      phone: profile.phone,
      isSelf: link.user_id === currentUserId,
    });

    const swId = profile.social_worker_id || link.social_worker_id || null;
    if (swId) socialWorkerIdSet.add(swId);
  }

  fosterCarers.sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });

  const socialWorkers: HouseholdStaffMemberDto[] = [];
  const managerIdSet = new Set<string>();
  for (const swId of socialWorkerIdSet) {
    const profile = params.staffProfilesByUserId.get(swId);
    if (!profile) continue;
    socialWorkers.push(toStaffMemberDto(profile));
    if (profile.manager_id) managerIdSet.add(profile.manager_id);
  }
  socialWorkers.sort((a, b) => a.displayName.localeCompare(b.displayName));

  const swManagers: HouseholdStaffMemberDto[] = [];
  for (const managerId of managerIdSet) {
    const profile = params.staffProfilesByUserId.get(managerId);
    if (!profile) continue;
    swManagers.push(toStaffMemberDto(profile));
  }
  swManagers.sort((a, b) => a.displayName.localeCompare(b.displayName));

  const currentChildren: HouseholdCurrentChildDto[] = [];

  for (const row of params.childRows) {
    if (!isCurrentlyActivePlacement(row)) continue;
    const child = params.childrenById.get(row.child_id);
    if (!child) continue;
    currentChildren.push({
      kind: "child",
      id: child.id,
      displayName: buildChildDisplayName(child),
      figappId: child.figapp_id,
      relationship: null,
      linkedChild: null,
    });
  }

  const seenParents = new Set<string>();
  for (const row of params.parentPlacements) {
    if (!isCurrentlyActivePlacement(row)) continue;
    const parent = params.parentsById.get(row.biological_parent_id);
    if (!parent) continue;
    if (!isBiologicalParentUnder18ForOwnDailyLog(parent.date_of_birth)) {
      continue;
    }

    const key = `${parent.id}:${row.household_id}`;
    if (seenParents.has(key)) continue;
    seenParents.add(key);

    const linked = params.childrenById.get(row.child_id);
    currentChildren.push({
      kind: "placed_parent",
      id: parent.id,
      displayName: (parent.name ?? "").trim() || "Parent",
      figappId: parent.figapp_id,
      relationship: parent.relationship,
      linkedChild: linked
        ? {
            id: linked.id,
            displayName: buildChildDisplayName(linked),
            figappId: linked.figapp_id,
          }
        : null,
    });
  }

  currentChildren.sort((a, b) => a.displayName.localeCompare(b.displayName));

  const childrenInPlacementCount = currentChildren.length;
  const maxChildren = household.max_children;
  const capacityUtilizationPercent =
    maxChildren != null && maxChildren > 0
      ? Math.round((childrenInPlacementCount / maxChildren) * 100)
      : 0;

  return {
    id: household.id,
    figappId: household.household_id_system,
    name: (household.name ?? "").trim() || "Household",
    status: household.status,
    createdAt: household.created_at ?? null,
    addressLine1: household.address_line1,
    addressLine2: household.address_line2,
    city: household.city,
    postalCode: household.postal_code,
    country: household.country,
    maxChildren,
    activeFosterCarersCount: fosterCarers.length,
    childrenInPlacementCount,
    capacityUtilizationPercent,
    fosterCarers,
    socialWorkers,
    swManagers,
    currentChildren,
  };
}
