import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import {
  deleteEventRow,
  deleteSeriesEvents,
  findEventById,
  listParticipantsForEvents,
} from "../../repositories/calendar.js";
import type { EditScope } from "../../types/calendar.js";
import { canManageEvent } from "./shared.js";

export type DeleteScope = EditScope;

export type DeleteCalendarEventResult =
  | ReturnType<typeof serviceFailure>
  | ReturnType<typeof serviceSuccess<null>>;

/** Deletes a single occurrence, this+future occurrences, or the whole series
 * — matches web EventDetailsDialog deleteScope behavior. */
export async function deleteEventForCarer(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
  deleteScope: DeleteScope = "single",
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

  const scope =
    existing.series_id && deleteScope !== "single" ? deleteScope : "single";

  if (scope === "single" || !existing.series_id) {
    const { error } = await deleteEventRow(supabase, eventId);
    if (error) return serviceFailure({ error });
    return serviceSuccess(null);
  }

  const fromIndex =
    scope === "future" ? existing.occurrence_index : undefined;
  const { error } = await deleteSeriesEvents(
    supabase,
    existing.series_id,
    fromIndex,
  );
  if (error) return serviceFailure({ error });

  return serviceSuccess(null);
}
