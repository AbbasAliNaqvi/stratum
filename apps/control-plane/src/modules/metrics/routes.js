import { registry } from "@stratum/metrics";

export async function metricsRoutes(app) {
  app.get("/metrics", async (request, reply) => {
    reply.type("text/plain; version=0.0.4");
    return registry.metrics();
  });
}
