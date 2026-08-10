import type { FastifyInstance } from "fastify";
import { healthRoute } from "./health.js";
import { profileRoute } from "./profile.js";
import { childrenRoute } from "./children.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoute);
  await app.register(profileRoute);
  await app.register(childrenRoute);
}
