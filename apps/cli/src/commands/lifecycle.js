import { Command } from "commander";
import {
  startService,
  stopService,
  isServiceRunning,
  getProjectRoot,
  getLogDir,
  initRuntimeDir,
} from "../runtime.js";
import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

async function ensureDatabase(dbUrl) {
  const url = new URL(dbUrl);
  const targetDb = url.pathname.slice(1);
  if (!targetDb) {
    throw new Error("Invalid DATABASE_URL: missing database name");
  }

  const targetClient = new pg.Client({ connectionString: dbUrl });
  try {
    await targetClient.connect();
    await targetClient.end();
    return;
  } catch (err) {
    if (err.code !== "3D000") {
      throw err;
    }
  }

  url.pathname = "/postgres";
  const maintDbUrl = url.toString();

  const maintClient = new pg.Client({ connectionString: maintDbUrl });
  try {
    await maintClient.connect();
  } catch (err) {
    throw new Error(
      `Failed to connect to maintenance database: ${err.message}`,
    );
  }

  try {
    const escapedDbName = targetDb.replace(/"/g, '""');
    await maintClient.query(`CREATE DATABASE "${escapedDbName}"`);
  } catch (err) {
    await maintClient.end();
    throw new Error(`Could not create database "${targetDb}": ${err.message}`);
  }

  await maintClient.end();
}

async function waitForControlPlane(client) {
  const max = process.env.NODE_ENV === "test" ? 1 : 30;
  const delay = process.env.NODE_ENV === "test" ? 0 : 1000;
  for (let i = 0; i < max; i++) {
    try {
      await client.getHealth();
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return false;
}

async function waitForWorker(client) {
  const max = process.env.NODE_ENV === "test" ? 1 : 30;
  const delay = process.env.NODE_ENV === "test" ? 0 : 1000;
  
  let registered = false;
  
  for (let i = 0; i < max; i++) {
    try {
      const nodes = await client.getNodes();
      const node = nodes.nodes?.find((n) => n.status === "registered");
      if (node) {
        registered = true;
        const healthy = Date.now() - new Date(node.lastHeartbeatAt).getTime() < 15000;
        return { started: true, registered: true, healthy };
      }
    } catch {}
    await new Promise((r) => setTimeout(r, delay));
  }
  
  const started = isServiceRunning("worker") !== null;
  return { started, registered, healthy: false };
}

export async function getSystemHealth(client) {
  const cpPid = isServiceRunning("control-plane");
  const workerPid = isServiceRunning("worker");

  let cpReachable = false;
  let activeWorkers = 0;

  if (cpPid) {
    try {
      await client.getHealth();
      cpReachable = true;
      const nodes = await client.getNodes();
      activeWorkers =
        nodes.nodes?.filter((n) => n.status === "registered").length || 0;
    } catch {}
  }

  return { cpPid, workerPid, cpReachable, activeWorkers };
}

export function registerLifecycleCommands(program, { client }) {
  program
    .command("init")
    .description("Initialize Stratum environment and database")
    .action(async () => {
      console.log("Stratum\n");
      console.log("✓ Node.js");

      const envPath = join(getProjectRoot(), ".env");
      if (!existsSync(envPath)) {
        writeFileSync(
          envPath,
          "DATABASE_URL=postgres://postgres:postgres@localhost:5432/stratum\nSTRATUM_CONTROL_PLANE_URL=http://127.0.0.1:3000\n",
        );
        process.env.DATABASE_URL =
          "postgres://postgres:postgres@localhost:5432/stratum";
        process.env.STRATUM_CONTROL_PLANE_URL = "http://127.0.0.1:3000";
      }

      if (!process.env.DATABASE_URL) {
        console.log("✗ PostgreSQL / Database");
        console.error("\nNo DATABASE_URL found in .env");
        process.exitCode = 1;
        return;
      }

      try {
        await ensureDatabase(process.env.DATABASE_URL);
        console.log("✓ PostgreSQL");
        console.log("✓ Database");
      } catch (err) {
        console.log("✗ Database");
        console.log(
          `\nPostgreSQL is reachable, but Stratum could not create the\nlocal database "${new URL(process.env.DATABASE_URL).pathname.slice(1)}".\n\nError: ${err.message}\n\nPlease either:\n  1. provide a DATABASE_URL for an accessible PostgreSQL database, or\n  2. create the database manually and run \`stratum init\` again.\n`,
        );
        process.exitCode = 1;
        return;
      }

      try {
        execSync("npm run db:migrate", {
          cwd: getProjectRoot(),
          stdio: "ignore",
        });
        console.log("✓ Schema");
      } catch (err) {
        console.log("✗ Schema");
        console.error("\nFailed to apply database migrations.");
        process.exitCode = 1;
        return;
      }

      initRuntimeDir();
      startService("control-plane", "npm", [
        "run",
        "dev",
        "--workspace=@stratum/control-plane",
      ]);

      const cpReady = await waitForControlPlane(client);
      if (!cpReady) {
        console.log("✗ Control Plane");
        console.error(
          "\nThe Control Plane process started, but the API did not become reachable.\nCheck:\n  stratum logs\n  stratum doctor",
        );
        process.exitCode = 1;
        return;
      }
      console.log("✓ Control Plane");

      startService("worker", "npm", [
        "run",
        "dev",
        "--workspace=@stratum/worker",
      ]);

      const workerState = await waitForWorker(client);
      if (!workerState.registered) {
        console.log("✗ Worker");
        if (!workerState.started) {
          console.error("\nThe Worker process failed to start.\n");
        } else {
          console.error("\nThe Worker process started, but did not register with Stratum.\n\nCheck:\n  stratum logs\n  stratum doctor\n");
        }
        process.exitCode = 1;
        return;
      } else if (!workerState.healthy) {
        console.log("⚠ Worker");
        console.error("\nThe Worker registered but is not currently healthy (missing heartbeat).\n");
      } else {
        console.log("✓ Worker");
      }

      console.log(
        "\nStratum is ready.\n\nRun:\n\n  stratum\n\nto open the control panel.\n",
      );
    });

  program
    .command("start")
    .description("Start Stratum background services")
    .action(async () => {
      initRuntimeDir();
      startService("control-plane", "npm", [
        "run",
        "dev",
        "--workspace=@stratum/control-plane",
      ]);
      const cpReady = await waitForControlPlane(client);
      if (!cpReady) {
        console.error("✗ Control Plane failed to become reachable.");
        process.exitCode = 1;
        return;
      }

      startService("worker", "npm", [
        "run",
        "dev",
        "--workspace=@stratum/worker",
      ]);
      const workerState = await waitForWorker(client);
      if (!workerState.registered) {
        if (!workerState.started) {
          console.error("✗ Worker process failed to start.");
        } else {
          console.error("✗ Worker process started but did not register.");
        }
        process.exitCode = 1;
        return;
      } else if (!workerState.healthy) {
        console.error("⚠ Worker registered but is not healthy.");
      }

      console.log("Stratum services started.");
    });

  program
    .command("stop")
    .description("Stop Stratum background services")
    .action(() => {
      const cpStopped = stopService("control-plane");
      const workerStopped = stopService("worker");
      console.log(`Control Plane: ${cpStopped ? "Stopped" : "Not running"}`);
      console.log(`Worker: ${workerStopped ? "Stopped" : "Not running"}`);
    });

  program
    .command("restart")
    .description("Restart Stratum background services")
    .action(async () => {
      stopService("control-plane");
      stopService("worker");

      startService("control-plane", "npm", [
        "run",
        "dev",
        "--workspace=@stratum/control-plane",
      ]);
      const cpReady = await waitForControlPlane(client);
      if (!cpReady) {
        console.error("✗ Control Plane failed to become reachable.");
        process.exitCode = 1;
        return;
      }

      startService("worker", "npm", [
        "run",
        "dev",
        "--workspace=@stratum/worker",
      ]);
      const workerReady = await waitForWorker(client);
      if (!workerReady) {
        console.error("✗ Worker failed to register.");
        process.exitCode = 1;
        return;
      }
      console.log("Stratum services restarted.");
    });

  program
    .command("status")
    .description("Show system status")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const health = await getSystemHealth(client);

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              controlPlane: health.cpReachable,
              database: health.cpReachable,
              workers: health.activeWorkers,
            },
            null,
            2,
          ),
        );
        return;
      }

      console.log("\nStratum\n");
      console.log(
        `Control Plane   ${health.cpReachable ? "● Running" : "○ Stopped/Unreachable"}`,
      );

      if (health.cpReachable) {
        console.log(`Database        ● Connected`);
        console.log(`Workers         ${health.activeWorkers} online`);

        try {
          const jobsRes = await client.listJobs();
          const jobs = jobsRes.jobs || [];
          const queued = jobs.filter((j) => j.status === "queued").length;
          const running = jobs.filter((j) => j.status === "running").length;
          const failed = jobs.filter((j) => j.status === "failed").length;

          console.log(`Queue           ${queued} queued`);
          console.log(`Running         ${running}`);
          console.log(`Failed          ${failed}`);
        } catch {}
      } else {
        console.log(`Workers         0 online`);
      }
      console.log(`\nURL             ${client.baseUrl}\n`);
    });

  program
    .command("doctor")
    .description("Diagnose system configuration")
    .action(async () => {
      console.log("Stratum Doctor\n");
      console.log("✓ Node.js");

      try {
        const url = new URL(
          process.env.DATABASE_URL ||
            "postgres://postgres:postgres@localhost:5432/stratum",
        );
        url.pathname = "/postgres";
        const maintClient = new pg.Client({ connectionString: url.toString() });
        await maintClient.connect();
        await maintClient.end();
        console.log("✓ PostgreSQL");

        const targetClient = new pg.Client({
          connectionString:
            process.env.DATABASE_URL ||
            "postgres://postgres:postgres@localhost:5432/stratum",
        });
        await targetClient.connect();
        await targetClient.end();
        console.log("✓ Database");
      } catch (err) {
        if (err.code === "3D000") {
          console.log("✓ PostgreSQL");
          console.log(
            `✗ Database (Database "${new URL(process.env.DATABASE_URL).pathname.slice(1)}" does not exist. Run: stratum init)`,
          );
        } else {
          console.log("✗ PostgreSQL (Not reachable)");
          console.log("✗ Database");
        }
      }

      try {
        execSync("npm run db:migrate", {
          cwd: getProjectRoot(),
          stdio: "ignore",
        });
        console.log("✓ Schema");
      } catch {
        console.log("✗ Schema (Migrations failed or incomplete)");
      }

      const health = await getSystemHealth(client);

      if (health.cpReachable) {
        console.log("✓ Control Plane");
      } else {
        console.log("✗ Control Plane (Not reachable via API)");
      }

      if (health.activeWorkers > 0) {
        console.log("✓ Worker");
      } else {
        console.log("✗ Worker (Not registered)");
      }
    });

  program
    .command("logs")
    .description("Show service logs")
    .action(() => {
      console.log("--- Control Plane Logs ---");
      const cpLog = join(getLogDir(), "control-plane.log");
      if (existsSync(cpLog)) {
        try {
          console.log(execSync(`tail -n 20 "${cpLog}"`).toString());
        } catch {}
      } else {
        console.log("No logs yet.");
      }

      console.log("\n--- Worker Logs ---");
      const workerLog = join(getLogDir(), "worker.log");
      if (existsSync(workerLog)) {
        try {
          console.log(execSync(`tail -n 20 "${workerLog}"`).toString());
        } catch {}
      } else {
        console.log("No logs yet.");
      }
    });

  program
    .command("workers")
    .description("List active workers")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const health = await getSystemHealth(client);

      if (!health.cpReachable) {
        if (options.json) {
          console.log(JSON.stringify({ error: "Cannot reach Control Plane" }));
        } else {
          console.error("Cannot reach Control Plane to list workers.");
        }
        process.exitCode = 1;
        return;
      }

      try {
        const res = await client.getNodes();

        if (options.json) {
          console.log(JSON.stringify(res.nodes, null, 2));
          return;
        }

        console.log(`\nWorkers: ${health.activeWorkers} online\n`);
        if (res.nodes && res.nodes.length > 0) {
          console.log("NODE".padEnd(34) + "STATUS".padEnd(13) + "HEARTBEAT");
          for (const node of res.nodes) {
            const isHealthy = node.status === "registered";
            const icon = isHealthy ? "●" : "○";
            const displayStatus = isHealthy ? "healthy" : node.status;
            let heartbeatStr = "never";
            
            if (node.lastHeartbeatAt) {
              const dt = new Date(node.lastHeartbeatAt).getTime();
              if (!isNaN(dt)) {
                const diff = Math.floor((Date.now() - dt) / 1000);
                if (diff < 60) heartbeatStr = `${diff}s ago`;
                else if (diff < 3600) heartbeatStr = `${Math.floor(diff / 60)}m ago`;
                else if (diff < 86400) heartbeatStr = `${Math.floor(diff / 3600)}h ago`;
                else heartbeatStr = `${Math.floor(diff / 86400)}d ago`;
              }
            }
            
            console.log(
              `${icon} ${node.nodeId}`.padEnd(34) +
                displayStatus.padEnd(13) +
                heartbeatStr
            );
          }
        }
        console.log("");
      } catch (e) {
        console.error("Error fetching workers", e.message);
        process.exitCode = 1;
      }
    });
}
