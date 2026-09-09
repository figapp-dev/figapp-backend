import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  expandRecurrence,
  isValidRecurrencePattern,
  normalizeRecurrencePattern,
  type RecurrencePattern,
} from "../../lib/calendar-recurrence.js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { toEventDetailDto } from "../../mappers/calendar.js";
import {
  findOwnAgencyId,
  insertEvents,
  insertParticipants,
  insertReminders,
  listParticipantsForEvents,
  listRemindersForEvents,
  type NewEventRow,
} from "../../repositories/calendar.js";
import type { CreateEventBody, EventDetailDto } from "../../types/calendar.js";
import { buildParticipantNameMap } from "./shared.js";

export type CreateCalendarEventResult =
  | ReturnType<typeof serviceFailure>
  | ReturnType<typeof serviceSuccess<EventDetailDto>>;

function validateTimes(body: CreateEventBody): boolean {
  const start = Date.parse(body.startDatetime);
  const end = Date.parse(body.endDatetime);
  return !Number.isNaN(start) && !Number.isNaN(end) && end > start;
}

function validatePattern(
  pattern: RecurrencePattern | null | undefined,
  startDatetime: string,
): RecurrencePattern | null | "invalid" {
  if (!pattern) return null;
  if (!isValidRecurrencePattern(pattern)) return "invalid";

  const normalized = normalizeRecurrencePattern(pattern);
  if (normalized.repeat.end.type === "until") {
    const untilMs = Date.parse(normalized.repeat.end.until);
    const startMs = Date.parse(startDatetime);
    if (Number.isNaN(untilMs) || untilMs < startMs) return "invalid";
  }
  return normalized;
}

/** Creates an event, expanding a recurrence pattern into individual `events`
 * rows up front (mirrors the web app's client-side expansion). Returns the
 * detail DTO for the first occurrence. */
export async function createEventForCarer(
  supabase: SupabaseClient,
  userId: string,
  body: CreateEventBody,
): Promise<CreateCalendarEventResult> {
  if (!validateTimes(body)) {
    return serviceFailure({ badRequest: true });
  }

  const pattern = validatePattern(body.recurrencePattern ?? null, body.startDatetime);
  if (pattern === "invalid") {
    return serviceFailure({ badRequest: true });
  }

  const { data: agencyId, error: agencyError } = await findOwnAgencyId(
    supabase,
    userId,
  );
  if (agencyError) return serviceFailure({ error: agencyError });
  if (!agencyId) return serviceFailure({ forbidden: true });

  const occurrences = expandRecurrence(
    body.startDatetime,
    body.endDatetime,
    pattern,
  );
  const seriesId = pattern ? randomUUID() : null;
  const taggedChildIds = [...new Set(body.taggedChildIds ?? [])];

  const rows: NewEventRow[] = occurrences.map((occurrence) => ({
    agency_id: agencyId,
    title: body.title,
    description: body.description ?? null,
    start_datetime: occurrence.startDatetime,
    end_datetime: occurrence.endDatetime,
    location: body.location ?? null,
    event_type: body.eventType,
    created_by: userId,
    is_recurring: pattern !== null,
    recurrence_pattern: pattern,
    series_id: seriesId,
    occurrence_index: occurrence.occurrenceIndex,
    is_series_exception: false,
    tagged_child_ids: taggedChildIds,
  }));

  const { data: inserted, error: insertError } = await insertEvents(
    supabase,
    rows,
  );
  if (insertError) return serviceFailure({ error: insertError });
  if (inserted.length === 0) return serviceFailure({ error: new Error("Insert returned no rows") });

  const eventIds = inserted.map((e) => e.id);
  const reminders = body.reminders ?? [];
  const participantUserIds = [
    ...new Set((body.participantUserIds ?? []).filter((id) => id !== userId)),
  ];

  const [remindersResult, participantsResult] = await Promise.all([
    insertReminders(
      supabase,
      eventIds.flatMap((eventId) =>
        reminders.map((r) => ({
          event_id: eventId,
          offset_number: r.offsetNumber,
          offset_unit: r.offsetUnit,
          label: r.label ?? null,
          created_by: userId,
        })),
      ),
    ),
    insertParticipants(
      supabase,
      eventIds.flatMap((eventId) =>
        participantUserIds.map((participantUserId) => ({
          event_id: eventId,
          user_id: participantUserId,
          role: "attendee",
          status: "pending",
        })),
      ),
    ),
  ]);
  if (remindersResult.error) return serviceFailure({ error: remindersResult.error });
  if (participantsResult.error) return serviceFailure({ error: participantsResult.error });

  const primary = inserted[0];
  const [primaryParticipants, primaryReminders] = await Promise.all([
    listParticipantsForEvents(supabase, [primary.id]),
    listRemindersForEvents(supabase, [primary.id]),
  ]);
  if (primaryParticipants.error) return serviceFailure({ error: primaryParticipants.error });
  if (primaryReminders.error) return serviceFailure({ error: primaryReminders.error });

  const { data: nameMap, error: nameError } = await buildParticipantNameMap(
    supabase,
    primaryParticipants.data,
  );
  if (nameError) return serviceFailure({ error: nameError });

  return serviceSuccess(
    toEventDetailDto(
      primary,
      userId,
      primaryParticipants.data,
      nameMap,
      primaryReminders.data,
    ),
  );
}
