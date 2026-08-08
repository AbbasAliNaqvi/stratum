import { buildApp } from "./app.js";
import { config } from "./config.js";
import { closeDatabase } from "./db/client.js";

const app = buildApp();

async function start() {
  try {
    await app.listen({
      host: config.CONTROL_PLANE_HOST,
      port: config.CONTROL_PLANE_PORT
    });

    app.log.info(
      `Control plane running on http://${config.CONTROL_PLANE_HOST}:${config.CONTROL_PLANE_PORT}`
    );
  } catch (error) {
    app.log.error(error);
    await closeDatabase();
    process.exit(1);
  }
}

async function shutdown(signal) {
  app.log.info(`${signal} received. Shutting down...`);

  try {
    await app.close();
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();