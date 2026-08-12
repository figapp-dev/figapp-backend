import Fastify from "fastify";
import sensible from "@fastify/sensible";
import { registerSwagger } from "./plugins/swagger.js";
import { registerRoutes } from "./routes/index.js";
import { AppError } from "./lib/errors.js";
import { ErrorMessages } from "./constants/error-messages.js";

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
    logger: true,
  });

  await app.register(sensible);
  // Swagger must register before routes so every route is documented.
  await registerSwagger(app);
  await app.register(registerRoutes);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
      });
    }

    if (isFastifyValidationError(error)) {
      return reply.status(400).send({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: error.message || ErrorMessages.VALIDATION_ERROR,
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
          typeof (error as { code?: unknown }).code === "string"
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

  return app;
}
