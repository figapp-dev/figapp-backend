import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import { listSocialWorkersForManager } from "../services/social-workers/list.js";
import { forbidden, internalError } from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";

const socialWorkerDtoSchema = {
  type: "object",
  required: [
    "userId",
    "displayName",
    "figappId",
    "email",
    "phone",
    "fosterCarersCount",
  ],
  properties: {
    userId: { type: "string" },
    displayName: { type: "string" },
    figappId: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    phone: { type: ["string", "null"] },
    fosterCarersCount: { type: "number" },
  },
} as const;

export async function socialWorkersRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get(
    "/social-workers",
    {
      schema: {
        tags: ["social-workers"],
        summary: "Social workers managed by the signed-in sw_manager",
        security: [...bearerSecurity],
        response: {
          200: {
            type: "object",
            required: ["socialWorkers"],
            properties: {
              socialWorkers: {
                type: "array",
                items: socialWorkerDtoSchema,
              },
            },
          },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await listSocialWorkersForManager(
        request.supabase,
        request.user.id,
      );

      if (result.forbidden) {
        throw forbidden(ErrorMessages.SOCIAL_WORKERS_FORBIDDEN);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.SOCIAL_WORKERS_LOAD_FAILED);
      }

      return result.data;
    },
  );
}
