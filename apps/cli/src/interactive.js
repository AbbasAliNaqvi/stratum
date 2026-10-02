/**
 * Stratum Interactive Console — v2
 *
 * Persistent slash-command REPL with autocomplete,
 * command history, polished output, and clean terminal handling.
 */

import readline from "node:readline";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getSystemHealth } from "./commands/lifecycle.js";
import { getProjectRoot, getLogDir } from "./runtime.js";
import { config } from "./config.js";
import {
  c,
  sym,
  box,
  statusDot,
  statusIcon,
  kvPanel,
  table,
  heading,
  success,
  error,
  warn,
  info,
  dim,
  timeAgo,
  shortTime,
  createSpinner,
  CLEAR,
} from "./ui.js";

/* ── Command registry ──────────────────────────────────── */

const COMMANDS = [
  {
    name: "/work",
    alias: ["/w", "/run"],
    desc: "Run distributed work",
    help: "Create and submit work to the Stratum engine.\n\n  Usage:  /work\n\n  Walks you through selecting a workload type and\n  configuring its parameters interactively.",
  },
  {
    name: "/jobs",
    alias: ["/j"],
    desc: "Browse jobs",
    help: "View recent jobs and their statuses.\n\n  Usage:  /jobs [filter]\n\n  Filters: running, queued, succeeded, failed, cancelled\n\n  Examples:\n    /jobs\n    /jobs running\n    /jobs failed",
  },
  {
    name: "/workers",
    alias: [],
    desc: "View workers",
    help: "Show all registered worker nodes and their status.",
  },
  {
    name: "/status",
    alias: ["/s"],
    desc: "System health",
    help: "Display a comprehensive overview of system health\n  including Control Plane, database, and worker status.",
  },
  {
    name: "/logs",
    alias: ["/l"],
    desc: "View activity",
    help: "Show recent structured log entries from Stratum services.",
  },
  {
    name: "/doctor",
    alias: [],
    desc: "Diagnose problems",
    help: "Run the full Stratum diagnostic suite checking\n  Node.js, PostgreSQL, database, schema, and services.",
  },
  {
    name: "/model",
    alias: [],
    desc: "AI model configuration",
    help: "Configure the AI diagnostics model.\n\n  AI Diagnostics is a future capability.\n  This command shows current model configuration\n  and will be the interface for enabling AI-powered\n  job analysis when available.",
  },
  {
    name: "/config",
    alias: [],
    desc: "Runtime configuration",
    help: "Display safe runtime configuration values.\n  Credentials and secrets are never shown.",
  },
  {
    name: "/help",
    alias: ["/h", "/?"],
    desc: "Help",
    help: "Show available commands and usage information.\n\n  Usage:  /help [command]\n\n  Examples:\n    /help\n    /help work\n    /help jobs",
  },
  {
    name: "/clear",
    alias: [],
    desc: "Clear screen",
    help: "Clear the terminal screen.",
  },
  {
    name: "/quit",
    alias: ["/q", "/exit"],
    desc: "Exit",
    help: "Exit the Stratum console.",
  },
];

function findCommand(input) {
  const name = input.toLowerCase().split(/\s+/)[0];
  return COMMANDS.find(
    (cmd) => cmd.name === name || cmd.alias.includes(name),
  );
}

/* ── Data fetching ─────────────────────────────────────── */

async function fetchState(client) {
  const health = await getSystemHealth(client);
  const state = {
    healthy: health.cpReachable && health.activeWorkers > 0,
    cpReachable: health.cpReachable,
    workerCount: health.activeWorkers,
    jobs: { queued: 0, running: 0, succeeded: 0, failed: 0, cancelled: 0 },
    recentJobs: [],
    nodes: [],
  };

  if (!health.cpReachable) return state;

  try {
    const jobsRes = await client.listJobs();
    const allJobs = jobsRes.jobs || [];
    for (const j of allJobs) {
      if (state.jobs[j.status] !== undefined) state.jobs[j.status]++;
    }
    state.recentJobs = allJobs
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8);
  } catch {}

  try {
    const nodesRes = await client.getNodes();
    state.nodes = nodesRes.nodes || [];
  } catch {}

  return state;
}

/* ── Interactive selection (arrow-key menu) ─────────────── */

function interactiveSelect(prompt, options) {
  return new Promise((resolve) => {
    let selected = 0;

    function render() {
      // Move cursor up to clear previous render (except first time)
      process.stdout.write(`\n  ${c.bold}${prompt}${c.reset}\n\n`);
      options.forEach((opt, i) => {
        if (i === selected) {
          process.stdout.write(
            `  ${c.cyan}${sym.arrow}${c.reset} ${c.bold}${opt}${c.reset}\n`,
          );
        } else {
          process.stdout.write(`    ${c.dim}${opt}${c.reset}\n`);
        }
      });
      process.stdout.write(
        `\n  ${c.dim}↑↓ navigate  Enter select  Esc cancel${c.reset}`,
      );
    }

    function clearRender() {
      // Move up: prompt(1) + blank(1) + options + footer(1) + blank between(1)
      const lines = options.length + 4;
      for (let i = 0; i < lines; i++) {
        process.stdout.write("\u001b[1A\u001b[2K");
      }
    }

    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();

    render();

    function onData(buf) {
      const key = buf.toString();

      if (key === "\u001b[A") {
        // Up
        clearRender();
        selected = (selected - 1 + options.length) % options.length;
        render();
      } else if (key === "\u001b[B") {
        // Down
        clearRender();
        selected = (selected + 1) % options.length;
        render();
      } else if (key === "\r" || key === "\n") {
        cleanup();
        clearRender();
        process.stdout.write(`\n`);
        resolve(options[selected]);
      } else if (key === "\u001b" || key === "\u0003") {
        // Escape or Ctrl+C
        cleanup();
        clearRender();
        process.stdout.write(`\n`);
        resolve(null);
      }
    }

    function cleanup() {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(wasRaw || false);
      if (!wasRaw) process.stdin.pause();
    }

    process.stdin.on("data", onData);
  });
}

/* ── Inline prompt ─────────────────────────────────────── */

function inlinePrompt(rl, label, defaultVal) {
  return new Promise((resolve) => {
    const suffix = defaultVal ? ` ${c.dim}(${defaultVal})${c.reset}` : "";
    rl.question(`  ${c.bold}${label}${c.reset}${suffix} ${sym.arrow} `, (answer) => {
      resolve(answer.trim() || defaultVal || "");
    });
  });
}

/* ── Slash command implementations ─────────────────────── */

async function cmdWork(client, rl) {
  const type = await interactiveSelect("What would you like Stratum to run?", [
    "echo",
    "sleep",
  ]);

  if (!type) return;

  let payload;
  if (type === "echo") {
    const msg = await inlinePrompt(rl, "Message", "Hello Stratum");
    payload = { message: msg };
  } else if (type === "sleep") {
    const dur = await inlinePrompt(rl, "Duration (ms)", "15000");
    payload = { durationMs: parseInt(dur, 10) || 15000 };
  }

  console.log("");
  console.log(
    kvPanel([
      ["Type", type],
      ["Payload", JSON.stringify(payload)],
    ]),
  );
  console.log(
    `\n  ${c.dim}Enter${c.reset} run  ${c.dim}Esc${c.reset} cancel\n`,
  );

  const confirm = await inlinePrompt(rl, "Submit?", "y");
  if (confirm.toLowerCase() !== "y" && confirm !== "") {
    dim("  Cancelled.");
    return;
  }

  const spinner = createSpinner("Submitting work…");
  spinner.start();

  try {
    const result = await client.submitJob({
      type,
      payload,
      priority: 0,
      maxRetries: 3,
    });
    spinner.stop(`${c.green}${sym.check}${c.reset} Work submitted`);
    console.log(`\n  ${c.dim}ID${c.reset}     ${result.job.id}`);
    console.log(`  ${c.dim}Status${c.reset} ${result.job.status}`);

    // Watch the job for up to 30s
    console.log(`\n  ${c.dim}Watching…${c.reset}`);
    let prev = result.job.status;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const check = await client.getJob(result.job.id);
        if (check.job.status !== prev) {
          const icon = statusIcon(check.job.status);
          console.log(`  ${icon} ${check.job.status}`);
          prev = check.job.status;
          if (["succeeded", "failed", "cancelled"].includes(prev)) {
            if (check.job.result) {
              console.log(
                `\n  ${c.dim}Result${c.reset} ${JSON.stringify(check.job.result)}`,
              );
            }
            break;
          }
        }
      } catch {
        break;
      }
    }
  } catch (e) {
    spinner.stop(`${c.red}${sym.cross}${c.reset} Submission failed`);
    error(`  ${e.message}`);
  }
}

async function cmdJobs(client, args) {
  const filter = args.trim() || undefined;
  try {
    const res = await client.listJobs(filter ? { status: filter } : {});
    const jobs = res.jobs || [];
    if (jobs.length === 0) {
      dim(`  No ${filter ? filter + " " : ""}jobs found.`);
      return;
    }

    const sorted = jobs
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);

    const rows = sorted.map((j) => [
      statusIcon(j.status),
      j.id.substring(0, 8) + "…",
      j.type,
      j.status,
      timeAgo(j.createdAt),
    ]);

    console.log(table(["", "ID", "TYPE", "STATUS", "AGE"], rows));
    console.log(`\n  ${c.dim}Total: ${jobs.length}${c.reset}`);
  } catch (e) {
    error(`Cannot reach Control Plane: ${e.message}`);
  }
}

async function cmdWorkers(client) {
  try {
    const health = await getSystemHealth(client);
    if (!health.cpReachable) {
      error("Control Plane is not reachable.");
      dim("\n  Run: stratum start  or  /doctor");
      return;
    }

    const nodesRes = await client.getNodes();
    const nodes = nodesRes.nodes || [];
    if (nodes.length === 0) {
      dim("  No workers online.");
      return;
    }

    const rows = nodes.map((n) => [
      statusDot(n.status === "active"),
      n.nodeId || n.id,
      n.status,
      `heartbeat ${timeAgo(n.lastHeartbeat)}`,
    ]);

    console.log(table(["", "NODE", "STATUS", "HEARTBEAT"], rows));
  } catch (e) {
    error(`Cannot reach Control Plane: ${e.message}`);
  }
}

async function cmdStatus(client) {
  const health = await getSystemHealth(client);
  heading("Stratum Status");

  let jobStats = { queued: 0, running: 0, succeeded: 0, failed: 0 };
  if (health.cpReachable) {
    try {
      const res = await client.listJobs();
      for (const j of res.jobs || []) {
        if (jobStats[j.status] !== undefined) jobStats[j.status]++;
      }
    } catch {}
  }

  const entries = [
    [
      "Control Plane",
      health.cpReachable
        ? `${c.green}${sym.dot} healthy${c.reset}`
        : `${c.red}${sym.circle} unreachable${c.reset}`,
    ],
    [
      "Workers",
      health.activeWorkers > 0
        ? `${c.green}${health.activeWorkers} online${c.reset}`
        : `${c.yellow}0 online${c.reset}`,
    ],
    ["Queued", String(jobStats.queued)],
    ["Running", String(jobStats.running)],
    ["Succeeded", String(jobStats.succeeded)],
    ["Failed", String(jobStats.failed)],
  ];

  console.log(kvPanel(entries));
  console.log(
    `\n${kvPanel([["Runtime", "local"], ["Endpoint", config.CONTROL_PLANE_URL]])}`,
  );
}

async function cmdLogs() {
  const logDir = getLogDir();
  const cpLog = join(logDir, "control-plane.log");
  const workerLog = join(logDir, "worker.log");

  heading("Recent Activity");

  const lines = [];

  for (const [label, path] of [
    ["control-plane", cpLog],
    ["worker", workerLog],
  ]) {
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, "utf8");
      const tail = content.trim().split("\n").slice(-15);
      for (const line of tail) {
        try {
          const parsed = JSON.parse(line);
          const time = shortTime(parsed.timestamp || parsed.time);
          const msg = parsed.msg || parsed.message || "";
          const level = parsed.level || "";
          const icon =
            level === "error"
              ? `${c.red}${sym.cross}${c.reset}`
              : level === "warn"
                ? `${c.yellow}!${c.reset}`
                : `${c.dim}${sym.dot}${c.reset}`;
          lines.push({
            ts: parsed.timestamp || parsed.time || "",
            display: `  ${c.dim}${time}${c.reset}  ${icon}  ${c.dim}${label}${c.reset}  ${msg}`,
          });
        } catch {
          // Non-JSON log line
          lines.push({
            ts: "",
            display: `  ${c.dim}${label}${c.reset}  ${line.substring(0, 80)}`,
          });
        }
      }
    } catch {}
  }

  if (lines.length === 0) {
    dim("  No logs available. Services may not have started yet.");
    return;
  }

  // Sort by timestamp, show latest 20
  lines
    .sort((a, b) => (a.ts > b.ts ? 1 : -1))
    .slice(-20)
    .forEach((l) => console.log(l.display));
}

async function cmdDoctor(client) {
  heading("Stratum Doctor");

  // Node
  const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);
  if (nodeMajor >= 22) {
    success(`Node.js ${process.versions.node}`);
  } else {
    error(`Node.js ${process.versions.node} (requires >=22)`);
  }

  // Health
  const health = await getSystemHealth(client);
  if (health.cpReachable) {
    success("Control Plane");
  } else {
    error("Control Plane (not reachable)");
  }

  if (health.activeWorkers > 0) {
    success(`Workers (${health.activeWorkers} online)`);
  } else {
    error("Workers (none registered)");
  }

  console.log("");
  if (health.cpReachable && health.activeWorkers > 0 && nodeMajor >= 22) {
    dim("  Everything looks good.");
  } else {
    dim("  Some issues detected. Run: stratum init");
  }
}

function cmdModel() {
  heading("Model");

  const provider = process.env.STRATUM_AI_PROVIDER || "none";
  const model = process.env.STRATUM_AI_MODEL || "—";
  const endpoint = process.env.STRATUM_AI_ENDPOINT || "—";
  const hasKey = !!process.env.GROQ_API_KEY;

  if (provider === "none" && !hasKey) {
    dim("  No AI model configured.");
    console.log("");
    dim("  AI Diagnostics is a future capability.");
    dim("  Configure by setting environment variables:");
    console.log("");
    console.log(
      kvPanel([
        ["STRATUM_AI_PROVIDER", "groq | openai | none"],
        ["STRATUM_AI_MODEL", "e.g. llama-3.3-70b-versatile"],
        ["GROQ_API_KEY", "your API key"],
      ]),
    );
  } else {
    console.log(
      kvPanel([
        ["Provider", provider],
        ["Model", model],
        ["Endpoint", endpoint],
        ["API Key", hasKey ? `${c.green}configured${c.reset}` : `${c.red}missing${c.reset}`],
      ]),
    );
  }
}

function cmdConfig() {
  heading("Stratum Configuration");

  const root = getProjectRoot();
  const envExists = existsSync(join(root, ".env"));

  console.log(
    kvPanel([
      ["Runtime", "local"],
      ["Control Plane", config.CONTROL_PLANE_URL],
      [
        "Timeout",
        `${config.REQUEST_TIMEOUT_MS}ms`,
      ],
      [".env", envExists ? `${c.green}present${c.reset}` : `${c.yellow}missing${c.reset}`],
      ["Project root", root],
      ["Logs", getLogDir()],
      ["AI provider", process.env.STRATUM_AI_PROVIDER || "none"],
    ]),
  );
}

function cmdHelp(args) {
  if (args.trim()) {
    const search = args.trim().replace(/^\//, "");
    const cmd = COMMANDS.find(
      (c) =>
        c.name === `/${search}` ||
        c.alias.includes(`/${search}`) ||
        c.name.includes(search),
    );
    if (cmd) {
      heading(cmd.name);
      console.log(`  ${cmd.desc}\n`);
      if (cmd.help) console.log(cmd.help);
    } else {
      dim(`  Unknown command: ${search}`);
    }
    return;
  }

  heading("Stratum Commands");

  const groups = [
    { label: "Work", cmds: ["/work", "/jobs", "/workers"] },
    { label: "System", cmds: ["/status", "/logs", "/doctor"] },
    { label: "Config", cmds: ["/model", "/config"] },
    { label: "", cmds: ["/help", "/clear", "/quit"] },
  ];

  for (const g of groups) {
    if (g.label) {
      console.log(`  ${c.dim}${g.label}${c.reset}`);
    }
    for (const name of g.cmds) {
      const cmd = COMMANDS.find((c) => c.name === name);
      if (cmd) {
        console.log(
          `  ${c.cyan}${cmd.name.padEnd(12)}${c.reset} ${c.dim}${cmd.desc}${c.reset}`,
        );
      }
    }
    console.log("");
  }
}

/* ── Header rendering ──────────────────────────────────── */

async function renderHeader(client) {
  const state = await fetchState(client);

  const statusStr = state.healthy
    ? `${c.green}${sym.dot} healthy${c.reset}`
    : `${c.red}${sym.circle} degraded${c.reset}`;

  const stats = [
    statusStr,
    `${state.workerCount} worker${state.workerCount !== 1 ? "s" : ""}`,
    `${state.jobs.queued} queued`,
    `${state.jobs.running} running`,
  ].join(`  ${c.dim}·${c.reset}  `);

  const lines = [
    `${c.bold}STRATUM${c.reset}`,
    `${c.dim}Distributed Work Control Console${c.reset}`,
    "",
    stats,
  ];

  console.log(box(lines));

  // Recent activity
  if (state.recentJobs.length > 0) {
    console.log(`\n  ${c.dim}Recent${c.reset}`);
    for (const j of state.recentJobs.slice(0, 5)) {
      const icon = statusIcon(j.status);
      const id = j.id.substring(0, 8) + "…";
      const type = j.type.padEnd(10);
      console.log(
        `  ${icon} ${c.dim}${id}${c.reset}  ${type}  ${c.dim}${j.status}${c.reset}`,
      );
    }
  }

  console.log("");
}

/* ── Autocomplete ──────────────────────────────────────── */

function completer(line) {
  if (!line.startsWith("/")) return [[], line];

  const matches = COMMANDS.filter(
    (cmd) =>
      cmd.name.startsWith(line) ||
      cmd.alias.some((a) => a.startsWith(line)),
  ).map((cmd) => cmd.name);

  return [matches.length ? matches : COMMANDS.map((c) => c.name), line];
}

/* ── Main REPL ─────────────────────────────────────────── */

export async function runDashboard(client) {
  process.stdout.write(CLEAR);
  await renderHeader(client);

  console.log(
    `  ${c.dim}Type ${c.reset}/help${c.dim} for commands, ${c.reset}/work${c.dim} to run work${c.reset}\n`,
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${c.cyan}${sym.arrow}${c.reset} `,
    completer,
    terminal: true,
    historySize: 100,
  });

  let running = true;

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    const cmd = findCommand(input);
    const args = input.replace(/^\/\S+\s*/, "");

    console.log(""); // breathing room

    try {
      if (!cmd && input.startsWith("/")) {
        dim(`  Unknown command: ${input}`);
        dim(`  Type /help for available commands.`);
      } else if (!cmd) {
        // Treat bare text as a search/shortcut
        dim(`  Type /help for available commands, or /work to run work.`);
      } else {
        switch (cmd.name) {
          case "/work":
            await cmdWork(client, rl);
            break;
          case "/jobs":
            await cmdJobs(client, args);
            break;
          case "/workers":
            await cmdWorkers(client);
            break;
          case "/status":
            await cmdStatus(client);
            break;
          case "/logs":
            await cmdLogs();
            break;
          case "/doctor":
            await cmdDoctor(client);
            break;
          case "/model":
            cmdModel();
            break;
          case "/config":
            cmdConfig();
            break;
          case "/help":
            cmdHelp(args);
            break;
          case "/clear":
            process.stdout.write(CLEAR);
            await renderHeader(client);
            break;
          case "/quit":
            running = false;
            rl.close();
            return;
        }
      }
    } catch (e) {
      error(`Unexpected error: ${e.message}`);
    }

    console.log(""); // breathing room after command output
    if (running) rl.prompt();
  });

  rl.on("close", () => {
    running = false;
    console.log(`\n${c.dim}Goodbye.${c.reset}\n`);
  });

  rl.on("SIGINT", () => {
    if (running) {
      console.log("");
      rl.prompt();
    }
  });

  // Keep the process alive until the RL closes
  await new Promise((resolve) => {
    rl.on("close", resolve);
  });
}
