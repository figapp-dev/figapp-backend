import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import { deleteAccount } from "../services/account/delete-account.js";
import { restoreAccount } from "../services/account/restore-account.js";
import {
  badRequest,
  forbidden,
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
        summary: "Close the signed-in account (deactivate, ban Auth login)",
        description:
          "Deactivates the agency_users profile and ends active household memberships, then bans the Auth user so they cannot sign in. Profile fields are not changed — this is a reversible flag, not an erasure; an agency admin can restore it later after confirming with the person (disclosed in the app's delete-account confirmation copy). Does not hard-delete auth.users (would cascade into care records like daily_logs.author_id).",
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

  app.post<{ Params: { userId: string } }>(
    "/account/:userId/restore",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 hour",
        },
      },
      schema: {
        tags: ["account"],
        summary: "Restore a deactivated account (agency admin only)",
        description:
          "Reverses /account/delete: reactivates the target's agency_users profile and unbans their Auth login. Nothing was destroyed by delete, so this is a full restore. Agency admins may only restore within their own agency.",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["userId"],
          properties: { userId: { type: "string" } },
        },
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
      const result = await restoreAccount(
        request.supabase,
        request.user.id,
        request.params.userId,
      );

      if (result.badRequest) {
        throw badRequest(ErrorMessages.ACCOUNT_RESTORE_NOT_DEACTIVATED);
      }
      if (result.forbidden) {
        throw forbidden(ErrorMessages.ACCOUNT_RESTORE_FORBIDDEN);
      }
      if (result.notFound) {
        throw notFound(ErrorMessages.ACCOUNT_RESTORE_NOT_FOUND);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.ACCOUNT_RESTORE_FAILED);
      }

      return result.data;
    },
  );
}
