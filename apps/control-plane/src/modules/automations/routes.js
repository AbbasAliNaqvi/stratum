import * as service from "./service.js";

export async function automationRoutes(app) {
  app.post("/automations", async (request, reply) => {
    try {
      const automation = await service.createAutomation(request.body);
      return reply.code(201).send({ automation });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: error.message });
    }
  });

  app.get("/automations", async (request, reply) => {
    const automations = await service.getAutomations();
    return reply.send({ automations });
  });

  app.get("/automations/:id", async (request, reply) => {
    const automation = await service.getAutomation(request.params.id);
    if (!automation) {
      return reply.code(404).send({ error: "Automation not found" });
    }
    return reply.send({ automation });
  });

  app.delete("/automations/:id", async (request, reply) => {
    await service.removeAutomation(request.params.id);
    return reply.code(204).send();
  });

  app.patch("/automations/:id", async (request, reply) => {
    try {
      const automation = await service.updateAutomation(request.params.id, request.body);
      return reply.send({ automation });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: error.message });
    }
  });

  app.post("/automations/:id/enable", async (request, reply) => {
    try {
      const automation = await service.updateAutomation(request.params.id, { enabled: 1 });
      return reply.send({ automation });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: error.message });
    }
  });

  app.post("/automations/:id/disable", async (request, reply) => {
    try {
      const automation = await service.updateAutomation(request.params.id, { enabled: 0 });
      return reply.send({ automation });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: error.message });
    }
  });

  app.post("/automations/:id/runs", async (request, reply) => {
    try {
      const run = await service.createAutomationRun(request.params.id, request.body?.input);
      return reply.code(201).send({ run });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: error.message });
    }
  });

  app.get("/automations/:id/runs", async (request, reply) => {
    const runs = await service.getRuns(request.params.id);
    return reply.send({ runs });
  });

  app.get("/runs", async (request, reply) => {
    const runs = await service.getRuns();
    return reply.send({ runs });
  });

  app.get("/runs/:id", async (request, reply) => {
    const run = await service.getRun(request.params.id);
    if (!run) {
      return reply.code(404).send({ error: "Run not found" });
    }
    return reply.send({ run });
  });

  app.post("/runs/:id/cancel", async (request, reply) => {
    try {
      const run = await service.updateRunStatus(request.params.id, "cancelled");
      return reply.send({ run });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: "Failed to cancel run" });
    }
  });
  
  app.post("/runs/:id/status", async (request, reply) => {
    try {
      const { status, result, error } = request.body;
      const run = await service.updateRunStatus(request.params.id, status, result, error);
      return reply.send({ run });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: "Failed to update run status" });
    }
  });
  
  app.post("/runs/:id/steps", async (request, reply) => {
    try {
      const { stepId, jobId } = request.body;
      const step = await service.linkRunStepToJob(request.params.id, stepId, jobId);
      return reply.code(201).send({ step });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: "Failed to link step to job" });
    }
  });
}
