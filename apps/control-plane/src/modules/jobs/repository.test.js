import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { eq, inArray } from "drizzle-orm";

import { db, pool } from "../../db/client.js";
import { jobs, nodes, jobEvents } from "../../db/schema.js";

import {
  claimNextJob,
  completeJob,
  reclaimJobsForNode,
  requestJobCancellation,
} from "./repository.js";

const NODE_ID = `test-worker-${Date.now()}`;

const JOB_TYPE = `STRATUM-REPOSITORY-TEST-${Date.now()}`;

async function createTestNode() {
  await db
    .insert(nodes)
    .values({
      nodeId: NODE_ID,
      hostname: "test-host",
      cpuCores: 4,
      memoryMb: 4096,
      platform: "test",
      status: "registered",
    })
    .onConflictDoNothing({
      target: nodes.nodeId,
    });
}

async function createTestJob(overrides = {}) {
  const [job] = await db
    .insert(jobs)
    .values({
      type: JOB_TYPE,
      payload: {
        test: true,
      },
      priority: 100,
      maxRetries: 3,
      retryCount: 0,
      ...overrides,
    })
    .returning();

  return job;
}

async function cleanupJobs() {
  const testJobs = await db
    .select({
      id: jobs.id,
    })
    .from(jobs)
    .where(eq(jobs.type, JOB_TYPE));

  if (testJobs.length === 0) {
    return;
  }

  const jobIds = testJobs.map((job) => job.id);

  // job_events has a foreign key to jobs,
  // so events must be deleted first.
  await db.delete(jobEvents).where(inArray(jobEvents.jobId, jobIds));

  await db.delete(jobs).where(inArray(jobs.id, jobIds));
}

async function cleanupNode() {
  await db
    .update(jobs)
    .set({
      status: "queued",
      lockedBy: null,
      leaseExpiresAt: null,
      finishedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(jobs.lockedBy, NODE_ID));

  await cleanupJobs();

  await db.delete(nodes).where(eq(nodes.nodeId, NODE_ID));
}

describe("job lease fencing", () => {
  beforeEach(async () => {
    await cleanupJobs();
    await cleanupNode();
    await createTestNode();
  });

  afterAll(async () => {
    await cleanupJobs();
    await cleanupNode();
    await pool.end();
  });

  it("completes a job with a valid lease", async () => {
    const job = await createTestJob();

    const claimed = await claimNextJob({
      nodeId: NODE_ID,
      leaseDurationMs: 60_000,
    });

    expect(claimed).not.toBeNull();
    expect(claimed.job.id).toBe(job.id);
    expect(claimed.job.status).toBe("running");
    expect(claimed.job.leaseToken).toBe(1);

    const completed = await completeJob({
      jobId: claimed.job.id,
      nodeId: NODE_ID,
      leaseToken: claimed.job.leaseToken,
      result: {
        message: "success",
      },
    });

    expect(completed).not.toBeNull();
    expect(completed.job.status).toBe("succeeded");
    expect(completed.job.result).toEqual({
      message: "success",
    });
  });

  it("rejects an invalid lease token", async () => {
    const job = await createTestJob();

    const claimed = await claimNextJob({
      nodeId: NODE_ID,
      leaseDurationMs: 60_000,
    });

    expect(claimed).not.toBeNull();
    expect(claimed.job.id).toBe(job.id);

    const completed = await completeJob({
      jobId: claimed.job.id,
      nodeId: NODE_ID,
      leaseToken: 999,
      result: {
        message: "should fail",
      },
    });

    expect(completed).toBeNull();
  });

  it("fences the old lease after reclaim", async () => {
    const job = await createTestJob();

    const firstClaim = await claimNextJob({
      nodeId: NODE_ID,
      leaseDurationMs: 60_000,
    });

    expect(firstClaim).not.toBeNull();
    expect(firstClaim.job.id).toBe(job.id);
    expect(firstClaim.job.leaseToken).toBe(1);

    await db
      .update(jobs)
      .set({
        leaseExpiresAt: new Date(Date.now() - 1_000),
      })
      .where(eq(jobs.id, firstClaim.job.id));

    const secondClaim = await claimNextJob({
      nodeId: NODE_ID,
      leaseDurationMs: 60_000,
    });

    expect(secondClaim).not.toBeNull();
    expect(secondClaim.job.id).toBe(firstClaim.job.id);
    expect(secondClaim.job.leaseToken).toBe(2);

    const staleCompletion = await completeJob({
      jobId: firstClaim.job.id,
      nodeId: NODE_ID,
      leaseToken: 1,
      result: {
        message: "STALE WORKER SHOULD NOT WIN",
      },
    });

    expect(staleCompletion).toBeNull();

    const validCompletion = await completeJob({
      jobId: secondClaim.job.id,
      nodeId: NODE_ID,
      leaseToken: 2,
      result: {
        message: "CURRENT WORKER WINS",
      },
    });

    expect(validCompletion).not.toBeNull();
    expect(validCompletion.job.status).toBe("succeeded");
    expect(validCompletion.job.result).toEqual({
      message: "CURRENT WORKER WINS",
    });
  });

  it("reclaims a running job and increments retryCount", async () => {
    const job = await createTestJob({
      maxRetries: 3,
      retryCount: 0,
    });

    const claimed = await claimNextJob({
      nodeId: NODE_ID,
      leaseDurationMs: 60_000,
    });

    expect(claimed).not.toBeNull();
    expect(claimed.job.id).toBe(job.id);

    const reclaimed = await reclaimJobsForNode(NODE_ID);

    expect(reclaimed).toHaveLength(1);
    expect(reclaimed[0].id).toBe(claimed.job.id);
    expect(reclaimed[0].status).toBe("queued");
    expect(reclaimed[0].retryCount).toBe(1);
    expect(reclaimed[0].lockedBy).toBeNull();
    expect(reclaimed[0].leaseExpiresAt).toBeNull();
  });

  it("fails an exhausted job without exceeding maxRetries", async () => {
    const job = await createTestJob({
      maxRetries: 3,
      retryCount: 3,
    });

    const claimed = await claimNextJob({
      nodeId: NODE_ID,
      leaseDurationMs: 60_000,
    });

    expect(claimed).not.toBeNull();
    expect(claimed.job.id).toBe(job.id);

    const reclaimed = await reclaimJobsForNode(NODE_ID);

    expect(reclaimed).toHaveLength(1);
    expect(reclaimed[0].id).toBe(claimed.job.id);
    expect(reclaimed[0].status).toBe("failed");
    expect(reclaimed[0].retryCount).toBe(3);
    expect(reclaimed[0].finishedAt).not.toBeNull();
    expect(reclaimed[0].error).toContain("3 retries");
  });

  it("cancels a queued job immediately", async () => {
    const job = await createTestJob();

    const result = await requestJobCancellation(job.id);

    expect(result.error).toBeNull();
    expect(result.job.status).toBe("cancelled");
    expect(result.job.cancelRequestedAt).not.toBeNull();
    expect(result.job.finishedAt).not.toBeNull();
    expect(result.job.lockedBy).toBeNull();
    expect(result.job.leaseExpiresAt).toBeNull();

    expect(result.event).not.toBeNull();
    expect(result.event.eventType).toBe("cancelled");
    expect(result.event.jobId).toBe(job.id);
    expect(result.event.message).toBe("Queued job cancelled");
  });

  it("requests cancellation for a running job", async () => {
    const job = await createTestJob();

    const claimed = await claimNextJob({
      nodeId: NODE_ID,
      leaseDurationMs: 60_000,
    });

    expect(claimed).not.toBeNull();
    expect(claimed.job.id).toBe(job.id);
    expect(claimed.job.status).toBe("running");

    const result = await requestJobCancellation(job.id);

    expect(result.error).toBeNull();
    expect(result.job.status).toBe("running");
    expect(result.job.cancelRequestedAt).not.toBeNull();
    expect(result.job.lockedBy).toBe(NODE_ID);
    expect(result.job.leaseExpiresAt).not.toBeNull();

    expect(result.event).not.toBeNull();
    expect(result.event.eventType).toBe("cancel_requested");
    expect(result.event.jobId).toBe(job.id);
    expect(result.event.nodeId).toBe(NODE_ID);
  });
it("rejects cancellation of a succeeded job", async () => {
  const job = await createTestJob();

  const claimed = await claimNextJob({
    nodeId: NODE_ID,
    leaseDurationMs: 60_000,
  });

  expect(claimed).not.toBeNull();

  const completed = await completeJob({
    jobId: claimed.job.id,
    nodeId: NODE_ID,
    leaseToken: claimed.job.leaseToken,
    result: {
      message: "completed before cancellation",
    },
  });


  expect(completed).not.toBeNull();
  expect(completed.job.status).toBe("succeeded");

  const result = await requestJobCancellation(job.id);

  expect(result.error).toBe("JOB_ALREADY_SUCCEEDED");
  expect(result.job.status).toBe("succeeded");
  expect(result.event).toBeNull();
});


  it("rejects cancellation of a failed job", async () => {
    const job = await createTestJob({
      maxRetries: 0,
      retryCount: 0,
    });

    const claimed = await claimNextJob({
      nodeId: NODE_ID,
      leaseDurationMs: 60_000,
    });

    expect(claimed).not.toBeNull();

    const reclaimed = await reclaimJobsForNode(NODE_ID);

    expect(reclaimed).toHaveLength(1);
    expect(reclaimed[0].status).toBe("failed");

    const result = await requestJobCancellation(job.id);

    expect(result.error).toBe("JOB_ALREADY_FAILED");
    expect(result.job.status).toBe("failed");
    expect(result.event).toBeNull();
  });

  it("returns an already cancelled job without creating another event", async () => {
    const job = await createTestJob();

    const firstCancellation = await requestJobCancellation(job.id);

    expect(firstCancellation.error).toBeNull();
    expect(firstCancellation.job.status).toBe("cancelled");
    expect(firstCancellation.event).not.toBeNull();

    const eventsBeforeSecondCancellation = await db
      .select()
      .from(jobEvents)
      .where(eq(jobEvents.jobId, job.id));

    const secondCancellation = await requestJobCancellation(job.id);

    expect(secondCancellation.error).toBeNull();
    expect(secondCancellation.job.status).toBe("cancelled");
    expect(secondCancellation.event).toBeNull();

    const eventsAfterSecondCancellation = await db
      .select()
      .from(jobEvents)
      .where(eq(jobEvents.jobId, job.id));

    expect(eventsAfterSecondCancellation).toHaveLength(
      eventsBeforeSecondCancellation.length,
    );
  });

  it("returns JOB_NOT_FOUND for a missing job", async () => {
    const result = await requestJobCancellation(
      "00000000-0000-0000-0000-000000000000",
    );

    expect(result.error).toBe("JOB_NOT_FOUND");
    expect(result.job).toBeNull();
    expect(result.event).toBeNull();
  });
});
