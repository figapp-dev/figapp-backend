import type { AskAdminChatBody } from "../types/admin-chat.js";

export const askAdminChatBodySchema = {
  type: "object",
  required: ["question"],
  additionalProperties: false,
  properties: {
    question: { type: "string", minLength: 1, maxLength: 300 },
  },
} as const;

export type { AskAdminChatBody };
