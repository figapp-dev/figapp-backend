import { randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
import { createServiceRoleClient } from "../../lib/supabase.js";
import { TABLES } from "../../lib/tables.js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";

function anonymisedEmail(userId: string): string {
  return `deleted+${userId.replace(/-/g, "")}@deleted.figapp.invalid`;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Soft-close the signed-in user's account for store / GDPR compliance.
 *
 * Does NOT call auth.admin.deleteUser — agency_users and care records
 * (e.g. daily_logs.author_id) CASCADE on auth.users delete. Instead we
 * archive + anonymise the agency_users row, end household memberships,
 * free the login email, and ban the Auth user so they cannot sign in.
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
  const closedEmail = anonymisedEmail(userId);
  const now = new Date().toISOString();

  const { data: existing, error: loadError } = await admin
    .from(TABLES.AGENCY_USERS)
    .select("id, user_id, email, is_archived")
    .eq("user_id", userId)
    .maybeSingle();

  if (loadError) {
    return serviceFailure({ error: loadError });
  }
  if (!existing) {
    return serviceFailure({ notFound: true });
  }

  const { error: archiveError } = await admin
    .from(TABLES.AGENCY_USERS)
    .update({
      email: closedEmail,
      first_name: "Deleted",
      last_name: "User",
      preferred_name: null,
      phone: null,
      date_of_birth: null,
      gender: null,
      position: null,
      job_title: null,
      household_id: null,
      is_active: false,
      is_archived: true,
      archived_at: now,
      status: "archived",
      updated_at: now,
    })
    .eq("user_id", userId);

  if (archiveError) {
    return serviceFailure({ error: archiveError });
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

  const randomPassword = randomBytes(32).toString("base64url");
  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    email: closedEmail,
    password: randomPassword,
    ban_duration: "876600h",
    email_confirm: true,
  });

  if (authError) {
    return serviceFailure({ error: authError });
  }

  return serviceSuccess({ ok: true as const });
}
