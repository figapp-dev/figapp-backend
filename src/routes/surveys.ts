import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import {
  getSurveyForCarer,
  listSurveysForCarer,
  saveSurveyDraftForCarer,
  submitSurveyForCarer,
} from "../services/surveys/index.js";
import {
  badRequest,
  forbidden,
  internalError,
  notFound,
} from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { saveSurveyResponseBodySchema } from "../schemas/surveys.js";
import type {
  SaveSurveyResponseBody,
  SurveyReceiverStatus,
} from "../types/surveys.js";

export async function surveysRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{
    Querystring: { status?: SurveyReceiverStatus; q?: string };
  }>(
    "/surveys",
    {
      schema: {
        tags: ["surveys"],
        summary: "List surveys assigned to the signed-in carer",
        security: [...bearerSecurity],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: {
              type: "string",
              enum: [
                "active",
                "in_progress",
                "completed",
                "ended",
                "archived",
              ],
            },
            q: { type: "string" },
          },
        },
        response: {
          200: { $ref: "SurveyListDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await listSurveysForCarer(
        request.supabase,
        request.user.id,
        {
          status: request.query.status,
          q: request.query.q,
        },
      );

      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.SURVEYS_LIST_LOAD_FAILED);
      }

      return result.data;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/surveys/:id",
    {
      schema: {
        tags: ["surveys"],
        summary: "Survey detail with questions and the caller's answers",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: { $ref: "SurveyDetailDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await getSurveyForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
      );

      if (result.badRequest) {
        throw badRequest(ErrorMessages.SURVEY_INVALID_BODY);
      }
      if (result.forbidden) {
        throw forbidden(ErrorMessages.SURVEY_ACCESS_DENIED);
      }
      if (result.notFound) {
        throw notFound(ErrorMessages.SURVEY_NOT_FOUND);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.SURVEY_LOAD_FAILED);
      }

      return result.data;
    },
  );

  app.put<{ Params: { id: string }; Body: SaveSurveyResponseBody }>(
    "/surveys/:id/response",
    {
      schema: {
        tags: ["surveys"],
        summary: "Save a survey response draft",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: saveSurveyResponseBodySchema,
        response: {
          200: { $ref: "SurveyDetailDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await saveSurveyDraftForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
        request.body ?? {},
      );

      if (result.badRequest) {
        throw badRequest(
          result.error?.message?.includes("agency")
            ? ErrorMessages.SURVEY_NO_AGENCY
            : ErrorMessages.SURVEY_INVALID_BODY,
        );
      }
      if (result.forbidden) {
        throw forbidden(ErrorMessages.SURVEY_ACCESS_DENIED);
      }
      if (result.notFound) {
        throw notFound(ErrorMessages.SURVEY_NOT_FOUND);
      }
      if (result.notEditable) {
        throw badRequest(ErrorMessages.SURVEY_NOT_EDITABLE);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.SURVEY_SAVE_FAILED);
      }

      return result.data;
    },
  );

  app.post<{ Params: { id: string }; Body: SaveSurveyResponseBody }>(
    "/surveys/:id/response/submit",
    {
      schema: {
        tags: ["surveys"],
        summary: "Submit a survey response",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: saveSurveyResponseBodySchema,
        response: {
          200: { $ref: "SurveyDetailDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await submitSurveyForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
        request.body ?? {},
      );

      if (result.validationFailed) {
        throw badRequest(ErrorMessages.SURVEY_REQUIRED_MISSING);
      }
      if (result.badRequest) {
        throw badRequest(
          result.error?.message?.includes("agency")
            ? ErrorMessages.SURVEY_NO_AGENCY
            : ErrorMessages.SURVEY_INVALID_BODY,
        );
      }
      if (result.forbidden) {
        throw forbidden(ErrorMessages.SURVEY_ACCESS_DENIED);
      }
      if (result.notFound) {
        throw notFound(ErrorMessages.SURVEY_NOT_FOUND);
      }
      if (result.notEditable) {
        throw badRequest(ErrorMessages.SURVEY_NOT_EDITABLE);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.SURVEY_SUBMIT_FAILED);
      }

      return result.data;
    },
  );
}
