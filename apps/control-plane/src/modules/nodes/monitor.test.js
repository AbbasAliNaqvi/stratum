import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { eq, inArray, like } from "drizzle-orm";

import { db, pool } from "../../db/client.js";

import { jobs, jobEvents, nodes } from "../../db/schema.js";

import { claimNextJob } from "../jobs/repository.js";

import { startNodeLivenessMonitor } from "./monitor.js";

const NODE_ID = `liveness-test-worker-${Date.now()}`;

const JOB_TYPE = `STRATUM-LIVENESS-TEST-${Date.now()}`;

async function createTestNode() {
  await db
    .insert(nodes)
    .values({
      nodeId: NODE_ID,
      hostname: "liveness-test-host",
      cpuCores: 4,
      memoryMb: 4096,
      platform: "test",
      status: "registered",
      lastHeartbeatAt: new Date(Date.now() - 60_000),
    })
    .onConflictDoUpdate({
      target: nodes.nodeId,
      set: {
        hostname: "liveness-test-host",
        cpuCores: 4,
        memoryMb: 4096,
        platform: "test",
        status: "registered",
        lastHeartbeatAt: new Date(Date.now() - 60_000),
        updatedAt: new Date(),
      },
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
      priority: 100_000,
      maxRetries: 3,
      retryCount: 0,
      ...overrides,
    })
    .returning();

  return job;
}

async function cleanupJobs() {
  /*
   * IMPORTANT:
   * Only clean liveness-test jobs.
   * Do NOT touch repository-test jobs.
   */
  const testJobs = await db
    .select({
      id: jobs.id,
    })
    .from(jobs)
    .where(like(jobs.type, "STRATUM-LIVENESS-TEST-%"));

  if (testJobs.length === 0) {
    return;
  }

  const jobIds = testJobs.map((job) => job.id);

  /*
   * First move jobs out of running state so
   * jobs_running_lease_check remains valid.
   */
  await db
    .update(jobs)
    .set({
      status: "queued",
      lockedBy: null,
      leaseExpiresAt: null,
      finishedAt: null,
      cancelRequestedAt: null,
      updatedAt: new Date(),
    })
    .where(inArray(jobs.id, jobIds));

  await db.delete(jobEvents).where(inArray(jobEvents.jobId, jobIds));

  await db.delete(jobs).where(inArray(jobs.id, jobIds));
}

async function cleanupNodeJobs() {
  /*
   * Only release jobs owned by the liveness test node.
   */
  await db
    .update(jobs)
    .set({
      status: "queued",
      lockedBy: null,
      leaseExpiresAt: null,
      finishedAt: null,
      cancelRequestedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(jobs.lockedBy, NODE_ID));
}

async function cleanupNode() {
  await cleanupNodeJobs();

  await cleanupJobs();

  await db.delete(nodes).where(eq(nodes.nodeId, NODE_ID));
}

async function resetTestNode() {
  await createTestNode();
}

const logger = {
  warn: vi.fn(),
  error: vi.fn(),
};

describe("node liveness monitor", () => {
  let stopMonitor;

  beforeAll(async () => {
    await cleanupNode();
    await createTestNode();
  });

  beforeEach(async () => {
    if (stopMonitor) {
      stopMonitor();
      stopMonitor = undefined;
    }

    await cleanupNodeJobs();
    await cleanupJobs();
    await resetTestNode();

    logger.warn.mockClear();
    logger.error.mockClear();
  });

  afterAll(async () => {
    if (stopMonitor) {
      stopMonitor();
      stopMonitor = undefined;
    }

    await cleanupNode();

    await pool.end();
  });

  it("marks a stale registered node as unreachable", async () => {
    stopMonitor = startNodeLivenessMonitor(logger, {
      checkIntervalMs: 50,
    });

    await vi.waitFor(
      async () => {
        const [node] = await db
          .select()
          .from(nodes)
          .where(eq(nodes.nodeId, NODE_ID));

        expect(node).toBeDefined();

        expect(node.status).toBe("unreachable");
      },
      {
        timeout: 1_000,
        interval: 25,
      },
    );

    expect(logger.warn).toHaveBeenCalledWith(
      `Node ${NODE_ID} marked unreachable`,
    );

    stopMonitor();
    stopMonitor = undefined;
  });

  it("reclaims jobs owned by a stale node", async () => {
    const job = await createTestJob({
      retryCount: 0,
    });

    const claimed = await claimNextJob({
      nodeId: NODE_ID,
      leaseDurationMs: 60_000,
    });

    expect(claimed).not.toBeNull();

    expect(claimed.job.id).toBe(job.id);

    expect(claimed.job.status).toBe("running");

    expect(claimed.job.lockedBy).toBe(NODE_ID);

    stopMonitor = startNodeLivenessMonitor(logger, {
      checkIntervalMs: 50,
    });

    await vi.waitFor(
      async () => {
        const [node] = await db
          .select()
          .from(nodes)
          .where(eq(nodes.nodeId, NODE_ID));

        expect(node).toBeDefined();

        expect(node.status).toBe("unreachable");

        const [updatedJob] = await db
          .select()
          .from(jobs)
          .where(eq(jobs.id, job.id));

        expect(updatedJob).toBeDefined();

        expect(updatedJob.status).toBe("queued");

        expect(updatedJob.retryCount).toBe(1);

        expect(updatedJob.lockedBy).toBeNull();

        expect(updatedJob.leaseExpiresAt).toBeNull();
      },
      {
        timeout: 1_000,
        interval: 25,
      },
    );

    expect(logger.warn).toHaveBeenCalledWith(
      `Node ${NODE_ID} marked unreachable`,
    );

    expect(logger.warn).toHaveBeenCalledWith(
      `Job ${job.id} reclaimed from node ${NODE_ID}`,
    );

    stopMonitor();
    stopMonitor = undefined;
  });
});
