import readline from "node:readline";
import { isServiceRunning } from "./runtime.js";
import { execSync } from "node:child_process";
import { printJobSummary } from "./output.js";

const ESC = "\u001b";
const CLEAR_SCREEN = `${ESC}[2J${ESC}[3J${ESC}[H`;
const YELLOW = `${ESC}[33m`;
const GREEN = `${ESC}[32m`;
const RED = `${ESC}[31m`;
const RESET = `${ESC}[0m`;
const BOLD = `${ESC}[1m`;

async function fetchSystemState(client) {
  const cpRunning = isServiceRunning("control-plane");
  const state = {
    cpRunning: !!cpRunning,
    workerRunning: !!isServiceRunning("worker"),
    nodes: [],
    jobs: { queued: 0, running: 0, succeeded: 0, failed: 0, cancelled: 0 },
    recentJobs: [],
  };

  if (!cpRunning) {
    return state;
  }

  try {
    const nodesRes = await client.getNodes();
    state.nodes = nodesRes.nodes || [];

    const jobsRes = await client.listJobs();
    const allJobs = jobsRes.jobs || [];

    for (const j of allJobs) {
      if (state.jobs[j.status] !== undefined) {
        state.jobs[j.status]++;
      }
    }

    // Sort jobs by created desc
    state.recentJobs = allJobs
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

  } catch (e) {
    // API unavailable
  }
  return state;
}

export async function runDashboard(client) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  async function renderMenu() {
    process.stdout.write(CLEAR_SCREEN);
    const state = await fetchSystemState(client);

    console.log(`${BOLD}STRATUM${RESET}\n`);

    if (state.cpRunning && state.nodes.some(n => n.status === "active")) {
      console.log(`● System healthy\n`);
    } else {
      console.log(`○ System offline or degraded (Run 'stratum start' or 'stratum init')\n`);
    }

    const onlineWorkers = state.nodes.filter(n => n.status === "active").length;

    console.log(`Workers     ${onlineWorkers > 0 ? GREEN : YELLOW}${onlineWorkers} online${RESET}`);
    console.log(`Queued      ${state.jobs.queued}`);
    console.log(`Running     ${state.jobs.running}`);
    console.log(`Succeeded   ${state.jobs.succeeded}`);
    console.log(`Failed      ${state.jobs.failed}\n`);

    console.log(`${BOLD}Recent Jobs${RESET}\n`);
    if (state.recentJobs.length === 0) {
      console.log("  —\n");
    } else {
      console.log("ID".padEnd(10) + "Type".padEnd(10) + "Status".padEnd(15) + "Worker");
      for (const j of state.recentJobs) {
        console.log(
          j.id.substring(0, 8).padEnd(10) +
          j.type.padEnd(10) +
          j.status.padEnd(15) +
          (j.lockedBy || "—")
        );
      }
      console.log("");
    }

    console.log(`${BOLD}Actions${RESET}\n`);
    console.log("1  Run Job");
    console.log("2  Jobs");
    console.log("3  Workers");
    console.log("4  Logs");
    console.log("5  System");
    console.log("6  Doctor");
    console.log("q  Quit\n");

    const answer = await question("> ");

    switch (answer.trim().toLowerCase()) {
      case "1":
        await interactiveRunJob();
        break;
      case "2":
        execSync("stratum job list", { stdio: "inherit" });
        await question("\nPress Enter to return...");
        break;
      case "3":
        execSync("stratum workers", { stdio: "inherit" });
        await question("\nPress Enter to return...");
        break;
      case "4":
        execSync("stratum logs", { stdio: "inherit" });
        await question("\nPress Enter to return...");
        break;
      case "5":
        execSync("stratum status", { stdio: "inherit" });
        await question("\nPress Enter to return...");
        break;
      case "6":
        execSync("stratum doctor", { stdio: "inherit" });
        await question("\nPress Enter to return...");
        break;
      case "q":
      case "exit":
      case "quit":
        rl.close();
        return;
    }

    // loop
    if (answer.trim().toLowerCase() !== "q") {
      await renderMenu();
    }
  }

  async function interactiveRunJob() {
    console.log(`\n${BOLD}Select job type:${RESET}`);
    console.log("1. echo");
    console.log("2. sleep");

    const typeAns = await question("\n> ");
    let type = "echo";
    let payloadStr = "{}";

    if (typeAns === "2") {
      type = "sleep";
      const dur = await question("Duration (ms) [15000]: ");
      payloadStr = JSON.stringify({ durationMs: parseInt(dur || "15000", 10) });
    } else {
      const msg = await question("Message: ");
      payloadStr = JSON.stringify({ message: msg || "Hello Stratum" });
    }

    console.log(`\nSubmit job?\n`);
    console.log(`Type      ${type}`);
    console.log(`Payload   ${payloadStr}\n`);

    const conf = await question("[y] Submit  [n] Cancel: ");
    if (conf.toLowerCase() !== "y" && conf !== "") {
      return;
    }

    try {
      const result = await client.submitJob({
        type,
        payload: JSON.parse(payloadStr),
        priority: 0,
        maxRetries: 3
      });

      console.log(`\n✓ Job submitted\n`);
      console.log(`Job ID    ${result.job.id}`);
      console.log(`Status    ${result.job.status}\n`);

      console.log("Watching job... (Press Ctrl+C to stop watching)");

      // Simple watch loop
      let prevStatus = result.job.status;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000));
        try {
          const check = await client.getJob(result.job.id);
          if (check.job.status !== prevStatus) {
            console.log(`  ↓`);
            console.log(check.job.status);
            prevStatus = check.job.status;

            if (["succeeded", "failed", "cancelled"].includes(check.job.status)) {
              break;
            }
          }
        } catch (e) {
          break;
        }
      }

    } catch (e) {
      console.error(`\n✗ Error: ${e.message}`);
    }

    await question("\nPress Enter to return...");
  }

  await renderMenu();
}
