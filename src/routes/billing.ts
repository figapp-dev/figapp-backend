import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import {
  createAgencyBillingRequest,
  getBillingAccess,
  getBillingSummary,
  updateAgencyBillingExemption,
} from "../services/billing/index.js";
import {
  badRequest,
  conflict,
  forbidden,
  internalError,
  notFound,
} from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { createBillingRequestBodySchema, billingExemptionBodySchema } from "../schemas/billing.js";
import type {
  BillingExemptionBody,
  CreateBillingRequestBody,
} from "../types/billing.js";

const agencyIdParams = {
  type: "object",
  required: ["agencyId"],
  properties: {
    agencyId: { type: "string", minLength: 1 },
  },
} as const;

export async function billingRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get(
    "/billing/access",
    {
      schema: {
        tags: ["billing"],
        summary: "Billing access gate for the signed-in user's agency",
        description:
          "Mobile and web gate. No GoCardless call. Platform admins without an agency can use the app.",
        security: [...bearerSecurity],
        response: {
          200: { $ref: "BillingAccessDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await getBillingAccess(request.supabase, request.user.id);

      if (result.notFound) {
        throw notFound(ErrorMessages.BILLING_AGENCY_NOT_FOUND);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.BILLING_ACCESS_LOAD_FAILED);
      }
      return result.data;
    },
  );

  app.get<{ Params: { agencyId: string } }>(
    "/billing/agencies/:agencyId/summary",
    {
      schema: {
        tags: ["billing"],
        summary: "Payment-screen quote for an agency (starter pack + setup fee)",
        security: [...bearerSecurity],
        params: agencyIdParams,
        response: {
          200: { $ref: "BillingSummaryDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await getBillingSummary(
        request.supabase,
        request.user.id,
        request.params.agencyId,
      );

      if (result.forbidden) {
        throw forbidden(ErrorMessages.BILLING_FORBIDDEN);
      }
      if (result.notFound) {
        throw notFound(ErrorMessages.BILLING_AGENCY_NOT_FOUND);
      }
      if (result.badRequest) {
        throw badRequest(ErrorMessages.BILLING_PRICES_MISSING);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.BILLING_SUMMARY_LOAD_FAILED);
      }
      return result.data;
    },
  );

  app.post<{
    Params: { agencyId: string };
    Body: CreateBillingRequestBody;
  }>(
    "/billing/agencies/:agencyId/billing-request",
    {
      schema: {
        tags: ["billing"],
        summary: "Start GoCardless hosted Direct Debit mandate setup",
        security: [...bearerSecurity],
        params: agencyIdParams,
        body: createBillingRequestBodySchema,
        response: {
          200: { $ref: "CreateBillingRequestDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await createAgencyBillingRequest(
        request.supabase,
        request.user.id,
        request.params.agencyId,
        request.body,
      );

      if (result.forbidden) {
        throw forbidden(ErrorMessages.BILLING_FORBIDDEN);
      }
      if (result.notFound) {
        throw notFound(ErrorMessages.BILLING_AGENCY_NOT_FOUND);
      }
      if (result.unsupported) {
        throw badRequest(ErrorMessages.BILLING_EXEMPT);
      }
      if (result.conflict) {
        throw conflict(ErrorMessages.BILLING_MANDATE_EXISTS);
      }
      if (result.badRequest) {
        throw badRequest(ErrorMessages.BILLING_REDIRECT_URL_INVALID);
      }
      if (result.error || !result.data) {
        request.log.error(
          { err: result.error, message: result.error?.message },
          "billing-request failed",
        );
        const message = result.error?.message?.includes("not configured")
          ? ErrorMessages.BILLING_GOCARDLESS_NOT_CONFIGURED
          : ErrorMessages.BILLING_REQUEST_FAILED;
        throw internalError(message);
      }
      return result.data;
    },
  );

  app.patch<{
    Params: { agencyId: string };
    Body: BillingExemptionBody;
  }>(
    "/billing/agencies/:agencyId/exemption",
    {
      schema: {
        tags: ["billing"],
        summary: "Set demo vs commercial billing (platform admin)",
        security: [...bearerSecurity],
        params: agencyIdParams,
        body: billingExemptionBodySchema,
        response: {
          200: { $ref: "BillingExemptionDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await updateAgencyBillingExemption(
        request.supabase,
        request.user.id,
        request.params.agencyId,
        request.body,
      );

      if (result.forbidden) {
        throw forbidden(ErrorMessages.BILLING_EXEMPTION_FORBIDDEN);
      }
      if (result.notFound) {
        throw notFound(ErrorMessages.BILLING_AGENCY_NOT_FOUND);
      }
      if (result.badRequest) {
        throw badRequest(ErrorMessages.BAD_REQUEST);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.BILLING_EXEMPTION_FAILED);
      }
      return result.data;
    },
  );
}
