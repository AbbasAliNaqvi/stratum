import { checkDatabaseConnection } from "../../db/client.js";

export async function healthRoutes(app) {
  app.get("/health", async () => {
    return {
      status: "ok"
    };
  });

  app.get("/health/ready", async (request, reply) => {
    try {
      await checkDatabaseConnection();

      return {
        status: "ready",
        database: "connected"
      };
    } catch (error) {
      request.log.error(
        { err: error },
        "Database readiness check failed"
      );

      reply.code(503);

      return {
        status: "not_ready",
        database: "disconnected"
      };
    }
  });
}
