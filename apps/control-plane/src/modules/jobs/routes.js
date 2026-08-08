import {
  createJob,
  getJob,
  getJobs
} from "./service.js";

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