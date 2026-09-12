import type {
  CreateFileUploadBody,
  CreateSignedUrlBody,
} from "../types/files.js";

/** POST /files/signed-upload-url */
export const createFileUploadBodySchema = {
  type: "object",
  required: ["resource", "id", "fileName"],
  additionalProperties: false,
  properties: {
    resource: {
      type: "string",
      enum: ["daily_log", "figchat", "life_story", "child_document"],
      description: "Feature the file belongs to",
    },
    id: {
      type: "string",
      minLength: 1,
      description:
        "For daily_log: assignment id (same as GET /daily-logs/:id). For figchat: conversation id. For life_story / child_document: child id.",
    },
    fieldId: {
      type: "string",
      minLength: 1,
      description: "Template field / question id (required for daily_log only)",
    },
    section: {
      type: "string",
      enum: ["leisure_fun", "academic_achievements", "other_achievements"],
      description: "Life Story section (required for life_story only)",
    },
    fileName: { type: "string", minLength: 1 },
  },
} as const;

/** POST /files/signed-url */
export const createSignedUrlBodySchema = {
  type: "object",
  required: ["bucket", "path"],
  additionalProperties: false,
  properties: {
    bucket: { type: "string", minLength: 1 },
    path: { type: "string", minLength: 1 },
    expiresIn: { type: "integer", minimum: 1 },
  },
} as const;

export type { CreateFileUploadBody, CreateSignedUrlBody };
