import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import {
  getGdprConsent,
  putGdprConsent,
} from "../services/gdpr-consent.js";
import { badRequest, internalError } from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";
import type { PutGdprConsentBody } from "../types/gdpr-consent.js";

const gdprConsentDtoSchema = {
  type: "object",
  required: [
    "needsPrompt",
    "status",
    "id",
    "consentGiven",
    "consentDate",
    "consentVersion",
    "legalBasis",
  ],
  properties: {
    needsPrompt: { type: "boolean" },
    status: { type: "string", enum: ["none", "accepted", "declined"] },
    id: { type: ["string", "null"] },
    consentGiven: { type: ["boolean", "null"] },
    consentDate: { type: ["string", "null"] },
    consentVersion: { type: ["string", "null"] },
    legalBasis: { type: ["string", "null"] },
  },
} as const;

export async function gdprConsentRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get(
    "/gdpr-consent",
    {
      schema: {
        tags: ["gdpr"],
        summary: "Get data-processing consent status for the signed-in user",
        security: [...bearerSecurity],
        response: {
          200: gdprConsentDtoSchema,
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await getGdprConsent(request.supabase, request.user.id);
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.GDPR_CONSENT_LOAD_FAILED);
      }
      return result.data;
    },
  );

  app.put<{ Body: PutGdprConsentBody }>(
    "/gdpr-consent",
    {
      schema: {
        tags: ["gdpr"],
        summary: "Accept or decline data-processing consent",
        security: [...bearerSecurity],
        body: {
          type: "object",
          required: ["given"],
          additionalProperties: false,
          properties: {
            given: { type: "boolean" },
          },
        },
        response: {
          200: gdprConsentDtoSchema,
          ...errorResponses,
        },
      },
    },
    async (request) => {
      if (typeof request.body?.given !== "boolean") {
        throw badRequest(ErrorMessages.VALIDATION_ERROR);
      }

      const result = await putGdprConsent(
        request.supabase,
        request.user.id,
        request.body.given,
      );

      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.GDPR_CONSENT_SAVE_FAILED);
      }
      return result.data;
    },
  );
}
