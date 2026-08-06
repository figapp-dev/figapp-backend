import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { getProfile } from "../services/profile.js";
import { toProfileDto } from "../mappers/profile.js";
import { internalError, notFound } from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";

export async function profileRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/profile", async (request, reply) => {
    const { data, error } = await getProfile(request.supabase, request.user.id);

    if (error) {
      request.log.error(error);
      throw internalError(ErrorMessages.PROFILE_LOAD_FAILED);
    }
    if (!data) {
      throw notFound(ErrorMessages.PROFILE_NOT_FOUND);
    }
    return toProfileDto(data);
  });
}
