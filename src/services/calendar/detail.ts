import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { toEventDetailDto } from "../../mappers/calendar.js";
import {
  findEventById,
  listParticipantsForEvents,
  listRemindersForEvents,
} from "../../repositories/calendar.js";
import type { EventDetailDto } from "../../types/calendar.js";
import { buildParticipantNameMap } from "./shared.js";

export type GetCalendarEventResult =
  | ReturnType<typeof serviceFailure>
  | ReturnType<typeof serviceSuccess<EventDetailDto>>;

/** RLS hides rows the caller can't see, so a missing row here means either
 * "doesn't exist" or "not visible to this user" — both correctly surface as
 * 404, not 403, so we don't leak existence of events outside the caller's
 * access. */
export async function getEventForCarer(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
): Promise<GetCalendarEventResult> {
  const { data: event, error } = await findEventById(supabase, eventId);
  if (error) return serviceFailure({ error });
  if (!event) return serviceFailure({ notFound: true });

  const [participantsResult, remindersResult] = await Promise.all([
    listParticipantsForEvents(supabase, [eventId]),
    listRemindersForEvents(supabase, [eventId]),
  ]);
  if (participantsResult.error) {
    return serviceFailure({ error: participantsResult.error });
  }
  if (remindersResult.error) {
    return serviceFailure({ error: remindersResult.error });
  }

  const { data: nameMap, error: nameError } = await buildParticipantNameMap(
    supabase,
    participantsResult.data,
  );
  if (nameError) return serviceFailure({ error: nameError });

  return serviceSuccess(
    toEventDetailDto(
      event,
      userId,
      participantsResult.data,
      nameMap,
      remindersResult.data,
    ),
  );
}
