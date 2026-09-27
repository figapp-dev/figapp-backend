import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/tables.js";

export type AgencyUserRoleRow = {
  user_id: string;
  agency_id: string;
  role: string;
  is_active: boolean | null;
};

export async function findAgencyUserRoleByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: AgencyUserRoleRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.AGENCY_USERS)
    .select("user_id, agency_id, role, is_active")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .maybeSingle();

  return { data: (data as AgencyUserRoleRow | null) ?? null, error };
}

export async function countTodayAdminChatQuestions(
  supabase: SupabaseClient,
  userId: string,
  sinceIso: string,
): Promise<{ count: number; error: Error | null }> {
  const { count, error } = await supabase
    .from(TABLES.ADMIN_CHAT_LOGS)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", sinceIso);

  return { count: count ?? 0, error };
}

export type AdminChatLogInsert = {
  agency_id: string;
  user_id: string;
  question: string;
  matched_table: string | null;
  matched_aggregation: string | null;
  matched_query: Record<string, unknown> | null;
  answer: string | null;
  error: string | null;
};

export async function insertAdminChatLog(
  supabase: SupabaseClient,
  row: AdminChatLogInsert,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from(TABLES.ADMIN_CHAT_LOGS).insert(row);
  return { error };
}

export type AllowlistedDateRange = {
  column: string;
  from: string;
  to: string;
};

/**
 * Generic allowlisted-table access. Table name, column names, and filter
 * keys must already be validated against the schema catalog by the caller
 * (services/admin-chat/query-validator.ts) — this function trusts its inputs.
 */
export async function countAllowlistedRows(
  supabase: SupabaseClient,
  table: string,
  filters: Record<string, string | number | boolean>,
  dateRange?: AllowlistedDateRange,
): Promise<{ count: number; error: Error | null }> {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }
  if (dateRange) {
    query = query.gte(dateRange.column, dateRange.from).lte(dateRange.column, dateRange.to);
  }
  const { count, error } = await query;
  return { count: count ?? 0, error };
}

export async function listAllowlistedRows(
  supabase: SupabaseClient,
  table: string,
  columns: string[],
  filters: Record<string, string | number | boolean>,
  limit: number,
  dateRange?: AllowlistedDateRange,
): Promise<{ data: Record<string, unknown>[]; error: Error | null }> {
  let query = supabase.from(table).select(columns.join(",")).limit(limit);
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }
  if (dateRange) {
    query = query.gte(dateRange.column, dateRange.from).lte(dateRange.column, dateRange.to);
  }
  const { data, error } = await query;
  return { data: (data as Record<string, unknown>[] | null) ?? [], error };
}
