import * as service from "./service.js";
import { getModelConfig } from "./model.js";
import { toolRegistry } from "./tools.js";
import * as repo from "./repository.js";

export async function agentRoutes(app) {
  app.get("/agent/config", async (request, reply) => {
    const cfg = getModelConfig();
    return reply.send({
      ...cfg,
      toolCount: toolRegistry.list().length,
      policy: "Controlled",
    });
  });

  app.post("/agent/sessions", async (request, reply) => {
    try {
      const { title } = request.body || {};
      const session = await service.createSession(title);
      return reply.code(201).send({ session });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: err.message });
    }
  });

  app.get("/agent/sessions", async (request, reply) => {
    const sessions = await service.getSessions();
    return reply.send({ sessions });
  });

  app.get("/agent/sessions/:id", async (request, reply) => {
    const session = await service.getSession(request.params.id);
    if (!session) {
      return reply.code(404).send({ error: "Agent session not found" });
    }
    return reply.send({ session });
  });

  app.post("/agent/sessions/:id/messages", async (request, reply) => {
    try {
      const { content } = request.body || {};
      if (!content || !content.trim()) {
        return reply.code(400).send({ error: "Message content is required" });
      }
      const session = await service.processUserMessage(request.params.id, content);
      return reply.send({ session });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: err.message });
    }
  });

  app.get("/agent/approvals", async (request, reply) => {
    const { sessionId } = request.query || {};
    const approvals = await repo.findPendingAgentApprovals(sessionId);
    return reply.send({ approvals });
  });

  app.post("/agent/approvals/:id/approve", async (request, reply) => {
    try {
      const session = await service.approveAction(request.params.id);
      return reply.send({ session });
    } catch (err) {
      request.log.error(err);
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post("/agent/approvals/:id/reject", async (request, reply) => {
    try {
      const { reason } = request.body || {};
      const session = await service.rejectAction(request.params.id, reason);
      return reply.send({ session });
    } catch (err) {
      request.log.error(err);
      return reply.code(400).send({ error: err.message });
    }
  });
}
