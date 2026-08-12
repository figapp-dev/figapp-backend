import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "../config/env.js";
import { registerOpenApiSchemas } from "./openapi-schemas.js";

/**
 * OpenAPI schemas always register (route $refs).
 * Swagger UI (/docs) only when env.enableDocs is true.
 */
export async function registerSwagger(app: FastifyInstance) {
  registerOpenApiSchemas(app);

  if (!env.enableDocs) {
    return;
  }

  await app.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "FigApp Backend API",
        description:
          "Production mobile API for FigApp (foster_carer). Use Bearer JWT from Supabase Auth. " +
          "Response shapes here are the source of truth for Flutter models.\n\n" +
          "Error `code` values: VALIDATION_ERROR (schema), VALIDATION_FAILED (submit fields), " +
          "EXPECTED_UPDATED_AT_REQUIRED, CONFLICT, BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, " +
          "NOT_FOUND, INTERNAL_ERROR.",
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
