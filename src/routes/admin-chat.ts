import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import { askAdminChat, getAdminChatHistory } from "../services/admin-chat/index.js";
import { badRequest, forbidden, internalError } from "../lib/errors.js";
import { AppError } from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { askAdminChatBodySchema } from "../schemas/admin-chat.js";
import type { AskAdminChatBody } from "../types/admin-chat.js";

export async function adminChatRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.post<{ Body: AskAdminChatBody }>(
    "/admin-chat/ask",
    {
      schema: {
        tags: ["admin-chat"],
        summary: "Ask Figgy — agency admin chat assistant over the agency's own data",
        security: [...bearerSecurity],
        body: askAdminChatBodySchema,
        response: {
          200: {
            type: "object",
            properties: {
              text: { type: "string" },
              stats: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    value: { type: "string" },
                    label: { type: "string" },
                    delta: { type: "string" },
                  },
                },
              },
              rows: {
                type: "array",
                items: { type: "object", additionalProperties: { type: "string" } },
              },
              suggestedQuestions: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await askAdminChat(
        request.supabase,
        request.user.id,
        request.body.question,
      );

      if (result.badRequest) {
        throw badRequest(ErrorMessages.ADMIN_CHAT_INVALID_BODY);
      }
      if (result.forbidden) {
        throw forbidden(ErrorMessages.ADMIN_CHAT_FORBIDDEN);
      }
      if (result.rateLimited) {
        throw new AppError(429, "RATE_LIMITED", ErrorMessages.ADMIN_CHAT_RATE_LIMITED);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        const message =
          result.error?.message === "ANTHROPIC_API_KEY not configured"
            ? ErrorMessages.ADMIN_CHAT_NOT_CONFIGURED
            : ErrorMessages.ADMIN_CHAT_FAILED;
        throw internalError(message);
      }

      return result.data;
    },
  );

  app.get(
    "/admin-chat/history",
    {
      schema: {
        tags: ["admin-chat"],
        summary: "Ask Figgy — today's question/answer history for the calling admin",
        security: [...bearerSecurity],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                question: { type: "string" },
                createdAt: { type: "string" },
                answer: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    stats: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          value: { type: "string" },
                          label: { type: "string" },
                          delta: { type: "string" },
                        },
                      },
                    },
                    rows: {
                      type: "array",
                      items: { type: "object", additionalProperties: { type: "string" } },
                    },
                    suggestedQuestions: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await getAdminChatHistory(request.supabase, request.user.id);

      if (result.forbidden) {
        throw forbidden(ErrorMessages.ADMIN_CHAT_FORBIDDEN);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.ADMIN_CHAT_HISTORY_FAILED);
      }

      return result.data;
    },
  );
}
