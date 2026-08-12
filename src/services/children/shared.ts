import type { SupabaseClient } from "@supabase/supabase-js";
import type { HouseholdChildRow } from "../../types/children.js";
import {
  findActiveChildPlacementAccess,
  findAnyChildPlacementAccess,
  listActiveHouseholdChildPlacements,
} from "../../repositories/children.js";

export type ActiveChildPlacements = {
  childIds: string[];
  placedSinceByChild: Map<string, string | null>;
};

export function toActiveChildPlacements(
  activePlacements: HouseholdChildRow[],
): ActiveChildPlacements {
  const childIds = [...new Set(activePlacements.map((row) => row.child_id))];

  const placedSinceByChild = new Map<string, string | null>();
  for (const row of activePlacements) {
    if (!placedSinceByChild.has(row.child_id)) {
      placedSinceByChild.set(row.child_id, row.start_date);
    }
  }

  return { childIds, placedSinceByChild };
}

export async function getActiveChildPlacements(
  supabase: SupabaseClient,
  householdIds: string[],
): Promise<{ placements: ActiveChildPlacements; error: Error | null }> {
  const empty: ActiveChildPlacements = {
    childIds: [],
    placedSinceByChild: new Map(),
  };

  const { data, error } = await listActiveHouseholdChildPlacements(
    supabase,
    householdIds,
  );

  if (error) {
    return { placements: empty, error };
  }

  return { placements: toActiveChildPlacements(data), error: null };
}

export async function assertChildAccessibleToCarer(
  supabase: SupabaseClient,
  childId: string,
  householdIds: string[],
): Promise<{ allowed: boolean; error: Error | null }> {
  if (householdIds.length === 0) {
    return { allowed: false, error: null };
  }

  const { data, error } = await findActiveChildPlacementAccess(
    supabase,
    childId,
    householdIds,
  );

  if (error) {
    return { allowed: false, error };
  }

  return { allowed: !!data, error: null };
}

/** Any placement (active or ended) in the carer's households. */
export async function assertChildHasPlacementInCarerHouseholds(
  supabase: SupabaseClient,
  childId: string,
  householdIds: string[],
): Promise<{ allowed: boolean; error: Error | null }> {
  if (householdIds.length === 0) {
    return { allowed: false, error: null };
  }

  const { data, error } = await findAnyChildPlacementAccess(
    supabase,
    childId,
    householdIds,
  );

  if (error) {
    return { allowed: false, error };
  }

  return { allowed: !!data, error: null };
}
