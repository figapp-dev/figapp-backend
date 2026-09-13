import { buildChildDisplayName } from "../lib/child-names.js";
import {
  getPlacementDisplayStatus,
  isActiveHouseholdLinkForToday,
} from "../lib/placement-status.js";
import type { BiologicalParentRow } from "../types/children.js";
import type { HouseholdCarerRow, HouseholdRow } from "../types/households.js";
import type {
  PlacementChildRow,
  PlacementChildSummaryRow,
  PlacementDetailDto,
  PlacementFosterCarerDto,
  PlacementHouseholdSummaryDto,
  PlacementListItemDto,
  PlacementParentRow,
  PlacementSubjectDto,
  PlacementTypeRow,
} from "../types/placements.js";

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

function toHouseholdSummary(
  household: HouseholdRow | undefined,
  householdId: string,
): PlacementHouseholdSummaryDto {
  return {
    id: household?.id ?? householdId,
    name: household?.name ?? null,
    figappId: household?.household_id_system ?? null,
    addressLine1: household?.address_line1 ?? null,
    city: household?.city ?? null,
    postalCode: household?.postal_code ?? null,
  };
}

function resolveTypeNames(
  typeIds: string[] | null | undefined,
  typesById: Map<string, string>,
): string[] {
  if (!typeIds?.length) return [];
  return typeIds
    .map((id) => typesById.get(id))
    .filter((name): name is string => !!name?.trim());
}

export function toChildPlacementListItemDto(params: {
  row: PlacementChildRow;
  child: PlacementChildSummaryRow | undefined;
  household: HouseholdRow | undefined;
  typesById: Map<string, string>;
}): PlacementListItemDto {
  const { row, child, household, typesById } = params;
  const status = getPlacementDisplayStatus(row);

  const subject: PlacementSubjectDto = {
    id: row.child_id,
    displayName: child ? buildChildDisplayName(child) : "Child",
    figappId: child?.figapp_id ?? null,
    dateOfBirth: child?.date_of_birth ?? null,
    relationship: null,
    linkedChild: null,
  };

  return {
    id: row.id,
    kind: "child",
    status,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active === true,
    notes: row.notes?.trim() || null,
    placementTypeNames: resolveTypeNames(child?.placement_type_ids, typesById),
    child: subject,
    household: toHouseholdSummary(household, row.household_id),
  };
}

export function toParentPlacementListItemDto(params: {
  row: PlacementParentRow;
  parent: BiologicalParentRow | undefined;
  linkedChild: PlacementChildSummaryRow | undefined;
  household: HouseholdRow | undefined;
}): PlacementListItemDto {
  const { row, parent, linkedChild, household } = params;
  const status = getPlacementDisplayStatus(row);

  const subject: PlacementSubjectDto = {
    id: row.biological_parent_id,
    displayName: parent?.name?.trim() || "Parent",
    figappId: parent?.figapp_id ?? null,
    dateOfBirth: parent?.date_of_birth ?? null,
    relationship: parent?.relationship ?? null,
    linkedChild: linkedChild
      ? {
          id: linkedChild.id,
          displayName: buildChildDisplayName(linkedChild),
          figappId: linkedChild.figapp_id,
        }
      : {
          id: row.child_id,
          displayName: "Linked child",
          figappId: null,
        },
  };

  return {
    id: row.id,
    kind: "placed_parent",
    status,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active === true,
    notes: null,
    placementTypeNames: [],
    child: subject,
    household: toHouseholdSummary(household, row.household_id),
  };
}

export function toPlacementFosterCarers(params: {
  carerLinks: HouseholdCarerRow[];
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
}): PlacementFosterCarerDto[] {
  const carers: PlacementFosterCarerDto[] = [];
  for (const link of params.carerLinks) {
    if (!isActiveHouseholdLinkForToday(link)) continue;
    const profile = params.profilesByUserId.get(link.user_id);
    if (!profile) continue;
    carers.push({
      userId: link.user_id,
      displayName: carerDisplayName(profile),
      figappId: profile.figapp_id,
    });
  }
  return carers;
}

export function toPlacementDetailDto(
  item: PlacementListItemDto,
  fosterCarers: PlacementFosterCarerDto[],
): PlacementDetailDto {
  return {
    ...item,
    fosterCarers,
  };
}

export function placementTypesMap(
  rows: PlacementTypeRow[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const name = row.name?.trim();
    if (name) map.set(row.id, name);
  }
  return map;
}
