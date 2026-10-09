/**
 * Stratum Interactive Console — v4
 *
 * Automation & Orchestration Platform
 *
 * Persistent slash-command REPL with:
 *  - Product-level vocabulary (Task, Workflow, Run, Schedule)
 *  - Live slash-command suggestions and fuzzy typo correction
 *  - Guided /run palette, /workflow builder, /schedule creator
 *  - Real-time execution monitoring with timeline visualization
 *  - Deterministic /demo workflow
 *  - Arrow-key navigation, autocomplete, command history
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
import {
  TASK_TYPES,
  Orchestrator,
  Workflow,
  Schedule,
  createDemoWorkflow,
} from "./orchestrator.js";


/* ── Command registry ──────────────────────────────────── */

const COMMANDS = [
  {
    name: "/automations",
    alias: ["/a"],
    group: "Work",
    desc: "View automations",
    help: "List available automation recipes.\n\n  Usage:  /automations",
  },
  {
    name: "/run",
    alias: ["/r"],
    group: "Work",
    desc: "Run an automation or task",
    help: "Run an automation or a single task.\n\n  Usage:  /run [--dry-run]\n\n  Walks you through selecting an automation or task and\n  configuring its inputs.",
  },
  {
    name: "/workflow",
    alias: ["/wf"],
    group: "Advanced",
    desc: "Run a custom multi-step workflow",
    help: "Create and execute a custom workflow.\n\n  Usage:  /workflow",
  },
  {
    name: "/automate",
    alias: [],
    group: "Work",
    desc: "Create automation",
    help: "Create automation for workflows.\n\n  Usage:  /automate\n\n  This is a preview of the automation triggers system.",
  },
  {
    name: "/schedule",
    alias: [],
    group: "Work",
    desc: "Schedule execution",
    help: "Schedule a task to run on a recurring interval.\n\n  Usage:  /schedule\n\n  Configure what to run and how often.",
  },
  {
    name: "/demo",
    alias: [],
    group: "Work",
    desc: "Run the demo workflow",
    help: "Run the built-in Data Processing Pipeline demo.\n\n  Demonstrates:\n    • Parallel task execution across workers\n    • Sequential task dependencies\n    • Automatic retry on failure\n    • Result collection\n    • Workflow completion",
  },
  {
    name: "/runs",
    alias: [],
    group: "Observe",
    desc: "View executions",
    help: "Show recent task and workflow executions.\n\n  Usage:  /runs [filter]\n\n  Filters: running, succeeded, failed",
  },
  {
    name: "/tasks",
    alias: [],
    group: "Observe",
    desc: "View available tasks",
    help: "Show all available task types and their configuration.",
  },
  {
    name: "/workers",
    alias: [],
    group: "Observe",
    desc: "View workers",
    help: "Show all registered worker nodes and their status.",
  },
  {
    name: "/monitor",
    alias: ["/logs"],
    group: "Observe",
    desc: "Monitor activity",
    help: "Show recent structured log entries from Stratum services.",
  },
  {
    name: "/status",
    alias: ["/s"],
    group: "System",
    desc: "System health",
    help: "Display a comprehensive overview of system health\n  including execution engine, workers, and active runs.",
  },
  {
    name: "/doctor",
    alias: [],
    group: "System",
    desc: "Diagnose problems",
    help: "Run the full Stratum diagnostic suite.\n  Checks Node.js version, execution engine reachability,\n  and worker registration. Provides actionable suggestions\n  for each problem found.",
  },
  {
    name: "/config",
    alias: [],
    group: "System",
    desc: "Configuration",
    help: "Display safe runtime configuration values.\n  Credentials and secrets are never shown.",
  },
  {
    name: "/model",
    alias: [],
    group: "System",
    desc: "Intelligence settings",
    help: "Configure AI-powered diagnostics.\n\n  AI Diagnostics is a future capability.\n  This command shows current model configuration\n  and will be the interface for enabling AI-powered\n  analysis when available.",
  },
  {
    name: "/jobs",
    alias: ["/j"],
    group: "Advanced",
    desc: "Inspect internal jobs",
    help: "View raw internal job queue state.\n  This is an advanced debugging command.\n\n  Usage:  /jobs [filter]\n\n  Filters: running, queued, succeeded, failed, cancelled",
  },
  {
    name: "/about",
    alias: [],
    group: "Other",
    desc: "About STRATUM",
    help: "Learn about the STRATUM Automation & Orchestration Platform.",
  },
  {
    name: "/help",
    alias: ["/h", "/?"],
    group: "Other",
    desc: "Help",
    help: "Show available commands and usage information.\n\n  Usage:  /help [command]",
  },
  {
    name: "/clear",
    alias: [],
    group: "Other",
    desc: "Clear screen",
    help: "Clear the terminal screen.",
  },
  {
    name: "/quit",
    alias: ["/q", "/exit"],
    group: "Other",
    desc: "Exit",
    help: "Exit the Stratum console. Aliases: /q, /exit",
  },
];

export { COMMANDS };

export function findCommand(input) {
  const name = input.toLowerCase().split(/\s+/)[0];
  return COMMANDS.find(
    (cmd) => cmd.name === name || cmd.alias.includes(name),
  );
}

export function suggestCommand(input) {
  const name = input.toLowerCase().split(/\s+/)[0];
  const allNames = COMMANDS.flatMap((cmd) => [cmd.name, ...cmd.alias]);
  return fuzzyMatch(name, allNames, 3);
}

export function filterCommands(prefix) {
  const lower = prefix.toLowerCase();
  return COMMANDS.filter(
    (cmd) =>
      cmd.name.startsWith(lower) ||
      cmd.alias.some((a) => a.startsWith(lower)),
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
        process.stdout.write("\n");
        resolve(options[selected]);
      } else if (key === "\u001b" || key === "\u0003") {
        cleanup();
        clearRender();
        process.stdout.write("\n");
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

/* ── Inline prompt with Escape support ─────────────────── */

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
    } catch {
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
      () => process.stdin.removeListener("keypress", onKeypress),
      { once: true },
    );
  });
}

function cmdAbout() {
  heading("STRATUM");
  console.log(`  Automation & Orchestration Platform`);
  console.log("");
  console.log(`  ${c.bold}What it does${c.reset}`);
  console.log(`  Build automated processes from tasks.`);
  console.log(`  Run independent work in parallel.`);
  console.log(`  Schedule recurring execution.`);
  console.log(`  Monitor runs.`);
  console.log(`  Retry and recover failures.`);
  console.log("");
  console.log(`  ${c.bold}How it works${c.reset}`);
  console.log(`  Automation`);
  console.log(`      ↓`);
  console.log(`  Workflow`);
  console.log(`      ↓`);
  console.log(`  Run`);
  console.log(`      ↓`);
  console.log(`  Distributed execution`);
  console.log(`      ↓`);
  console.log(`  Workers`);
  console.log(`      ↓`);
  console.log(`  Result`);
}

/* ── /automate command ─────────────────────────────────── */

async function cmdAutomate(client, rl) {
  heading("Create Automation");

  const name = await inlinePrompt(rl, "Automation name", "My Automation");
  if (!name) return;

  const description = await inlinePrompt(rl, "Description", "");
  if (description === null) return;

  const steps = [];
  let adding = true;

  while (adding) {
    const stepNum = steps.length + 1;
    console.log(`\n  ${c.bold}Add step ${stepNum}?${c.reset}`);
    
    const userTypes = Object.entries(TASK_TYPES).filter((e) => !e[1].internal);
    const typeKeys = userTypes.map((e) => e[0]);
    const typeLabels = userTypes.map((e) => `${e[1].icon}  ${e[1].name}`);

    const selectedType = await interactiveSelect("Task type", [...typeKeys, "cancel"], {
      labels: [...typeLabels, "Stop adding steps"],
    });

    if (!selectedType || selectedType === "cancel") {
      if (steps.length === 0) {
        dim("  Cancelled.");
        return;
      }
      adding = false;
      break;
    }

    const taskDef = TASK_TYPES[selectedType];
    const stepId = await inlinePrompt(rl, "Step ID", `step-${stepNum}`);
    if (!stepId) return;

    const payload = {};
    for (const field of taskDef.fields) {
      const value = await inlinePrompt(rl, field.label, field.default || "");
      if (value === null) return;
      payload[field.name] = field.transform ? field.transform(value) : value;
    }

    let dependsOn = [];
    if (steps.length > 0) {
      const available = steps.map((s) => s.id).join(", ");
      dim(`  Available: ${available}`);
      const depInput = await inlinePrompt(rl, "Depends on", steps[steps.length - 1].id);
      if (depInput === null) return;
      if (depInput) {
        dependsOn = depInput.split(",").map((d) => d.trim()).filter(Boolean);
      }
    }

    steps.push({ id: stepId, type: selectedType, payload, dependsOn });
    success(`  Added: ${stepId}`);
  }

  console.log("");
  const confirm = await inlinePrompt(rl, "Save automation?", "y");
  if (confirm === null || confirm.toLowerCase() !== "y") {
    dim("  Cancelled.");
    return;
  }

  const spinner = createSpinner("Saving...");
  spinner.start();
  try {
    const res = await client.createAutomation({
      name,
      description,
      definition: { steps }
    });
    spinner.stop(`${c.green}${sym.check}${c.reset} Automation created\n  ID: ${res.automation.id}`);
  } catch (e) {
    spinner.stop(`${c.red}${sym.cross}${c.reset} Failed to save: ${e.message}`);
  }
}

/* ── /automations command ──────────────────────────────── */

async function cmdAutomations(client, rl, orchestrator) {
  heading("Automations");
  
  let data;
  try {
    data = await client.getAutomations();
  } catch (e) {
    error(`Failed to fetch automations: ${e.message}`);
    return;
  }
  
  const automations = data.automations || [];
  
  if (automations.length === 0) {
    dim("  No automations available.");
    console.log(`\n  ${c.dim}Create one with /automate${c.reset}`);
    return;
  }
  
  const autoKeys = automations.map(a => a.id);
  const autoLabels = automations.map(a => `${a.name.padEnd(24)} ${c.dim}${a.description || ''}${c.reset}`);
  
  const selectedId = await interactiveSelect(
    "Automations",
    autoKeys,
    { labels: autoLabels }
  );
  
  if (!selectedId) return;
  
  let automationRes;
  try {
    automationRes = await client.getAutomation(selectedId);
  } catch (e) {
    error(`Failed to fetch automation: ${e.message}`);
    return;
  }
  
  const automation = automationRes.automation;
  
  console.log("");
  console.log(`  ${c.bold}${automation.name}${c.reset}`);
  console.log("");
  console.log(`  ${c.dim}Description${c.reset}`);
  console.log(`  ${automation.description || 'none'}`);
  console.log("");
  
  console.log(`  ${c.dim}Steps${c.reset}`);
  const dag = automation.definition?.steps || [];
  for (let i = 0; i < dag.length; i++) {
    const s = dag[i];
    console.log(`  ${s.id}`);
    if (i < dag.length - 1) {
      console.log(`      ↓`);
    }
  }
  console.log("");
  
  const action = await interactiveSelect("Action", ["run", "dry-run"], { labels: ["Run", "Dry run"] });
  if (!action) return;
  
  if (action === "dry-run") {
    await cmdRun(client, rl, orchestrator, "--dry-run");
  } else {
    await cmdRun(client, rl, orchestrator, "");
  }
}

/* ── /run command ──────────────────────────────────────── */

async function cmdRun(client, rl, orchestrator, args = "") {
  const isDryRun = args.includes("--dry-run");

  const runChoice = await interactiveSelect(
    "What do you want to run?",
    ["automation", "task"],
    { labels: ["Automation", "Single task"] }
  );

  if (!runChoice) return;

  if (runChoice === "automation") {
    let data;
    try {
      data = await client.getAutomations();
    } catch (e) {
      error(`Failed to fetch automations: ${e.message}`);
      return;
    }
    const automations = data.automations || [];
    if (automations.length === 0) {
      error("No automations available.");
      return;
    }

    const autoKeys = automations.map(a => a.id);
    const autoLabels = automations.map(a => `${a.name.padEnd(24)} ${c.dim}${a.description || ''}${c.reset}`);
    
    const selectedId = await interactiveSelect(
      "Choose automation",
      autoKeys,
      { labels: autoLabels }
    );
    if (!selectedId) return;

    let automationRes;
    try {
      automationRes = await client.getAutomation(selectedId);
    } catch (e) {
      error(`Failed to fetch automation: ${e.message}`);
      return;
    }
    const automation = automationRes.automation;
    
    // For now we don't have defined inputs on the automation model since they are dynamic, 
    // but we can prompt for any needed inputs if we had a schema. Let's just pass empty inputs.
    const inputs = {};

    if (isDryRun) {
      console.log("");
      heading("Execution Plan");
      const steps = automation.definition?.steps || [];
      steps.forEach((s, i) => {
        console.log(`  ${i+1}. ${s.id} ${c.dim}(${s.type})${c.reset}`);
      });
      console.log(`\n  1 workflow\n  ${steps.length} steps\n  0 running\n\n  Nothing executed.`);
      return;
    }

    const confirm = await inlinePrompt(rl, "Run automation?", "");
    if (confirm === null || confirm.toLowerCase() === "n" || confirm.toLowerCase() === "no") {
      dim("  Cancelled.");
      return;
    }
    
    // We create the run in the API
    let runRes;
    try {
      runRes = await client.createRun(automation.id, inputs);
    } catch (e) {
      error(`Failed to create run: ${e.message}`);
      return;
    }

    const workflow = new Workflow({
      name: automation.name,
      steps: automation.definition?.steps || []
    });
    
    // We want orchestrator to execute this workflow, but we should pass the runId 
    // so it updates the DB instead of just in-memory.

    const startTime = Date.now();

    const run = await orchestrator.submitWorkflow(workflow, {
      inputs,
      runId: runRes.run.id,
      onProgress: (r) => {
        for (const task of r.tasks) {
          if (task.status !== "pending" && !task._displayed) {
            const icon = statusIcon(task.status);
            console.log(`  ${icon}  ${task.taskId.padEnd(16)} ${c.dim}${task.status}${c.reset}`);
            if (["succeeded", "failed", "cancelled", "skipped"].includes(task.status)) {
              task._displayed = true;
            }
          }
        }
      }
    });

    const elapsed = Date.now() - startTime;
    console.log("");
    if (run.status === "succeeded") {
      console.log(box([
        `${c.green}${sym.check}${c.reset} Automation completed`,
        "",
        `Automation     ${automation.name}`,
        `Status         ${c.green}healthy${c.reset}`,
        `Tasks          ${run.totalTaskCount}`,
        `Duration       ${formatDuration(elapsed)}`,
      ]));
    } else {
      console.log(box([
        `${c.red}${sym.cross}${c.reset} Automation failed`,
        "",
        `Automation     ${automation.name}`,
        `Status         ${c.red}failed${c.reset}`,
        `Tasks          ${run.totalTaskCount}`,
        `Duration       ${formatDuration(elapsed)}`,
      ]));
    }
    return;
  }

  // Single task branch
  const userTypes = Object.entries(TASK_TYPES).filter((e) => !e[1].internal);
  const typeKeys = userTypes.map((e) => e[0]);
  const typeLabels = userTypes.map(
    (e) => `${e[1].icon}  ${e[1].name.padEnd(16)} ${c.dim}${e[1].description}${c.reset}`,
  );

  const selectedType = await interactiveSelect(
    "Choose task",
    typeKeys,
    { labels: typeLabels },
  );

  if (!selectedType) return;

  const taskDef = TASK_TYPES[selectedType];

  // Check privilege gate
  if (taskDef.privileged && taskDef.envGate) {
    if (process.env[taskDef.envGate] !== "true") {
      console.log("");
      error(`${taskDef.name} is disabled.`);
      console.log(`\n  ${c.dim}Enable it with:${c.reset}`);
      console.log(`  ${taskDef.envGate}=true\n`);
      return;
    }
  }

  // Collect field values
  const payload = {};
  for (const field of taskDef.fields) {
    const value = await inlinePrompt(rl, field.label, field.default || "");
    if (value === null) {
      dim("  Cancelled.");
      return;
    }
    if (field.required && !value) {
      error(`  ${field.label} is required.`);
      return;
    }
    if (field.validate) {
      const err = field.validate(value);
      if (err) {
        error(`  ${err}`);
        return;
      }
    }
    payload[field.name] = field.transform ? field.transform(value) : value;
  }

  // Confirmation
  console.log("");
  console.log(
    kvPanel([
      ["Task", `${taskDef.icon}  ${taskDef.name}`],
      ["Payload", JSON.stringify(payload)],
    ]),
  );
  console.log(
    `\n  ${c.dim}Enter${c.reset} to run · ${c.dim}Esc${c.reset} to cancel\n`,
  );

  const confirm = await inlinePrompt(rl, "Submit?", "");
  if (confirm === null || confirm.toLowerCase() === "n" || confirm.toLowerCase() === "no") {
    dim("  Cancelled.");
    return;
  }

  const spinner = createSpinner("Submitting task…");
  spinner.start();

  const run = await orchestrator.submitTask(selectedType, payload);

  if (run.status === "failed") {
    spinner.stop(`${c.red}${sym.cross}${c.reset} Submission failed`);
    error(run.error);
    return;
  }

  spinner.stop(`${c.green}${sym.check}${c.reset} Task submitted`);

  console.log("");
  console.log(
    kvPanel([
      ["Run", run.id.substring(0, 8) + "…"],
      ["Task", `${taskDef.icon}  ${taskDef.name}`],
      ["Status", run.tasks[0].status],
    ]),
  );

  // Watch
  console.log(`\n  ${c.dim}Watching…${c.reset}\n`);
  const jobId = run.tasks[0].jobId;
  const steps = [run.tasks[0].status];
  let prev = run.tasks[0].status;
  const startTime = Date.now();

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const check = await client.getJob(jobId);
      if (check.job.status !== prev) {
        steps.push(check.job.status);
        prev = check.job.status;
        if (["succeeded", "failed", "cancelled"].includes(prev)) break;
      }
    } catch {
      break;
    }
  }

  const elapsed = Date.now() - startTime;
  const timelineSteps = steps.map((s) => `${statusIcon(s)} ${s}`);
  console.log(timeline(timelineSteps));
  console.log("");

  if (prev === "succeeded") {
    success(`Completed in ${elapsed < 1000 ? elapsed + "ms" : (elapsed / 1000).toFixed(1) + "s"}`);
  } else if (prev === "failed") {
    error(`Failed after ${(elapsed / 1000).toFixed(1)}s`);
  } else if (prev === "cancelled") {
    dim(`  Cancelled after ${(elapsed / 1000).toFixed(1)}s`);
  } else {
    dim(`  Still ${prev}. Use /runs to check later.`);
  }

  try {
    const final = await client.getJob(jobId);
    if (final.job.result) {
      console.log(`\n  ${c.dim}Result${c.reset} ${JSON.stringify(final.job.result)}`);
    }
    if (final.job.error) {
      console.log(`\n  ${c.dim}Error${c.reset} ${final.job.error}`);
    }
  } catch {}

  console.log(`\n  ${c.dim}${sym.arrow} /runs  view executions   ${sym.arrow} /run  run more${c.reset}`);
}

/* ── /workflow command ─────────────────────────────────── */

async function cmdWorkflow(client, rl, orchestrator) {
  heading("Create Workflow");
  dim("  Build a pipeline of tasks with dependencies.");
  dim("  Tasks with shared dependencies run in parallel.");
  console.log("");

  const steps = [];
  let adding = true;

  while (adding) {
    const stepNum = steps.length + 1;
    console.log(`  ${c.bold}Step ${stepNum}${c.reset}`);

    const userTypes = Object.entries(TASK_TYPES).filter((e) => !e[1].internal);
    const typeKeys = userTypes.map((e) => e[0]);
    const typeLabels = userTypes.map(
      (e) => `${e[1].icon}  ${e[1].name}`,
    );

    const selectedType = await interactiveSelect("Task type", typeKeys, {
      labels: typeLabels,
    });

    if (!selectedType) {
      if (steps.length === 0) {
        dim("  Cancelled.");
        return;
      }
      adding = false;
      break;
    }

    const taskDef = TASK_TYPES[selectedType];

    // Collect payload
    let cancelled = false;
    const payload = {};
    for (const field of taskDef.fields) {
      const value = await inlinePrompt(rl, field.label, field.default || "");
      if (value === null) {
        cancelled = true;
        break;
      }
      payload[field.name] = field.transform ? field.transform(value) : value;
    }
    
    if (cancelled) return;

    // Assign step ID
    const stepId = await inlinePrompt(rl, "Step ID", `step-${stepNum}`);
    if (stepId === null) return;

    // Dependencies
    let dependsOn = [];
    if (steps.length > 0) {
      const available = steps.map((s) => s.id).join(", ");
      dim(`  Available dependencies: ${available}`);
      const depInput = await inlinePrompt(
        rl,
        `Depends on`,
        steps[steps.length - 1].id,
      );
      if (depInput === null) return;
      if (depInput) {
        dependsOn = depInput.split(",").map((d) => d.trim()).filter(Boolean);
      }
    }

    steps.push({ id: stepId, type: selectedType, payload, dependsOn });
    success(`  Added: ${taskDef.icon}  ${stepId} (${taskDef.name})`);

    const more = await inlinePrompt(rl, "Add another step?", "y");
    if (more === null) return;
    if (more.toLowerCase() === "n" || more.toLowerCase() === "no") {
      adding = false;
    }
  }

  if (steps.length === 0) return;

  const wfName = await inlinePrompt(rl, "Workflow name", "My Workflow");
  if (wfName === null) {
    dim("  Cancelled.");
    return;
  }

  const workflow = new Workflow({ name: wfName, steps });
  const errors = workflow.validate();
  if (errors.length > 0) {
    error("Invalid workflow:");
    for (const e of errors) console.log(`  ${c.red}${sym.cross}${c.reset} ${e}`);
    return;
  }

  // Show workflow visualization
  heading(`Workflow: ${wfName}`);
  for (const step of steps) {
    const taskDef = TASK_TYPES[step.type] || { icon: "·", name: step.type };
    const deps =
      step.dependsOn.length > 0
        ? ` ${c.dim}← ${step.dependsOn.join(", ")}${c.reset}`
        : "";
    console.log(`  ${taskDef.icon}  ${step.id}${deps}`);
  }

  console.log(
    `\n  ${c.dim}Enter${c.reset} to execute · ${c.dim}Esc${c.reset} to cancel\n`,
  );

  const confirm = await inlinePrompt(rl, "Execute?", "");
  if (confirm === null || confirm.toLowerCase() === "n") {
    dim("  Cancelled.");
    return;
  }

  // Execute
  const spinner = createSpinner("Executing workflow…");
  spinner.start();

  const run = await orchestrator.submitWorkflow(workflow, {
    onProgress: (r) => {
      // We could update a live display here, but the spinner is sufficient
    },
  });

  spinner.stop(
    run.status === "succeeded"
      ? `${c.green}${sym.check}${c.reset} Workflow completed`
      : `${c.red}${sym.cross}${c.reset} Workflow ${run.status}`,
  );

  // Show results
  console.log("");
  for (const task of run.tasks) {
    const taskDef = TASK_TYPES[task.type] || { icon: "·", name: task.type };
    const icon = statusIcon(task.status);
    console.log(`  ${icon} ${taskDef.icon}  ${task.taskId.padEnd(16)} ${c.dim}${task.status}${c.reset}`);
  }

  console.log("");
  console.log(
    kvPanel([
      ["Tasks", String(run.totalTaskCount)],
      ["Succeeded", String(run.completedTaskCount)],
      ["Failed", String(run.failedTaskCount)],
      ["Status", run.status],
    ]),
  );
}

/* ── /schedule command ─────────────────────────────────── */

async function cmdSchedule(client, rl, orchestrator) {
  heading(`Schedule`);
  const action = await interactiveSelect("What would you like to do?", [
    "create",
    "list",
    "remove",
  ], {
    labels: [
      "Create a new schedule",
      "View active schedules",
      "Remove a schedule",
    ],
  });

  if (!action) return;

  if (action === "list") {
    let data;
    try {
      data = await client.getSchedules();
    } catch (e) {
      error(`Failed to fetch schedules: ${e.message}`);
      return;
    }
    const schedules = data.schedules || [];
    if (schedules.length === 0) {
      dim("  No active schedules.");
      console.log(`\n  ${c.dim}Create one with /schedule${c.reset}`);
      return;
    }
    heading("Active Schedules");
    const rows = schedules.map((s) => [
      statusDot(s.enabled === 1 || s.enabled === true),
      s.name,
      s.type === "automation" ? s.automationId : s.taskType,
      s.intervalMs ? `every ${s.intervalMs / 1000}s` : s.cron || "—",
      String(s.runCount),
    ]);
    console.log(table(["", "NAME", "TARGET", "INTERVAL", "RUNS"], rows));
    return;
  }

  if (action === "remove") {
    let data;
    try {
      data = await client.getSchedules();
    } catch (e) {
      error(`Failed to fetch schedules: ${e.message}`);
      return;
    }
    const schedules = data.schedules || [];
    if (schedules.length === 0) {
      dim("  No schedules to remove.");
      return;
    }
    const names = schedules.map((s) => s.id);
    const labels = schedules.map(
      (s) => `${s.name} (${s.type === 'automation' ? s.automationId : s.taskType}, every ${(s.intervalMs || 0) / 1000}s)`,
    );
    const selected = await interactiveSelect("Remove which schedule?", names, {
      labels,
    });
    if (!selected) return;
    try {
      await client.removeSchedule(selected);
      success(`Schedule removed.`);
    } catch (e) {
      error(`Failed to remove schedule: ${e.message}`);
    }
    return;
  }

  // Create
  heading("Create Schedule");

  const name = await inlinePrompt(rl, "Schedule name", "health-check");
  if (name === null) return;

  const targetChoice = await interactiveSelect(
    "What do you want to schedule?",
    ["automation", "task"],
    { labels: ["Automation", "Single task"] }
  );
  if (!targetChoice) return;

  let scheduleDef = { name, type: targetChoice };
  let displayTarget = "";

  if (targetChoice === "automation") {
    let data;
    try {
      data = await client.getAutomations();
    } catch (e) {
      error(`Failed to fetch automations: ${e.message}`);
      return;
    }
    const automations = data.automations || [];
    if (automations.length === 0) {
      error("No automations available.");
      return;
    }
    const autoKeys = automations.map(a => a.id);
    const autoLabels = automations.map(a => `${a.name.padEnd(24)} ${c.dim}${a.description || ''}${c.reset}`);
    
    const selectedId = await interactiveSelect(
      "Choose automation",
      autoKeys,
      { labels: autoLabels }
    );
    if (!selectedId) return;

    let automationRes;
    try {
      automationRes = await client.getAutomation(selectedId);
    } catch (e) {
      error(`Failed to fetch automation: ${e.message}`);
      return;
    }
    const automation = automationRes.automation;
    scheduleDef.automationId = selectedId;
    displayTarget = automation.name;
    
    // Collect inputs
    const inputs = {};
    // As mentioned earlier, inputs would be driven by a schema if we had one.
    // Assuming empty inputs for now.
    scheduleDef.inputs = inputs;
  } else {
    const userTypes = Object.entries(TASK_TYPES).filter((e) => !e[1].internal);
    const typeKeys = userTypes.map((e) => e[0]);
    const typeLabels = userTypes.map((e) => `${e[1].icon}  ${e[1].name}`);

    const taskType = await interactiveSelect("Task to schedule", typeKeys, {
      labels: typeLabels,
    });
    if (!taskType) return;

    const taskDef = TASK_TYPES[taskType];
    const payload = {};
    for (const field of taskDef.fields) {
      const value = await inlinePrompt(rl, field.label, field.default || "");
      if (value === null) return;
      payload[field.name] = field.transform ? field.transform(value) : value;
    }
    scheduleDef.taskType = taskType;
    scheduleDef.payload = payload;
    displayTarget = taskDef.name;
  }

  const intervalStr = await inlinePrompt(rl, "Interval (seconds)", "60");
  if (intervalStr === null) return;
  const intervalMs = parseInt(intervalStr, 10) * 1000;
  if (isNaN(intervalMs) || intervalMs < 5000) {
    error("Interval must be at least 5 seconds.");
    return;
  }

  scheduleDef.intervalMs = intervalMs;
  let schedule;
  try {
    const res = await client.createSchedule(scheduleDef);
    schedule = res.schedule;
    success(`Schedule created: "${name}"`);
    console.log(
      kvPanel([
        ["Target", displayTarget],
        ["Interval", `every ${intervalMs / 1000}s`],
        ["Next run", schedule.nextRunAt || "—"],
      ]),
    );
  } catch (e) {
    error(`Failed to create schedule: ${e.message}`);
  }
}

/* ── /demo command ─────────────────────────────────────── */

export async function cmdDemo(client, rl, orchestrator) {
  process.stdout.write(CLEAR);

  console.log(
    box([
      `${c.bold}STRATUM DEMO${c.reset}`,
      `${c.dim}Automation & Orchestration${c.reset}`,
    ]),
  );

  console.log(`
  ${c.bold}Problem:${c.reset}
  We need to monitor multiple endpoints simultaneously, validate
  the results, and handle failures gracefully.

  ${c.bold}STRATUM will:${c.reset}
  ${c.green}${sym.check}${c.reset} Execute API checks in parallel
  ${c.green}${sym.check}${c.reset} Automatically retry failures
  ${c.green}${sym.check}${c.reset} Coordinate task dependencies
  ${c.green}${sym.check}${c.reset} Collect results from all endpoints
  ${c.green}${sym.check}${c.reset} Produce a final health report
`);

  const workflow = createDemoWorkflow();

  // Show the pipeline
  heading("Pipeline: " + workflow.name);
  console.log(
    `  ${c.cyan}api-1${c.reset}    ${c.cyan}api-2${c.reset}    ${c.cyan}api-3${c.reset}  ${c.dim}← parallel${c.reset}`,
  );
  console.log(`  ${c.dim}  ↓        ↓        ↓${c.reset}`);
  console.log(`  ${c.dim}      validate${c.reset}`);
  console.log(`  ${c.dim}          ↓${c.reset}`);
  console.log(`  ${c.dim}   generate-report${c.reset}`);
  console.log("");

  const state = await fetchState(client);
  console.log(`  ${c.bold}Workers available: ${state.workerCount}${c.reset}`);
  console.log(`  Independent tasks are submitted concurrently.`);
  console.log(`  The execution engine schedules them across available workers.`);
  console.log("");

  if (rl) {
    const confirm = await inlinePrompt(rl, "Run the demo?", "");
    if (confirm === null || confirm.toLowerCase() === "n") {
      dim("  Cancelled.");
      return;
    }
  } else {
    // Non-interactive mode, just add a small delay for readability
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("");
  const startTime = Date.now();

  const abortController = new AbortController();
  const onSigint = () => {
    console.log(`\n  ${c.yellow}Cancelling demo...${c.reset}`);
    abortController.abort();
  };
  
  if (rl) {
    rl.on("SIGINT", onSigint);
  }

  // Execute workflow with live progress
  let run;
  try {
    run = await orchestrator.submitWorkflow(workflow, {
      signal: abortController.signal,
      onProgress: (r) => {
        // Show each task status change
        for (const task of r.tasks) {
          if (
            task.status !== "pending" &&
            task._lastDisplayedStatus !== task.status
          ) {
            const taskDef = TASK_TYPES[task.type] || { icon: "·" };
            const icon = statusIcon(task.status);
            console.log(
              `  ${icon} ${taskDef.icon}  ${task.taskId.padEnd(16)} ${c.dim}${task.status}${c.reset}`,
            );
            task._lastDisplayedStatus = task.status;
          }
        }
      },
    });
  } catch (e) {
    if (rl) rl.removeListener("SIGINT", onSigint);
    console.log(`\n  ${c.red}${e.message}${c.reset}\n`);
    return;
  }
  
  if (rl) rl.removeListener("SIGINT", onSigint);

  const elapsed = Date.now() - startTime;

  console.log("");

  // Count parallel tasks
  const parallelCount = 3;

  if (run.status === "succeeded" || run.status === "failed") {
    const api1Task = run.tasks.find(t => t.taskId === "api-1");
    const api2Task = run.tasks.find(t => t.taskId === "api-2");
    const api3Task = run.tasks.find(t => t.taskId === "api-3");
    
    let api3Result = "failed";
    if (api3Task?.status === "succeeded") {
      api3Result = "healthy after retry";
    }

    let retryOutput = "0";
    if (api3Task && api3Task.retryCount > 0) {
      retryOutput = `${api3Task.retryCount} (${api3Task.status === 'succeeded' ? 'recovered' : 'failed'})`;
    }

    const state = await fetchState(client);
    console.log(
      box([
        `${run.status === 'succeeded' ? c.green + sym.check : c.red + sym.cross}${c.reset} ${c.bold}Automation complete${c.reset}`,
        "",
        `Endpoint checks`,
        `  ${api1Task?.status === 'succeeded' ? c.green + sym.check + ' api-1 healthy' : c.red + sym.cross + ' api-1 failed'}${c.reset}`,
        `  ${api2Task?.status === 'succeeded' ? c.green + sym.check + ' api-2 healthy' : c.red + sym.cross + ' api-2 failed'}${c.reset}`,
        `  ${api3Result === 'failed' ? c.red + sym.cross + ' api-3 failed' : c.green + sym.check + ' api-3 ' + api3Result}${c.reset}`,
        "",
        `Retries        ${retryOutput}`,
        `Workers        ${state.workerCount}`,
        `Duration       ${(elapsed / 1000).toFixed(1)}s`,
      ]),
    );
  }
}

/* ── /runs command ─────────────────────────────────────── */

async function cmdRuns(client, args, rl, orchestrator) {
  heading(`Runs`);
  
  let data;
  try {
    data = await client.getRuns();
  } catch (e) {
    error(`Failed to fetch runs: ${e.message}`);
    return;
  }
  const runs = data.runs || [];

  if (runs.length === 0) {
    dim("  No executions yet.");
    console.log(`\n  ${c.dim}Run something with /run or /workflow${c.reset}`);
    return;
  }

  const runChoices = runs.map(r => r.id);
  const runLabels = runs.map(r => 
    `${statusIcon(r.status)} ${r.id.substring(0, 8)}… ${r.status}`
  );

  const selectedRunId = await interactiveSelect(
    "Runs",
    runChoices,
    { labels: runLabels }
  );

  if (!selectedRunId) return;

  let runRes;
  try {
    runRes = await client.getRun(selectedRunId);
  } catch(e) {
    error(`Failed to fetch run: ${e.message}`);
    return;
  }
  const run = runRes.run;
  const duration = run.completedAt 
    ? new Date(run.completedAt) - new Date(run.createdAt)
    : Date.now() - new Date(run.createdAt);

  console.log(`\n${c.bold}Run ${run.id.substring(0, 8)}…${c.reset}\n`);
  
  console.log(kvPanel([
    ["Automation ID", run.automationId],
    ["Status", run.status],
    ["Started", new Date(run.createdAt).toLocaleString()],
    ["Duration", formatDuration(duration)]
  ]));

  console.log(`\n${c.bold}Steps Linked to Jobs${c.reset}\n`);
  let hasSteps = false;
  for (const step of (run.steps || [])) {
    console.log(`  ${step.stepId.padEnd(14)} ${c.dim}Job ID: ${step.jobId}${c.reset}`);
    hasSteps = true;
  }
  
  if (!hasSteps) dim("  No steps data.");
  console.log("");
}

/* ── /tasks command ────────────────────────────────────── */

function cmdTasks() {
  heading("Available Tasks");
  const userTypes = Object.entries(TASK_TYPES).filter((e) => !e[1].internal);
  for (const [key, def] of userTypes) {
    const priv = def.privileged
      ? ` ${c.yellow}(privileged)${c.reset}`
      : "";
    console.log(`  ${def.icon}  ${c.bold}${def.name}${c.reset}${priv}`);
    console.log(`     ${c.dim}${def.description}${c.reset}`);
    if (def.fields.length > 0) {
      for (const f of def.fields) {
        const req = f.required ? "" : ` ${c.dim}(optional)${c.reset}`;
        const def2 = f.default ? ` ${c.dim}default: ${f.default}${c.reset}` : "";
        console.log(`     ${c.dim}${sym.dash}${c.reset} ${f.label}${req}${def2}`);
      }
    }
    console.log("");
  }
}

/* ── /jobs (advanced) ──────────────────────────────────── */

async function cmdJobs(client, args, rl) {
  const filter = args.trim() || undefined;
  try {
    const res = await client.listJobs(filter ? { status: filter } : {});
    const jobs = res.jobs || [];
    if (jobs.length === 0) {
      dim(`  No ${filter ? filter + " " : ""}jobs.`);
      return;
    }

    const sorted = jobs
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);

    heading(filter ? `Internal Jobs — ${filter}` : "Internal Jobs");

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
    error("Cannot reach execution engine.");
    dim(`\n  ${e.message}`);
  }
}

/* ── /workers command ──────────────────────────────────── */

async function cmdWorkers(client) {
  try {
    const health = await getSystemHealth(client);
    if (!health.cpReachable) {
      error("Execution engine is not reachable.");
      console.log(`\n  ${c.dim}Run: stratum start${c.reset}`);
      return;
    }

    const nodesRes = await client.getNodes();
    const nodes = nodesRes.nodes || [];

    heading("Workers");

    if (nodes.length === 0) {
      dim("  No workers online.");
      console.log(`\n  ${c.dim}Workers register automatically when started.${c.reset}`);
      console.log(`  ${c.dim}Run: stratum start${c.reset}`);
      return;
    }

    const rows = nodes.map((n) => [
      statusDot(n.status === "registered"),
      n.nodeId || n.id,
      n.status === "registered"
        ? `${c.green}healthy${c.reset}`
        : `${c.yellow}${n.status}${c.reset}`,
      `heartbeat ${n.lastHeartbeatAt ? timeAgo(n.lastHeartbeatAt) : "never"}`,
    ]);

    console.log(table(["", "NODE", "STATUS", "HEARTBEAT"], rows));
  } catch (e) {
    error(`Cannot reach execution engine: ${e.message}`);
  }
}

/* ── /status command ───────────────────────────────────── */

async function cmdStatus(client, orchestrator) {
  const health = await getSystemHealth(client);
  heading("System Status");

  let jobStats = { queued: 0, running: 0, succeeded: 0, failed: 0 };
  if (health.cpReachable) {
    try {
      const res = await client.listJobs();
      for (const j of res.jobs || []) {
        if (jobStats[j.status] !== undefined) jobStats[j.status]++;
      }
    } catch {}
  }

  let runs = [];
  let schedules = [];
  try {
    const [runsRes, schedRes] = await Promise.all([
      client.getRuns().catch(() => ({ runs: [] })),
      client.getSchedules().catch(() => ({ schedules: [] }))
    ]);
    runs = runsRes.runs || [];
    schedules = schedRes.schedules || [];
  } catch (e) {}
  
  const activeRuns = runs.filter((r) => !['succeeded', 'failed', 'cancelled'].includes(r.status)).length;

  const entries = [
    [
      "Engine",
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
    [`Active runs ${c.dim}(in-memory)${c.reset}`, String(activeRuns)],
    [`Schedules ${c.dim}(in-memory)${c.reset}`, String(schedules.length)],
    ["Queued", String(jobStats.queued)],
    ["Running", String(jobStats.running)],
    ["Succeeded", String(jobStats.succeeded)],
    ["Failed", String(jobStats.failed)],
  ];

  console.log(kvPanel(entries));
}

/* ── /monitor command ──────────────────────────────────── */

async function cmdMonitor() {
  const logDir = getLogDir();
  const cpLog = join(logDir, "control-plane.log");
  const workerLog = join(logDir, "worker.log");

  heading("Activity Monitor");

  const lines = [];

  for (const [label, path] of [
    ["engine", cpLog],
    ["worker", workerLog],
  ]) {
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, "utf8");
      const tail = content.trim().split("\n").slice(-15);
      for (const line of tail) {
        try {
          const parsed = JSON.parse(line);
          const date = new Date(parsed.timestamp || parsed.time || Date.now());
          const time = date.toLocaleTimeString('en-US', { hour12: false });
          let msg = parsed.msg || parsed.message || "";
          
          if (typeof msg === "object") {
            // Check if it's an error object or just a plain object
            if (msg.message) msg = msg.message;
            else msg = JSON.stringify(msg);
          }
          
          const level = parsed.level || "";
          const icon =
            level === "error"
              ? `${c.red}${sym.cross}${c.reset}`
              : level === "warn"
                ? `${c.yellow}!${c.reset}`
                : `${c.cyan}●${c.reset}`;
          
          lines.push({
            ts: date.getTime(),
            display: `${time}  ${icon} ${label.padEnd(8)} ${msg}`,
          });
        } catch {
          lines.push({
            ts: 0,
            display: `          ${c.dim}${label}${c.reset}  ${line.substring(0, 80)}`,
          });
        }
      }
    } catch {}
  }

  if (lines.length === 0) {
    dim("  No activity yet. Services may not have started.");
    console.log(`\n  ${c.dim}Run: stratum start${c.reset}`);
    return;
  }

  lines
    .sort((a, b) => a.ts - b.ts)
    .slice(-20)
    .forEach((l) => console.log(l.display));
}

/* ── /doctor command ───────────────────────────────────── */

async function cmdDoctor(client) {
  heading("Diagnostics");
  let allGood = true;

  const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);
  if (nodeMajor >= 22) {
    success(`Node.js ${process.versions.node}`);
  } else {
    error(`Node.js ${process.versions.node}`);
    console.log(`\n  ${c.dim}Cause:${c.reset} Stratum requires Node.js 22 or newer.`);
    console.log(`\n  ${c.dim}Action:${c.reset} Install Node.js 22+ from https://nodejs.org\n`);
    allGood = false;
  }

  const health = await getSystemHealth(client);
  if (health.cpReachable) {
    success("Execution engine");
  } else {
    error("Execution engine");
    console.log(`\n  ${c.dim}Cause:${c.reset} Cannot reach ${config.CONTROL_PLANE_URL}`);
    console.log(`\n  ${c.dim}Action:${c.reset}`);
    console.log(`  ${c.cyan}${sym.arrow} stratum start${c.reset}\n`);
    allGood = false;
  }

  if (health.activeWorkers > 0) {
    success(`Workers (${health.activeWorkers} online)`);
  } else {
    error("Workers");
    console.log(`\n  ${c.dim}Cause:${c.reset} No workers registered.`);
    console.log(`  Tasks will remain queued until a worker is available.`);
    console.log(`\n  ${c.dim}Action:${c.reset}`);
    console.log(`  ${c.cyan}${sym.arrow} stratum start${c.reset}\n`);
    allGood = false;
  }

  console.log("");
  if (allGood) {
    success("All systems operational.");
  } else {
    dim("  Fix the issues above, then run:");
    console.log(`  ${c.cyan}${sym.arrow} stratum init${c.reset}`);
  }
}

/* ── /model command ────────────────────────────────────── */

async function cmdModel(client) {
  heading("Intelligence");

  let cfg = { enabled: false, provider: "mock", model: "gpt-4o", toolCount: 18, policy: "Controlled" };
  try {
    cfg = await client.getAgentConfig();
  } catch {}

  console.log(
    kvPanel([
      ["AI Runtime Status", cfg.enabled ? `${c.green}${sym.dot} Enabled${c.reset}` : `${c.yellow}${sym.circle} Disabled (Mock Provider Active)${c.reset}`],
      ["Provider", cfg.provider || "openai"],
      ["Model", cfg.model || "gpt-4o"],
      ["Tools Registered", String(cfg.toolCount || 18)],
      ["Policy Engine", cfg.policy || "Controlled"],
    ]),
  );

  if (!cfg.enabled) {
    console.log("");
    dim("  Set STRATUM_AI_ENABLED=true to enable production LLM models.");
  }
}

async function cmdAgent(client, rl, goalInput) {
  heading("STRATUM AI Agent");

  let goal = goalInput ? goalInput.trim() : "";
  if (!goal) {
    console.log(`  ${c.dim}Enter natural language goal or question for the AI Agent:${c.reset}`);
    goal = await new Promise((res) => {
      rl.question(`  ${c.cyan}${sym.arrow}${c.reset} `, (ans) => res(ans.trim()));
    });
  }

  if (!goal) return;

  const spinner = createSpinner("Initializing Agent runtime loop...");
  try {
    const sessRes = await client.createAgentSession(`Goal: ${goal.substring(0, 30)}`);
    const sessionId = sessRes.session.id;

    spinner.setText("Agent inspecting system state and formulating plan...");
    const sessionRes = await client.sendAgentMessage(sessionId, goal);
    spinner.stop();

    const session = sessionRes.session;

    // Output Messages & Plans
    for (const msg of session.messages || []) {
      if (msg.role === "assistant" && msg.content) {
        console.log(`\n  ${c.bold}STRATUM Agent:${c.reset}\n`);
        console.log(`  ${msg.content.replace(/\n/g, "\n  ")}\n`);
      }

      if (msg.plan && msg.plan.length > 0) {
        console.log(`  ${c.bold}Plan Checklist:${c.reset}`);
        for (const p of msg.plan) {
          const icon = p.status === "completed" ? `${c.green}✓${c.reset}` : `${c.yellow}⟳${c.reset}`;
          console.log(`    ${icon} ${p.title}`);
        }
        console.log("");
      }
    }

    // Output Tool Calls
    if (session.toolCalls && session.toolCalls.length > 0) {
      console.log(`  ${c.bold}Tool Activity Log:${c.reset}`);
      for (const tc of session.toolCalls) {
        const statusStr = tc.status === "executed" || tc.status === "approved"
          ? `${c.green}✓ ${tc.status}${c.reset}`
          : tc.status === "waiting_approval"
            ? `${c.yellow}! approval required${c.reset}`
            : `${c.red}✗ ${tc.status}${c.reset}`;
        console.log(`    ${statusStr}  ${c.cyan}${tc.toolName}${c.reset}  ${c.dim}${tc.durationMs ? tc.durationMs + "ms" : ""}${c.reset}`);
      }
      console.log("");
    }

    // Handle Pending Approvals
    if (session.pendingApprovals && session.pendingApprovals.length > 0) {
      for (const appr of session.pendingApprovals) {
        console.log(`  ${c.yellow}${c.bold}POLICY APPROVAL REQUIRED${c.reset}`);
        console.log(`  Operation: ${c.bold}${appr.toolName}${c.reset} (${appr.riskLevel})`);
        console.log(`  Reason:    ${appr.reason}\n`);

        const answer = await new Promise((res) => {
          rl.question(`  Approve execution? [y/N]: `, (ans) => res(ans.trim().toLowerCase()));
        });

        if (answer === "y" || answer === "yes") {
          const apprSpinner = createSpinner("Executing approved action...");
          const resSess = await client.approveAgentAction(appr.id);
          apprSpinner.stop();
          success("Action approved and executed.");
          if (resSess.session?.messages) {
            const lastMsg = resSess.session.messages[resSess.session.messages.length - 1];
            if (lastMsg && lastMsg.content) {
              console.log(`\n  ${lastMsg.content}\n`);
            }
          }
        } else {
          await client.rejectAgentAction(appr.id, "Rejected by CLI user");
          warn("Action rejected.");
        }
      }
    }
  } catch (err) {
    spinner.stop();
    error(`Agent error: ${err.message}`);
  }
}

/* ── /config command ───────────────────────────────────── */

function cmdConfig() {
  heading("Configuration");

  const root = getProjectRoot();
  const envExists = existsSync(join(root, ".env"));

  console.log(
    kvPanel([
      ["Runtime", "local"],
      ["Engine", config.CONTROL_PLANE_URL],
      ["Timeout", `${config.REQUEST_TIMEOUT_MS}ms`],
      [
        ".env",
        envExists
          ? `${c.green}present${c.reset}`
          : `${c.yellow}missing${c.reset}`,
      ],
      ["Project root", root],
      ["Logs", getLogDir()],
      ["Commands", process.env.STRATUM_ENABLE_COMMAND_JOBS === "true" ? `${c.green}enabled${c.reset}` : `${c.yellow}disabled${c.reset}`],
      ["AI", process.env.STRATUM_AI_PROVIDER || "none"],
    ]),
  );
}

/* ── /help command ─────────────────────────────────────── */

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
    { label: "Work", cmds: ["/run", "/workflow", "/schedule", "/demo"] },
    { label: "Observe", cmds: ["/runs", "/tasks", "/workers", "/monitor"] },
    { label: "System", cmds: ["/status", "/doctor", "/config", "/model"] },
    { label: "Other", cmds: ["/help", "/clear", "/quit"] },
  ];

  for (const g of groups) {
    console.log(`  ${c.dim}${g.label}${c.reset}`);
    for (const name of g.cmds) {
      const cmd = COMMANDS.find((entry) => entry.name === name);
      if (cmd) {
        const aliases =
          cmd.alias.length > 0
            ? ` ${c.dim}(${cmd.alias.join(", ")})${c.reset}`
            : "";
        console.log(
          `  ${c.cyan}${cmd.name.padEnd(14)}${c.reset} ${c.dim}${cmd.desc}${c.reset}${aliases}`,
        );
      }
    }
    console.log("");
  }

  dim("  Advanced: /jobs (internal job queue inspection)");
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
    `${state.jobs.running} running`,
    `${state.jobs.queued} queued`,
  ].join(`  ${c.dim}·${c.reset}  `);

  const lines = [
    `${c.bold}STRATUM${c.reset}`,
    `${c.dim}Automation & Orchestration Platform${c.reset}`,
    "",
    `${c.dim}Run tasks. Build workflows. Automate execution.${c.reset}`,
    "",
    stats,
  ];

  console.log(box(lines, { width: 62 }));
  console.log("");
}

/* ── Autocomplete ──────────────────────────────────────── */

function completer(line) {
  if (!line.startsWith("/")) return [[], line];
  const matches = filterCommands(line).map((cmd) => cmd.name);
  return [matches.length ? matches : COMMANDS.map((e) => e.name), line];
}

/* ── Main REPL ─────────────────────────────────────────── */

export async function runDashboard(client) {
  const orchestrator = new Orchestrator(client);

  process.stdout.write(CLEAR);
  await renderHeader(client);

  console.log(
    `  ${c.dim}Type ${c.reset}/help${c.dim} for commands, ${c.reset}/run${c.dim} to run a task, ${c.reset}/${c.dim} for suggestions${c.reset}\n`,
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
  let inCommand = false;

  rl.prompt();

  rl.on("line", async (line) => {
    if (inCommand) return;
    inCommand = true;
    
    try {
      const input = line.trim();
      if (!input) {
        return;
      }

      if (input === "/") {
        console.log("");
        for (const cmd of COMMANDS.filter((c) => c.group !== "Advanced")) {
          console.log(
            `  ${c.cyan}${cmd.name.padEnd(14)}${c.reset}  ${c.dim}${cmd.desc}${c.reset}`,
          );
        }
        return;
      }

      const cmd = findCommand(input);
      const args = input.replace(/^\/\S+\s*/, "");

      console.log("");

      if (!cmd && input.startsWith("/")) {
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
            dim("  Type /help for available commands.");
          }
        }
      } else if (!cmd) {
        dim("  Type /help for commands, or /run to run a task.");
      } else {
        switch (cmd.name) {
          case "/automations":
          case "/a":
            await cmdAutomations(client, rl, orchestrator);
            break;
          case "/automate":
            cmdAutomate();
            break;
          case "/about":
            cmdAbout();
            break;
          case "/run":
          case "/r":
            await cmdRun(client, rl, orchestrator, args);
            break;
          case "/workflow":
          case "/wf":
            await cmdWorkflow(client, rl, orchestrator);
            break;
          case "/schedule":
            await cmdSchedule(client, rl, orchestrator);
            break;
          case "/demo":
            await cmdDemo(client, rl, orchestrator);
            break;
          case "/runs":
            await cmdRuns(client, args, rl, orchestrator);
            break;
          case "/tasks":
            cmdTasks();
            break;
          case "/jobs":
            await cmdJobs(client, args, rl);
            break;
          case "/workers":
            await cmdWorkers(client);
            break;
          case "/monitor":
          case "/logs":
          case "/l":
            await cmdMonitor();
            break;
          case "/status":
          case "/s":
            await cmdStatus(client, orchestrator);
            break;
          case "/doctor":
            await cmdDoctor(client);
            break;
          case "/agent":
          case "/ask":
            await cmdAgent(client, rl, args);
            break;
          case "/model":
            await cmdModel(client);
            break;
          case "/config":
            cmdConfig();
            break;
          case "/help":
          case "/h":
          case "/?":
            cmdHelp(args);
            break;
          case "/clear":
            process.stdout.write(CLEAR);
            await renderHeader(client);
            break;
          case "/quit":
            running = false;
            orchestrator.destroy();
            rl.close();
            return;
        }
      }
    } catch (e) {
      error(`Unexpected error: ${e.message}`);
    } finally {
      if (running) {
        console.log("");
        rl.prompt();
      }
      inCommand = false;
    }
  });

  rl.on("close", () => {
    running = false;
    orchestrator.destroy();
    console.log(`\n${c.dim}Goodbye.${c.reset}\n`);
  });

  rl.on("SIGINT", () => {
    if (running && !inCommand) {
      console.log("");
      rl.prompt();
    }
  });

  await new Promise((resolve) => {
    rl.on("close", resolve);
  });
}
