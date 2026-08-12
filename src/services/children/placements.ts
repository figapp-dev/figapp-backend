import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveHouseholdIds } from "../../lib/households.js";
import { isBiologicalParentUnder18 } from "../../lib/age.js";
import type { PlacementsDto } from "../../types/children.js";
import { toPlacementHistoryItemDto } from "../../mappers/children.js";
import {
  findBiologicalParentDob,
  listBiologicalParentPlacementHistory,
  listChildPlacementHistory,
} from "../../repositories/children.js";
import { assertChildHasPlacementInCarerHouseholds } from "./shared.js";

async function loadChildPlacementHistory(
  supabase: SupabaseClient,
  childId: string,
  householdIds: string[],
): Promise<{ data: PlacementsDto | null; error: Error | null }> {
  const { allowed, error: accessError } =
    await assertChildHasPlacementInCarerHouseholds(
      supabase,
      childId,
      householdIds,
    );
  if (accessError) {
    return { data: null, error: accessError };
  }
  if (!allowed) {
    return { data: null, error: null };
  }

  const { data: rows, error } = await listChildPlacementHistory(
    supabase,
    childId,
    householdIds,
  );

  if (error) {
    return { data: null, error };
  }

  return {
    data: {
      kind: "child",
      id: childId,
      items: rows.map(toPlacementHistoryItemDto),
    },
    error: null,
  };
}

async function loadPlacedParentPlacementHistory(
  supabase: SupabaseClient,
  parentId: string,
  householdIds: string[],
): Promise<{ data: PlacementsDto | null; error: Error | null }> {
  if (householdIds.length === 0) {
    return { data: null, error: null };
  }

  const { data: placements, error } = await listBiologicalParentPlacementHistory(
    supabase,
    parentId,
    householdIds,
  );

  if (error) {
    return { data: null, error };
  }

  if (placements.length === 0) {
    return { data: null, error: null };
  }

  const { data: parentRow, error: parentError } = await findBiologicalParentDob(
    supabase,
    parentId,
  );

  if (parentError) {
    return { data: null, error: parentError };
  }
  if (!parentRow || !isBiologicalParentUnder18(parentRow.date_of_birth)) {
    return { data: null, error: null };
  }

  return {
    data: {
      kind: "placed_parent",
      id: parentId,
      items: placements.map(toPlacementHistoryItemDto),
    },
    error: null,
  };
}

export async function listPlacementsForCarer(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<{ data: PlacementsDto | null; error: Error | null }> {
  const { householdIds, error: householdError } = await getActiveHouseholdIds(
    supabase,
    userId,
  );
  if (householdError) {
    return { data: null, error: householdError };
  }

  const childResult = await loadChildPlacementHistory(
    supabase,
    id,
    householdIds,
  );
  if (childResult.error) {
    return childResult;
  }
  if (childResult.data) {
    return childResult;
  }

  return loadPlacedParentPlacementHistory(supabase, id, householdIds);
}
