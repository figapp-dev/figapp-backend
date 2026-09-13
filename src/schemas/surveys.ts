import type { SaveSurveyResponseBody } from "../types/surveys.js";

export const saveSurveyResponseBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    responseData: {
      type: "object",
      additionalProperties: true,
    },
    isAnonymous: { type: "boolean" },
  },
} as const;

export type { SaveSurveyResponseBody };
