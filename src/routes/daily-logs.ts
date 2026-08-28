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
  conflict,
  expectedUpdatedAtRequired,
  forbidden,
  internalError,
  notFound,
  validationFailed,
} from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { saveDailyLogBodySchema } from "../schemas/daily-logs.js";
import type { SaveDailyLogBody } from "../types/daily-logs.js";

const dailyLogsListResponseSchema = {
  type: "object",
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
      },
    },
  },
} as const;

export async function dailyLogsRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get(
    "/daily-logs/overdue",
    {
      schema: {
        tags: ["daily-logs"],
        summary:
          "Incomplete assignments before today (same overdue set as the web dashboard)",
        security: [...bearerSecurity],
        response: {
          200: dailyLogsListResponseSchema,
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const { data, error } = await listDailyLogsForCarer(
        request.supabase,
        request.user.id,
        { status: "overdue" },
      );
      if (error) {
        request.log.error(error);
        throw internalError(ErrorMessages.DAILY_LOGS_LOAD_FAILED);
      }
      request.log.debug(
        { count: data?.items.length ?? 0 },
        "daily-logs.overdue",
      );
      return data;
    },
  );

  app.get<{
    Querystring: { date?: string; status?: string };
  }>(
    "/daily-logs",
    {
      schema: {
        tags: ["daily-logs"],
        summary:
          "List assignments for a UK date (default: today), or overdue missed logs",
        security: [...bearerSecurity],
        querystring: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description: "YYYY-MM-DD (UK calendar). Omit for today.",
            },
            status: {
              type: "string",
              enum: ["overdue"],
              description:
                "overdue = incomplete assignments before today. Ignores date.",
            },
          },
        },
        response: {
          200: dailyLogsListResponseSchema,
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const { data, error, badRequest: invalidQuery } =
        await listDailyLogsForCarer(request.supabase, request.user.id, {
          date: request.query.date,
          status: request.query.status,
        });

      if (invalidQuery) {
        const status = request.query.status?.trim();
        throw badRequest(
          status && status.toLowerCase() !== "overdue"
            ? ErrorMessages.DAILY_LOG_INVALID_STATUS
            : ErrorMessages.DAILY_LOG_INVALID_DATE,
        );
      }
      if (error) {
        request.log.error(error);
        throw internalError(ErrorMessages.DAILY_LOGS_LOAD_FAILED);
      }

      request.log.debug(
        {
          date: request.query.date ?? null,
          status: request.query.status ?? null,
          count: data?.items.length ?? 0,
        },
        "daily-logs.list",
      );

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
    async (request) => {
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
        throw expectedUpdatedAtRequired(
          ErrorMessages.DAILY_LOG_EXPECTED_UPDATED_AT_REQUIRED,
          result.currentUpdatedAt,
        );
      }
      if (result.validationFailed) {
        throw validationFailed(
          ErrorMessages.DAILY_LOG_SUBMIT_INVALID,
          result.missingFieldIds,
        );
      }
      if (result.conflict) {
        throw conflict(ErrorMessages.DAILY_LOG_CONFLICT, {
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
