import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import {
  getDailyLogForCarer,
  listDailyLogsForCarer,
  saveDailyLogForCarer,
} from "../services/daily-logs/index.js";
import {
  badRequest,
  forbidden,
  internalError,
  notFound,
} from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { saveDailyLogBodySchema } from "../schemas/daily-logs.js";
import type { SaveDailyLogBody } from "../types/daily-logs.js";

export async function dailyLogsRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{
    Querystring: { date?: string };
  }>(
    "/daily-logs",
    {
      schema: {
        tags: ["daily-logs"],
        summary: "List assignments for a UK date (default: today)",
        security: [...bearerSecurity],
        querystring: {
          type: "object",
          properties: {
            date: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              description: "YYYY-MM-DD (UK calendar). Omit for today.",
            },
          },
        },
        response: {
          200: { $ref: "DailyLogsListDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const { data, error, badRequest: invalidDate } =
        await listDailyLogsForCarer(request.supabase, request.user.id, {
          date: request.query.date,
        });

      if (invalidDate) {
        throw badRequest(ErrorMessages.DAILY_LOG_INVALID_DATE);
      }
      if (error) {
        request.log.error(error);
        throw internalError(ErrorMessages.DAILY_LOGS_LOAD_FAILED);
      }

      return data;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/daily-logs/:id",
    {
      schema: {
        tags: ["daily-logs"],
        summary: "Assignment detail (template + answers + contributors)",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: { $ref: "DailyLogDetailDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const { data, error } = await getDailyLogForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
      );

      if (error) {
        request.log.error(error);
        throw internalError(ErrorMessages.DAILY_LOG_LOAD_FAILED);
      }

      if (!data) {
        throw notFound(ErrorMessages.DAILY_LOG_NOT_FOUND);
      }

      return data;
    },
  );

  app.put<{ Params: { id: string }; Body: SaveDailyLogBody }>(
    "/daily-logs/:id",
    {
      schema: {
        tags: ["daily-logs"],
        summary: "Save or submit answers (full dataJson replace)",
        description:
          "intent=save allows partial answers. intent=submit validates required fields. " +
          "dataJson fully replaces answers. First create may omit expectedUpdatedAt; " +
          "once log exists, expectedUpdatedAt (from log.updatedAt) is required.",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: saveDailyLogBodySchema,
        response: {
          200: { $ref: "DailyLogDetailDto#" },
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const result = await saveDailyLogForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
        request.body,
      );

      if (result.badRequest) {
        throw badRequest(ErrorMessages.DAILY_LOG_INVALID_BODY);
      }
      if (result.submitEmpty) {
        throw badRequest(ErrorMessages.DAILY_LOG_SUBMIT_EMPTY);
      }
      if (result.missingLock) {
        return reply.status(400).send({
          statusCode: 400,
          code: "EXPECTED_UPDATED_AT_REQUIRED",
          message: ErrorMessages.DAILY_LOG_EXPECTED_UPDATED_AT_REQUIRED,
          currentUpdatedAt: result.currentUpdatedAt,
        });
      }
      if (result.validationFailed) {
        return reply.status(400).send({
          statusCode: 400,
          code: "VALIDATION_FAILED",
          message: ErrorMessages.DAILY_LOG_SUBMIT_INVALID,
          missingFieldIds: result.missingFieldIds,
        });
      }
      if (result.conflict) {
        return reply.status(409).send({
          statusCode: 409,
          code: "CONFLICT",
          message: ErrorMessages.DAILY_LOG_CONFLICT,
          currentUpdatedAt: result.currentUpdatedAt,
        });
      }
      if (result.notEditable) {
        throw forbidden(ErrorMessages.DAILY_LOG_NOT_EDITABLE);
      }
      if (result.notFound) {
        throw notFound(ErrorMessages.DAILY_LOG_NOT_FOUND);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.DAILY_LOG_SAVE_FAILED);
      }

      return result.data;
    },
  );
}
