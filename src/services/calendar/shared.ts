import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findOwnAgencyId,
  listAgencyUsersByIds,
} from "../../repositories/calendar.js";
import type {
  EventParticipantRow,
  ParticipantProfile,
} from "../../types/calendar.js";

export async function getOwnAgencyId(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ agencyId: string | null; error: Error | null }> {
  const { data, error } = await findOwnAgencyId(supabase, userId);
  if (error) return { agencyId: null, error };
  return { agencyId: data, error: null };
}

/** Resolves participant display name + FigApp ID + agency role (e.g.
 * "social_worker") in one batch query — the agency role is distinct from
 * `EventParticipantRow.role` (organizer/attendee/optional), which is the
 * calendar-specific role. */
export async function buildParticipantProfileMap(
  supabase: SupabaseClient,
  participants: EventParticipantRow[],
): Promise<{ data: Map<string, ParticipantProfile>; error: Error | null }> {
  const userIds = [...new Set(participants.map((p) => p.user_id))];
  const { data, error } = await listAgencyUsersByIds(supabase, userIds);
  if (error) return { data: new Map(), error };

  const map = new Map<string, ParticipantProfile>();
  for (const user of data) {
    const name =
      [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
      "Unnamed user";
    map.set(user.user_id, {
      displayName: name,
      figappId: user.figapp_id,
      profileRole: user.role,
    });
  }
  return { data: map, error: null };
}

/** Self is allowed to edit/delete if they created the event or hold
 * `event_admin_role` on their own participant row — mirrors the same check
 * the RLS policies (`events_agency_user_update`, `events_agency_user_delete`)
 * enforce at the DB layer; this lets the service return a clean 403 instead
 * of a silent no-op update. */
export function canManageEvent(
  createdBy: string | null,
  selfUserId: string,
  participants: EventParticipantRow[],
): boolean {
  if (createdBy === selfUserId) return true;
  return participants.some(
    (p) => p.user_id === selfUserId && p.event_admin_role,
  );
}
