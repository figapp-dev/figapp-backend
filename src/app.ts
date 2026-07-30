import Fastify from "fastify";
import sensible from "@fastify/sensible";
import { registerRoutes } from "./routes/index.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(sensible);
  await app.register(registerRoutes);
  return app;
}
