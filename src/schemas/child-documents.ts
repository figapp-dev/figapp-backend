/** POST /children/:id/documents */
export const createChildDocumentBodySchema = {
  type: "object",
  required: ["title", "filePath"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1 },
    filePath: { type: "string", minLength: 1 },
    fileType: { type: "string", nullable: true },
    fileSizeBytes: { type: "integer", nullable: true, minimum: 0 },
  },
} as const;
