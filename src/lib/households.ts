import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "./tables.js";
import { resolveCallerContext } from "./caller-context.js";
import { isActiveHouseholdLinkForToday } from "./placement-status.js";
import { resolveScopeForRole } from "./social-worker-scope.js";

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

async function resolveCallerRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ role: string | null; error: Error | null }> {
  const { data, error } = await resolveCallerContext(supabase, userId);
  return { role: data?.role ?? null, error };
}

/**
 * Household ids visible to the caller, resolving their role internally
 * (never trust a client-supplied role): foster_carer keeps today's
 * own-household-links behaviour (getCarerHouseholdIds) unchanged;
 * social_worker/sw_manager get their scope's households instead. Wraps
 * getCarerHouseholdIds specifically — see resolveActiveHouseholdIdsForCaller
 * for callers (e.g. children) that historically used getActiveHouseholdIds
 * for their foster_carer branch instead.
 */
export async function resolveHouseholdIdsForCaller(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ householdIds: string[]; role: string | null; error: Error | null }> {
  const { role, error: roleError } = await resolveCallerRole(supabase, userId);
  if (roleError) return { householdIds: [], role: null, error: roleError };

  if (role === "social_worker" || role === "sw_manager") {
    const { scope, error } = await resolveScopeForRole(supabase, userId, role);
    return { householdIds: scope.householdIds, role, error };
  }
  const { householdIds, error } = await getCarerHouseholdIds(supabase, userId);
  return { householdIds, role, error };
}

/**
 * Same role-branching as resolveHouseholdIdsForCaller, but the foster_carer
 * branch uses getActiveHouseholdIds instead of getCarerHouseholdIds —
 * matching what children/list.ts, children/detail.ts and
 * daily-logs/detail.ts already used before this role split.
 */
export async function resolveActiveHouseholdIdsForCaller(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ householdIds: string[]; role: string | null; error: Error | null }> {
  const { role, error: roleError } = await resolveCallerRole(supabase, userId);
  if (roleError) return { householdIds: [], role: null, error: roleError };

  if (role === "social_worker" || role === "sw_manager") {
    const { scope, error } = await resolveScopeForRole(supabase, userId, role);
    return { householdIds: scope.householdIds, role, error };
  }
  const { householdIds, error } = await getActiveHouseholdIds(supabase, userId);
  return { householdIds, role, error };
}
