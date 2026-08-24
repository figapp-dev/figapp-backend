import type { FastifyInstance } from "fastify";
import { collectDueLicencePayments } from "../services/billing/index.js";
import { env } from "../config/env.js";
import { secretsEqual } from "../lib/secrets.js";
import { internalError, unauthorized } from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { errorResponses } from "../plugins/swagger.js";

function headerValue(
  value: string | string[] | undefined,
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

function cronSecretFromRequest(headers: {
  authorization?: string | string[];
  "x-billing-cron-secret"?: string | string[];
}): string | undefined {
  const fromHeader = headerValue(headers["x-billing-cron-secret"]);
  if (fromHeader) return fromHeader;
  const auth = headerValue(headers.authorization);
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim();
    return token || undefined;
  }
  return undefined;
}

/** Railway cron (or similar) — not a user JWT route. */
export async function billingCollectRoute(app: FastifyInstance) {
  app.post(
    "/internal/billing/collect",
    {
      schema: {
        tags: ["billing"],
        summary: "Catch-up one-off licence collections (cron)",
        description:
          "Creates missing GoCardless one-off payments for commercial agencies, " +
          "sends past_due reminder emails, and suspends on day 29. " +
          "Header x-billing-cron-secret (or Bearer) must match BILLING_CRON_SECRET.",
        response: {
          200: { $ref: "BillingCollectDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      if (!env.billingCronSecret) {
        throw internalError(ErrorMessages.BILLING_CRON_NOT_CONFIGURED);
      }
      if (!secretsEqual(cronSecretFromRequest(request.headers), env.billingCronSecret)) {
        throw unauthorized(ErrorMessages.BILLING_CRON_UNAUTHORIZED);
      }

      try {
        return await collectDueLicencePayments();
      } catch (error) {
        request.log.error(error);
        throw internalError(ErrorMessages.BILLING_COLLECT_FAILED);
      }
    },
  );
}
