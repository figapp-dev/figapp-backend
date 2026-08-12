import type { FastifyInstance } from "fastify";

export async function healthRoute(app: FastifyInstance) {
  app.get(
    "/health",
    {
      schema: {
        tags: ["health"],
        summary: "Liveness probe",
        response: {
          200: { $ref: "HealthResponse#" },
        },
      },
    },
    async () => {
      return {
        status: "ok" as const,
        service: "figapp-backend",
        timestamp: new Date().toISOString(),
      };
    },
  );
}
