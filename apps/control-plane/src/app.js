import Fastify from "fastify";
import { LogController } from "fastify";

import { logger } from "@stratum/logger";
import { registry } from "@stratum/metrics";
import { startSpan, withSpanContext } from "@stratum/tracing";
import { healthRoutes } from "./modules/health/routes.js";
import { nodeRoutes } from "./modules/nodes/routes.js";
import { jobRoutes } from "./modules/jobs/routes.js";
import { metricsRoutes } from "./modules/metrics/routes.js";

const httpRequestsTotal = registry.counter({
  name: "stratum_http_requests_total",
  help: "Total HTTP requests",
});
const httpRequestDuration = registry.histogram({
  name: "stratum_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
});

class StratumLogController extends LogController {
  constructor() {
    super({
      disableRequestLogging: true,
    });
  }
}

export function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    logController: new StratumLogController(),
  });

  app.addHook("onRequest", (request, reply, done) => {
    const traceparent = request.headers["traceparent"];
    const route = request.routeOptions?.url || "unknown";

    // Create span but don't end it here
    const span = startSpan(`HTTP ${request.method} ${route}`, { traceparent });
    span.setAttribute("http.method", request.method);
    span.setAttribute("http.route", route);

    request.span = span;

    withSpanContext(span, () => {
      done();
    });
  });

  app.addHook("onResponse", async (request, reply) => {
    const status = reply.statusCode;

    const method = request.method.padEnd(6);
    // Sanitize route parameter matching for fastify to avoid high cardinality
    const route = request.routeOptions?.url || "unknown";

    // We only want to record metrics for valid routes to avoid noise
    if (route !== "unknown") {
      const labels = {
        method: request.method,
        route,
        status: String(status),
      };

      httpRequestsTotal.inc(labels);
      httpRequestDuration.observe(labels, reply.elapsedTime / 1000);
    }

    const duration = `${reply.elapsedTime.toFixed(2)}ms`;

    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

    request.log[level](
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        statusCode: status,
        responseTime: Number(reply.elapsedTime.toFixed(2)),
      },
      `${method} ${request.url} → ${status} (${duration})`,
    );

    if (request.span) {
      request.span.setAttribute("http.status_code", status);
      if (status >= 500) {
        request.span.setStatus("error");
      }
      request.span.end();
    }
  });

  app.register(healthRoutes);
  app.register(nodeRoutes);
  app.register(jobRoutes);
  app.register(metricsRoutes);

  return app;
}
