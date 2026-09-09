import type { SupabaseClient } from "@supabase/supabase-js";
import { getTodayUKDateString, toDateOnly } from "../../lib/dates.js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { toEventListItemDto } from "../../mappers/calendar.js";
import {
  listEventsInRange,
  listParticipantsForEvents,
} from "../../repositories/calendar.js";
import type { EventListDto } from "../../types/calendar.js";

export type ListCalendarEventsQuery = {
  from?: string;
  to?: string;
};

function currentUkMonthRange(): { from: string; to: string } {
  const today = getTodayUKDateString();
  const [year, month] = today.split("-").map(Number);
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const to = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { from, to };
}

export type ListCalendarEventsResult =
  | ReturnType<typeof serviceFailure>
  | ReturnType<typeof serviceSuccess<EventListDto>>;

/** RLS already restricts rows to created_by = self OR is_event_participant,
 * so no extra household/access filtering is needed here — see
 * `events_select_participants_only` in the DB. */
export async function listEventsForCarer(
  supabase: SupabaseClient,
  userId: string,
  query: ListCalendarEventsQuery,
): Promise<ListCalendarEventsResult> {
  let fromDate: string;
  let toDate: string;

  if (query.from || query.to) {
    const from = toDateOnly(query.from);
    const to = toDateOnly(query.to);
    if (!from || !to) {
      return serviceFailure({ badRequest: true });
    }
    fromDate = from;
    toDate = to;
  } else {
    const range = currentUkMonthRange();
    fromDate = range.from;
    toDate = range.to;
  }

  const fromIso = new Date(`${fromDate}T00:00:00.000Z`).toISOString();
  const toIso = new Date(`${toDate}T00:00:00.000Z`).toISOString();

  const { data: events, error } = await listEventsInRange(
    supabase,
    fromIso,
    toIso,
  );
  if (error) return serviceFailure({ error });

  const eventIds = events.map((e) => e.id);
  const { data: participants, error: participantsError } =
    await listParticipantsForEvents(supabase, eventIds);
  if (participantsError) return serviceFailure({ error: participantsError });

  const participantsByEvent = new Map<string, typeof participants>();
  for (const p of participants) {
    const arr = participantsByEvent.get(p.event_id) ?? [];
    arr.push(p);
    participantsByEvent.set(p.event_id, arr);
  }

  return serviceSuccess({
    events: events.map((row) =>
      toEventListItemDto(row, userId, participantsByEvent.get(row.id) ?? []),
    ),
  });
}
