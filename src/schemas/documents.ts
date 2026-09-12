/** POST /documents/:id/sign */
export const signDocumentBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["hasRead"],
  properties: {
    hasRead: { type: "boolean" },
  },
} as const;
