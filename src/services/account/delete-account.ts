import { env } from "../../config/env.js";
import { createServiceRoleClient } from "../../lib/supabase.js";
import { TABLES } from "../../lib/tables.js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Deactivate the signed-in user's account (App Store / Play Store require an
 * in-app account-deletion path). This is a reversible flag, not an erasure:
 * no profile fields are changed, login is blocked, and household membership
 * ends. An agency admin can restore it later (see restore-account.ts) after
 * confirming with the person — this is disclosed to the user in the app's
 * delete-account confirmation copy, not a hidden behavior.
 *
 * Does NOT call auth.admin.deleteUser — agency_users and care records (e.g.
 * daily_logs.author_id) CASCADE on auth.users delete, which would destroy
 * legally-retained safeguarding records.
 */
export async function deleteAccount(userId: string) {
  if (!userId) {
    return serviceFailure({ badRequest: true });
  }
  if (!env.supabaseServiceRoleKey) {
    return serviceFailure({
      error: new Error("SUPABASE_SERVICE_ROLE_KEY is not configured"),
    });
  }

  const admin = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data: existing, error: loadError } = await admin
    .from(TABLES.AGENCY_USERS)
    .select("id, user_id, is_archived")
    .eq("user_id", userId)
    .maybeSingle();

  if (loadError) {
    return serviceFailure({ error: loadError });
  }
  if (!existing) {
    return serviceFailure({ notFound: true });
  }

  const { error: deactivateError } = await admin
    .from(TABLES.AGENCY_USERS)
    .update({
      household_id: null,
      is_active: false,
      is_archived: true,
      archived_at: now,
      status: "archived",
      updated_at: now,
    })
    .eq("user_id", userId);

  if (deactivateError) {
    return serviceFailure({ error: deactivateError });
  }

  const { error: householdError } = await admin
    .from(TABLES.HOUSEHOLD_CARERS)
    .update({
      is_active: false,
      end_date: todayIsoDate(),
      updated_at: now,
    })
    .eq("user_id", userId)
    .eq("is_active", true);

  if (householdError) {
    return serviceFailure({ error: householdError });
  }

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "876600h",
  });

  if (authError) {
    return serviceFailure({ error: authError });
  }

  return serviceSuccess({ ok: true as const });
}
