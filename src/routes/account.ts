import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import { deleteAccount } from "../services/account/delete-account.js";
import {
  badRequest,
  internalError,
  notFound,
} from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";

export async function accountRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.post(
    "/account/delete",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 hour",
        },
      },
      schema: {
        tags: ["account"],
        summary:
          "Close the signed-in account (soft-close, anonymise, ban Auth login)",
        description:
          "Archives and anonymises the agency_users profile, ends active household memberships, frees the login email, and bans the Auth user. Care records are retained for agency legal retention. Does not hard-delete auth.users (would cascade into logs).",
        security: [...bearerSecurity],
        response: {
          200: {
            type: "object",
            required: ["ok"],
            properties: {
              ok: { type: "boolean" },
            },
          },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await deleteAccount(request.user.id);

      if (result.badRequest) {
        throw badRequest(ErrorMessages.VALIDATION_ERROR);
      }
      if (result.notFound) {
        throw notFound(ErrorMessages.PROFILE_NOT_FOUND);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.ACCOUNT_DELETE_FAILED);
      }

      return result.data;
    },
  );
}
