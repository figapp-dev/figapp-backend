import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "./tables.js";
import { isActiveHouseholdLinkForToday } from "./placement-status.js";

/** Active household ids for the signed-in user (carer links + profile household). */
export async function getActiveHouseholdIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ householdIds: string[]; error: Error | null }> {
  const [links, profile] = await Promise.all([
    supabase
      .from(TABLES.HOUSEHOLD_CARERS)
      .select("household_id, is_active, start_date, end_date")
      .eq("user_id", userId),
    supabase
      .from(TABLES.AGENCY_USERS)
      .select("household_id")
      .eq("user_id", userId)
      .eq("is_archived", false)
      .maybeSingle(),
  ]);

  if (links.error) {
    return { householdIds: [], error: links.error };
  }
  if (profile.error) {
    return { householdIds: [], error: profile.error };
  }

  const householdIds = new Set<string>();
  for (const row of links.data ?? []) {
    if (isActiveHouseholdLinkForToday(row)) {
      const id = row.household_id as string | null;
      if (id) householdIds.add(id);
    }
  }

  const profileHouseholdId = profile.data?.household_id as string | null;
  if (profileHouseholdId) householdIds.add(profileHouseholdId);

  return { householdIds: [...householdIds], error: null };
}

/** Active household_carers links only — same set the web dashboard uses for log counts. */
export async function getCarerHouseholdIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ householdIds: string[]; error: Error | null }> {
  const links = await supabase
    .from(TABLES.HOUSEHOLD_CARERS)
    .select("household_id, is_active, start_date, end_date")
    .eq("user_id", userId);

  if (links.error) {
    return { householdIds: [], error: links.error };
  }

  const householdIds = new Set<string>();
  for (const row of links.data ?? []) {
    if (isActiveHouseholdLinkForToday(row)) {
      const id = row.household_id as string | null;
      if (id) householdIds.add(id);
    }
  }

  return { householdIds: [...householdIds], error: null };
}
