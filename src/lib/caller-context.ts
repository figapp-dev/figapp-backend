import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "./tables.js";

export type CallerContext = {
  role: string | null;
  agencyId: string | null;
  isActive: boolean;
};

/**
 * Resolves the caller's own role/agency from their own agency_users row,
 * via their forwarded JWT client — never trust a client-supplied role.
 * Shared across resources that need role-branching (team-dashboard,
 * foster-carers, social-workers), following the same lookup already
 * duplicated per-resource in admin-chat/billing/surveys.
 */
export async function resolveCallerContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: CallerContext | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.AGENCY_USERS)
    .select("role, agency_id, is_active")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!data) return { data: null, error: null };

  const row = data as { role: string | null; agency_id: string | null; is_active: boolean | null };
  return {
    data: {
      role: row.role ?? null,
      agencyId: row.agency_id ?? null,
      isActive: row.is_active !== false,
    },
    error: null,
  };
}
