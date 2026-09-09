import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import {
  createEventForCarer,
  deleteEventForCarer,
  getEligibleParticipantsForCarer,
  getEventForCarer,
  listEventsForCarer,
  rsvpToEventForCarer,
  updateEventForCarer,
} from "../services/calendar/index.js";
import { badRequest, forbidden, internalError, notFound } from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";
import {
  createEventBodySchema,
  rsvpBodySchema,
  updateEventBodySchema,
} from "../schemas/calendar.js";
import type {
  CreateEventBody,
  RsvpBody,
  UpdateEventBody,
} from "../types/calendar.js";

export async function calendarRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{ Querystring: { from?: string; to?: string } }>(
    "/calendar/events",
    {
      schema: {
        tags: ["calendar"],
        summary:
          "List events the caller created or is a participant in, for a date range (default: current UK month)",
        security: [...bearerSecurity],
        querystring: {
          type: "object",
          properties: {
            from: { type: "string", description: "YYYY-MM-DD, inclusive" },
            to: { type: "string", description: "YYYY-MM-DD, exclusive" },
          },
        },
        response: {
          200: { $ref: "CalendarEventListDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await listEventsForCarer(request.supabase, request.user.id, {
        from: request.query.from,
        to: request.query.to,
      });

      if (result.badRequest) {
        throw badRequest(ErrorMessages.CALENDAR_EVENT_INVALID_QUERY);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.CALENDAR_EVENTS_LOAD_FAILED);
      }

      return result.data;
    },
  );

  app.get(
    "/calendar/eligible-participants",
    {
      schema: {
        tags: ["calendar"],
        summary:
          "Placed children (tag-only), linked foster carers, and social workers the caller can invite to an event",
        security: [...bearerSecurity],
        response: {
          200: { $ref: "CalendarEligibleParticipantsDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await getEligibleParticipantsForCarer(
        request.supabase,
        request.user.id,
      );

      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.CALENDAR_ELIGIBLE_PARTICIPANTS_LOAD_FAILED);
      }

      return result.data;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/calendar/events/:id",
    {
      schema: {
        tags: ["calendar"],
        summary: "Event detail, including participants and reminders",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: { $ref: "CalendarEventDetailDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await getEventForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
      );

      if (result.notFound) {
        throw notFound(ErrorMessages.CALENDAR_EVENT_NOT_FOUND);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.CALENDAR_EVENT_LOAD_FAILED);
      }

      return result.data;
    },
  );

  app.post<{ Body: CreateEventBody }>(
    "/calendar/events",
    {
      schema: {
        tags: ["calendar"],
        summary:
          "Create an event. A recurrence pattern is expanded into individual occurrence rows immediately (up to 52).",
        security: [...bearerSecurity],
        body: createEventBodySchema,
        response: {
          200: { $ref: "CalendarEventDetailDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await createEventForCarer(
        request.supabase,
        request.user.id,
        request.body,
      );

      if (result.badRequest) {
        throw badRequest(ErrorMessages.CALENDAR_EVENT_INVALID_BODY);
      }
      if (result.forbidden) {
        throw forbidden(ErrorMessages.CALENDAR_NO_AGENCY);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.CALENDAR_EVENT_SAVE_FAILED);
      }

      return result.data;
    },
  );

  app.put<{ Params: { id: string }; Body: UpdateEventBody }>(
    "/calendar/events/:id",
    {
      schema: {
        tags: ["calendar"],
        summary:
          "Update an event. editScope (default 'single') controls how a recurring series is affected.",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: updateEventBodySchema,
        response: {
          200: { $ref: "CalendarEventDetailDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await updateEventForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
        request.body,
      );

      if (result.notFound) {
        throw notFound(ErrorMessages.CALENDAR_EVENT_NOT_FOUND);
      }
      if (result.forbidden) {
        throw forbidden(ErrorMessages.CALENDAR_EVENT_ACCESS_DENIED);
      }
      if (result.badRequest) {
        throw badRequest(ErrorMessages.CALENDAR_EVENT_INVALID_BODY);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.CALENDAR_EVENT_SAVE_FAILED);
      }

      return result.data;
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/calendar/events/:id",
    {
      schema: {
        tags: ["calendar"],
        summary: "Delete a single event occurrence (not the whole series)",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            required: ["ok"],
            properties: { ok: { type: "boolean" } },
          },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await deleteEventForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
      );

      if (result.notFound) {
        throw notFound(ErrorMessages.CALENDAR_EVENT_NOT_FOUND);
      }
      if (result.forbidden) {
        throw forbidden(ErrorMessages.CALENDAR_EVENT_ACCESS_DENIED);
      }
      if (result.error) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.CALENDAR_EVENT_DELETE_FAILED);
      }

      return { ok: true };
    },
  );

  app.post<{ Params: { id: string }; Body: RsvpBody }>(
    "/calendar/events/:id/rsvp",
    {
      schema: {
        tags: ["calendar"],
        summary: "Accept, decline, or tentatively respond to an event invite",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: rsvpBodySchema,
        response: {
          200: { $ref: "CalendarEventParticipantDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await rsvpToEventForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
        request.body.status,
      );

      if (result.notFound) {
        throw notFound(ErrorMessages.CALENDAR_RSVP_NOT_INVITED);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.CALENDAR_RSVP_FAILED);
      }

      return result.data;
    },
  );
}
