import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerLifecycleCommands } from "./lifecycle.js";
import { Command } from "commander";
import * as runtime from "../runtime.js";
import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

vi.mock("../runtime.js", () => ({
  startService: vi.fn(),
  stopService: vi.fn(),
  isServiceRunning: vi.fn(),
  getProjectRoot: vi.fn(() => "/mock/root"),
  getLogDir: vi.fn(() => "/mock/root/logs"),
  initRuntimeDir: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
  openSync: vi.fn(),
}));

vi.mock("pg", () => {
  class Client {
    connect() {
      return Promise.resolve();
    }
    end() {
      return Promise.resolve();
    }
    query() {
      return Promise.resolve();
    }
  }
  return { default: { Client } };
});

function createMockClient() {
  return {
    getHealth: vi.fn(),
    getNodes: vi.fn(),
    listJobs: vi.fn(),
    baseUrl: "http://127.0.0.1:3000",
  };
}

async function runCommand(cmdString, client) {
  const program = new Command();
  registerLifecycleCommands(program, { client });
  program.exitOverride();

  let out = "";
  let err = "";
  program.configureOutput({
    writeOut: (str) => {
      out += str;
    },
    writeErr: (str) => {
      err += str;
    },
  });

  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args) => {
    out += args.join(" ") + "\n";
  };
  console.error = (...args) => {
    err += args.join(" ") + "\n";
  };

  let exitCode = 0;
  const originalExitCode = process.exitCode;
  process.exitCode = undefined;
  try {
    await program.parseAsync(["node", "stratum", ...cmdString.split(" ")]);
    exitCode = process.exitCode ?? 0;
  } catch (e) {
    err += e.stack || e.message || String(e);
    exitCode = e.exitCode ?? process.exitCode ?? 1;
  } finally {
    process.exitCode = originalExitCode;
    console.log = originalLog;
    console.error = originalError;
  }
  return { out, err, exitCode };
}

describe("lifecycle commands", () => {
  let client;

  beforeEach(() => {
    client = createMockClient();
    vi.clearAllMocks();
    process.env.DATABASE_URL = "";
  });

  describe("init", () => {
    it("creates .env if missing and sets default DATABASE_URL", async () => {
      fs.existsSync.mockReturnValue(false); // .env does not exist
      child_process.execSync.mockReturnValue("");
      client.getHealth.mockResolvedValue();
      client.getNodes.mockResolvedValue({ nodes: [{ status: "active" }] });

      const p = await runCommand("init", client);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join("/mock/root", ".env"),
        expect.stringContaining("DATABASE_URL"),
      );
      expect(process.env.DATABASE_URL).toContain("postgres");
    });

    it("preserves existing .env", async () => {
      fs.existsSync.mockReturnValue(true); // .env exists
      child_process.execSync.mockReturnValue("");
      client.getHealth.mockResolvedValue();
      client.getNodes.mockResolvedValue({ nodes: [{ status: "active" }] });

      vi.useFakeTimers();
      const p = runCommand("init", client);
      vi.runAllTimers();
      await p;
      vi.useRealTimers();

      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it("fails if control plane fails to become ready", async () => {
      fs.existsSync.mockReturnValue(true);
      process.env.DATABASE_URL = "postgres://test/testdb";
      child_process.execSync.mockReturnValue("");
      client.getHealth.mockRejectedValue(new Error("conn ref"));

      const { out, err, exitCode } = await runCommand("init", client);

      expect(err).toContain(
        "Control Plane process started, but the API did not become reachable",
      );
      expect(exitCode).toBe(1);
    });

    it("fails if worker fails to register", async () => {
      fs.existsSync.mockReturnValue(true);
      process.env.DATABASE_URL = "postgres://test/testdb";
      child_process.execSync.mockReturnValue("");
      client.getHealth.mockResolvedValue();
      client.getNodes.mockResolvedValue({ nodes: [] }); // no active workers

      const { out, err, exitCode } = await runCommand("init", client);

      expect(err).toContain("Worker process started, but did not register");
      expect(exitCode).toBe(1);
    });
  });

  describe("status", () => {
    it("shows zero workers when control plane is reachable but no workers", async () => {
      runtime.isServiceRunning.mockReturnValue(1234);
      client.getHealth.mockResolvedValue();
      client.getNodes.mockResolvedValue({ nodes: [] });
      client.listJobs.mockResolvedValue({ jobs: [] });

      const { out } = await runCommand("status", client);
      expect(out).toContain("Control Plane   ● Running");
      expect(out).toContain("Workers         0 online");
    });

    it("shows unreachable when control plane is down", async () => {
      runtime.isServiceRunning.mockReturnValue(1234);
      client.getHealth.mockRejectedValue(new Error("down"));

      const { out } = await runCommand("status", client);
      expect(out).toContain("Control Plane   ○ Stopped/Unreachable");
      expect(out).toContain("Workers         0 online");
    });
  });

  describe("workers", () => {
    it("reports unreachable when control plane down", async () => {
      runtime.isServiceRunning.mockReturnValue(1234);
      client.getHealth.mockRejectedValue(new Error("down"));

      const { err, exitCode } = await runCommand("workers", client);
      expect(err).toContain("Cannot reach Control Plane to list workers");
      expect(exitCode).toBe(1);
    });
  });

  describe("doctor", () => {
    it("reports healthy system", async () => {
      process.env.DATABASE_URL = "postgres://test/testdb";
      child_process.execSync.mockReturnValue(""); // postgres ok
      runtime.isServiceRunning.mockReturnValue(1234);
      client.getHealth.mockResolvedValue();
      client.getNodes.mockResolvedValue({ nodes: [{ status: "active" }] });

      const { out } = await runCommand("doctor", client);
      expect(out).toContain("✓ PostgreSQL");
      expect(out).toContain("✓ Control Plane");
      expect(out).toContain("✓ Worker");
    });

    it("reports postgres failure", async () => {
      process.env.DATABASE_URL = "postgres://test/testdb";
      child_process.execSync.mockImplementation(() => {
        throw new Error();
      }); // postgres fail
      const { out } = await runCommand("doctor", client);
      expect(out).toContain("✗ Schema (Migrations failed or incomplete)");
    });
  });
});
