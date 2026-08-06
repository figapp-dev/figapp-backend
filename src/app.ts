import Fastify from "fastify";
import sensible from "@fastify/sensible";
import { registerRoutes } from "./routes/index.js";
import { AppError } from "./lib/errors.js";
import { ErrorMessages } from "./constants/error-messages.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(sensible);
  await app.register(registerRoutes);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
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
