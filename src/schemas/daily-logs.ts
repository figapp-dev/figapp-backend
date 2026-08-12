/** Fastify JSON Schema for PUT /daily-logs/:id body. */
export const saveDailyLogBodySchema = {
  type: "object",
  required: ["dataJson"],
  additionalProperties: false,
  properties: {
    dataJson: {
      type: "object",
      additionalProperties: true,
      description: "Full answers map (fieldId → value). Replaces data_json.",
    },
    intent: {
      type: "string",
      enum: ["save", "submit"],
      description: "save = draft/autosave (partial OK); submit = complete + validate",
    },
    isSensitive: {
      type: "boolean",
    },
    clientLogId: {
      type: "string",
      minLength: 1,
      description: "Optional client UUID for offline-safe first create",
    },
    expectedUpdatedAt: {
      type: "string",
      minLength: 1,
      description:
        "Required when log already exists — send log.updatedAt from last GET/PUT",
    },
  },
} as const;
