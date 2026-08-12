import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import {
  getChildForCarer,
  listChildrenForCarer,
  listPlacementsForCarer,
} from "../services/children/index.js";
import { internalError, notFound } from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";

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
}
