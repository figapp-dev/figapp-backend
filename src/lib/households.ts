import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "./tables.js";

/** Active household ids for a carer (household_carers.is_active = true). */
export async function getActiveHouseholdIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ householdIds: string[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.HOUSEHOLD_CARERS)
    .select("household_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    return { householdIds: [], error };
  }

  const householdIds = (data ?? [])
    .map((row) => row.household_id as string)
    .filter(Boolean);

  return { householdIds, error: null };
}
