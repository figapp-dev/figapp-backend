import Fastify from "fastify";
import sensible from "@fastify/sensible";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/env.js";
import { registerSwagger } from "./plugins/swagger.js";
import { registerRoutes } from "./routes/index.js";
import { AppError } from "./lib/errors.js";
import { ErrorMessages } from "./constants/error-messages.js";
import { formatValidationMessage } from "./lib/validation-errors.js";

function isFastifyValidationError(
  error: unknown,
): error is Error & { validation: unknown; statusCode?: number; code?: string } {
  return (
    !!error &&
    typeof error === "object" &&
    "validation" in error &&
    Array.isArray((error as { validation?: unknown }).validation)
  );
}

export async function buildApp() {
  const app = Fastify({
    trustProxy: true,
    requestIdHeader: "x-request-id",
    logger:
      env.nodeEnv === "test"
        ? false
        : {
            level: env.isProduction ? "info" : "debug",
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "req.headers['authorization']",
              ],
              censor: "[Redacted]",
            },
          },
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
        ...error.details,
      });
    }

    if (isFastifyValidationError(error)) {
      return reply.status(400).send({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: formatValidationMessage(
          error.validation,
          ErrorMessages.VALIDATION_ERROR,
        ),
      });
    }

    const statusCode =
      typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? ((error as { statusCode: number }).statusCode)
        : undefined;

    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        statusCode,
        code:
          typeof (error as { code?: unknown }).code === "string" &&
          (error as { code: string }).code !== "FST_ERR_VALIDATION"
            ? (error as { code: string }).code
            : "BAD_REQUEST",
        message:
          error instanceof Error ? error.message : ErrorMessages.BAD_REQUEST,
      });
    }

    request.log.error(error);

    return reply.status(500).send({
      statusCode: 500,
      code: "INTERNAL_ERROR",
      message: ErrorMessages.INTERNAL_ERROR,
    });
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  await app.register(sensible);
  await app.register(cors, {
    origin: env.corsOrigins,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "Accept",
      "X-Requested-With",
    ],
  });
  await app.register(rateLimit, {
    max: env.rateLimitMax,
    timeWindow: env.rateLimitWindow,
    allowList: (request) => {
      const path = request.url.split("?")[0];
      return path === "/health" || path === "/webhooks/gocardless" || path === "/internal/billing/collect";
    },
  });

  // Swagger must register before routes so every route is documented (when enabled).
  await registerSwagger(app);
  await app.register(registerRoutes);

  return app;
}
