import type { RecurrencePattern } from "../lib/calendar-recurrence.js";

export type { RecurrencePattern } from "../lib/calendar-recurrence.js";

/** Mirrors the `events_event_type_check` constraint. */
export type EventType =
  | "meeting"
  | "visit"
  | "appointment"
  | "training"
  | "court"
  | "activity"
  | "other";

/** Mirrors `event_participants_role_check`. */
export type EventParticipantRole = "organizer" | "attendee" | "optional";

/** Mirrors `event_participants_status_check`. */
export type EventParticipantStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "tentative";

/** Mirrors `event_reminders_offset_unit_check`. */
export type ReminderOffsetUnit = "minutes" | "hours" | "days";

export type EventRow = {
  id: string;
  agency_id: string | null;
  title: string;
  description: string | null;
  start_datetime: string;
  end_datetime: string;
  location: string | null;
  event_type: EventType;
  created_by: string | null;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  created_at: string;
  updated_at: string;
  series_id: string | null;
  occurrence_index: number;
  is_series_exception: boolean;
  tagged_child_ids: string[];
};

export type EventParticipantRow = {
  id: string;
  event_id: string;
  user_id: string;
  status: EventParticipantStatus;
  role: EventParticipantRole;
  response_at: string | null;
  notes: string | null;
  created_at: string;
  event_admin_role: boolean;
};

export type EventReminderRow = {
  id: string;
  event_id: string;
  offset_number: number;
  offset_unit: ReminderOffsetUnit;
  label: string | null;
  created_at: string;
  created_by: string | null;
};

export type EventParticipantDto = {
  id: string;
  userId: string;
  status: EventParticipantStatus;
  role: EventParticipantRole;
  responseAt: string | null;
  notes: string | null;
  isAdmin: boolean;
  displayName: string | null;
};

export type EventReminderDto = {
  id: string;
  offsetNumber: number;
  offsetUnit: ReminderOffsetUnit;
  label: string | null;
};

export type ParticipantSummaryDto = {
  total: number;
  accepted: number;
  pending: number;
  declined: number;
  tentative: number;
};

export type EventListItemDto = {
  id: string;
  title: string;
  eventType: EventType;
  startDatetime: string;
  endDatetime: string;
  location: string | null;
  isRecurring: boolean;
  seriesId: string | null;
  occurrenceIndex: number;
  taggedChildIds: string[];
  createdBy: string | null;
  isOwnEvent: boolean;
  participantSummary: ParticipantSummaryDto;
};

export type EventDetailDto = EventListItemDto & {
  description: string | null;
  recurrencePattern: RecurrencePattern | null;
  isSeriesException: boolean;
  participants: EventParticipantDto[];
  reminders: EventReminderDto[];
  canEdit: boolean;
  canDelete: boolean;
};

export type EventListDto = {
  events: EventListItemDto[];
};

export type EligibleChildDto = {
  id: string;
  displayName: string;
};

export type EligibleUserDto = {
  userId: string;
  displayName: string;
  role: string;
};

export type EligibleParticipantsDto = {
  children: EligibleChildDto[];
  linkedCarers: EligibleUserDto[];
  socialWorkers: EligibleUserDto[];
};

export type CreateEventReminderInput = {
  offsetNumber: number;
  offsetUnit: ReminderOffsetUnit;
  label?: string | null;
};

export type CreateEventBody = {
  title: string;
  description?: string | null;
  eventType: EventType;
  location?: string | null;
  startDatetime: string;
  endDatetime: string;
  taggedChildIds?: string[];
  participantUserIds?: string[];
  reminders?: CreateEventReminderInput[];
  recurrencePattern?: RecurrencePattern | null;
};

export type EditScope = "single" | "future" | "series";

export type UpdateEventBody = CreateEventBody & {
  editScope?: EditScope;
};

export type RsvpStatus = Extract<
  EventParticipantStatus,
  "accepted" | "declined" | "tentative"
>;

export type RsvpBody = {
  status: RsvpStatus;
};
