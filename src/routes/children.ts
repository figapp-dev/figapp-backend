import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import {
  getChildForCarer,
  listChildrenForCarer,
  listPlacementsForCarer,
} from "../services/children/index.js";
import {
  createChildDocumentForCarer,
  listChildDocumentsForCarer,
} from "../services/child-documents/index.js";
import {
  badRequest,
  forbidden,
  internalError,
  notFound,
} from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { createChildDocumentBodySchema } from "../schemas/child-documents.js";
import type { CreateChildDocumentBody } from "../types/child-documents.js";

export async function childrenRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get(
    "/children",
    {
      schema: {
        tags: ["children"],
        summary: "List children + under-18 placed parents",
        security: [...bearerSecurity],
        response: {
          200: { $ref: "ChildrenListDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const { data, error } = await listChildrenForCarer(
        request.supabase,
        request.user.id,
      );

      if (error) {
        request.log.error(error);
        throw internalError(ErrorMessages.CHILDREN_LOAD_FAILED);
      }

      return data;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/children/:id",
    {
      schema: {
        tags: ["children"],
        summary: "Child or placed-parent detail",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: { $ref: "ChildrenDetailDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const { data, error } = await getChildForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
      );

      if (error) {
        request.log.error(error);
        throw internalError(ErrorMessages.CHILD_LOAD_FAILED);
      }

      if (!data) {
        throw notFound(ErrorMessages.CHILD_NOT_FOUND);
      }

      return data;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/children/:id/placements",
    {
      schema: {
        tags: ["children"],
        summary: "Placement history for child or placed parent",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: { $ref: "PlacementsDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const { data, error } = await listPlacementsForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
      );

      if (error) {
        request.log.error(error);
        throw internalError(ErrorMessages.PLACEMENTS_LOAD_FAILED);
      }

      if (!data) {
        throw notFound(ErrorMessages.CHILD_NOT_FOUND);
      }

      return data;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/children/:id/documents",
    {
      schema: {
        tags: ["children"],
        summary: "List child profile documents (upload library)",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: { $ref: "ChildDocumentsListDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await listChildDocumentsForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
      );

      if (result.badRequest) {
        throw badRequest(ErrorMessages.CHILD_DOCUMENTS_INVALID_BODY);
      }
      if (result.forbidden) {
        throw forbidden(ErrorMessages.CHILD_DOCUMENTS_ACCESS_DENIED);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.CHILD_DOCUMENTS_LOAD_FAILED);
      }

      return result.data;
    },
  );

  app.post<{ Params: { id: string }; Body: CreateChildDocumentBody }>(
    "/children/:id/documents",
    {
      schema: {
        tags: ["children"],
        summary: "Register a child profile document after signed upload",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: createChildDocumentBodySchema,
        response: {
          200: { $ref: "ChildDocumentDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await createChildDocumentForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
        request.body,
      );

      if (result.badRequest) {
        throw badRequest(ErrorMessages.CHILD_DOCUMENTS_INVALID_BODY);
      }
      if (result.forbidden) {
        throw forbidden(ErrorMessages.CHILD_DOCUMENTS_ACCESS_DENIED);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.CHILD_DOCUMENTS_UPLOAD_FAILED);
      }

      return result.data;
    },
  );
}
