import {
  createJobWithEvent,
  getJobById,
  getJobByIdempotencyKey,
  getJobEvents,
  listJobs
} from "./repository.js";

export async function createJob(input) {
  /*
   * Idempotency:
   * If the client retries the same request with the same key,
   * return the already-created job instead of creating another one.
   */
  if (input.idempotencyKey) {
    const existing = await getJobByIdempotencyKey(input.idempotencyKey);

    if (existing) {
      return existing;
    }
  }

  const { job } = await createJobWithEvent(
    {
      type: input.type,
      payload: input.payload,
      priority: input.priority ?? 0,
      maxRetries: input.maxRetries ?? 3,
      idempotencyKey: input.idempotencyKey ?? null
    },
    {
      eventType: "queued",
      message: "Job created"
    }
  );

  return job;
}

export async function getJob(id) {
  const job = await getJobById(id);

  if (!job) {
    return null;
  }

  const events = await getJobEvents(id);

  return {
    job,
    events
  };
}

export async function getJobs(filters) {
  return listJobs(filters);
}