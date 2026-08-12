import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveHouseholdIds } from "../../lib/households.js";
import { findAssignmentAccessForHouseholds } from "../../repositories/daily-logs.js";

export type DailyLogAssignmentAccess = {
  id: string;
  child_id: string | null;
  biological_parent_id: string | null;
  household_id: string | null;
};

export async function getDailyLogAssignmentForCarer(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<{
  assignment: DailyLogAssignmentAccess | null;
  error: Error | null;
  forbidden: boolean;
}> {
  const { householdIds, error: householdError } = await getActiveHouseholdIds(
    supabase,
    userId,
  );
  if (householdError) {
    return { assignment: null, error: householdError, forbidden: false };
  }
  if (householdIds.length === 0) {
    return { assignment: null, error: null, forbidden: true };
  }

  const { data, error } = await findAssignmentAccessForHouseholds(
    supabase,
    id,
    householdIds,
  );

  if (error) {
    return { assignment: null, error, forbidden: false };
  }
  if (!data) {
    return { assignment: null, error: null, forbidden: true };
  }

  return {
    assignment: data,
    error: null,
    forbidden: false,
  };
}
