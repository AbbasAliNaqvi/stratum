import Fastify from "fastify";
import { LogController } from "fastify";

import { logger } from "@stratum/logger";
import { healthRoutes } from "./modules/health/routes.js";
import { nodeRoutes } from "./modules/nodes/routes.js";

class StratumLogController extends LogController {
  constructor() {
    super({
      disableRequestLogging: true
    });
  }
}

export function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    logController: new StratumLogController()
  });

  app.addHook("onResponse", async (request, reply) => {
    const status = reply.statusCode;

    const method = request.method.padEnd(6);
    const url = request.url;
    const duration = `${reply.elapsedTime.toFixed(2)}ms`;

    const level =
      status >= 500 ? "error" :
      status >= 400 ? "warn" :
      "info";

    request.log[level](
      {
        reqId: request.id,
        method: request.method,
        url,
        statusCode: status,
        responseTime: Number(reply.elapsedTime.toFixed(2))
      },
      `${method} ${url} → ${status} (${duration})`
    );
  });

  app.register(healthRoutes);
  app.register(nodeRoutes);

  return app;
}