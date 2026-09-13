import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import {
  getPlacementDetailForCarer,
  listPlacementsForCarer,
} from "../services/placements/index.js";
import {
  badRequest,
  internalError,
  notFound,
} from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";

export async function placementsRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get(
    "/placements",
    {
      schema: {
        tags: ["placements"],
        summary: "List placements for households linked to the signed-in carer",
        security: [...bearerSecurity],
        response: {
          200: { $ref: "PlacementListDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await listPlacementsForCarer(
        request.supabase,
        request.user.id,
      );

      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.PLACEMENTS_LIST_LOAD_FAILED);
      }

      return result.data;
    },
  );

  app.get<{
    Params: { id: string };
    Querystring: { kind?: string };
  }>(
    "/placements/:id",
    {
      schema: {
        tags: ["placements"],
        summary: "Placement overview detail (view-only)",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        querystring: {
          type: "object",
          required: ["kind"],
          additionalProperties: false,
          properties: {
            kind: {
              type: "string",
              enum: ["child", "placed_parent"],
            },
          },
        },
        response: {
          200: { $ref: "PlacementDetailDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await getPlacementDetailForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
        request.query.kind ?? "",
      );

      if (result.badRequest) {
        throw badRequest(ErrorMessages.PLACEMENT_INVALID_QUERY);
      }
      if (result.notFound) {
        throw notFound(ErrorMessages.PLACEMENT_NOT_FOUND);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.PLACEMENT_LOAD_FAILED);
      }

      return result.data;
    },
  );
}
