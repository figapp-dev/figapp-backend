import type {
  AddLifeStoryEntryBody,
  UpdateLifeStoryEntryBody,
} from "../types/life-story.js";

const LIFE_STORY_SECTION_ENUM = [
  "leisure_fun",
  "academic_achievements",
  "milestones",
  "other_events",
] as const;

/** POST /life-story/:childId — media optional (notes-only allowed).
 * When media is sent, path must come from signed-upload-url for life_story. */
export const addLifeStoryEntryBodySchema = {
  type: "object",
  required: ["section"],
  additionalProperties: false,
  properties: {
    section: {
      type: "string",
      enum: [...LIFE_STORY_SECTION_ENUM],
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

/** PATCH /life-story/:childId/entries/:entryId */
export const updateLifeStoryEntryBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    section: {
      type: "string",
      enum: [...LIFE_STORY_SECTION_ENUM],
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
    clearMedia: { type: "boolean" },
  },
} as const;

export type { AddLifeStoryEntryBody, UpdateLifeStoryEntryBody };
