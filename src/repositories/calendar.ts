import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/tables.js";
import type {
  EventParticipantRow,
  EventReminderRow,
  EventRow,
} from "../types/calendar.js";

const EVENT_SELECT = `
  id, agency_id, title, description, start_datetime, end_datetime, location,
  event_type, created_by, is_recurring, recurrence_pattern, created_at,
  updated_at, series_id, occurrence_index, is_series_exception, tagged_child_ids
`;

/** RLS (`events_select_participants_only`) already restricts rows to
 * created_by = self OR is_event_participant — no extra filtering needed here. */
export async function listEventsInRange(
  supabase: SupabaseClient,
  fromIso: string,
  toIso: string,
): Promise<{ data: EventRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.EVENTS)
    .select(EVENT_SELECT)
    .gte("start_datetime", fromIso)
    .lt("start_datetime", toIso)
    .order("start_datetime", { ascending: true });

  if (error) return { data: [], error };
  return { data: (data ?? []) as EventRow[], error: null };
}

export async function findEventById(
  supabase: SupabaseClient,
  id: string,
): Promise<{ data: EventRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.EVENTS)
    .select(EVENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) return { data: null, error };
  return { data: (data as EventRow | null) ?? null, error: null };
}

export async function listSeriesEvents(
  supabase: SupabaseClient,
  seriesId: string,
  fromOccurrenceIndex?: number,
): Promise<{ data: EventRow[]; error: Error | null }> {
  let query = supabase
    .from(TABLES.EVENTS)
    .select(EVENT_SELECT)
    .eq("series_id", seriesId)
    .order("occurrence_index", { ascending: true });

  if (fromOccurrenceIndex !== undefined) {
    query = query.gte("occurrence_index", fromOccurrenceIndex);
  }

  const { data, error } = await query;
  if (error) return { data: [], error };
  return { data: (data ?? []) as EventRow[], error: null };
}

export type NewEventRow = Omit<
  EventRow,
  "id" | "created_at" | "updated_at"
>;

export async function insertEvents(
  supabase: SupabaseClient,
  rows: NewEventRow[],
): Promise<{ data: EventRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.EVENTS)
    .insert(rows)
    .select(EVENT_SELECT);

  if (error) return { data: [], error };
  return { data: (data ?? []) as EventRow[], error: null };
}

export async function updateEventRow(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<NewEventRow>,
): Promise<{ data: EventRow | null; error: Error | null }> {
  // No DB trigger bumps `updated_at` on this table, so every write path
  // through this function stamps it explicitly.
  const { data, error } = await supabase
    .from(TABLES.EVENTS)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(EVENT_SELECT)
    .maybeSingle();

  if (error) return { data: null, error };
  return { data: (data as EventRow | null) ?? null, error: null };
}

export async function deleteEventRow(
  supabase: SupabaseClient,
  id: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from(TABLES.EVENTS).delete().eq("id", id);
  return { error };
}

const PARTICIPANT_SELECT =
  "id, event_id, user_id, status, role, response_at, notes, created_at, event_admin_role";

export async function listParticipantsForEvents(
  supabase: SupabaseClient,
  eventIds: string[],
): Promise<{ data: EventParticipantRow[]; error: Error | null }> {
  if (eventIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLES.EVENT_PARTICIPANTS)
    .select(PARTICIPANT_SELECT)
    .in("event_id", eventIds);

  if (error) return { data: [], error };
  return { data: (data ?? []) as EventParticipantRow[], error: null };
}

export async function insertParticipants(
  supabase: SupabaseClient,
  rows: Array<{
    event_id: string;
    user_id: string;
    role: string;
    status: string;
  }>,
): Promise<{ error: Error | null }> {
  if (rows.length === 0) return { error: null };
  const { error } = await supabase.from(TABLES.EVENT_PARTICIPANTS).insert(rows);
  return { error };
}

export async function deleteParticipantsByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<{ error: Error | null }> {
  if (ids.length === 0) return { error: null };
  const { error } = await supabase
    .from(TABLES.EVENT_PARTICIPANTS)
    .delete()
    .in("id", ids);
  return { error };
}

export async function deleteParticipantsForEvents(
  supabase: SupabaseClient,
  eventIds: string[],
): Promise<{ error: Error | null }> {
  if (eventIds.length === 0) return { error: null };
  const { error } = await supabase
    .from(TABLES.EVENT_PARTICIPANTS)
    .delete()
    .in("event_id", eventIds);
  return { error };
}

export async function findOwnParticipantRow(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<{ data: EventParticipantRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.EVENT_PARTICIPANTS)
    .select(PARTICIPANT_SELECT)
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { data: null, error };
  return { data: (data as EventParticipantRow | null) ?? null, error: null };
}

export async function updateParticipantStatus(
  supabase: SupabaseClient,
  participantId: string,
  status: string,
  responseAt: string,
): Promise<{ data: EventParticipantRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.EVENT_PARTICIPANTS)
    .update({ status, response_at: responseAt })
    .eq("id", participantId)
    .select(PARTICIPANT_SELECT)
    .maybeSingle();

  if (error) return { data: null, error };
  return { data: (data as EventParticipantRow | null) ?? null, error: null };
}

const REMINDER_SELECT = "id, event_id, offset_number, offset_unit, label, created_at, created_by";

export async function listRemindersForEvents(
  supabase: SupabaseClient,
  eventIds: string[],
): Promise<{ data: EventReminderRow[]; error: Error | null }> {
  if (eventIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLES.EVENT_REMINDERS)
    .select(REMINDER_SELECT)
    .in("event_id", eventIds);

  if (error) return { data: [], error };
  return { data: (data ?? []) as EventReminderRow[], error: null };
}

export async function insertReminders(
  supabase: SupabaseClient,
  rows: Array<{
    event_id: string;
    offset_number: number;
    offset_unit: string;
    label: string | null;
    created_by: string;
  }>,
): Promise<{ error: Error | null }> {
  if (rows.length === 0) return { error: null };
  const { error } = await supabase.from(TABLES.EVENT_REMINDERS).insert(rows);
  return { error };
}

export async function deleteRemindersForEvents(
  supabase: SupabaseClient,
  eventIds: string[],
): Promise<{ error: Error | null }> {
  if (eventIds.length === 0) return { error: null };
  const { error } = await supabase
    .from(TABLES.EVENT_REMINDERS)
    .delete()
    .in("event_id", eventIds);
  return { error };
}

export async function findOwnAgencyId(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.AGENCY_USERS)
    .select("agency_id")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .maybeSingle();

  if (error) return { data: null, error };
  return {
    data: (data as { agency_id: string | null } | null)?.agency_id ?? null,
    error: null,
  };
}

export type AgencyUserRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
};

export async function listAgencyUsersByIds(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<{ data: AgencyUserRow[]; error: Error | null }> {
  if (userIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLES.AGENCY_USERS)
    .select("user_id, first_name, last_name, role")
    .in("user_id", userIds);

  if (error) return { data: [], error };
  return { data: (data ?? []) as AgencyUserRow[], error: null };
}

export async function listAgencyUsersByRole(
  supabase: SupabaseClient,
  agencyId: string,
  userIds: string[],
  roles: string[],
): Promise<{ data: AgencyUserRow[]; error: Error | null }> {
  if (userIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLES.AGENCY_USERS)
    .select("user_id, first_name, last_name, role")
    .eq("agency_id", agencyId)
    .eq("is_active", true)
    .in("user_id", userIds)
    .in("role", roles)
    .order("first_name");

  if (error) return { data: [], error };
  return { data: (data ?? []) as AgencyUserRow[], error: null };
}

export async function listOtherActiveHouseholdCarerUserIds(
  supabase: SupabaseClient,
  householdIds: string[],
  excludeUserId: string,
): Promise<{ data: string[]; error: Error | null }> {
  if (householdIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLES.HOUSEHOLD_CARERS)
    .select("user_id")
    .in("household_id", householdIds)
    .eq("is_active", true)
    .neq("user_id", excludeUserId);

  if (error) return { data: [], error };
  return {
    data: [...new Set((data ?? []).map((r) => (r as { user_id: string }).user_id))],
    error: null,
  };
}

export async function listHouseholdCarerLinksForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  data: Array<{ household_id: string; social_worker_id: string | null }>;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from(TABLES.HOUSEHOLD_CARERS)
    .select("household_id, social_worker_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) return { data: [], error };
  return {
    data: (data ?? []) as Array<{
      household_id: string;
      social_worker_id: string | null;
    }>,
    error: null,
  };
}

export async function listSocialWorkerIdsForChildren(
  supabase: SupabaseClient,
  childIds: string[],
): Promise<{ data: string[]; error: Error | null }> {
  if (childIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLES.CHILDREN)
    .select("id, social_worker_id")
    .in("id", childIds);

  if (error) return { data: [], error };
  return {
    data: [
      ...new Set(
        (data ?? [])
          .map((r) => (r as { social_worker_id: string | null }).social_worker_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ],
    error: null,
  };
}
