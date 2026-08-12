import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { registerOpenApiSchemas } from "./openapi-schemas.js";

/**
 * OpenAPI 3 + Swagger UI for Flutter / Postman clients.
 * UI:    GET /docs
 * Spec:  GET /docs/json  (also /documentation/json via plugin defaults if configured)
 */
export async function registerSwagger(app: FastifyInstance) {
  registerOpenApiSchemas(app);

  await app.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "FigApp Backend API",
        description:
          "Mobile API for FigApp (foster_carer). Use Bearer JWT from Supabase Auth. " +
          "Response shapes here are the source of truth for Flutter models.",
        version: "1.0.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Supabase access_token",
          },
        },
      },
      tags: [
        { name: "health", description: "Liveness" },
        { name: "profile", description: "Signed-in carer profile" },
        { name: "children", description: "Children & placed parents" },
        { name: "daily-logs", description: "Daily log assignments & answers" },
        { name: "files", description: "Signed upload / download URLs" },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      tryItOutEnabled: true,
    },
  });
}

/** Reusable response map for authenticated JSON APIs. */
export const errorResponses = {
  400: { description: "Bad request", $ref: "ErrorResponse#" },
  401: { description: "Unauthorized", $ref: "ErrorResponse#" },
  403: { description: "Forbidden", $ref: "ErrorResponse#" },
  404: { description: "Not found", $ref: "ErrorResponse#" },
  409: { description: "Conflict", $ref: "ErrorResponse#" },
  500: { description: "Internal error", $ref: "ErrorResponse#" },
} as const;

export const bearerSecurity = [{ bearerAuth: [] }] as const;
