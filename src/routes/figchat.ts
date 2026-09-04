import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import { sendFigChatMessageForUser } from "../services/figchat/send-message.js";
import { markFigChatConversationReadForUser } from "../services/figchat/mark-read.js";
import { badRequest, forbidden, internalError } from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { sendFigChatMessageBodySchema } from "../schemas/figchat.js";
import type { SendFigChatMessageBody } from "../types/figchat.js";

export async function figChatRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.post<{ Params: { id: string }; Body: SendFigChatMessageBody }>(
    "/figchat/conversations/:id/messages",
    {
      schema: {
        tags: ["figchat"],
        summary: "Send a message in a conversation",
        security: [...bearerSecurity],
        body: sendFigChatMessageBodySchema,
        response: {
          200: { $ref: "FigChatMessageDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await sendFigChatMessageForUser(
        request.supabase,
        request.user.id,
        request.params.id,
        request.body,
      );

      if (result.badRequest) {
        throw badRequest(ErrorMessages.FIGCHAT_MESSAGE_INVALID_BODY);
      }
      if (result.forbidden) {
        if (result.error) {
          request.log.warn(result.error);
        }
        if (result.error?.name === "FigChatBroadcastDeliveryBlocked") {
          throw forbidden(ErrorMessages.FIGCHAT_BROADCAST_DELIVERY_BLOCKED);
        }
        if (result.error?.name === "FigChatBroadcastAdminOnly") {
          throw forbidden(ErrorMessages.FIGCHAT_BROADCAST_ADMIN_ONLY);
        }
        throw forbidden(ErrorMessages.FIGCHAT_ACCESS_DENIED);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.FIGCHAT_MESSAGE_SEND_FAILED);
      }

      return result.data;
    },
  );

  app.put<{ Params: { id: string } }>(
    "/figchat/conversations/:id/read",
    {
      schema: {
        tags: ["figchat"],
        summary: "Mark a conversation as read up to now",
        security: [...bearerSecurity],
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
      const result = await markFigChatConversationReadForUser(
        request.supabase,
        request.user.id,
        request.params.id,
      );

      if (result.forbidden) {
        throw forbidden(ErrorMessages.FIGCHAT_ACCESS_DENIED);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.FIGCHAT_MARK_READ_FAILED);
      }

      return result.data;
    },
  );
}
