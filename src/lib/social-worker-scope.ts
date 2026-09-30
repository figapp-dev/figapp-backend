import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "./tables.js";
import { isActiveHouseholdLinkForToday } from "./placement-status.js";

/**
 * A social_worker's or sw_manager's scope — which foster carers and
 * households they're allowed to see. Ported from the already-proven
 * figapp-new logic in modules/core/utils/swManagerScope.ts (same two
 * columns: agency_users.social_worker_id and agency_users.manager_id),
 * not redesigned — see the sibling figapp-flutter repo's
 * docs/adr-multi-role-mobile-support.md § 2 (that ADR lives in
 * figapp-flutter, not here, since it covers the mobile rollout as a whole).
 *
 * Callers must always pass the forwarded-JWT client (never service role)
 * so RLS still governs what's actually returned, per this repo's
 * JWT-forwarding security pattern.
 */
export type SwManagerScope = {
  fosterCarerUserIds: string[];
  householdIds: string[];
};

/** Foster carer user_ids linked to a social worker via agency_users.social_worker_id OR household_carers.social_worker_id (union, matching web). */
async function resolveFosterCarerUserIds(
  supabase: SupabaseClient,
  socialWorkerUserIds: string[],
): Promise<{ userIds: string[]; error: Error | null }> {
  if (socialWorkerUserIds.length === 0) return { userIds: [], error: null };

  const [agencyRes, householdRes] = await Promise.all([
    supabase
      .from(TABLES.AGENCY_USERS)
      .select("user_id, role, is_active, is_archived")
      .in("social_worker_id", socialWorkerUserIds)
      .eq("role", "foster_carer"),
    supabase
      .from(TABLES.HOUSEHOLD_CARERS)
      .select("user_id, is_active, start_date, end_date")
      .in("social_worker_id", socialWorkerUserIds),
  ]);

  if (agencyRes.error) return { userIds: [], error: agencyRes.error };
  if (householdRes.error) return { userIds: [], error: householdRes.error };

  const userIds = new Set<string>();
  for (const row of agencyRes.data ?? []) {
    const active = row.is_archived !== true && row.is_active !== false;
    if (active && row.user_id) userIds.add(row.user_id as string);
  }
  for (const row of householdRes.data ?? []) {
    if (isActiveHouseholdLinkForToday(row) && row.user_id) {
      userIds.add(row.user_id as string);
    }
  }

  return { userIds: [...userIds], error: null };
}

/** Household ids for a set of foster carer user_ids, via active household_carers links. */
async function resolveHouseholdIdsForCarers(
  supabase: SupabaseClient,
  fosterCarerUserIds: string[],
): Promise<{ householdIds: string[]; error: Error | null }> {
  if (fosterCarerUserIds.length === 0) return { householdIds: [], error: null };

  const { data, error } = await supabase
    .from(TABLES.HOUSEHOLD_CARERS)
    .select("household_id, is_active, start_date, end_date")
    .in("user_id", fosterCarerUserIds);

  if (error) return { householdIds: [], error };

  const householdIds = new Set<string>();
  for (const row of data ?? []) {
    if (isActiveHouseholdLinkForToday(row)) {
      householdIds.add(row.household_id as string);
    }
  }

  return { householdIds: [...householdIds], error: null };
}

/** A single social worker's own scope. */
export async function resolveSocialWorkerScope(
  supabase: SupabaseClient,
  socialWorkerUserId: string,
): Promise<{ scope: SwManagerScope; error: Error | null }> {
  const carerRes = await resolveFosterCarerUserIds(supabase, [socialWorkerUserId]);
  if (carerRes.error) {
    return { scope: { fosterCarerUserIds: [], householdIds: [] }, error: carerRes.error };
  }

  const householdRes = await resolveHouseholdIdsForCarers(supabase, carerRes.userIds);
  if (householdRes.error) {
    return { scope: { fosterCarerUserIds: carerRes.userIds, householdIds: [] }, error: householdRes.error };
  }

  return {
    scope: { fosterCarerUserIds: carerRes.userIds, householdIds: householdRes.householdIds },
    error: null,
  };
}

/**
 * An sw_manager's team scope: manager -> social workers (manager_id) ->
 * foster carers (social_worker_id) -> households.
 */
export async function resolveSwManagerScope(
  supabase: SupabaseClient,
  managerUserId: string,
): Promise<{ scope: SwManagerScope & { socialWorkerUserIds: string[] }; error: Error | null }> {
  const empty = { socialWorkerUserIds: [], fosterCarerUserIds: [], householdIds: [] };

  const { data: swRows, error: swError } = await supabase
    .from(TABLES.AGENCY_USERS)
    .select("user_id")
    .eq("manager_id", managerUserId)
    .eq("role", "social_worker")
    .eq("is_active", true);

  if (swError) return { scope: empty, error: swError };

  const socialWorkerUserIds = (swRows ?? [])
    .map((row) => row.user_id as string | null)
    .filter((id): id is string => Boolean(id));

  if (socialWorkerUserIds.length === 0) {
    return { scope: empty, error: null };
  }

  const carerRes = await resolveFosterCarerUserIds(supabase, socialWorkerUserIds);
  if (carerRes.error) {
    return { scope: { ...empty, socialWorkerUserIds }, error: carerRes.error };
  }

  const householdRes = await resolveHouseholdIdsForCarers(supabase, carerRes.userIds);
  if (householdRes.error) {
    return {
      scope: { socialWorkerUserIds, fosterCarerUserIds: carerRes.userIds, householdIds: [] },
      error: householdRes.error,
    };
  }

  return {
    scope: {
      socialWorkerUserIds,
      fosterCarerUserIds: carerRes.userIds,
      householdIds: householdRes.householdIds,
    },
    error: null,
  };
}

/** Resolves the right scope for whichever of the two roles the caller has. */
export async function resolveScopeForRole(
  supabase: SupabaseClient,
  callerUserId: string,
  role: "social_worker" | "sw_manager",
): Promise<{ scope: SwManagerScope; error: Error | null }> {
  if (role === "sw_manager") {
    const { scope, error } = await resolveSwManagerScope(supabase, callerUserId);
    return { scope: { fosterCarerUserIds: scope.fosterCarerUserIds, householdIds: scope.householdIds }, error };
  }
  return resolveSocialWorkerScope(supabase, callerUserId);
}
