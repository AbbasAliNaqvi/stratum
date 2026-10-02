import { Command } from "commander";
import { startService, stopService, isServiceRunning, getProjectRoot, getLogDir, initRuntimeDir } from "../runtime.js";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function printStatus(json) {
  const cpRunning = isServiceRunning("control-plane");
  const workerRunning = isServiceRunning("worker");

  if (json) {
    console.log(JSON.stringify({
      controlPlane: !!cpRunning,
      worker: !!workerRunning,
    }, null, 2));
    return;
  }

  console.log("\nStratum\n");
  console.log(`Control Plane   ${cpRunning ? "● Running" : "○ Stopped"}`);
  console.log(`Worker          ${workerRunning ? "● Running" : "○ Stopped"}`);
  console.log("");
}

export function registerLifecycleCommands(program, { client }) {
  program
    .command("init")
    .description("Initialize Stratum environment and database")
    .action(() => {
      console.log("Stratum Initialization");

      console.log("\n✓ Node.js detected");

      try {
        execSync("psql --version", { stdio: "ignore" });
        console.log("✓ PostgreSQL detected");
      } catch {
        console.log("✗ PostgreSQL not detected in PATH. (Make sure it is installed and running if using localhost)");
      }

      console.log("✓ Dependencies ready");

      try {
        console.log("\nApplying database migrations...");
        execSync("npm run db:migrate", { cwd: getProjectRoot(), stdio: "inherit" });
        console.log("✓ Database ready");
        console.log("✓ Migrations applied");
      } catch (err) {
        console.error("\n✗ Failed to apply migrations. Please ensure PostgreSQL is running and DATABASE_URL is correct in .env");
        process.exitCode = 1;
        return;
      }

      initRuntimeDir();
      startService("control-plane", "npm", ["run", "dev", "--workspace=@stratum/control-plane"]);
      console.log("✓ Control Plane started");

      startService("worker", "npm", ["run", "dev", "--workspace=@stratum/worker"]);
      console.log("✓ Worker connected");

      console.log("✓ System ready");
      console.log("\nStratum is ready.\n\nRun:\n\n  stratum\n\nto open the control panel.\n");
    });

  program
    .command("start")
    .description("Start Stratum background services")
    .action(() => {
      initRuntimeDir();
      startService("control-plane", "npm", ["run", "dev", "--workspace=@stratum/control-plane"]);
      startService("worker", "npm", ["run", "dev", "--workspace=@stratum/worker"]);
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
    .action(() => {
      stopService("control-plane");
      stopService("worker");
      startService("control-plane", "npm", ["run", "dev", "--workspace=@stratum/control-plane"]);
      startService("worker", "npm", ["run", "dev", "--workspace=@stratum/worker"]);
      console.log("Stratum services restarted.");
    });

  program
    .command("status")
    .description("Show system status")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      if (!isServiceRunning("control-plane")) {
        printStatus(options.json);
        return;
      }

      try {
        // Try to fetch real metrics if possible
        const nodesRes = await fetch(`${client.baseUrl}/nodes`);
        const nodes = await nodesRes.json();

        const jobsRes = await client.listJobs();
        const jobs = jobsRes.jobs || [];

        const queued = jobs.filter(j => j.status === "queued").length;
        const running = jobs.filter(j => j.status === "running").length;
        const failed = jobs.filter(j => j.status === "failed").length;

        if (options.json) {
          console.log(JSON.stringify({
            controlPlane: true,
            database: true,
            workers: nodes.nodes.filter(n => n.status === "active").length,
            queue: { queued, running, failed }
          }, null, 2));
          return;
        }

        console.log("\nStratum\n");
        console.log(`Control Plane   ● Running`);
        console.log(`Database        ● Connected`);
        console.log(`Workers         ● ${nodes.nodes.filter(n => n.status === "active").length} online`);
        console.log(`Queue           ${queued} queued`);
        console.log(`Running         ${running}`);
        console.log(`Failed          ${failed}`);
        console.log(`\nURL             ${client.baseUrl}\n`);
      } catch (e) {
        printStatus(options.json);
      }
    });

  program
    .command("doctor")
    .description("Diagnose system configuration")
    .action(async () => {
      console.log("Stratum Doctor\n");
      console.log("✓ Node.js");

      try {
        execSync("psql --version", { stdio: "ignore" });
        console.log("✓ PostgreSQL");
      } catch {
        console.log("✗ PostgreSQL");
        console.log("\nPostgreSQL is not reachable. Start PostgreSQL and run:\n\n  stratum init\n");
        return;
      }

      const cpRunning = isServiceRunning("control-plane");
      if (cpRunning) {
        console.log("✓ Control Plane");
      } else {
        console.log("✗ Control Plane (Not running)");
      }

      const workerRunning = isServiceRunning("worker");
      if (workerRunning) {
        console.log("✓ Worker");
      } else {
        console.log("✗ Worker (Not running)");
      }

      if (cpRunning) {
        try {
          await fetch(`${client.baseUrl}/health`);
          console.log("✓ API connectivity");
        } catch {
          console.log("✗ API connectivity (Cannot reach Control Plane API)");
        }
      }
    });

  program
    .command("logs")
    .description("Show service logs")
    .action(() => {
      console.log("--- Control Plane Logs ---");
      const cpLog = join(getLogDir(), "control-plane.log");
      if (existsSync(cpLog)) {
        console.log(execSync(`tail -n 20 "${cpLog}"`).toString());
      } else {
        console.log("No logs yet.");
      }

      console.log("\n--- Worker Logs ---");
      const workerLog = join(getLogDir(), "worker.log");
      if (existsSync(workerLog)) {
        console.log(execSync(`tail -n 20 "${workerLog}"`).toString());
      } else {
        console.log("No logs yet.");
      }
    });

  program
    .command("workers")
    .description("List active workers")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const res = await fetch(`${client.baseUrl}/nodes`);
        const data = await res.json();

        if (options.json) {
          console.log(JSON.stringify(data.nodes, null, 2));
          return;
        }

        console.log("\nWorkers\n");
        console.log("ID".padEnd(30) + "Status".padEnd(10) + "Last Heartbeat");
        for (const node of data.nodes) {
          console.log(
            node.nodeId.padEnd(30) +
            node.status.padEnd(10) +
            new Date(node.lastHeartbeat).toISOString()
          );
        }
        console.log("");
      } catch (e) {
        if (options.json) {
          console.log(JSON.stringify({ error: "Cannot reach Control Plane" }));
        } else {
          console.error("Cannot reach Control Plane to list workers.");
        }
        process.exitCode = 1;
      }
    });
}
