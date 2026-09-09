import type {
  EligibleChildDto,
  EligibleUserDto,
  EventDetailDto,
  EventListItemDto,
  EventParticipantDto,
  EventParticipantRow,
  EventReminderDto,
  EventReminderRow,
  EventRow,
  ParticipantSummaryDto,
} from "../types/calendar.js";

export function summarizeParticipants(
  rows: EventParticipantRow[],
): ParticipantSummaryDto {
  return {
    total: rows.length,
    accepted: rows.filter((r) => r.status === "accepted").length,
    pending: rows.filter((r) => r.status === "pending").length,
    declined: rows.filter((r) => r.status === "declined").length,
    tentative: rows.filter((r) => r.status === "tentative").length,
  };
}

export function toEventListItemDto(
  row: EventRow,
  selfUserId: string,
  participants: EventParticipantRow[],
): EventListItemDto {
  return {
    id: row.id,
    title: row.title,
    eventType: row.event_type,
    startDatetime: row.start_datetime,
    endDatetime: row.end_datetime,
    location: row.location,
    isRecurring: row.is_recurring,
    seriesId: row.series_id,
    occurrenceIndex: row.occurrence_index,
    taggedChildIds: row.tagged_child_ids ?? [],
    createdBy: row.created_by,
    isOwnEvent: row.created_by === selfUserId,
    participantSummary: summarizeParticipants(participants),
  };
}

export function toEventParticipantDto(
  row: EventParticipantRow,
  displayName: string | null,
): EventParticipantDto {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    role: row.role,
    responseAt: row.response_at,
    notes: row.notes,
    isAdmin: row.event_admin_role,
    displayName,
  };
}

export function toEventReminderDto(row: EventReminderRow): EventReminderDto {
  return {
    id: row.id,
    offsetNumber: row.offset_number,
    offsetUnit: row.offset_unit,
    label: row.label,
  };
}

export function toEventDetailDto(
  row: EventRow,
  selfUserId: string,
  participants: EventParticipantRow[],
  participantNamesById: Map<string, string>,
  reminders: EventReminderRow[],
): EventDetailDto {
  const isOwnEvent = row.created_by === selfUserId;
  const isParticipantAdmin = participants.some(
    (p) => p.user_id === selfUserId && p.event_admin_role,
  );

  return {
    ...toEventListItemDto(row, selfUserId, participants),
    description: row.description,
    recurrencePattern: row.recurrence_pattern,
    isSeriesException: row.is_series_exception,
    participants: participants.map((p) =>
      toEventParticipantDto(p, participantNamesById.get(p.user_id) ?? null),
    ),
    reminders: reminders.map(toEventReminderDto),
    canEdit: isOwnEvent || isParticipantAdmin,
    canDelete: isOwnEvent || isParticipantAdmin,
  };
}

export function toEligibleChildDto(child: {
  id: string;
  legal_name: string | null;
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
}): EligibleChildDto {
  const displayName =
    child.preferred_name?.trim() ||
    child.legal_name?.trim() ||
    [child.first_name, child.last_name].filter(Boolean).join(" ").trim() ||
    "Unnamed child";
  return { id: child.id, displayName };
}

export function toEligibleUserDto(user: {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}): EligibleUserDto {
  const displayName =
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    "Unnamed user";
  return { userId: user.user_id, displayName, role: user.role };
}
