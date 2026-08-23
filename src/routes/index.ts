import type { FastifyInstance } from "fastify";
import { healthRoute } from "./health.js";
import { profileRoute } from "./profile.js";
import { childrenRoute } from "./children.js";
import { dailyLogsRoute } from "./daily-logs.js";
import { filesRoute } from "./files.js";
import { billingRoute } from "./billing.js";
import { billingCollectRoute } from "./internal-billing.js";
import { gocardlessWebhookRoute } from "./webhooks-gocardless.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoute);
  await app.register(gocardlessWebhookRoute);
  await app.register(billingCollectRoute);
  await app.register(profileRoute);
  await app.register(childrenRoute);
  await app.register(dailyLogsRoute);
  await app.register(filesRoute);
  await app.register(billingRoute);
}
