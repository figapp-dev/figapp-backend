import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import { dailyLogCatalog } from "../daily-log-catalog/catalog.js";

const catalogResponseSchema = {
  type: "object",
  required: ["schemaVersion", "catalogVersion", "fields"],
  properties: {
    schemaVersion: { type: "number" },
    catalogVersion: { type: "number" },
    fields: { type: "object", additionalProperties: true },
  },
} as const;

export async function dailyLogCatalogRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get(
    "/daily-log-catalog",
    {
      schema: {
        tags: ["daily-logs"],
        summary:
          "Question wording, visibility rules, and AI-suggestion phrases for every daily log field. " +
          "One global, unresolved document -- {they}/{possessive}/{wasWere}/{who}/{type} tokens are " +
          "still literal; the caller substitutes them locally, per child/row, after fetching. " +
          "Not embedded in GET /daily-logs/:id so this stays cacheable across children and logs.",
        security: [...bearerSecurity],
        response: {
          200: catalogResponseSchema,
          ...errorResponses,
        },
      },
    },
    async () => dailyLogCatalog,
  );
}
