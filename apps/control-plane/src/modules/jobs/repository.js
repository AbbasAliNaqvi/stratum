import { eq, desc, asc, and, lte, sql, or } from "drizzle-orm";

import { db } from "../../db/client.js";
import { jobs, jobEvents, nodes } from "../../db/schema.js";

export async function insertJob(data) {
  const [job] = await db.insert(jobs).values(data).returning();

  return job;
}

export async function getJobById(id) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);

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
  message = null,
}) {
  const [event] = await db
    .insert(jobEvents)
    .values({
      jobId,
      eventType,
      nodeId,
      message,
    })
    .returning();

  return event;
}

export async function createJobWithEvent(jobData, eventData) {
  return db.transaction(async (tx) => {
    const [job] = await tx.insert(jobs).values(jobData).returning();

    const [event] = await tx
      .insert(jobEvents)
      .values({
        jobId: job.id,
        eventType: eventData.eventType,
        nodeId: eventData.nodeId ?? null,
        message: eventData.message ?? null,
      })
      .returning();

    return {
      job,
      event,
    };
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

export async function claimNextJob({ nodeId, leaseDurationMs }) {
  return db.transaction(async (tx) => {
    const now = new Date();

    const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);

    const [node] = await tx
      .select({
        nodeId: nodes.nodeId,
      })
      .from(nodes)
      .where(and(eq(nodes.nodeId, nodeId), eq(nodes.status, "registered")))
      .limit(1);

    if (!node) {
      const error = new Error(`Node '${nodeId}' is not registered`);

      error.code = "NODE_NOT_REGISTERED";

      throw error;
    }

    const [job] = await tx
      .update(jobs)
      .set({
        status: "running",
        lockedBy: nodeId,
        leaseToken: sql`${jobs.leaseToken} + 1`,
        leaseExpiresAt,
        startedAt: now,
        updatedAt: now,
      })
      .where(
        eq(
          jobs.id,
          tx
            .select({
              id: jobs.id,
            })
            .from(jobs)
            .where(
              and(
                lte(jobs.runAfter, now),
                or(
                  eq(jobs.status, "queued"),
                  and(
                    eq(jobs.status, "running"),
                    sql`${jobs.leaseExpiresAt} <= ${now}`,
                  ),
                ),
              ),
            )
            .orderBy(desc(jobs.priority), asc(jobs.createdAt))
            .limit(1)
            .for("update", {
              skipLocked: true,
            }),
        ),
      )
      .returning();

    if (!job) {
      return null;
    }

    const eventType = job.leaseToken > 1 ? "reclaimed" : "claimed";

    const message =
      eventType === "reclaimed"
        ? `Job reclaimed by node ${nodeId}`
        : `Job claimed by node ${nodeId}`;

    const [event] = await tx
      .insert(jobEvents)
      .values({
        jobId: job.id,
        eventType,
        nodeId,
        message,
      })
      .returning();

    return {
      job,
      event,
    };
  });
}

export async function completeJob({
  jobId,
  nodeId,
  leaseToken,
  result = null,
}) {
  return db.transaction(async (tx) => {
    const now = new Date();

    const [job] = await tx
      .update(jobs)
      .set({
        status: "succeeded",
        result,
        finishedAt: now,
        updatedAt: now,
        lockedBy: null,
        leaseExpiresAt: null,
      })
      .where(
        and(
          eq(jobs.id, jobId),
          eq(jobs.lockedBy, nodeId),
          eq(jobs.leaseToken, leaseToken),
          eq(jobs.status, "running"),
          sql`${jobs.leaseExpiresAt} > ${now}`,
        ),
      )
      .returning();

    if (!job) {
      return null;
    }

    const [event] = await tx
      .insert(jobEvents)
      .values({
        jobId: job.id,
        eventType: "completed",
        nodeId,
        message: `Job completed by node ${nodeId}`,
      })
      .returning();

    return {
      job,
      event,
    };
  });
}

export async function reclaimJobsForNode(nodeId) {
  return db.transaction(async (tx) => {
    const now = new Date();

    const runningJobs = await tx
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.status, "running"),
          eq(jobs.lockedBy, nodeId)
        )
      );

    const reclaimedJobs = [];

    for (const currentJob of runningJobs) {
      const shouldFail =
        currentJob.retryCount >= currentJob.maxRetries;

      const nextRetryCount = currentJob.retryCount + 1;

      const [job] = await tx
        .update(jobs)
        .set({
          status: shouldFail ? "failed" : "queued",
          retryCount: shouldFail
            ? currentJob.retryCount
            : nextRetryCount,

          lockedBy: null,
          leaseExpiresAt: null,

          runAfter: shouldFail
            ? currentJob.runAfter
            : now,

          finishedAt: shouldFail
            ? now
            : null,

          error: shouldFail
            ? `Job failed after ${currentJob.maxRetries} retries`
            : null,

          updatedAt: now,
        })
        .where(
          and(
            eq(jobs.id, currentJob.id),
            eq(jobs.status, "running"),
            eq(jobs.lockedBy, nodeId)
          )
        )
        .returning();

      if (!job) {
        continue;
      }

      const eventType = shouldFail
        ? "failed"
        : "reclaimed";

      const message = shouldFail
        ? `Job failed after ${currentJob.maxRetries} retries`
        : `Job reclaimed after node ${nodeId} became unreachable`;

      await tx
        .insert(jobEvents)
        .values({
          jobId: job.id,
          eventType,
          nodeId,
          message,
        });

      reclaimedJobs.push(job);
    }

    return reclaimedJobs;
  });
}

export async function requestJobCancellation(jobId) {
  return db.transaction(async (tx) => {
    const now = new Date();

    const [currentJob] = await tx
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1)
      .for("update");

    if (!currentJob) {
      return {
        job: null,
        event: null,
        error: "JOB_NOT_FOUND",
      };
    }

    /*
     * Terminal states cannot be cancelled.
     */
    if (currentJob.status === "succeeded") {
      return {
        job: currentJob,
        event: null,
        error: "JOB_ALREADY_SUCCEEDED",
      };
    }

    if (currentJob.status === "failed") {
      return {
        job: currentJob,
        event: null,
        error: "JOB_ALREADY_FAILED",
      };
    }

    /*
     * Cancellation is idempotent.
     *
     * If the job was already cancelled, do not create
     * another cancellation event.
     */
    if (currentJob.status === "cancelled") {
      return {
        job: currentJob,
        event: null,
        error: null,
      };
    }

    /*
     * Queued jobs can be cancelled immediately because
     * no worker owns them.
     */
    if (currentJob.status === "queued") {
      const [job] = await tx
        .update(jobs)
        .set({
          status: "cancelled",
          cancelRequestedAt: now,
          finishedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(jobs.id, jobId),
            eq(jobs.status, "queued"),
          ),
        )
        .returning();

      if (!job) {
        return {
          job: null,
          event: null,
          error: "CANCELLATION_RACE",
        };
      }

      const [event] = await tx
        .insert(jobEvents)
        .values({
          jobId: job.id,
          eventType: "cancelled",
          message: "Queued job cancelled",
        })
        .returning();

      return {
        job,
        event,
        error: null,
      };
    }

    /*
     * Running jobs cannot be immediately cancelled because
     * a worker currently owns their lease.
     *
     * Instead we record a cancellation request. The worker
     * will observe this and stop execution.
     */
    if (currentJob.status === "running") {
      const [job] = await tx
        .update(jobs)
        .set({
          cancelRequestedAt:
            currentJob.cancelRequestedAt ?? now,
          updatedAt: now,
        })
        .where(
          and(
            eq(jobs.id, jobId),
            eq(jobs.status, "running"),
          ),
        )
        .returning();

      if (!job) {
        return {
          job: null,
          event: null,
          error: "CANCELLATION_RACE",
        };
      }

      /*
       * Only create an event for the first cancellation
       * request. Repeated requests remain idempotent.
       */
      let event = null;

      if (!currentJob.cancelRequestedAt) {
        const [createdEvent] = await tx
          .insert(jobEvents)
          .values({
            jobId: job.id,
            eventType: "cancel_requested",
            nodeId: job.lockedBy,
            message: `Cancellation requested for job ${job.id}`,
          })
          .returning();

        event = createdEvent;
      }

      return {
        job,
        event,
        error: null,
      };
    }

    return {
      job: currentJob,
      event: null,
      error: "JOB_NOT_CANCELLABLE",
    };
  });
}