import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "../../lib/supabase.js";
import { TABLES } from "../../lib/tables.js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";

const ALLOWED_RESTORE_ROLES = new Set(["agency_admin", "app_admin", "super_admin"]);

/**
 * Reverses deleteAccount(): reactivates the target's agency_users row and
 * unbans their Auth login. Nothing was ever destroyed by delete, so this is
 * a full restore, not a recreation. Agency admins may only restore within
 * their own agency; app_admin/super_admin may restore anywhere.
 *
 * callerSupabase must be the caller's own forwarded-JWT client (not service
 * role) so the caller's role/agency lookup is the caller's own RLS-readable
 * row — never trust a client-supplied role.
 */
export async function restoreAccount(
  callerSupabase: SupabaseClient,
  callerUserId: string,
  targetUserId: string,
) {
  if (!targetUserId) {
    return serviceFailure({ badRequest: true });
  }
  if (callerUserId === targetUserId) {
    return serviceFailure({ badRequest: true });
  }

  const { data: caller, error: callerError } = await callerSupabase
    .from(TABLES.AGENCY_USERS)
    .select("role, agency_id, is_active")
    .eq("user_id", callerUserId)
    .maybeSingle();

  if (callerError) {
    return serviceFailure({ error: callerError });
  }
  if (
    !caller ||
    !ALLOWED_RESTORE_ROLES.has(caller.role) ||
    caller.is_active === false
  ) {
    return serviceFailure({ forbidden: true });
  }

  const admin = createServiceRoleClient();

  const { data: target, error: targetError } = await admin
    .from(TABLES.AGENCY_USERS)
    .select("user_id, agency_id, is_archived")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (targetError) {
    return serviceFailure({ error: targetError });
  }
  if (!target) {
    return serviceFailure({ notFound: true });
  }
  if (caller.role === "agency_admin" && caller.agency_id !== target.agency_id) {
    return serviceFailure({ forbidden: true });
  }
  if (!target.is_archived) {
    return serviceFailure({ badRequest: true });
  }

  const now = new Date().toISOString();
  const { error: reactivateError } = await admin
    .from(TABLES.AGENCY_USERS)
    .update({
      is_active: true,
      is_archived: false,
      archived_at: null,
      status: "active",
      updated_at: now,
    })
    .eq("user_id", targetUserId);

  if (reactivateError) {
    return serviceFailure({ error: reactivateError });
  }

  const { error: unbanError } = await admin.auth.admin.updateUserById(
    targetUserId,
    { ban_duration: "none" },
  );

  if (unbanError) {
    return serviceFailure({ error: unbanError });
  }

  return serviceSuccess({ ok: true as const });
}
