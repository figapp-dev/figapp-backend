import { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import {
  getChildForCarer,
  listChildrenForCarer,
  listPlacementsForCarer,
} from "../services/children.js";
import { internalError, notFound } from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";

export async function childrenRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/children", async (request) => {
    const { data, error } = await listChildrenForCarer(
      request.supabase,
      request.user.id,
    );

    if (error) {
      request.log.error(error);
      throw internalError(ErrorMessages.CHILDREN_LOAD_FAILED);
    }

    return data;
  });

  app.get<{ Params: { id: string } }>("/children/:id", async (request) => {
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
  });

  app.get<{ Params: { id: string } }>(
    "/children/:id/placements",
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
