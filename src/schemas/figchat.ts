import type { SendFigChatMessageBody } from "../types/figchat.js";

/** POST /figchat/conversations/:id/messages — at least one of content or
 * attachment is required, enforced in the service (not expressible cleanly
 * as a plain JSON Schema `required` here since both are optional keys). */
export const sendFigChatMessageBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    content: { type: "string" },
    attachment: {
      type: "object",
      required: ["path", "name"],
      additionalProperties: false,
      properties: {
        path: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        contentType: { type: "string" },
        size: { type: "integer", minimum: 0 },
      },
    },
  },
} as const;

export type { SendFigChatMessageBody };
