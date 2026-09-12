import type { AddLifeStoryEntryBody } from "../types/life-story.js";

/** POST /life-story/:childId — media optional (notes-only allowed).
 * When media is sent, path must come from signed-upload-url for life_story. */
export const addLifeStoryEntryBodySchema = {
  type: "object",
  required: ["section"],
  additionalProperties: false,
  properties: {
    section: {
      type: "string",
      enum: ["leisure_fun", "academic_achievements", "other_achievements"],
    },
    notes: { type: "string" },
    media: {
      type: "object",
      required: ["path", "name"],
      additionalProperties: false,
      properties: {
        path: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        contentType: { type: "string" },
      },
    },
  },
} as const;

export type { AddLifeStoryEntryBody };
