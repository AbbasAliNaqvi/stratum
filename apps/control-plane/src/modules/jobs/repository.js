import { eq, desc, asc, and } from "drizzle-orm";
import { db } from "../../db/client.js";
import { jobs, jobEvents } from "../../db/schema.js";

export async function insertJob(data) {
  const [job] = await db
    .insert(jobs)
    .values(data)
    .returning();

  return job;
}

export async function getJobById(id) {
  const [job] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, id))
    .limit(1);

  return job ?? null;
}

export async function listJobs({ status, type } = {}) {
  const conditions = [];

  if (status) {
    conditions.push(eq(jobs.status, status));
  }

  if (type) {
    conditions.push(eq(jobs.type, type));
  }

  let query = db
    .select()
    .from(jobs)
    .orderBy(desc(jobs.priority), asc(jobs.createdAt));

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  return query;
}

export async function insertJobEvent({
  jobId,
  eventType,
  nodeId = null,
  message = null
}) {
  const [event] = await db
    .insert(jobEvents)
    .values({
      jobId,
      eventType,
      nodeId,
      message
    })
    .returning();

  return event;
}

export async function createJobWithEvent(jobData, eventData) {
  return db.transaction(async (tx) => {
    const [job] = await tx
      .insert(jobs)
      .values(jobData)
      .returning();

    const [event] = await tx
      .insert(jobEvents)
      .values({
        jobId: job.id,
        eventType: eventData.eventType,
        nodeId: eventData.nodeId ?? null,
        message: eventData.message ?? null
      })
      .returning();

    return { job, event };
  });
}

export async function getJobEvents(jobId) {
  return db
    .select()
    .from(jobEvents)
    .where(eq(jobEvents.jobId, jobId))
    .orderBy(asc(jobEvents.createdAt));
}

export async function getJobByIdempotencyKey(idempotencyKey) {
  const [job] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.idempotencyKey, idempotencyKey))
    .limit(1);

  return job ?? null;
}