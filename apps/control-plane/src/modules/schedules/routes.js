import * as service from "./service.js";
import { createAutomationRun } from "../automations/service.js";

export async function scheduleRoutes(app) {
  app.post("/schedules", async (request, reply) => {
    try {
      const schedule = await service.createSchedule(request.body);
      return reply.code(201).send({ schedule });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: error.message });
    }
  });

  app.get("/schedules", async (request, reply) => {
    const schedules = await service.getSchedules();
    return reply.send({ schedules });
  });

  app.get("/schedules/:id", async (request, reply) => {
    const schedule = await service.getSchedule(request.params.id);
    if (!schedule) {
      return reply.code(404).send({ error: "Schedule not found" });
    }
    return reply.send({ schedule });
  });

  app.patch("/schedules/:id", async (request, reply) => {
    try {
      const schedule = await service.updateSchedule(request.params.id, request.body);
      return reply.send({ schedule });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: error.message });
    }
  });

  app.post("/schedules/:id/enable", async (request, reply) => {
    try {
      const schedule = await service.updateSchedule(request.params.id, { enabled: 1 });
      return reply.send({ schedule });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: error.message });
    }
  });

  app.post("/schedules/:id/disable", async (request, reply) => {
    try {
      const schedule = await service.updateSchedule(request.params.id, { enabled: 0 });
      return reply.send({ schedule });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: error.message });
    }
  });

  app.post("/schedules/:id/run", async (request, reply) => {
    try {
      const schedule = await service.getSchedule(request.params.id);
      if (!schedule) {
        return reply.code(404).send({ error: "Schedule not found" });
      }
      const run = await createAutomationRun(schedule.automationId, schedule.inputs || {});
      return reply.code(201).send({ run });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: error.message });
    }
  });

  app.delete("/schedules/:id", async (request, reply) => {
    await service.removeSchedule(request.params.id);
    return reply.code(204).send();
  });
}
