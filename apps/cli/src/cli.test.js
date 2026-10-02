import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createProgram } from "./program.js";

function createMockClient() {
  return {
    submitJob: vi.fn(),
    listJobs: vi.fn(),
    getJob: vi.fn(),
    cancelJob: vi.fn(),
  };
}

function captureOutput() {
  const output = {
    stdout: [],
    stderr: [],
  };

  const originalLog = console.log;
  const originalError = console.error;
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  console.log = (...args) => {
    output.stdout.push(args.join(" "));
  };

  console.error = (...args) => {
    output.stderr.push(args.join(" "));
  };

  process.stdout.write = (chunk) => {
    output.stdout.push(String(chunk));
    return true;
  };

  process.stderr.write = (chunk) => {
    output.stderr.push(String(chunk));
    return true;
  };

  output.restore = () => {
    console.log = originalLog;
    console.error = originalError;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  };

  return output;
}

async function run(client, args) {
  const output = captureOutput();

  try {
    process.exitCode = 0;

    const program = createProgram({ client });

    program.exitOverride();

    program.configureOutput({
      writeOut: (str) => output.stdout.push(str),
      writeErr: (str) => output.stderr.push(str),
    });

    await program.parseAsync(
      ["node", "stratum", ...args],
    );

    return {
      exitCode: process.exitCode ?? 0,
      stdout: output.stdout.join("\n"),
      stderr: output.stderr.join("\n"),
    };
  } catch (error) {
    /*
     * Commander throws CommanderError for --help
     * and --version with exitCode 0.
     */
    const exitCode =
      error.exitCode === 0
        ? 0
        : process.exitCode || 1;

    return {
      exitCode,
      stdout: output.stdout.join("\n"),
      stderr: output.stderr.join("\n"),
      error,
    };
  } finally {
    output.restore();
  }
}


describe("stratum cli", () => {
  afterEach(() => {
    process.exitCode = 0;
  });

  /*
   * ── Command Parsing ──────────────────────────────────────
   */

  describe("command parsing", () => {
    it("shows help", async () => {
      const client = createMockClient();
      const result = await run(client, ["--help"]);

      expect(result.stdout).toContain("stratum");
      expect(result.stdout).toContain("job");
    });

    it("shows version", async () => {
      const client = createMockClient();
      const result = await run(client, ["--version"]);

      expect(result.stdout).toContain("0.1.0");
    });

    it("shows job subcommand help", async () => {
      const client = createMockClient();
      const result = await run(client, ["job", "--help"]);

      /*
       * Commander may write subcommand help to stdout
       * or stderr depending on how configureOutput
       * propagates. Check combined output.
       */
      const combined = result.stdout + result.stderr;

      expect(combined).toContain("submit");
      expect(combined).toContain("list");
      expect(combined).toContain("status");
      expect(combined).toContain("cancel");
    });
  });

  /*
   * ── Job Submit ───────────────────────────────────────────
   */

  describe("job submit", () => {
    it("submits a job with required type", async () => {
      const client = createMockClient();

      client.submitJob.mockResolvedValueOnce({
        job: {
          id: "abc-123",
          type: "echo",
          status: "queued",
          payload: { message: "hello" },
          priority: 0,
          maxRetries: 3,
          retryCount: 0,
          createdAt: "2026-10-02T09:00:00Z",
        },
      });

      const result = await run(client, [
        "job",
        "submit",
        "-t",
        "echo",
        "-p",
        '{"message":"hello"}',
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("submitted");
      expect(result.stdout).toContain("abc-123");

      expect(client.submitJob).toHaveBeenCalledWith({
        type: "echo",
        payload: { message: "hello" },
        priority: 0,
        maxRetries: 3,
      });
    });

    it("submits a job with all options", async () => {
      const client = createMockClient();

      client.submitJob.mockResolvedValueOnce({
        job: {
          id: "def-456",
          type: "sleep",
          status: "queued",
          payload: { durationMs: 5000 },
          priority: 10,
          maxRetries: 5,
          retryCount: 0,
          idempotencyKey: "my-key",
          createdAt: "2026-10-02T09:00:00Z",
        },
      });

      const result = await run(client, [
        "job",
        "submit",
        "-t",
        "sleep",
        "-p",
        '{"durationMs":5000}',
        "--priority",
        "10",
        "--max-retries",
        "5",
        "--idempotency-key",
        "my-key",
      ]);

      expect(result.exitCode).toBe(0);

      expect(client.submitJob).toHaveBeenCalledWith({
        type: "sleep",
        payload: { durationMs: 5000 },
        priority: 10,
        maxRetries: 5,
        idempotencyKey: "my-key",
      });
    });

    it("outputs JSON when --json is set", async () => {
      const client = createMockClient();

      const mockResponse = {
        job: {
          id: "abc-123",
          type: "echo",
          status: "queued",
          payload: {},
          priority: 0,
          maxRetries: 3,
          retryCount: 0,
          createdAt: "2026-10-02T09:00:00Z",
        },
      };

      client.submitJob.mockResolvedValueOnce(mockResponse);

      const result = await run(client, [
        "job",
        "submit",
        "-t",
        "echo",
        "--json",
      ]);

      expect(result.exitCode).toBe(0);

      const parsed = JSON.parse(result.stdout);
      expect(parsed.job.id).toBe("abc-123");
    });

    it("rejects invalid JSON payload", async () => {
      const client = createMockClient();

      const result = await run(client, [
        "job",
        "submit",
        "-t",
        "echo",
        "-p",
        "not-json",
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Invalid JSON");
    });

    it("rejects non-numeric priority", async () => {
      const client = createMockClient();

      const result = await run(client, [
        "job",
        "submit",
        "-t",
        "echo",
        "--priority",
        "abc",
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Priority");
    });

    it("handles API error on submit", async () => {
      const client = createMockClient();

      client.submitJob.mockRejectedValueOnce(
        new Error("Connection refused"),
      );

      const result = await run(client, [
        "job",
        "submit",
        "-t",
        "echo",
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Connection refused");
    });
  });

  /*
   * ── Job List ─────────────────────────────────────────────
   */

  describe("job list", () => {
    it("lists jobs", async () => {
      const client = createMockClient();

      client.listJobs.mockResolvedValueOnce({
        jobs: [
          {
            id: "aaa-111",
            type: "echo",
            status: "queued",
            priority: 0,
          },
          {
            id: "bbb-222",
            type: "sleep",
            status: "running",
            priority: 5,
          },
        ],
      });

      const result = await run(client, [
        "job",
        "list",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("aaa-111");
      expect(result.stdout).toContain("bbb-222");
      expect(result.stdout).toContain("Total: 2");
    });

    it("passes status filter", async () => {
      const client = createMockClient();

      client.listJobs.mockResolvedValueOnce({
        jobs: [],
      });

      await run(client, [
        "job",
        "list",
        "-s",
        "queued",
      ]);

      expect(client.listJobs).toHaveBeenCalledWith({
        status: "queued",
        type: undefined,
      });
    });

    it("passes type filter", async () => {
      const client = createMockClient();

      client.listJobs.mockResolvedValueOnce({
        jobs: [],
      });

      await run(client, [
        "job",
        "list",
        "-t",
        "echo",
      ]);

      expect(client.listJobs).toHaveBeenCalledWith({
        status: undefined,
        type: "echo",
      });
    });

    it("shows empty message when no jobs", async () => {
      const client = createMockClient();

      client.listJobs.mockResolvedValueOnce({
        jobs: [],
      });

      const result = await run(client, [
        "job",
        "list",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("No jobs found");
    });

    it("outputs JSON when --json is set", async () => {
      const client = createMockClient();

      const mockResponse = {
        jobs: [
          {
            id: "aaa-111",
            type: "echo",
            status: "queued",
            priority: 0,
          },
        ],
      };

      client.listJobs.mockResolvedValueOnce(mockResponse);

      const result = await run(client, [
        "job",
        "list",
        "--json",
      ]);

      expect(result.exitCode).toBe(0);

      const parsed = JSON.parse(result.stdout);
      expect(parsed.jobs).toHaveLength(1);
    });

    it("handles API error on list", async () => {
      const client = createMockClient();

      client.listJobs.mockRejectedValueOnce(
        new Error("Network error"),
      );

      const result = await run(client, [
        "job",
        "list",
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Network error");
    });
  });

  /*
   * ── Job Status ───────────────────────────────────────────
   */

  describe("job status", () => {
    it("shows detailed job status", async () => {
      const client = createMockClient();

      client.getJob.mockResolvedValueOnce({
        job: {
          id: "abc-123",
          type: "sleep",
          status: "running",
          priority: 5,
          lockedBy: "worker-01",
          leaseToken: 1,
          leaseExpiresAt: "2026-10-02T09:01:00Z",
          retryCount: 0,
          maxRetries: 3,
          createdAt: "2026-10-02T09:00:00Z",
          startedAt: "2026-10-02T09:00:05Z",
        },
        events: [
          {
            eventType: "queued",
            createdAt: "2026-10-02T09:00:00Z",
            message: "Job created",
          },
          {
            eventType: "claimed",
            nodeId: "worker-01",
            createdAt: "2026-10-02T09:00:05Z",
            message: "Job claimed",
          },
        ],
      });

      const result = await run(client, [
        "job",
        "status",
        "abc-123",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("abc-123");
      expect(result.stdout).toContain("running");
      expect(result.stdout).toContain("worker-01");
      expect(result.stdout).toContain("Events");
    });

    it("outputs JSON when --json is set", async () => {
      const client = createMockClient();

      const mockResponse = {
        job: {
          id: "abc-123",
          type: "echo",
          status: "succeeded",
          priority: 0,
          retryCount: 0,
          maxRetries: 3,
          createdAt: "2026-10-02T09:00:00Z",
          result: { message: "hello" },
        },
        events: [],
      };

      client.getJob.mockResolvedValueOnce(mockResponse);

      const result = await run(client, [
        "job",
        "status",
        "abc-123",
        "--json",
      ]);

      expect(result.exitCode).toBe(0);

      const parsed = JSON.parse(result.stdout);
      expect(parsed.job.id).toBe("abc-123");
    });

    it("handles 404 not found", async () => {
      const client = createMockClient();

      const error = new Error("Not found");
      error.status = 404;

      client.getJob.mockRejectedValueOnce(error);

      const result = await run(client, [
        "job",
        "status",
        "nonexistent",
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not found");
    });

    it("handles API error on status", async () => {
      const client = createMockClient();

      client.getJob.mockRejectedValueOnce(
        new Error("Server error"),
      );

      const result = await run(client, [
        "job",
        "status",
        "abc-123",
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Server error");
    });
  });

  /*
   * ── Job Cancel ───────────────────────────────────────────
   */

  describe("job cancel", () => {
    it("cancels a queued job", async () => {
      const client = createMockClient();

      client.cancelJob.mockResolvedValueOnce({
        job: {
          id: "abc-123",
          status: "cancelled",
        },
        event: {
          eventType: "cancelled",
        },
      });

      const result = await run(client, [
        "job",
        "cancel",
        "abc-123",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("abc-123");
      expect(result.stdout).toContain("cancelled");
    });

    it("reports cancel_requested for a running job", async () => {
      const client = createMockClient();

      client.cancelJob.mockResolvedValueOnce({
        job: {
          id: "abc-123",
          status: "running",
          cancelRequestedAt: "2026-10-02T09:01:00Z",
        },
        event: {
          eventType: "cancel_requested",
        },
      });

      const result = await run(client, [
        "job",
        "cancel",
        "abc-123",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("running");
    });

    it("outputs JSON when --json is set", async () => {
      const client = createMockClient();

      const mockResponse = {
        job: {
          id: "abc-123",
          status: "cancelled",
        },
        event: {
          eventType: "cancelled",
        },
      };

      client.cancelJob.mockResolvedValueOnce(mockResponse);

      const result = await run(client, [
        "job",
        "cancel",
        "abc-123",
        "--json",
      ]);

      expect(result.exitCode).toBe(0);

      const parsed = JSON.parse(result.stdout);
      expect(parsed.job.status).toBe("cancelled");
    });

    it("handles 404 not found", async () => {
      const client = createMockClient();

      const error = new Error("Not found");
      error.status = 404;

      client.cancelJob.mockRejectedValueOnce(error);

      const result = await run(client, [
        "job",
        "cancel",
        "nonexistent",
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not found");
    });

    it("handles 409 conflict", async () => {
      const client = createMockClient();

      const error = new Error("Conflict");
      error.status = 409;
      error.body = { error: "JOB_ALREADY_SUCCEEDED" };

      client.cancelJob.mockRejectedValueOnce(error);

      const result = await run(client, [
        "job",
        "cancel",
        "abc-123",
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("JOB_ALREADY_SUCCEEDED");
    });

    it("handles network error on cancel", async () => {
      const client = createMockClient();

      client.cancelJob.mockRejectedValueOnce(
        new Error("ECONNREFUSED"),
      );

      const result = await run(client, [
        "job",
        "cancel",
        "abc-123",
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("ECONNREFUSED");
    });
  });
});
