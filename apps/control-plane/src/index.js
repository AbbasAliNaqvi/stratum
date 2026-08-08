import { buildApp } from "./app.js";
import { config } from "./config.js";
import { closeDatabase } from "./db/client.js";
import { printShutdown, printStartup } from "@stratum/logger/console";
import { startNodeLivenessMonitor } from "./modules/nodes/monitor.js";

const app = buildApp();

const stopNodeLivenessMonitor = startNodeLivenessMonitor(
  app.log
);

async function start() {
  try {
    await app.listen({
      host: config.CONTROL_PLANE_HOST,
      port: config.CONTROL_PLANE_PORT
    });

    printStartup({
      host: config.CONTROL_PLANE_HOST,
      port: config.CONTROL_PLANE_PORT,
      database: "PostgreSQL"
    });
  } catch (error) {
    app.log.error(error);
    await closeDatabase();
    process.exit(1);
  }
}

async function shutdown(signal) {
  printShutdown();

  app.log.info(`${signal} received`);

  try {
    stopNodeLivenessMonitor();
    app.log.info("Closing HTTP server...");
    await app.close();

    app.log.info("Closing PostgreSQL pool...");
    await closeDatabase();

    app.log.info("Stratum stopped cleanly");

    process.exit(0);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();