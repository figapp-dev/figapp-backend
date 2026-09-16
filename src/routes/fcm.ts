import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import {
  registerDeviceToken,
  unregisterDeviceToken,
} from "../services/fcm-tokens.js";
import { badRequest, internalError } from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";
import {
  DEVICE_PLATFORMS,
  type RegisterFcmTokenBody,
  type UnregisterFcmTokenBody,
} from "../types/fcm.js";

const okSchema = {
  type: "object",
  required: ["ok"],
  properties: {
    ok: { type: "boolean" },
  },
} as const;

export async function fcmRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.post<{ Body: RegisterFcmTokenBody }>(
    "/fcm/register",
    {
      schema: {
        tags: ["notifications"],
        summary: "Register this device's FCM token for the signed-in user",
        security: [...bearerSecurity],
        body: {
          type: "object",
          required: ["token", "platform"],
          additionalProperties: false,
          properties: {
            token: { type: "string", minLength: 1, maxLength: 4096 },
            platform: { type: "string", enum: [...DEVICE_PLATFORMS] },
            deviceId: { type: ["string", "null"], maxLength: 200 },
            appVersion: { type: ["string", "null"], maxLength: 50 },
          },
        },
        response: {
          200: okSchema,
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await registerDeviceToken(request.user.id, request.body);
      if (result.badRequest) {
        throw badRequest(ErrorMessages.VALIDATION_ERROR);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.FCM_TOKEN_REGISTER_FAILED);
      }
      return result.data;
    },
  );

  app.post<{ Body: UnregisterFcmTokenBody }>(
    "/fcm/unregister",
    {
      schema: {
        tags: ["notifications"],
        summary: "Remove this device's FCM token (called on sign-out)",
        security: [...bearerSecurity],
        body: {
          type: "object",
          required: ["token"],
          additionalProperties: false,
          properties: {
            token: { type: "string", minLength: 1, maxLength: 4096 },
          },
        },
        response: {
          200: okSchema,
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await unregisterDeviceToken(
        request.user.id,
        request.body.token,
      );
      if (result.badRequest) {
        throw badRequest(ErrorMessages.VALIDATION_ERROR);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.FCM_TOKEN_UNREGISTER_FAILED);
      }
      return result.data;
    },
  );
}
