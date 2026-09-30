import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveCallerContext } from "../../lib/caller-context.js";
import { serviceFailure, type ServiceFailureResult } from "../../lib/service-result.js";
import { resolveScopeForRole } from "../../lib/social-worker-scope.js";
import type { SwManagerScope } from "../../lib/social-worker-scope.js";

const SUPERVISORY_ROLES = new Set(["social_worker", "sw_manager"]);

/**
 * Shared entry check for every team-scoped resource (foster-carers now,
 * social-workers in a later increment): caller must be an active
 * social_worker/sw_manager, resolved from their own agency_users row.
 */
export async function resolveSupervisoryScope(
  supabase: SupabaseClient,
  callerUserId: string,
): Promise<{ scope: SwManagerScope | null; failure: ServiceFailureResult | null }> {
  const callerRes = await resolveCallerContext(supabase, callerUserId);
  if (callerRes.error) {
    return { scope: null, failure: serviceFailure({ error: callerRes.error }) };
  }

  const caller = callerRes.data;
  if (!caller || !SUPERVISORY_ROLES.has(caller.role ?? "") || !caller.isActive) {
    return { scope: null, failure: serviceFailure({ forbidden: true }) };
  }

  const role = caller.role as "social_worker" | "sw_manager";
  const { scope, error } = await resolveScopeForRole(supabase, callerUserId, role);
  if (error) {
    return { scope: null, failure: serviceFailure({ error }) };
  }

  return { scope, failure: null };
}
