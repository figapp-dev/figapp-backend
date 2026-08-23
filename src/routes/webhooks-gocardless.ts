import type { FastifyInstance } from "fastify";
import { processGoCardlessWebhook } from "../services/billing/index.js";
import { badRequest, internalError, unauthorized } from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { errorResponses } from "../plugins/swagger.js";

export async function gocardlessWebhookRoute(app: FastifyInstance) {
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => {
      done(null, body);
    },
  );

  app.post<{ Body: string }>(
    "/webhooks/gocardless",
    {
      schema: {
        tags: ["webhooks"],
        summary: "GoCardless webhook receiver (signature verification only)",
        description:
          "Public. Verifies Webhook-Signature, stores events idempotently, then syncs mandate / payment state.",
        response: {
          200: { $ref: "GoCardlessWebhookAckDto#" },
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      if (typeof request.body !== "string") {
        throw badRequest(ErrorMessages.BILLING_WEBHOOK_INVALID_BODY);
      }

      const signature = request.headers["webhook-signature"];
      const signatureHeader = Array.isArray(signature) ? signature[0] : signature;

      const result = await processGoCardlessWebhook(request.body, signatureHeader);

      if ("invalidSignature" in result) {
        throw unauthorized(ErrorMessages.BILLING_WEBHOOK_INVALID_SIGNATURE);
      }
      if ("invalidBody" in result) {
        throw badRequest(ErrorMessages.BILLING_WEBHOOK_INVALID_BODY);
      }
      if ("misconfigured" in result) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.BILLING_GOCARDLESS_NOT_CONFIGURED);
      }
      if ("processingFailed" in result) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.BILLING_WEBHOOK_FAILED);
      }

      return reply.status(200).send({ received: true });
    },
  );
}
