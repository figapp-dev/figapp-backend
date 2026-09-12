import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import {
  addLifeStoryEntryForCarer,
  listLifeStoryForCarer,
} from "../services/life-story/index.js";
import { badRequest, forbidden, internalError } from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { addLifeStoryEntryBodySchema } from "../schemas/life-story.js";
import type { AddLifeStoryEntryBody } from "../types/life-story.js";

export async function lifeStoryRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{ Params: { childId: string } }>(
    "/life-story/:childId",
    {
      schema: {
        tags: ["life-story"],
        summary: "List Life Story entries for a placed child",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["childId"],
          properties: { childId: { type: "string" } },
        },
        response: {
          200: { $ref: "LifeStoryListDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await listLifeStoryForCarer(
        request.supabase,
        request.user.id,
        request.params.childId,
      );

      if (result.forbidden) {
        throw forbidden(ErrorMessages.LIFE_STORY_ACCESS_DENIED);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.LIFE_STORY_LOAD_FAILED);
      }

      return result.data;
    },
  );

  app.post<{ Params: { childId: string }; Body: AddLifeStoryEntryBody }>(
    "/life-story/:childId",
    {
      schema: {
        tags: ["life-story"],
        summary:
          "Add a Life Story entry (photo and/or notes) for a placed child",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["childId"],
          properties: { childId: { type: "string" } },
        },
        body: addLifeStoryEntryBodySchema,
        response: {
          200: { $ref: "LifeStoryEntryDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await addLifeStoryEntryForCarer(
        request.supabase,
        request.user.id,
        request.params.childId,
        request.body,
      );

      if (result.badRequest) {
        throw badRequest(ErrorMessages.LIFE_STORY_INVALID_BODY);
      }
      if (result.forbidden) {
        throw forbidden(ErrorMessages.LIFE_STORY_ACCESS_DENIED);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.LIFE_STORY_ADD_FAILED);
      }

      return result.data;
    },
  );
}
