import type { FastifyInstance } from "fastify";
import { errorResponses } from "../plugins/swagger.js";
import { badRequest, internalError } from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { requestPasswordReset } from "../services/auth/password-reset.js";

export async function authRoute(app: FastifyInstance) {
  app.post<{ Body: { email: string } }>(
    "/auth/password-reset",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 hour",
        },
      },
      schema: {
        tags: ["auth"],
        summary:
          "Request a branded password-reset email (Resend). Always returns the same success message.",
        body: {
          type: "object",
          required: ["email"],
          additionalProperties: false,
          properties: {
            email: { type: "string", format: "email" },
          },
        },
        response: {
          200: {
            type: "object",
            required: ["ok", "message"],
            properties: {
              ok: { type: "boolean" },
              message: { type: "string" },
            },
          },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await requestPasswordReset(request.body.email);

      if (result.badRequest) {
        throw badRequest(ErrorMessages.VALIDATION_ERROR);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.PASSWORD_RESET_FAILED);
      }

      return result.data;
    },
  );
}
