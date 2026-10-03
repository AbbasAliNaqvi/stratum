/**
 * Stratum Interactive Console — v3
 *
 * Persistent slash-command REPL with live suggestions,
 * fuzzy typo correction, arrow-key selection, command history,
 * guided /work palette, polished output, and clean terminal handling.
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
  dim,
  timeAgo,
  shortTime,
  formatDuration,
  timeline,
  createSpinner,
  fuzzyMatch,
  CLEAR,
} from "./ui.js";

/* ── Command registry ──────────────────────────────────── */

const COMMANDS = [
  {
    name: "/work",
    alias: ["/w", "/run"],
    desc: "Run distributed work",
    help: "Create and submit work to the Stratum engine.\n\n  Usage:  /work\n\n  Walks you through selecting a workload type and\n  configuring its parameters interactively.\n\n  Supported workloads:\n    echo    Send a message through the engine\n    sleep   Run a timed delay job",
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
    help: "Run the full Stratum diagnostic suite.\n  Checks Node.js version, Control Plane reachability,\n  and worker registration. Provides actionable suggestions\n  for each problem found.",
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
    help: "Exit the Stratum console. Aliases: /q, /exit",
  },
];

export { COMMANDS };

export function findCommand(input) {
  const name = input.toLowerCase().split(/\s+/)[0];
  return COMMANDS.find((cmd) => cmd.name === name || cmd.alias.includes(name));
}

/**
 * Suggest corrections for an unknown command.
 */
export function suggestCommand(input) {
  const name = input.toLowerCase().split(/\s+/)[0];
  const allNames = COMMANDS.flatMap((cmd) => [cmd.name, ...cmd.alias]);
  return fuzzyMatch(name, allNames, 3);
}

/**
 * Filter commands matching a prefix (for autocomplete suggestions).
 */
export function filterCommands(prefix) {
  const lower = prefix.toLowerCase();
  return COMMANDS.filter(
    (cmd) =>
      cmd.name.startsWith(lower) || cmd.alias.some((a) => a.startsWith(lower)),
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

function interactiveSelect(prompt, options, { labels } = {}) {
  return new Promise((resolve) => {
    let selected = 0;
    const displayLabels = labels || options;

    function render() {
      process.stdout.write(`\n  ${c.bold}${prompt}${c.reset}\n\n`);
      displayLabels.forEach((label, i) => {
        if (i === selected) {
          process.stdout.write(
            `  ${c.cyan}${sym.arrow}${c.reset} ${c.bold}${label}${c.reset}\n`,
          );
        } else {
          process.stdout.write(`    ${c.dim}${label}${c.reset}\n`);
        }
      });
      process.stdout.write(
        `\n  ${c.dim}↑↓ navigate  Enter select  Esc cancel${c.reset}`,
      );
    }

    function clearRender() {
      const lines = displayLabels.length + 4;
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
        clearRender();
        selected = (selected - 1 + options.length) % options.length;
        render();
      } else if (key === "\u001b[B") {
        clearRender();
        selected = (selected + 1) % options.length;
        render();
      } else if (key === "\r" || key === "\n") {
        cleanup();
        clearRender();
        process.stdout.write(`\n`);
        resolve(options[selected]);
      } else if (key === "\u001b" || key === "\u0003") {
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

export function inlinePrompt(rl, label, defaultVal) {
  return new Promise((resolve) => {
    const suffix = defaultVal ? ` ${c.dim}(${defaultVal})${c.reset}` : "";
    const ac = new AbortController();

    const onKeypress = (s, key) => {
      if (key && key.name === "escape") {
        ac.abort();
        process.stdout.write("\n");
        resolve(null);
      }
    };

    process.stdin.on("keypress", onKeypress);

    // Some environments/tests might not support options in question() fully,
    // so we wrap it in a try-catch or just rely on manual cleanup if aborted.
    try {
      rl.question(
        `  ${c.bold}${label}${c.reset}${suffix} ${sym.arrow} `,
        { signal: ac.signal },
        (answer) => {
          process.stdin.removeListener("keypress", onKeypress);
          if (!ac.signal.aborted) {
            resolve(answer.trim() || defaultVal || "");
          }
        },
      );
    } catch (e) {
      // Fallback for older Node versions or if signal is rejected
      rl.question(
        `  ${c.bold}${label}${c.reset}${suffix} ${sym.arrow} `,
        (answer) => {
          process.stdin.removeListener("keypress", onKeypress);
          if (!ac.signal.aborted) {
            resolve(answer.trim() || defaultVal || "");
          }
        },
      );
    }

    ac.signal.addEventListener(
      "abort",
      () => {
        process.stdin.removeListener("keypress", onKeypress);
      },
      { once: true },
    );
  });
}

/* ── Slash command implementations ─────────────────────── */

async function cmdWork(client, rl) {
  const typeLabel = await interactiveSelect("What do you want to run?", [
    "Echo message",
    "Wait / Delay",
    "HTTP Request",
    "Run Command",
  ]);

  if (!typeLabel) return;

  let type = "";
  let payload;
  if (typeLabel === "Echo message") {
    type = "echo";
    const msg = await inlinePrompt(rl, "Message", "Hello Stratum");
    if (msg === null) {
      dim("  Cancelled.");
      return;
    }
    payload = { message: msg };
  } else if (typeLabel === "Wait / Delay") {
    type = "sleep";
    const dur = await inlinePrompt(rl, "Duration (ms)", "15000");
    if (dur === null) {
      dim("  Cancelled.");
      return;
    }
    const parsed = parseInt(dur, 10);
    if (isNaN(parsed) || parsed <= 0) {
      error("  Duration must be a positive number.");
      return;
    }
    payload = { durationMs: parsed };
  } else if (typeLabel === "HTTP Request") {
    type = "http";
    const url = await inlinePrompt(rl, "URL", "https://example.com");
    if (url === null) {
      dim("  Cancelled.");
      return;
    }
    const method = await inlinePrompt(rl, "Method", "GET");
    if (method === null) {
      dim("  Cancelled.");
      return;
    }
    const timeout = await inlinePrompt(rl, "Timeout", "30s");
    if (timeout === null) {
      dim("  Cancelled.");
      return;
    }

    payload = {
      url,
      method: method.toUpperCase(),
      timeout,
    };
  } else if (typeLabel === "Run Command") {
    if (process.env.STRATUM_ENABLE_COMMAND_JOBS !== "true") {
      console.log("");
      error("Run Command is disabled.");
      console.log(`\n  ${c.dim}Enable it with:${c.reset}`);
      console.log(`  STRATUM_ENABLE_COMMAND_JOBS=true\n`);
      return;
    }

    type = "command";
    const cmd = await inlinePrompt(rl, "Command", "echo 'Hello'");
    if (cmd === null) {
      dim("  Cancelled.");
      return;
    }
    payload = { command: cmd };
  }

  console.log("");
  console.log(
    kvPanel([
      ["Type", typeLabel],
      ["Payload", JSON.stringify(payload)],
    ]),
  );
  console.log(
    `\n  ${c.dim}Enter${c.reset} to run · ${c.dim}Esc${c.reset} to cancel\n`,
  );

  const confirm = await inlinePrompt(rl, "Submit?", "");
  if (confirm === null) {
    dim("  Cancelled.");
    return;
  }

  if (confirm.toLowerCase() === "n" || confirm.toLowerCase() === "no") {
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

    console.log("");
    console.log(
      kvPanel([
        ["ID", result.job.id],
        ["Type", typeLabel],
        ["Status", result.job.status],
      ]),
    );

    // Watch the job with timeline display
    console.log(`\n  ${c.dim}Watching…${c.reset}\n`);
    const steps = [result.job.status];
    let prev = result.job.status;
    const startTime = Date.now();

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const check = await client.getJob(result.job.id);
        if (check.job.status !== prev) {
          steps.push(check.job.status);
          prev = check.job.status;

          if (["succeeded", "failed", "cancelled"].includes(prev)) {
            break;
          }
        }
      } catch {
        break;
      }
    }

    // Render final timeline (outside the loop to prevent duplicates)
    const elapsed = Date.now() - startTime;
    const timelineSteps = steps.map((s) => {
      const icon = statusIcon(s);
      return `${icon} ${s}`;
    });
    console.log(timeline(timelineSteps));
    console.log("");

    if (prev === "succeeded") {
      success(
        `Completed in ${elapsed < 1000 ? elapsed + "ms" : (elapsed / 1000).toFixed(1) + "s"}`,
      );
    } else if (prev === "failed") {
      error(`Failed after ${(elapsed / 1000).toFixed(1)}s`);
    } else if (prev === "cancelled") {
      dim(`  Cancelled after ${(elapsed / 1000).toFixed(1)}s`);
    } else {
      dim(`  Still ${prev}. Use /jobs to check later.`);
    }

    try {
      const check = await client.getJob(result.job.id);
      if (check.job.result) {
        console.log(
          `\n  ${c.dim}Result${c.reset} ${JSON.stringify(check.job.result)}`,
        );
      }
      if (check.job.error) {
        console.log(`\n  ${c.dim}Error${c.reset} ${check.job.error}`);
      }
    } catch {}

    console.log(
      `\n  ${c.dim}${sym.arrow} /jobs  inspect jobs   ${sym.arrow} /work  run more work${c.reset}`,
    );
  } catch (e) {
    spinner.stop(`${c.red}${sym.cross}${c.reset} Submission failed`);
    console.log("");
    error(`${e.message}`);
    console.log(`\n  ${c.dim}Check: /doctor  or  stratum logs${c.reset}`);
  }
}

async function cmdJobs(client, args, rl) {
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

    heading(filter ? `Jobs — ${filter}` : "Jobs");

    const rows = sorted.map((j) => [
      statusIcon(j.status),
      j.id.substring(0, 8) + "…",
      j.type,
      j.status,
      timeAgo(j.createdAt),
    ]);

    console.log(table(["", "ID", "TYPE", "STATUS", "AGE"], rows));
    console.log(`\n  ${c.dim}Total: ${jobs.length}${c.reset}`);

    // Offer to view detail
    if (sorted.length > 0 && rl) {
      console.log(
        `\n  ${c.dim}Type a job ID prefix to inspect, or Enter to skip${c.reset}`,
      );
      const pick = await inlinePrompt(rl, "Inspect", "");
      if (pick) {
        const match = sorted.find((j) => j.id.startsWith(pick));
        if (match) {
          await showJobDetail(client, match.id);
        } else {
          dim(`  No job matching "${pick}".`);
        }
      }
    }
  } catch (e) {
    error("Cannot reach Control Plane.");
    dim(`\n  ${e.message}`);
    console.log(`\n  ${c.dim}Run: stratum start  or  /doctor${c.reset}`);
  }
}

async function showJobDetail(client, jobId) {
  try {
    const res = await client.getJob(jobId);
    const j = res.job;

    heading(`Job ${j.id.substring(0, 8)}…`);

    const entries = [
      ["Status", `${statusIcon(j.status)} ${j.status}`],
      ["Type", j.type],
    ];

    if (j.lockedBy) entries.push(["Worker", j.lockedBy]);

    entries.push([
      "Duration",
      formatDuration(j.startedAt, j.finishedAt || new Date().toISOString()),
    ]);
    entries.push(["Retries", `${j.retryCount}/${j.maxRetries}`]);
    entries.push(["Created", timeAgo(j.createdAt)]);

    if (j.idempotencyKey) entries.push(["Idempotency", j.idempotencyKey]);

    console.log(kvPanel(entries));

    if (j.result) {
      console.log(`\n  ${c.dim}Result${c.reset}`);
      console.log(`  ${JSON.stringify(j.result)}`);
    }

    if (j.error) {
      console.log(`\n  ${c.dim}Error${c.reset}`);
      console.log(`  ${j.error}`);
    }

    // Build lifecycle timeline from available timestamps
    const steps = [];
    steps.push(`${statusIcon("queued")} queued`);
    if (j.startedAt) steps.push(`${statusIcon("running")} running`);
    if (j.finishedAt) steps.push(`${statusIcon(j.status)} ${j.status}`);
    if (j.cancelRequestedAt)
      steps.push(`${statusIcon("cancelled")} cancel requested`);

    if (steps.length > 1) {
      console.log(`\n  ${c.dim}Timeline${c.reset}`);
      console.log(timeline(steps));
    }
  } catch (e) {
    error(`Could not fetch job: ${e.message}`);
  }
}

async function cmdWorkers(client) {
  try {
    const health = await getSystemHealth(client);
    if (!health.cpReachable) {
      error("Control Plane is not reachable.");
      console.log(
        `\n  ${c.dim}Cause:${c.reset} Cannot connect to ${config.CONTROL_PLANE_URL}`,
      );
      console.log(`\n  ${c.dim}Suggested action:${c.reset}`);
      console.log(`  ${c.cyan}${sym.arrow} stratum start${c.reset}`);
      return;
    }

    const nodesRes = await client.getNodes();
    const nodes = nodesRes.nodes || [];

    heading("Workers");

    if (nodes.length === 0) {
      dim("  No workers online.");
      console.log(
        `\n  ${c.dim}Workers register automatically when started.${c.reset}`,
      );
      console.log(`  ${c.dim}Run: stratum start${c.reset}`);
      return;
    }

    const rows = nodes.map((n) => [
      statusDot(n.status === "active"),
      n.nodeId || n.id,
      n.status === "active"
        ? `${c.green}healthy${c.reset}`
        : `${c.yellow}${n.status}${c.reset}`,
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
    `\n${kvPanel([
      ["Runtime", "local"],
      ["Endpoint", config.CONTROL_PLANE_URL],
    ])}`,
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
    console.log(`\n  ${c.dim}Run: stratum start${c.reset}`);
    return;
  }

  lines
    .sort((a, b) => (a.ts > b.ts ? 1 : -1))
    .slice(-20)
    .forEach((l) => console.log(l.display));
}

async function cmdDoctor(client) {
  heading("Stratum Doctor");
  let allGood = true;

  // Node
  const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);
  if (nodeMajor >= 22) {
    success(`Node.js ${process.versions.node}`);
  } else {
    error(`Node.js ${process.versions.node}`);
    console.log(
      `\n  ${c.dim}Cause:${c.reset} Stratum requires Node.js 22 or newer.`,
    );
    console.log(`  ${c.dim}Current:${c.reset} v${process.versions.node}`);
    console.log(`\n  ${c.dim}Suggested action:${c.reset}`);
    console.log(`  Install Node.js 22+ from https://nodejs.org\n`);
    allGood = false;
  }

  // Control Plane
  const health = await getSystemHealth(client);
  if (health.cpReachable) {
    success("Control Plane");
  } else {
    error("Control Plane");
    console.log(
      `\n  ${c.dim}Cause:${c.reset} Cannot reach ${config.CONTROL_PLANE_URL}`,
    );
    console.log(`  The Control Plane API is not responding.`);
    console.log(`\n  ${c.dim}Suggested action:${c.reset}`);
    console.log(`  ${c.cyan}${sym.arrow} stratum start${c.reset}\n`);
    allGood = false;
  }

  // Workers
  if (health.activeWorkers > 0) {
    success(`Workers (${health.activeWorkers} online)`);
  } else {
    error("Workers");
    console.log(`\n  ${c.dim}Cause:${c.reset} No active worker is registered.`);
    console.log(`  Jobs will remain queued until a worker is available.`);
    console.log(`\n  ${c.dim}Suggested action:${c.reset}`);
    console.log(`  ${c.cyan}${sym.arrow} stratum start${c.reset}\n`);
    allGood = false;
  }

  console.log("");
  if (allGood) {
    success("Everything looks good.");
  } else {
    dim("  Fix the issues above, or run:");
    console.log(`  ${c.cyan}${sym.arrow} stratum init${c.reset}`);
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
        [
          "API Key",
          hasKey
            ? `${c.green}configured${c.reset}`
            : `${c.red}missing${c.reset}`,
        ],
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
      ["Timeout", `${config.REQUEST_TIMEOUT_MS}ms`],
      [
        ".env",
        envExists
          ? `${c.green}present${c.reset}`
          : `${c.yellow}missing${c.reset}`,
      ],
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
      (entry) =>
        entry.name === `/${search}` ||
        entry.alias.includes(`/${search}`) ||
        entry.name.includes(search),
    );
    if (cmd) {
      heading(cmd.name);
      console.log(`  ${cmd.desc}\n`);
      if (cmd.alias.length > 0) {
        console.log(`  ${c.dim}Aliases: ${cmd.alias.join(", ")}${c.reset}\n`);
      }
      if (cmd.help) console.log(cmd.help);
    } else {
      dim(`  Unknown command: ${search}`);
      const suggestions = suggestCommand(`/${search}`);
      if (suggestions.length > 0) {
        console.log(
          `\n  ${c.dim}Did you mean:${c.reset} ${c.cyan}${suggestions[0]}${c.reset}`,
        );
      }
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
      const cmd = COMMANDS.find((entry) => entry.name === name);
      if (cmd) {
        const aliases =
          cmd.alias.length > 0
            ? ` ${c.dim}(${cmd.alias.join(", ")})${c.reset}`
            : "";
        console.log(
          `  ${c.cyan}${cmd.name.padEnd(12)}${c.reset} ${c.dim}${cmd.desc}${c.reset}${aliases}`,
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

  const matches = filterCommands(line).map((cmd) => cmd.name);

  return [matches.length ? matches : COMMANDS.map((entry) => entry.name), line];
}

/* ── Main REPL ─────────────────────────────────────────── */

export async function runDashboard(client) {
  process.stdout.write(CLEAR);
  await renderHeader(client);

  console.log(
    `  ${c.dim}Type ${c.reset}/help${c.dim} for commands, ${c.reset}/work${c.dim} to run work, ${c.reset}/${c.dim} for suggestions${c.reset}\n`,
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

    // Show suggestion list when user types exactly "/"
    if (input === "/") {
      console.log("");
      for (const cmd of COMMANDS) {
        console.log(
          `  ${c.cyan}${cmd.name.padEnd(12)}${c.reset}  ${c.dim}${cmd.desc}${c.reset}`,
        );
      }
      console.log("");
      rl.prompt();
      return;
    }

    const cmd = findCommand(input);
    const args = input.replace(/^\/\S+\s*/, "");

    console.log(""); // breathing room

    try {
      if (!cmd && input.startsWith("/")) {
        // Show filtered suggestions for partial commands like "/wo"
        const partial = input.split(/\s+/)[0];
        const filtered = filterCommands(partial);

        if (filtered.length > 0 && filtered.length < COMMANDS.length) {
          dim(`  Unknown command: ${input}`);
          console.log("");
          console.log(`  ${c.dim}Did you mean:${c.reset}`);
          for (const match of filtered.slice(0, 3)) {
            console.log(
              `  ${c.cyan}${sym.arrow} ${match.name}${c.reset}  ${c.dim}${match.desc}${c.reset}`,
            );
          }
        } else {
          // Fuzzy typo suggestions
          const suggestions = suggestCommand(input);
          dim(`  Unknown command: ${input}`);
          if (suggestions.length > 0) {
            console.log("");
            console.log(`  ${c.dim}Did you mean:${c.reset}`);
            for (const s of suggestions.slice(0, 3)) {
              const matchCmd = COMMANDS.find(
                (entry) => entry.name === s || entry.alias.includes(s),
              );
              const desc = matchCmd
                ? `  ${c.dim}${matchCmd.desc}${c.reset}`
                : "";
              console.log(`  ${c.cyan}${sym.arrow} ${s}${c.reset}${desc}`);
            }
          } else {
            dim(`  Type /help for available commands.`);
          }
        }
      } else if (!cmd) {
        dim(`  Type /help for available commands, or /work to run work.`);
      } else {
        switch (cmd.name) {
          case "/work":
            await cmdWork(client, rl);
            break;
          case "/jobs":
            await cmdJobs(client, args, rl);
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
