import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { eq } from "drizzle-orm";

import { db, pool } from "../../db/client.js";
import {
  jobs,
  jobEvents,
  nodes,
} from "../../db/schema.js";

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

  for (const job of testJobs) {
    await db
      .delete(jobEvents)
      .where(eq(jobEvents.jobId, job.id));
  }

  // Remove FK references to the test node.
  await db
    .update(jobs)
    .set({
      lockedBy: null,
      leaseExpiresAt: null,
    })
    .where(eq(jobs.type, JOB_TYPE));

  await db
    .delete(jobs)
    .where(eq(jobs.type, JOB_TYPE));
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

  await db
    .delete(nodes)
    .where(eq(nodes.nodeId, NODE_ID));
}

async function resetTestNode() {
  await db
    .update(nodes)
    .set({
      status: "registered",
      lastHeartbeatAt: new Date(Date.now() - 60_000),
      updatedAt: new Date(),
    })
    .where(eq(nodes.nodeId, NODE_ID));
}

const logger = {
  warn: vi.fn(),
  error: vi.fn(),
};

describe("node liveness monitor", () => {
  let stopMonitor;

  beforeAll(async () => {
    await cleanupJobs();
    await cleanupNode();
    await createTestNode();
  });

  beforeEach(async () => {
    if (stopMonitor) {
      stopMonitor();
      stopMonitor = undefined;
    }

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

    await cleanupJobs();
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

        expect(node.status).toBe("unreachable");
      },
      {
        timeout: 1_000,
        interval: 25,
      }
    );

    expect(logger.warn).toHaveBeenCalledWith(
      `Node ${NODE_ID} marked unreachable`
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

        expect(node.status).toBe("unreachable");

        const [updatedJob] = await db
          .select()
          .from(jobs)
          .where(eq(jobs.id, job.id));

        expect(updatedJob.status).toBe("queued");
        expect(updatedJob.retryCount).toBe(1);
        expect(updatedJob.lockedBy).toBeNull();
        expect(updatedJob.leaseExpiresAt).toBeNull();
      },
      {
        timeout: 1_000,
        interval: 25,
      }
    );

    expect(logger.warn).toHaveBeenCalledWith(
      `Node ${NODE_ID} marked unreachable`
    );

    expect(logger.warn).toHaveBeenCalledWith(
      `Job ${job.id} reclaimed from node ${NODE_ID}`
    );

    stopMonitor();
    stopMonitor = undefined;
  });
});