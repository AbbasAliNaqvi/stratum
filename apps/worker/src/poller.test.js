import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createJobPoller } from "./poller.js";

/*
 * Mock the config module to avoid requiring real .env
 */
vi.mock("./config.js", () => ({
  config: {
    NODE_ID: "test-worker-01",
    CONTROL_PLANE_URL: "http://127.0.0.1:3000",
    REQUEST_TIMEOUT_MS: 5000,
    HEARTBEAT_INTERVAL_MS: 10000,
    JOB_POLL_INTERVAL_MS: 2000,
    JOB_CANCEL_CHECK_INTERVAL_MS: 100,
  },
}));

/*
 * Mock the executor to avoid real sleep/echo jobs.
 */
vi.mock("./executor.js", () => ({
  executeJob: vi.fn(),
}));

import { executeJob } from "./executor.js";

function createMockClient() {
  return {
    claimJob: vi.fn(),
    getJob: vi.fn(),
    completeJob: vi.fn(),
    acknowledgeJobCancellation: vi.fn(),
    renewJobLease: vi.fn(),
  };
}

function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createRunningJob(overrides = {}) {
  return {
    id: "job-001",
    type: "sleep",
    payload: { durationMs: 5000 },
    status: "running",
    leaseToken: 1,
    leaseExpiresAt: new Date(
      Date.now() + 30_000
    ).toISOString(),
    cancelRequestedAt: null,
    ...overrides,
  };
}

describe("job poller lease renewal", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      shouldAdvanceTime: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("schedules lease renewal after claiming a job", async () => {
    const client = createMockClient();
    const logger = createMockLogger();

    const job = createRunningJob();

    client.claimJob.mockResolvedValueOnce({
      job,
      event: { eventType: "claimed" },
    });

    /*
     * getJob always returns no cancel for cancellation watcher.
     */
    client.getJob.mockResolvedValue({
      job: { ...job, cancelRequestedAt: null },
    });

    /*
     * First renewal succeeds.
     */
    const renewedJob = {
      ...job,
      leaseExpiresAt: new Date(
        Date.now() + 60_000
      ).toISOString(),
    };

    client.renewJobLease.mockResolvedValueOnce({
      job: renewedJob,
    });

    /*
     * Executor finishes successfully after renewal fires.
     */
    let resolveExecution;
    executeJob.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveExecution = resolve;
      })
    );

    client.completeJob.mockResolvedValueOnce({
      job: { ...job, status: "succeeded" },
    });

    const poller = createJobPoller({ client, logger });

    poller.start();

    /*
     * Let the initial poll run.
     */
    await vi.advanceTimersByTimeAsync(0);

    /*
     * Advance to first renewal (half of 30s = 15s).
     */
    await vi.advanceTimersByTimeAsync(15_000);

    expect(client.renewJobLease).toHaveBeenCalledWith(
      job.id,
      job.leaseToken,
    );

    /*
     * Complete the execution.
     */
    resolveExecution({ sleptMs: 5000 });
    await vi.advanceTimersByTimeAsync(200);

    poller.stop();
  });

  it("schedules another renewal after a successful one", async () => {
    const client = createMockClient();
    const logger = createMockLogger();

    const job = createRunningJob();

    client.claimJob.mockResolvedValueOnce({
      job,
      event: { eventType: "claimed" },
    });

    client.getJob.mockResolvedValue({
      job: { ...job, cancelRequestedAt: null },
    });

    const firstRenewedJob = {
      ...job,
      leaseExpiresAt: new Date(
        Date.now() + 30_000
      ).toISOString(),
    };

    const secondRenewedJob = {
      ...job,
      leaseExpiresAt: new Date(
        Date.now() + 60_000
      ).toISOString(),
    };

    client.renewJobLease
      .mockResolvedValueOnce({ job: firstRenewedJob })
      .mockResolvedValueOnce({ job: secondRenewedJob });

    let resolveExecution;
    executeJob.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveExecution = resolve;
      })
    );

    client.completeJob.mockResolvedValueOnce({
      job: { ...job, status: "succeeded" },
    });

    const poller = createJobPoller({ client, logger });
    poller.start();

    await vi.advanceTimersByTimeAsync(0);

    /*
     * First renewal at ~15s.
     */
    await vi.advanceTimersByTimeAsync(15_000);

    expect(client.renewJobLease).toHaveBeenCalledTimes(1);

    /*
     * Second renewal ~15s after first.
     */
    await vi.advanceTimersByTimeAsync(15_000);

    expect(client.renewJobLease).toHaveBeenCalledTimes(2);

    resolveExecution({ sleptMs: 5000 });
    await vi.advanceTimersByTimeAsync(200);

    poller.stop();
  });

  it("sets leaseLost on HTTP 409 and stops renewal", async () => {
    const client = createMockClient();
    const logger = createMockLogger();

    const job = createRunningJob();

    client.claimJob.mockResolvedValueOnce({
      job,
      event: { eventType: "claimed" },
    });

    client.getJob.mockResolvedValue({
      job: { ...job, cancelRequestedAt: null },
    });

    const conflictError = new Error("Lease rejected");
    conflictError.status = 409;

    client.renewJobLease.mockRejectedValueOnce(conflictError);

    let resolveExecution;
    executeJob.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveExecution = resolve;
      })
    );

    const poller = createJobPoller({ client, logger });
    poller.start();

    await vi.advanceTimersByTimeAsync(0);

    /*
     * Advance to renewal.
     */
    await vi.advanceTimersByTimeAsync(15_000);

    expect(client.renewJobLease).toHaveBeenCalledTimes(1);

    /*
     * Verify lease lost was logged.
     */
    expect(logger.warn).toHaveBeenCalledWith(
      "Job lease lost",
      expect.objectContaining({
        jobId: job.id,
        leaseToken: job.leaseToken,
      }),
    );

    /*
     * Complete execution — completeJob should NOT be called.
     */
    resolveExecution({ sleptMs: 5000 });
    await vi.advanceTimersByTimeAsync(200);

    expect(client.completeJob).not.toHaveBeenCalled();

    expect(logger.warn).toHaveBeenCalledWith(
      "Skipping completion because lease was lost",
      expect.objectContaining({
        jobId: job.id,
        leaseToken: job.leaseToken,
      }),
    );

    poller.stop();
  });

  it("retries renewal on network error", async () => {
    const client = createMockClient();
    const logger = createMockLogger();

    const job = createRunningJob();

    client.claimJob.mockResolvedValueOnce({
      job,
      event: { eventType: "claimed" },
    });

    client.getJob.mockResolvedValue({
      job: { ...job, cancelRequestedAt: null },
    });

    /*
     * First renewal fails with network error (no .status).
     * Second renewal succeeds.
     */
    const networkError = new Error("ECONNREFUSED");

    const renewedJob = {
      ...job,
      leaseExpiresAt: new Date(
        Date.now() + 60_000
      ).toISOString(),
    };

    client.renewJobLease
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({ job: renewedJob });

    let resolveExecution;
    executeJob.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveExecution = resolve;
      })
    );

    client.completeJob.mockResolvedValueOnce({
      job: { ...job, status: "succeeded" },
    });

    const poller = createJobPoller({ client, logger });
    poller.start();

    await vi.advanceTimersByTimeAsync(0);

    /*
     * Advance to first renewal attempt.
     */
    await vi.advanceTimersByTimeAsync(15_000);

    expect(client.renewJobLease).toHaveBeenCalledTimes(1);

    expect(logger.warn).toHaveBeenCalledWith(
      "Job lease renewal failed",
      expect.objectContaining({
        jobId: job.id,
        error: "ECONNREFUSED",
      }),
    );

    /*
     * Retry after 1s.
     */
    await vi.advanceTimersByTimeAsync(1_000);

    expect(client.renewJobLease).toHaveBeenCalledTimes(2);

    resolveExecution({ sleptMs: 5000 });
    await vi.advanceTimersByTimeAsync(200);

    poller.stop();
  });

  it("does not renew after job finishes", async () => {
    const client = createMockClient();
    const logger = createMockLogger();

    const job = createRunningJob({
      /*
       * Short lease so renewal would be at 2.5s.
       */
      leaseExpiresAt: new Date(
        Date.now() + 5_000
      ).toISOString(),
    });

    client.claimJob.mockResolvedValueOnce({
      job,
      event: { eventType: "claimed" },
    });

    client.getJob.mockResolvedValue({
      job: { ...job, cancelRequestedAt: null },
    });

    /*
     * Executor resolves immediately.
     */
    executeJob.mockResolvedValueOnce({ message: "done" });

    client.completeJob.mockResolvedValueOnce({
      job: { ...job, status: "succeeded" },
    });

    const poller = createJobPoller({ client, logger });
    poller.start();

    await vi.advanceTimersByTimeAsync(0);

    /*
     * Execution finishes immediately.
     * Wait enough for renewal to have fired if it weren't stopped.
     */
    await vi.advanceTimersByTimeAsync(5_000);

    expect(client.renewJobLease).not.toHaveBeenCalled();

    poller.stop();
  });

  it("does not renew after cancellation is detected", async () => {
    const client = createMockClient();
    const logger = createMockLogger();

    const job = createRunningJob();

    client.claimJob.mockResolvedValueOnce({
      job,
      event: { eventType: "claimed" },
    });

    /*
     * First getJob check returns cancel requested.
     */
    client.getJob.mockResolvedValue({
      job: { ...job, cancelRequestedAt: new Date().toISOString() },
    });

    /*
     * Executor rejects with JOB_CANCELLED from abort.
     */
    const cancelError = new Error("Job cancellation requested");
    cancelError.code = "JOB_CANCELLED";
    executeJob.mockRejectedValueOnce(cancelError);

    client.acknowledgeJobCancellation.mockResolvedValueOnce({
      job: { ...job, status: "cancelled" },
    });

    const poller = createJobPoller({ client, logger });
    poller.start();

    await vi.advanceTimersByTimeAsync(0);

    /*
     * Let cancellation watcher fire.
     */
    await vi.advanceTimersByTimeAsync(200);

    /*
     * Advance past where renewal would have fired.
     */
    await vi.advanceTimersByTimeAsync(16_000);

    expect(client.renewJobLease).not.toHaveBeenCalled();

    poller.stop();
  });

  it("skips completion when lease is lost", async () => {
    const client = createMockClient();
    const logger = createMockLogger();

    const job = createRunningJob();

    client.claimJob.mockResolvedValueOnce({
      job,
      event: { eventType: "claimed" },
    });

    client.getJob.mockResolvedValue({
      job: { ...job, cancelRequestedAt: null },
    });

    /*
     * Renewal returns null (lease no longer valid).
     */
    client.renewJobLease.mockResolvedValueOnce({
      job: null,
    });

    let resolveExecution;
    executeJob.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveExecution = resolve;
      })
    );

    const poller = createJobPoller({ client, logger });
    poller.start();

    await vi.advanceTimersByTimeAsync(0);

    /*
     * Trigger renewal.
     */
    await vi.advanceTimersByTimeAsync(15_000);

    expect(client.renewJobLease).toHaveBeenCalledTimes(1);

    expect(logger.warn).toHaveBeenCalledWith(
      "Job lease lost",
      expect.objectContaining({
        jobId: job.id,
      }),
    );

    resolveExecution({ sleptMs: 5000 });
    await vi.advanceTimersByTimeAsync(200);

    expect(client.completeJob).not.toHaveBeenCalled();

    poller.stop();
  });
});
