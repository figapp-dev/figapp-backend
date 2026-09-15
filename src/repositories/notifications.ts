import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/tables.js";
import type {
  NotificationListFilter,
  NotificationPreferencesRow,
  NotificationRow,
} from "../types/notifications.js";

const NOTIFICATION_SELECT =
  "id, user_id, title, message, type, read_at, action_url, metadata, agency_id, created_at, updated_at";

const PREFS_SELECT =
  "user_id, email_daily_logs, email_ai_insights, email_document_deadlines, email_system_maintenance, email_tasks, email_tickets, email_events, email_surveys, push_urgent_only, push_all";

export async function listNotificationsForUser(
  supabase: SupabaseClient,
  userId: string,
  filter: NotificationListFilter = "all",
): Promise<{ data: NotificationRow[]; error: Error | null }> {
  let query = supabase
    .from(TABLES.NOTIFICATIONS)
    .select(NOTIFICATION_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (filter === "unread") {
    query = query.is("read_at", null);
  }

  const { data, error } = await query;
  return {
    data: (data as NotificationRow[] | null) ?? [],
    error,
  };
}

export async function countUnreadNotifications(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: number; error: Error | null }> {
  const { count, error } = await supabase
    .from(TABLES.NOTIFICATIONS)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  return {
    data: count ?? 0,
    error,
  };
}

export async function markNotificationRead(
  supabase: SupabaseClient,
  userId: string,
  notificationId: string,
): Promise<{ data: NotificationRow | null; error: Error | null; notFound: boolean }> {
  const { data, error } = await supabase
    .from(TABLES.NOTIFICATIONS)
    .update({
      read_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .select(NOTIFICATION_SELECT)
    .maybeSingle();

  return {
    data: (data as NotificationRow | null) ?? null,
    error,
    notFound: !error && !data,
  };
}

export async function markAllNotificationsRead(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: number; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.NOTIFICATIONS)
    .update({
      read_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .is("read_at", null)
    .select("id");

  return {
    data: data?.length ?? 0,
    error,
  };
}

export async function findNotificationPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: NotificationPreferencesRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.NOTIFICATION_PREFERENCES)
    .select(PREFS_SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  return {
    data: (data as NotificationPreferencesRow | null) ?? null,
    error,
  };
}

export async function upsertNotificationPreferences(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
): Promise<{ data: NotificationPreferencesRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.NOTIFICATION_PREFERENCES)
    .upsert(row, { onConflict: "user_id" })
    .select(PREFS_SELECT)
    .single();

  return {
    data: (data as NotificationPreferencesRow | null) ?? null,
    error,
  };
}
