import {
  createJob,
  getJob,
  getJobs,
  claimJob,
  completeJob,
} from "./service.js";

import { config } from "../../config.js";

export async function jobRoutes(app) {
  app.post("/jobs", async (request, reply) => {
    try {
      const job = await createJob(request.body);

      return reply.code(201).send({ job });
    } catch (error) {
      request.log.error(error);

      return reply.code(500).send({
        error: "Failed to create job"
      });
    }
  });

  app.get("/jobs", async (request, reply) => {
    const { status, type } = request.query;

    const jobs = await getJobs({
      status,
      type
    });

    return reply.send({ jobs });
  });

  app.post("/jobs/claim", async (request, reply) => {
    try {
      const { nodeId } = request.body ?? {};

      if (!nodeId) {
        return reply.code(400).send({
          error: "nodeId is required"
        });
      }

      const result = await claimJob({
        nodeId,
        leaseDurationMs: config.JOB_LEASE_DURATION_MS
      });

      return reply.send({
        job: result?.job ?? null,
        event: result?.event ?? null
      });
    } catch (error) {
      request.log.error(error);

      if (error.code === "NODE_NOT_REGISTERED") {
        return reply.code(409).send({
          error: error.message
        });
      }

      return reply.code(500).send({
        error: "Failed to claim job"
      });
    }
  });

  app.post("/jobs/:id/complete", async (request, reply) => {
    try {
      const { nodeId, leaseToken, result } = request.body ?? {};

      if (!nodeId || leaseToken === undefined) {
        return reply.code(400).send({
          error: "nodeId and leaseToken are required",
        });
      }

      const completed = await completeJob({
        jobId: request.params.id,
        nodeId,
        leaseToken,
        result,
      });

      if (!completed) {
        return reply.code(409).send({
          error: "Job completion rejected: lease is invalid or expired",
        });
      }

      return reply.send({
        job: completed.job,
        event: completed.event,
      });
    } catch (error) {
      request.log.error(error);

      return reply.code(500).send({
        error: "Failed to complete job",
      });
    }
  });

  app.get("/jobs/:id", async (request, reply) => {
    const job = await getJob(request.params.id);

    if (!job) {
      return reply.code(404).send({
        error: "Job not found"
      });
    }

    return reply.send(job);
  });
}