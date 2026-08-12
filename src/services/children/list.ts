import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveHouseholdIds } from "../../lib/households.js";
import { isBiologicalParentUnder18 } from "../../lib/age.js";
import type {
  ChildrenListDto,
  ChildrenListItemDto,
} from "../../types/children.js";
import {
  toChildListItemDto,
  toPlacedParentListItemDto,
} from "../../mappers/children.js";
import {
  findParentChildPlacementTypeId,
  listActiveBiologicalParentPlacementsByChildIds,
  listBiologicalParentsByIds,
  listChildrenByIds,
} from "../../repositories/children.js";
import {
  getActiveChildPlacements,
  type ActiveChildPlacements,
} from "./shared.js";

async function buildChildItems(
  supabase: SupabaseClient,
  placements: ActiveChildPlacements,
  parentChildTypeId: string | null,
): Promise<{ items: ChildrenListItemDto[]; error: Error | null }> {
  const { childIds, placedSinceByChild } = placements;

  if (childIds.length === 0) {
    return { items: [], error: null };
  }

  const { data: childRows, error } = await listChildrenByIds(
    supabase,
    childIds,
  );

  if (error) {
    return { items: [], error };
  }

  const items = childRows.map((child) => {
    const isParentChildPlacement = parentChildTypeId
      ? (child.placement_type_ids ?? []).includes(parentChildTypeId)
      : false;

    return toChildListItemDto(
      child,
      placedSinceByChild.get(child.id) ?? null,
      isParentChildPlacement,
    );
  });

  return { items, error: null };
}

async function buildPlacedParentItems(
  supabase: SupabaseClient,
  childIds: string[],
): Promise<{ items: ChildrenListItemDto[]; error: Error | null }> {
  if (childIds.length === 0) {
    return { items: [], error: null };
  }

  const { data: parentPlacementRows, error: parentPlacementError } =
    await listActiveBiologicalParentPlacementsByChildIds(supabase, childIds);

  if (parentPlacementError) {
    return { items: [], error: parentPlacementError };
  }

  const activeParentPlacements = parentPlacementRows.filter(
    (row) => !row.end_date && row.biological_parent_id,
  );

  const parentIds = [
    ...new Set(activeParentPlacements.map((row) => row.biological_parent_id)),
  ];

  if (parentIds.length === 0) {
    return { items: [], error: null };
  }

  const { data: parentRows, error: parentsError } =
    await listBiologicalParentsByIds(supabase, parentIds);

  if (parentsError) {
    return { items: [], error: parentsError };
  }

  const parentsById = new Map(
    parentRows.map((parent) => [parent.id, parent]),
  );

  const items: ChildrenListItemDto[] = [];
  const seenParents = new Set<string>();

  for (const row of activeParentPlacements) {
    const parent = parentsById.get(row.biological_parent_id);
    if (!parent?.id) continue;
    if (!isBiologicalParentUnder18(parent.date_of_birth)) continue;

    const key = `${parent.id}:${row.child_id}`;
    if (seenParents.has(key)) continue;
    seenParents.add(key);

    items.push(
      toPlacedParentListItemDto(parent, row.child_id, row.start_date),
    );
  }

  return { items, error: null };
}

function mergeAndSortItems(
  childItems: ChildrenListItemDto[],
  parentItems: ChildrenListItemDto[],
): ChildrenListItemDto[] {
  return [...childItems, ...parentItems].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
}

export async function listChildrenForCarer(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: ChildrenListDto | null; error: Error | null }> {
  const { householdIds, error: householdError } = await getActiveHouseholdIds(
    supabase,
    userId,
  );
  if (householdError) {
    return { data: null, error: householdError };
  }
  if (householdIds.length === 0) {
    return { data: { items: [] }, error: null };
  }

  const { data: parentChildTypeId, error: typeError } =
    await findParentChildPlacementTypeId(supabase);
  if (typeError) {
    return { data: null, error: typeError };
  }

  const { placements, error: placementError } = await getActiveChildPlacements(
    supabase,
    householdIds,
  );
  if (placementError) {
    return { data: null, error: placementError };
  }

  const { items: childItems, error: childrenError } = await buildChildItems(
    supabase,
    placements,
    parentChildTypeId,
  );
  if (childrenError) {
    return { data: null, error: childrenError };
  }

  const { items: parentItems, error: parentsError } =
    await buildPlacedParentItems(supabase, placements.childIds);
  if (parentsError) {
    return { data: null, error: parentsError };
  }

  return {
    data: { items: mergeAndSortItems(childItems, parentItems) },
    error: null,
  };
}
