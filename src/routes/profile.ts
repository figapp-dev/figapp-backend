import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import { getProfile } from "../services/profile.js";
import { internalError, notFound } from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";

export async function profileRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get(
    "/profile",
    {
      schema: {
        tags: ["profile"],
        summary: "Get signed-in carer profile",
        description:
          "id is auth user_id; agencyUserId is agency_users.id (use the latter for agency FKs).",
        security: [...bearerSecurity],
        response: {
          200: { $ref: "ProfileDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const { data, error } = await getProfile(
        request.supabase,
        request.user.id,
      );

      if (error) {
        request.log.error(error);
        throw internalError(ErrorMessages.PROFILE_LOAD_FAILED);
      }
      if (!data) {
        throw notFound(ErrorMessages.PROFILE_NOT_FOUND);
      }
      return data;
    },
  );
}
