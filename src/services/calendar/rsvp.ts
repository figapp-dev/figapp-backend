import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { toEventParticipantDto } from "../../mappers/calendar.js";
import {
  findOwnParticipantRow,
  listAgencyUsersByIds,
  updateParticipantStatus,
} from "../../repositories/calendar.js";
import type { EventParticipantDto, RsvpStatus } from "../../types/calendar.js";

export type RsvpToCalendarEventResult =
  | ReturnType<typeof serviceFailure>
  | ReturnType<typeof serviceSuccess<EventParticipantDto>>;

/** Self accepts/declines/tentatively-responds to an event they're invited
 * to — updates only the caller's own `event_participants` row, matching the
 * `event_participants_self_manage` RLS policy. */
export async function rsvpToEventForCarer(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
  status: RsvpStatus,
): Promise<RsvpToCalendarEventResult> {
  const { data: participant, error: findError } = await findOwnParticipantRow(
    supabase,
    eventId,
    userId,
  );
  if (findError) return serviceFailure({ error: findError });
  if (!participant) return serviceFailure({ notFound: true });

  const { data: updated, error: updateError } = await updateParticipantStatus(
    supabase,
    participant.id,
    status,
    new Date().toISOString(),
  );
  if (updateError) return serviceFailure({ error: updateError });
  if (!updated) return serviceFailure({ notFound: true });

  const { data: users, error: usersError } = await listAgencyUsersByIds(
    supabase,
    [userId],
  );
  if (usersError) return serviceFailure({ error: usersError });

  const self = users[0];
  const profile = self
    ? {
        displayName:
          [self.first_name, self.last_name].filter(Boolean).join(" ").trim() ||
          "Unnamed user",
        figappId: self.figapp_id,
        profileRole: self.role,
      }
    : null;

  return serviceSuccess(toEventParticipantDto(updated, profile));
}
