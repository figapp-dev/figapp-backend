import type {
  CreateFileUploadBody,
  CreateSignedUrlBody,
} from "../types/files.js";

/** POST /files/signed-upload-url */
export const createFileUploadBodySchema = {
  type: "object",
  required: ["resource", "id", "fieldId", "fileName"],
  additionalProperties: false,
  properties: {
    resource: {
      type: "string",
      enum: ["daily_log"],
      description: "Feature the file belongs to",
    },
    id: {
      type: "string",
      minLength: 1,
      description: "For daily_log: assignment id (same as GET /daily-logs/:id)",
    },
    fieldId: {
      type: "string",
      minLength: 1,
      description: "Template field / question id",
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
