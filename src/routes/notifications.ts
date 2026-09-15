import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import {
  getNotificationPreferences,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  putNotificationPreferences,
} from "../services/notifications.js";
import {
  badRequest,
  internalError,
  notFound,
} from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";
import type {
  NotificationListFilter,
  NotificationPreferencesDto,
} from "../types/notifications.js";

const notificationDtoSchema = {
  type: "object",
  required: [
    "id",
    "title",
    "message",
    "type",
    "readAt",
    "actionUrl",
    "metadata",
    "agencyId",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    message: { type: ["string", "null"] },
    type: { type: "string" },
    readAt: { type: ["string", "null"] },
    actionUrl: { type: ["string", "null"] },
    metadata: { type: "object", additionalProperties: true },
    agencyId: { type: ["string", "null"] },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;

const preferencesDtoSchema = {
  type: "object",
  required: [
    "emailDailyLogs",
    "emailAiInsights",
    "emailDocumentDeadlines",
    "emailSystemMaintenance",
    "emailTasks",
    "emailTickets",
    "emailEvents",
    "emailSurveys",
    "pushUrgentOnly",
    "pushAll",
  ],
  properties: {
    emailDailyLogs: { type: "boolean" },
    emailAiInsights: { type: "boolean" },
    emailDocumentDeadlines: { type: "boolean" },
    emailSystemMaintenance: { type: "boolean" },
    emailTasks: { type: "boolean" },
    emailTickets: { type: "boolean" },
    emailEvents: { type: "boolean" },
    emailSurveys: { type: "boolean" },
    pushUrgentOnly: { type: "boolean" },
    pushAll: { type: "boolean" },
  },
} as const;

function isPreferencesBody(body: unknown): body is NotificationPreferencesDto {
  if (!body || typeof body !== "object") return false;
  const row = body as Record<string, unknown>;
  const keys = [
    "emailDailyLogs",
    "emailAiInsights",
    "emailDocumentDeadlines",
    "emailSystemMaintenance",
    "emailTasks",
    "emailTickets",
    "emailEvents",
    "emailSurveys",
    "pushUrgentOnly",
    "pushAll",
  ];
  return keys.every((key) => typeof row[key] === "boolean");
}

export async function notificationsRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{ Querystring: { filter?: NotificationListFilter } }>(
    "/notifications",
    {
      schema: {
        tags: ["notifications"],
        summary: "List notifications for the signed-in user",
        security: [...bearerSecurity],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            filter: { type: "string", enum: ["all", "unread"] },
          },
        },
        response: {
          200: {
            type: "object",
            required: ["notifications", "unreadCount"],
            properties: {
              notifications: {
                type: "array",
                items: notificationDtoSchema,
              },
              unreadCount: { type: "integer" },
            },
          },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const filter = request.query.filter === "unread" ? "unread" : "all";
      const result = await listNotifications(
        request.supabase,
        request.user.id,
        filter,
      );
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.NOTIFICATIONS_LOAD_FAILED);
      }
      return result.data;
    },
  );

  app.get(
    "/notifications/unread-count",
    {
      schema: {
        tags: ["notifications"],
        summary: "Unread notification count for the signed-in user",
        security: [...bearerSecurity],
        response: {
          200: {
            type: "object",
            required: ["unreadCount"],
            properties: {
              unreadCount: { type: "integer" },
            },
          },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await getUnreadNotificationCount(
        request.supabase,
        request.user.id,
      );
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.NOTIFICATIONS_LOAD_FAILED);
      }
      return result.data;
    },
  );

  app.put(
    "/notifications/read-all",
    {
      schema: {
        tags: ["notifications"],
        summary: "Mark all notifications as read",
        security: [...bearerSecurity],
        response: {
          200: {
            type: "object",
            required: ["ok", "count"],
            properties: {
              ok: { type: "boolean" },
              count: { type: "integer" },
            },
          },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await markAllNotificationsAsRead(
        request.supabase,
        request.user.id,
      );
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.NOTIFICATION_READ_FAILED);
      }
      return result.data;
    },
  );

  app.put<{ Params: { id: string } }>(
    "/notifications/:id/read",
    {
      schema: {
        tags: ["notifications"],
        summary: "Mark a notification as read",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 1 } },
        },
        response: {
          200: notificationDtoSchema,
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await markNotificationAsRead(
        request.supabase,
        request.user.id,
        request.params.id,
      );
      if (result.notFound) {
        throw notFound(ErrorMessages.NOTIFICATION_NOT_FOUND);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.NOTIFICATION_READ_FAILED);
      }
      return result.data;
    },
  );

  app.get(
    "/notification-preferences",
    {
      schema: {
        tags: ["notifications"],
        summary: "Get notification preferences for the signed-in user",
        security: [...bearerSecurity],
        response: {
          200: preferencesDtoSchema,
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await getNotificationPreferences(
        request.supabase,
        request.user.id,
      );
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.NOTIFICATION_PREFS_LOAD_FAILED);
      }
      return result.data;
    },
  );

  app.put<{ Body: NotificationPreferencesDto }>(
    "/notification-preferences",
    {
      schema: {
        tags: ["notifications"],
        summary: "Update notification preferences for the signed-in user",
        security: [...bearerSecurity],
        body: {
          ...preferencesDtoSchema,
          additionalProperties: false,
        },
        response: {
          200: preferencesDtoSchema,
          ...errorResponses,
        },
      },
    },
    async (request) => {
      if (!isPreferencesBody(request.body)) {
        throw badRequest(ErrorMessages.VALIDATION_ERROR);
      }
      const result = await putNotificationPreferences(
        request.supabase,
        request.user.id,
        request.body,
      );
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.NOTIFICATION_PREFS_SAVE_FAILED);
      }
      return result.data;
    },
  );
}
