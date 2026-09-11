import type { CreateEventBody, RsvpBody, UpdateEventBody } from "../types/calendar.js";

const EVENT_TYPES = [
  "meeting",
  "visit",
  "appointment",
  "training",
  "court",
  "activity",
  "other",
] as const;

const reminderSchema = {
  type: "object",
  required: ["offsetNumber", "offsetUnit"],
  additionalProperties: false,
  properties: {
    offsetNumber: { type: "integer", minimum: 0 },
    offsetUnit: { type: "string", enum: ["minutes", "hours", "days"] },
    label: { type: "string", nullable: true },
  },
} as const;

const recurrencePatternSchema = {
  type: "object",
  required: ["repeat"],
  additionalProperties: false,
  properties: {
    repeat: {
      type: "object",
      required: ["every", "unit", "end"],
      additionalProperties: false,
      properties: {
        every: { type: "integer", minimum: 1 },
        unit: { type: "string", enum: ["days", "weeks", "months", "years"] },
        // Fastify 5 / Ajv draft-2020 rejects `oneOf` + `const` for the
        // "after"/"until" branches (count is treated as missing). Use a flat
        // enum shape here; create/update still enforce count/until via
        // validateRecurrencePattern in calendar-recurrence.ts.
        end: {
          type: "object",
          required: ["type"],
          additionalProperties: false,
          properties: {
            type: { type: "string", enum: ["never", "after", "until"] },
            count: { type: "integer", minimum: 1 },
            until: { type: "string" },
          },
        },
      },
    },
  },
} as const;

/** POST /calendar/events. `taggedChildIds` are scheduling-context tags only
 * (stored on `events.tagged_child_ids`) — not invited as `event_participants`,
 * matching the DB column comment. `participantUserIds` (linked carers /
 * social workers) each get an `event_participants` row, status "pending". */
export const createEventBodySchema = {
  type: "object",
  required: ["title", "eventType", "startDatetime", "endDatetime"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1 },
    description: { type: "string", nullable: true },
    eventType: { type: "string", enum: EVENT_TYPES },
    location: { type: "string", nullable: true },
    startDatetime: { type: "string" },
    endDatetime: { type: "string" },
    taggedChildIds: { type: "array", items: { type: "string" } },
    participantUserIds: { type: "array", items: { type: "string" } },
    reminders: { type: "array", items: reminderSchema },
    recurrencePattern: {
      anyOf: [recurrencePatternSchema, { type: "null" }],
    },
  },
} as const;

/** PUT /calendar/events/:id. `editScope` (default "single") controls how a
 * recurring series is updated — see services/calendar/update.ts. */
export const updateEventBodySchema = {
  ...createEventBodySchema,
  properties: {
    ...createEventBodySchema.properties,
    editScope: { type: "string", enum: ["single", "future", "series"] },
  },
} as const;

export const rsvpBodySchema = {
  type: "object",
  required: ["status"],
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["accepted", "declined", "tentative"] },
  },
} as const;

export const deleteEventQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    deleteScope: {
      type: "string",
      enum: ["single", "future", "series"],
      default: "single",
    },
  },
} as const;

export type { CreateEventBody, UpdateEventBody, RsvpBody };
