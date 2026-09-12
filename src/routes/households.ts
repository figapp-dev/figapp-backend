import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import {
  getHouseholdDetailForCarer,
  listHouseholdsForCarer,
} from "../services/households/index.js";
import { internalError, notFound } from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";

export async function householdsRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get(
    "/households",
    {
      schema: {
        tags: ["households"],
        summary:
          "List households linked to the signed-in foster carer (My Household)",
        security: [...bearerSecurity],
        response: {
          200: { $ref: "HouseholdListDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await listHouseholdsForCarer(
        request.supabase,
        request.user.id,
      );

      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.HOUSEHOLDS_LOAD_FAILED);
      }

      return result.data;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/households/:id",
    {
      schema: {
        tags: ["households"],
        summary:
          "Household detail for a linked household (Overview / carers / SW team / children)",
        security: [...bearerSecurity],
        response: {
          200: { $ref: "HouseholdDetailDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await getHouseholdDetailForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
      );

      if (result.notFound) {
        throw notFound(ErrorMessages.HOUSEHOLD_NOT_FOUND);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.HOUSEHOLD_LOAD_FAILED);
      }

      return result.data;
    },
  );
}
