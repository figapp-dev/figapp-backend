import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import {
  getDocumentForCarer,
  listDocumentsForCarer,
  signDocumentForCarer,
} from "../services/documents/index.js";
import { badRequest, forbidden, internalError, notFound } from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { signDocumentBodySchema } from "../schemas/documents.js";
import type { SignDocumentBody } from "../types/documents.js";

export async function documentsRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{
    Querystring: { status?: "all" | "to_review" | "completed" };
  }>(
    "/documents",
    {
      schema: {
        tags: ["documents"],
        summary:
          "List documents assigned to the caller (foster carer / SW assignee view)",
        security: [...bearerSecurity],
        querystring: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["all", "to_review", "completed"],
            },
          },
        },
        response: {
          200: { $ref: "DocumentListDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const status = request.query.status ?? "all";
      if (!["all", "to_review", "completed"].includes(status)) {
        throw badRequest(ErrorMessages.DOCUMENTS_INVALID_QUERY);
      }

      const result = await listDocumentsForCarer(
        request.supabase,
        request.user.id,
        { status },
      );

      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.DOCUMENTS_LOAD_FAILED);
      }

      return result.data;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/documents/:id",
    {
      schema: {
        tags: ["documents"],
        summary: "Get one assigned document",
        security: [...bearerSecurity],
        response: {
          200: { $ref: "DocumentListItemDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await getDocumentForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
      );

      if (result.notFound) {
        throw notFound(ErrorMessages.DOCUMENT_NOT_FOUND);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.DOCUMENT_LOAD_FAILED);
      }

      return result.data;
    },
  );

  app.post<{ Params: { id: string }; Body: SignDocumentBody }>(
    "/documents/:id/sign",
    {
      schema: {
        tags: ["documents"],
        summary:
          "Confirm read and sign an assigned document (web-parity declaration, not drawn signature)",
        security: [...bearerSecurity],
        body: signDocumentBodySchema,
        response: {
          200: { $ref: "DocumentSignResultDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await signDocumentForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
        request.body,
        { userAgent: request.headers["user-agent"] ?? null },
      );

      if (result.badRequest) {
        throw badRequest(ErrorMessages.DOCUMENT_SIGN_CONFIRM_REQUIRED);
      }
      if (result.notFound) {
        throw notFound(ErrorMessages.DOCUMENT_NOT_FOUND);
      }
      if (result.forbidden) {
        throw forbidden(ErrorMessages.DOCUMENT_ACCESS_DENIED);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.DOCUMENT_SIGN_FAILED);
      }

      return result.data;
    },
  );
}
