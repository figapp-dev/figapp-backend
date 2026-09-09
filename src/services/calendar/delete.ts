import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import {
  deleteEventRow,
  findEventById,
  listParticipantsForEvents,
} from "../../repositories/calendar.js";
import { canManageEvent } from "./shared.js";

export type DeleteCalendarEventResult =
  | ReturnType<typeof serviceFailure>
  | ReturnType<typeof serviceSuccess<null>>;

/** Deletes a single occurrence (not the whole series) — same scope as the
 * web app's per-row delete action. */
export async function deleteEventForCarer(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
): Promise<DeleteCalendarEventResult> {
  const { data: existing, error: findError } = await findEventById(
    supabase,
    eventId,
  );
  if (findError) return serviceFailure({ error: findError });
  if (!existing) return serviceFailure({ notFound: true });

  const { data: participants, error: participantsError } =
    await listParticipantsForEvents(supabase, [eventId]);
  if (participantsError) return serviceFailure({ error: participantsError });

  if (!canManageEvent(existing.created_by, userId, participants)) {
    return serviceFailure({ forbidden: true });
  }

  const { error } = await deleteEventRow(supabase, eventId);
  if (error) return serviceFailure({ error });

  return serviceSuccess(null);
}
