import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db, pool } from "../../db/client.js";
import { jobs, nodes, jobEvents } from "../../db/schema.js";

import { claimNextJob, completeJob, reclaimJobsForNode } from "./repository.js";

import { eq } from "drizzle-orm";

const NODE_ID = `test-worker-${Date.now()}`;

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
      type: "STRATUM-REPOSITORY-TEST",
      payload: {
        test: true,
      },
      priority: 100,
      maxRetries: 3,
      ...overrides,
    })
    .returning();

  return job;
}

async function cleanupJobs() {
  await db.delete(jobEvents);
  await db.delete(jobs);
}

describe("job lease fencing", () => {

  beforeEach(async () => {
    await cleanupJobs();

    await db.delete(nodes).where(eq(nodes.nodeId, NODE_ID));

    await createTestNode();
  });

  afterAll(async () => {
    await cleanupJobs();

    await db.delete(nodes).where(eq(nodes.nodeId, NODE_ID));

    await pool.end();
  });

  it("completes a job with a valid lease", async () => {
    await createTestJob();

    const claimed = await claimNextJob({
      nodeId: NODE_ID,
      leaseDurationMs: 60_000,
    });

    expect(claimed).not.toBeNull();
    expect(claimed.job.status).toBe("running");
    expect(claimed.job.leaseToken).toBe(1);

    const completed = await completeJob({
      jobId: claimed.job.id,
      nodeId: NODE_ID,
      leaseToken: 1,
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
    await createTestJob();

    const claimed = await claimNextJob({
      nodeId: NODE_ID,
      leaseDurationMs: 60_000,
    });

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
    await createTestJob();

    const firstClaim = await claimNextJob({
      nodeId: NODE_ID,
      leaseDurationMs: 60_000,
    });

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
    await createTestJob({
      maxRetries: 3,
      retryCount: 0,
    });

    const claimed = await claimNextJob({
      nodeId: NODE_ID,
      leaseDurationMs: 60_000,
    });

    const reclaimed = await reclaimJobsForNode(NODE_ID);

    expect(reclaimed).toHaveLength(1);
    expect(reclaimed[0].id).toBe(claimed.job.id);
    expect(reclaimed[0].status).toBe("queued");
    expect(reclaimed[0].retryCount).toBe(1);
    expect(reclaimed[0].lockedBy).toBeNull();
    expect(reclaimed[0].leaseExpiresAt).toBeNull();
  });

  it("fails an exhausted job without exceeding maxRetries", async () => {
    await createTestJob({
      maxRetries: 3,
      retryCount: 3,
    });

    const claimed = await claimNextJob({
      nodeId: NODE_ID,
      leaseDurationMs: 60_000,
    });

    const reclaimed = await reclaimJobsForNode(NODE_ID);

    expect(reclaimed).toHaveLength(1);
    expect(reclaimed[0].id).toBe(claimed.job.id);
    expect(reclaimed[0].status).toBe("failed");
    expect(reclaimed[0].retryCount).toBe(3);
    expect(reclaimed[0].finishedAt).not.toBeNull();
    expect(reclaimed[0].error).toContain("3 retries");
  });
});
