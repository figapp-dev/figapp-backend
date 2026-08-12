import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = await buildApp();

async function shutdown(signal: string) {
  app.log.info({ signal }, "Shutting down");
  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

try {
  await app.listen({ port: env.port, host: "0.0.0.0" });
  app.log.info(
    {
      port: env.port,
      enableDocs: env.enableDocs,
      nodeEnv: env.nodeEnv,
    },
    "figapp-backend listening",
  );
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
