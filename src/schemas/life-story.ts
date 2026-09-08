import type { AddLifeStoryEntryBody } from "../types/life-story.js";

/** POST /life-story/:childId — media is required; this endpoint is
 * specifically the daily-log "Add to Life Story" photo flow. `media.path`
 * must come from a prior POST /files/signed-upload-url call with resource
 * "life_story" for this same child. */
export const addLifeStoryEntryBodySchema = {
  type: "object",
  required: ["section", "media"],
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
