import type {
  CreateTicketBody,
  CreateTicketCommentBody,
} from "../types/tickets.js";

export const createTicketBodySchema = {
  type: "object",
  required: ["subject"],
  additionalProperties: false,
  properties: {
    subject: { type: "string", minLength: 1 },
    description: { anyOf: [{ type: "string" }, { type: "null" }] },
    priority: {
      type: "string",
      enum: ["low", "normal", "high"],
    },
    attachments: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        required: ["fileName", "fileSize", "fileType", "storagePath"],
        additionalProperties: false,
        properties: {
          fileName: { type: "string", minLength: 1 },
          fileSize: { type: "integer", minimum: 0 },
          fileType: { type: "string", minLength: 1 },
          storagePath: { type: "string", minLength: 1 },
        },
      },
    },
  },
} as const;

export const createTicketCommentBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    body: { anyOf: [{ type: "string" }, { type: "null" }] },
    attachments: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        required: ["fileName", "fileSize", "fileType", "storagePath"],
        additionalProperties: false,
        properties: {
          fileName: { type: "string", minLength: 1 },
          fileSize: { type: "integer", minimum: 0 },
          fileType: { type: "string", minLength: 1 },
          storagePath: { type: "string", minLength: 1 },
        },
      },
    },
  },
} as const;

export type { CreateTicketBody, CreateTicketCommentBody };
