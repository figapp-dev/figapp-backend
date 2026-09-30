import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import { getFosterCarerForCaller } from "../services/foster-carers/detail.js";
import { listFosterCarersForCaller } from "../services/foster-carers/list.js";
import { forbidden, internalError, notFound } from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";

const fosterCarerDtoSchema = {
  type: "object",
  required: ["userId", "displayName", "figappId", "email", "phone", "households"],
  properties: {
    userId: { type: "string" },
    displayName: { type: "string" },
    figappId: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    phone: { type: ["string", "null"] },
    households: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
      },
    },
  },
} as const;

export async function fosterCarersRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get(
    "/foster-carers",
    {
      schema: {
        tags: ["foster-carers"],
        summary:
          "Foster carers linked to the signed-in social_worker/sw_manager",
        security: [...bearerSecurity],
        response: {
          200: {
            type: "object",
            required: ["fosterCarers"],
            properties: {
              fosterCarers: { type: "array", items: fosterCarerDtoSchema },
            },
          },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await listFosterCarersForCaller(
        request.supabase,
        request.user.id,
      );

      if (result.forbidden) {
        throw forbidden(ErrorMessages.FOSTER_CARERS_FORBIDDEN);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.FOSTER_CARERS_LOAD_FAILED);
      }

      return result.data;
    },
  );

  app.get<{ Params: { userId: string } }>(
    "/foster-carers/:userId",
    {
      schema: {
        tags: ["foster-carers"],
        summary: "Foster carer detail (must be linked to the caller)",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["userId"],
          properties: { userId: { type: "string" } },
        },
        response: {
          200: fosterCarerDtoSchema,
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await getFosterCarerForCaller(
        request.supabase,
        request.user.id,
        request.params.userId,
      );

      if (result.forbidden) {
        throw forbidden(ErrorMessages.FOSTER_CARERS_FORBIDDEN);
      }
      if (result.notFound) {
        throw notFound(ErrorMessages.FOSTER_CARER_NOT_FOUND);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.FOSTER_CARER_LOAD_FAILED);
      }

      return result.data;
    },
  );
}
