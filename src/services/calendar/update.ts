import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isValidRecurrencePattern,
  normalizeRecurrencePattern,
  type RecurrencePattern,
} from "../../lib/calendar-recurrence.js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { toEventDetailDto } from "../../mappers/calendar.js";
import {
  deleteParticipantsByIds,
  deleteRemindersForEvents,
  findEventById,
  insertParticipants,
  insertReminders,
  listParticipantsForEvents,
  listRemindersForEvents,
  listSeriesEvents,
  updateEventRow,
  type NewEventRow,
} from "../../repositories/calendar.js";
import type {
  EventDetailDto,
  EventParticipantRow,
  EventRow,
  UpdateEventBody,
} from "../../types/calendar.js";
import { buildParticipantProfileMap, canManageEvent } from "./shared.js";

export type UpdateCalendarEventResult =
  | ReturnType<typeof serviceFailure>
  | ReturnType<typeof serviceSuccess<EventDetailDto>>;

function validateTimes(body: UpdateEventBody): boolean {
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

/** Edits a single occurrence, or shifts every row in the rest of a
 * recurring series by the same start/end delta — mirrors
 * figapp-new/modules/events/components/EditEventDialog.tsx's `editScope`
 * ("single" | "future" | "series") behavior exactly, including the
 * delete-then-reinsert reminder sync and the add/remove participant diff. */
export async function updateEventForCarer(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
  body: UpdateEventBody,
): Promise<UpdateCalendarEventResult> {
  const { data: existing, error: findError } = await findEventById(
    supabase,
    eventId,
  );
  if (findError) return serviceFailure({ error: findError });
  if (!existing) return serviceFailure({ notFound: true });

  const { data: existingParticipants, error: existingParticipantsError } =
    await listParticipantsForEvents(supabase, [eventId]);
  if (existingParticipantsError) {
    return serviceFailure({ error: existingParticipantsError });
  }
  if (!canManageEvent(existing.created_by, userId, existingParticipants)) {
    return serviceFailure({ forbidden: true });
  }

  if (!validateTimes(body)) {
    return serviceFailure({ badRequest: true });
  }
  const pattern = validatePattern(body.recurrencePattern ?? null, body.startDatetime);
  if (pattern === "invalid") {
    return serviceFailure({ badRequest: true });
  }

  const editScope = body.editScope ?? "single";
  const isSeriesEvent = !!existing.series_id;
  const taggedChildIds = [...new Set(body.taggedChildIds ?? [])];

  const targetsResult = await resolveTargets(
    supabase,
    existing,
    isSeriesEvent && editScope !== "single" ? editScope : "single",
  );
  if (targetsResult.error) return serviceFailure({ error: targetsResult.error });
  const targets = targetsResult.data;

  const startDelta =
    Date.parse(body.startDatetime) - Date.parse(existing.start_datetime);
  const endDelta =
    Date.parse(body.endDatetime) - Date.parse(existing.end_datetime);
  const singleScope = !isSeriesEvent || editScope === "single";

  const updateResults = await Promise.all(
    targets.map((target) => {
      const patch: Partial<NewEventRow> = {
        title: body.title,
        description: body.description ?? null,
        event_type: body.eventType,
        location: body.location ?? null,
        is_recurring: pattern !== null,
        recurrence_pattern: pattern,
        tagged_child_ids: taggedChildIds,
        is_series_exception: singleScope ? isSeriesEvent : false,
      };

      if (singleScope && target.id === existing.id) {
        patch.start_datetime = new Date(body.startDatetime).toISOString();
        patch.end_datetime = new Date(body.endDatetime).toISOString();
      } else {
        patch.start_datetime = new Date(
          Date.parse(target.start_datetime) + startDelta,
        ).toISOString();
        patch.end_datetime = new Date(
          Date.parse(target.end_datetime) + endDelta,
        ).toISOString();
      }

      return updateEventRow(supabase, target.id, patch);
    }),
  );
  const updateError = updateResults.find((r) => r.error)?.error;
  if (updateError) return serviceFailure({ error: updateError });

  const targetEventIds = targets.map((t) => t.id);

  const remindersSyncError = await syncReminders(
    supabase,
    targetEventIds,
    body,
    userId,
  );
  if (remindersSyncError) return serviceFailure({ error: remindersSyncError });

  const participantsSyncError = await syncParticipants(
    supabase,
    targetEventIds,
    body.participantUserIds ?? [],
    userId,
  );
  if (participantsSyncError) {
    return serviceFailure({ error: participantsSyncError });
  }

  const [participantsResult, remindersResult] = await Promise.all([
    listParticipantsForEvents(supabase, [eventId]),
    listRemindersForEvents(supabase, [eventId]),
  ]);
  if (participantsResult.error) return serviceFailure({ error: participantsResult.error });
  if (remindersResult.error) return serviceFailure({ error: remindersResult.error });

  const { data: updatedEvent, error: refetchError } = await findEventById(
    supabase,
    eventId,
  );
  if (refetchError) return serviceFailure({ error: refetchError });
  if (!updatedEvent) return serviceFailure({ notFound: true });

  const { data: profileMap, error: profileError } = await buildParticipantProfileMap(
    supabase,
    participantsResult.data,
  );
  if (profileError) return serviceFailure({ error: profileError });

  return serviceSuccess(
    toEventDetailDto(
      updatedEvent,
      userId,
      participantsResult.data,
      profileMap,
      remindersResult.data,
    ),
  );
}

async function resolveTargets(
  supabase: SupabaseClient,
  existing: EventRow,
  scope: "single" | "future" | "series",
): Promise<{ data: EventRow[]; error: Error | null }> {
  if (scope === "single" || !existing.series_id) {
    return { data: [existing], error: null };
  }
  return listSeriesEvents(
    supabase,
    existing.series_id,
    scope === "future" ? existing.occurrence_index : undefined,
  );
}

/** Reminders are fully replaced for every target event, matching
 * syncRemindersForTargetEvents in the web app (delete all, then reinsert
 * the submitted list). */
async function syncReminders(
  supabase: SupabaseClient,
  targetEventIds: string[],
  body: UpdateEventBody,
  userId: string,
): Promise<Error | null> {
  const { error: deleteError } = await deleteRemindersForEvents(
    supabase,
    targetEventIds,
  );
  if (deleteError) return deleteError;

  const reminders = body.reminders ?? [];
  if (reminders.length === 0) return null;

  const { error: insertError } = await insertReminders(
    supabase,
    targetEventIds.flatMap((eventId) =>
      reminders.map((r) => ({
        event_id: eventId,
        offset_number: r.offsetNumber,
        offset_unit: r.offsetUnit,
        label: r.label ?? null,
        created_by: userId,
      })),
    ),
  );
  return insertError;
}

/** Diffs desired participants against existing rows per event so RSVP
 * status is preserved for anyone who stays on the invite list — only
 * additions/removals touch the table, matching
 * syncParticipantsForTargetEvents in the web app. */
async function syncParticipants(
  supabase: SupabaseClient,
  targetEventIds: string[],
  participantUserIds: string[],
  selfUserId: string,
): Promise<Error | null> {
  const desired = new Set(
    participantUserIds.filter((id) => id !== selfUserId),
  );

  const { data: existingRows, error } = await listParticipantsForEvents(
    supabase,
    targetEventIds,
  );
  if (error) return error;

  const byEvent = new Map<string, EventParticipantRow[]>();
  for (const row of existingRows) {
    const arr = byEvent.get(row.event_id) ?? [];
    arr.push(row);
    byEvent.set(row.event_id, arr);
  }

  const toRemoveIds: string[] = [];
  const toAdd: Array<{
    event_id: string;
    user_id: string;
    role: string;
    status: string;
  }> = [];

  for (const eventId of targetEventIds) {
    const rows = byEvent.get(eventId) ?? [];
    const existingUserIds = new Set(rows.map((r) => r.user_id));

    for (const row of rows) {
      if (!desired.has(row.user_id)) toRemoveIds.push(row.id);
    }
    for (const userId of desired) {
      if (!existingUserIds.has(userId)) {
        toAdd.push({
          event_id: eventId,
          user_id: userId,
          role: "attendee",
          status: "pending",
        });
      }
    }
  }

  const { error: removeError } = await deleteParticipantsByIds(
    supabase,
    toRemoveIds,
  );
  if (removeError) return removeError;

  const { error: addError } = await insertParticipants(supabase, toAdd);
  if (addError) return addError;

  return null;
}
