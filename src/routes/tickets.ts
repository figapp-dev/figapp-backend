import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import {
  addTicketCommentForCarer,
  createTicketForCarer,
  getTicketForCarer,
  listTicketsForCarer,
} from "../services/tickets/index.js";
import {
  badRequest,
  internalError,
  notFound,
} from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";
import {
  createTicketBodySchema,
  createTicketCommentBodySchema,
} from "../schemas/tickets.js";
import type {
  CreateTicketBody,
  CreateTicketCommentBody,
  TicketListStatusFilter,
} from "../types/tickets.js";

export async function ticketsRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{
    Querystring: { status?: TicketListStatusFilter; q?: string };
  }>(
    "/tickets",
    {
      schema: {
        tags: ["tickets"],
        summary: "List support tickets created by the signed-in user",
        security: [...bearerSecurity],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: {
              type: "string",
              enum: ["open", "resolved", "verified", "closed", "reopened"],
            },
            q: { type: "string" },
          },
        },
        response: {
          200: { $ref: "TicketListDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await listTicketsForCarer(
        request.supabase,
        request.user.id,
        {
          status: request.query.status,
          q: request.query.q,
        },
      );

      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.TICKETS_LIST_LOAD_FAILED);
      }

      return result.data;
    },
  );

  app.post<{ Body: CreateTicketBody }>(
    "/tickets",
    {
      schema: {
        tags: ["tickets"],
        summary: "Create a support ticket",
        security: [...bearerSecurity],
        body: createTicketBodySchema,
        response: {
          200: { $ref: "TicketDetailDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await createTicketForCarer(
        request.supabase,
        request.user.id,
        request.body,
      );

      if (result.badRequest) {
        throw badRequest(
          result.error?.message?.includes("agency")
            ? ErrorMessages.TICKET_NO_AGENCY
            : ErrorMessages.TICKET_INVALID_BODY,
        );
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.TICKET_CREATE_FAILED);
      }

      return result.data;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/tickets/:id",
    {
      schema: {
        tags: ["tickets"],
        summary: "Support ticket detail with messages and attachments",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: { $ref: "TicketDetailDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await getTicketForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
      );

      if (result.badRequest) {
        throw badRequest(ErrorMessages.TICKET_INVALID_BODY);
      }
      if (result.notFound) {
        throw notFound(ErrorMessages.TICKET_NOT_FOUND);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.TICKET_LOAD_FAILED);
      }

      return result.data;
    },
  );

  app.post<{ Params: { id: string }; Body: CreateTicketCommentBody }>(
    "/tickets/:id/comments",
    {
      schema: {
        tags: ["tickets"],
        summary: "Add a comment (and optional attachments) to a support ticket",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: createTicketCommentBodySchema,
        response: {
          200: { $ref: "TicketDetailDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await addTicketCommentForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
        request.body,
      );

      if (result.badRequest) {
        throw badRequest(ErrorMessages.TICKET_INVALID_BODY);
      }
      if (result.notFound) {
        throw notFound(ErrorMessages.TICKET_NOT_FOUND);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.TICKET_COMMENT_FAILED);
      }

      return result.data;
    },
  );
}
