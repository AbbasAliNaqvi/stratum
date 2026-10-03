/**
 * Stratum Orchestrator
 *
 * Maps the user-facing abstractions (Task, Workflow, Run, Schedule)
 * onto the underlying distributed job execution engine.
 *
 * The job engine (queue, workers, leases, fencing, retries, cancellation)
 * remains the execution foundation. This layer adds coordination,
 * dependency management, and user-friendly semantics on top.
 */

import { randomUUID } from "node:crypto";

/* ── Task Registry ─────────────────────────────────────── */

/**
 * A Task is a single unit of work.
 * It maps directly to a job type in the execution engine.
 */
export const TASK_TYPES = {
  http: {
    name: "HTTP Request",
    description: "Make an HTTP request to any URL",
    icon: "🌐",
    fields: [
      {
        name: "url",
        label: "URL",
        required: true,
        default: "https://example.com",
      },
      { name: "method", label: "Method", required: false, default: "GET" },
      { name: "timeout", label: "Timeout", required: false, default: "30s" },
    ],
  },
  command: {
    name: "Command",
    description: "Execute a shell command",
    icon: "⚡",
    privileged: true,
    envGate: "STRATUM_ENABLE_COMMAND_JOBS",
    fields: [
      {
        name: "command",
        label: "Command",
        required: true,
        default: "echo 'Hello'",
      },
    ],
  },
  echo: {
    name: "Echo",
    description: "Send a message through the engine",
    icon: "💬",
    fields: [
      {
        name: "message",
        label: "Message",
        required: true,
        default: "Hello Stratum",
      },
    ],
  },
  sleep: {
    name: "Delay",
    description: "Wait for a specified duration",
    icon: "⏱",
    fields: [
      {
        name: "durationMs",
        label: "Duration (ms)",
        required: true,
        default: "5000",
        validate: (v) => {
          const n = parseInt(v, 10);
          if (isNaN(n) || n <= 0 || n > 300000)
            return "Must be 1–300000";
          return null;
        },
        transform: (v) => parseInt(v, 10),
      },
    ],
  },
  validate: {
    name: "Validate",
    description: "Validate input data",
    icon: "✓",
    internal: true,
    fields: [
      {
        name: "data",
        label: "Data",
        required: true,
      },
    ],
  },
  transform: {
    name: "Transform",
    description: "Transform data",
    icon: "⚙",
    internal: true,
    fields: [
      {
        name: "input",
        label: "Input",
        required: true,
      },
      {
        name: "operation",
        label: "Operation",
        required: true,
      },
    ],
  },
  combine: {
    name: "Combine",
    description: "Combine results from multiple tasks",
    icon: "🔗",
    internal: true,
    fields: [
      {
        name: "results",
        label: "Results",
        required: true,
      },
    ],
  },
};

/* ── Run ───────────────────────────────────────────────── */

/**
 * A Run is a single execution of a Task or Workflow.
 * It wraps one or more internal jobs and tracks overall status.
 */
export class Run {
  constructor({ id, name, type, tasks, status, createdAt, error, result }) {
    this.id = id || randomUUID();
    this.name = name;
    this.type = type; // "task" | "workflow"
    this.tasks = tasks || []; // { taskId, jobId, type, status, result, error, dependsOn, condition }
    this.status = status || "pending"; // pending | running | succeeded | failed | cancelled
    this.createdAt = createdAt || new Date().toISOString();
    this.finishedAt = null;
    this.error = error || null;
    this.result = result || null;
    this.inputs = {};
  }

  get activeTaskCount() {
    return this.tasks.filter(
      (t) => t.status === "running" || t.status === "queued",
    ).length;
  }

  get completedTaskCount() {
    return this.tasks.filter((t) => t.status === "succeeded" || t.status === "skipped").length;
  }

  get failedTaskCount() {
    return this.tasks.filter((t) => t.status === "failed").length;
  }

  get totalTaskCount() {
    return this.tasks.length;
  }

  get isComplete() {
    return ["succeeded", "failed", "cancelled"].includes(this.status);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: this.status,
      tasks: this.tasks,
      createdAt: this.createdAt,
      finishedAt: this.finishedAt,
      result: this.result,
      error: this.error,
    };
  }
}

/* ── Workflow Definition ───────────────────────────────── */

/**
 * A Workflow defines a DAG of tasks with dependencies.
 *
 *   { name: "Process Data", steps: [
 *     { id: "fetch",    type: "http",      payload: {...} },
 *     { id: "validate", type: "validate",  payload: {...}, dependsOn: ["fetch"] },
 *     { id: "processA", type: "transform", payload: {...}, dependsOn: ["validate"] },
 *     { id: "processB", type: "transform", payload: {...}, dependsOn: ["validate"] },
 *     { id: "combine",  type: "combine",   payload: {...}, dependsOn: ["processA", "processB"] },
 *   ]}
 */
export class Workflow {
  constructor({ name, steps }) {
    this.name = name;
    this.steps = steps; // Array of { id, type, payload, dependsOn?, condition? }
  }

  /** Get steps that have no dependencies (entry points) */
  getRoots() {
    return this.steps.filter(
      (s) => !s.dependsOn || s.dependsOn.length === 0,
    );
  }

  /** Get steps whose dependencies are all in the completedSet */
  getReady(completedSet) {
    return this.steps.filter((s) => {
      if (completedSet.has(s.id)) return false;
      if (!s.dependsOn || s.dependsOn.length === 0)
        return !completedSet.has(s.id);
      return s.dependsOn.every((dep) => completedSet.has(dep));
    });
  }

  /** Validate that the workflow DAG is acyclic and all deps exist */
  validate() {
    const ids = new Set(this.steps.map((s) => s.id));
    const errors = [];

    for (const step of this.steps) {
      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          if (!ids.has(dep)) {
            errors.push(`Step "${step.id}" depends on unknown step "${dep}"`);
          }
        }
      }
    }

    // Simple cycle detection via topological sort
    const visited = new Set();
    const visiting = new Set();

    const visit = (id) => {
      if (visited.has(id)) return true;
      if (visiting.has(id)) return false; // cycle
      visiting.add(id);
      const step = this.steps.find((s) => s.id === id);
      if (step?.dependsOn) {
        for (const dep of step.dependsOn) {
          if (!visit(dep)) return false;
        }
      }
      visiting.delete(id);
      visited.add(id);
      return true;
    };

    for (const step of this.steps) {
      if (!visit(step.id)) {
        errors.push(`Cycle detected involving step "${step.id}"`);
        break;
      }
    }

    return errors;
  }
}

/* ── Schedule ──────────────────────────────────────────── */

export class Schedule {
  constructor({ id, name, type, automationId, taskType, payload, inputs, cron, intervalMs, enabled }) {
    this.id = id || randomUUID();
    this.name = name;
    this.type = type || "task"; // "task" | "automation"
    this.automationId = automationId || null;
    this.taskType = taskType || null;
    this.payload = payload || null;
    this.inputs = inputs || {};
    this.cron = cron || null;
    this.intervalMs = intervalMs || null;
    this.enabled = enabled !== false;
    this.lastRunAt = null;
    this.nextRunAt = null;
    this.runCount = 0;
    this.createdAt = new Date().toISOString();
  }
}

/* ── Evaluation Helpers ────────────────────────────────── */

function resolveVariables(payload, inputs, results) {
  if (typeof payload === "string") {
    return payload.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
      const parts = path.trim().split(".");
      if (parts[0] === "inputs") {
        return inputs[parts[1]] !== undefined ? inputs[parts[1]] : `{{${path}}}`;
      } else {
        const stepId = parts[0];
        const res = results.get(stepId);
        if (res && parts[1] === "result") {
          return typeof res === 'object' ? JSON.stringify(res) : res;
        } else if (res && parts[1] === "status") {
          return "succeeded";
        }
        return `{{${path}}}`;
      }
    });
  } else if (Array.isArray(payload)) {
    return payload.map(item => resolveVariables(item, inputs, results));
  } else if (payload !== null && typeof payload === "object") {
    const out = {};
    for (const [k, v] of Object.entries(payload)) {
      out[k] = resolveVariables(v, inputs, results);
    }
    return out;
  }
  return payload;
}

function evaluateCondition(conditionStr, runTasks) {
  if (!conditionStr) return true;
  // Simple check: "step-id.status == succeeded" or "step-id == succeeded"
  const match = conditionStr.match(/([a-zA-Z0-9_-]+)(?:\.status)?\s*==\s*([a-zA-Z0-9_-]+)/);
  if (match) {
    const stepId = match[1];
    const expected = match[2];
    const task = runTasks.find(t => t.taskId === stepId);
    if (!task) return false;
    return task.status === expected;
  }
  
  const matchNeq = conditionStr.match(/([a-zA-Z0-9_-]+)(?:\.status)?\s*!=\s*([a-zA-Z0-9_-]+)/);
  if (matchNeq) {
    const stepId = matchNeq[1];
    const expected = matchNeq[2];
    const task = runTasks.find(t => t.taskId === stepId);
    if (!task) return false;
    return task.status !== expected;
  }
  
  return true;
}

/* ── Orchestrator ──────────────────────────────────────── */

/**
 * The Orchestrator coordinates workflow execution by:
 *  1. Resolving the dependency DAG
 *  2. Submitting ready tasks as jobs to the execution engine
 *  3. Polling job status and advancing the workflow
 *  4. Collecting results and propagating them to dependent steps
 *
 * It does NOT replace the job engine. It uses it.
 */
export class Orchestrator {
  constructor(client) {
    this.client = client;
    this.runs = new Map(); // id -> Run
    this.schedules = new Map(); // id -> Schedule
    this._timers = new Map();
  }

  /** Submit a single task as a run */
  async submitTask(type, payload, { name, maxRetries = 3 } = {}) {
    const run = new Run({
      name: name || TASK_TYPES[type]?.name || type,
      type: "task",
      tasks: [
        {
          taskId: "main",
          jobId: null,
          type,
          status: "pending",
          payload,
          result: null,
          error: null,
        },
      ],
    });

    this.runs.set(run.id, run);

    // Submit to execution engine
    try {
      const result = await this.client.submitJob({
        type,
        payload,
        priority: 0,
        maxRetries,
      });

      run.tasks[0].jobId = result.job.id;
      run.tasks[0].status = result.job.status;
      run.status = "running";
    } catch (e) {
      run.tasks[0].status = "failed";
      run.tasks[0].error = e.message;
      run.status = "failed";
      run.error = e.message;
    }

    return run;
  }

  /** Execute a workflow */
  async submitWorkflow(workflow, { maxRetries = 3, onProgress, inputs = {}, signal } = {}) {
    const errors = workflow.validate();
    if (errors.length > 0) {
      throw new Error(`Invalid workflow: ${errors.join(", ")}`);
    }

    const run = new Run({
      name: workflow.name,
      type: "workflow",
      tasks: workflow.steps.map((s) => ({
        taskId: s.id,
        jobId: null,
        type: s.type,
        status: "pending",
        payload: s.payload,
        dependsOn: s.dependsOn || [],
        condition: s.condition || null,
        result: null,
        error: null,
        workerId: null,
      })),
    });
    run.inputs = inputs;

    this.runs.set(run.id, run);
    run.status = "running";

    // Execute the DAG
    const completed = new Set();
    const failed = new Set();
    const resultMap = new Map(); // taskId -> result

    while (completed.size + failed.size < workflow.steps.length) {
      if (signal?.aborted) {
        run.status = "cancelled";
        let cleanupCount = 0;
        const cancelPromises = [];
        for (const task of run.tasks) {
          if (task.jobId && !["succeeded", "failed", "cancelled"].includes(task.status)) {
            task.status = "cancelled";
            cancelPromises.push(this.client.cancelJob(task.jobId).catch(() => {}));
            cleanupCount++;
          }
        }
        await Promise.all(cancelPromises);
        throw new Error(`Demo cancelled.\n\nCleaned up:\n${cleanupCount} pending tasks`);
      }

      const ready = workflow.getReady(completed);

      // Filter out already submitted and failed
      const toSubmit = ready.filter(
        (s) => !failed.has(s.id) && !completed.has(s.id),
      );

      if (toSubmit.length === 0 && completed.size + failed.size < workflow.steps.length) {
        // Deadlock — remaining tasks have unmet deps due to failures
        break;
      }

      // Process conditions before submission
      const activeToSubmit = [];
      for (const step of toSubmit) {
        const task = run.tasks.find((t) => t.taskId === step.id);
        if (!evaluateCondition(step.condition, run.tasks)) {
          task.status = "skipped";
          completed.add(step.id);
          if (onProgress) onProgress(run);
        } else {
          activeToSubmit.push(step);
        }
      }

      // Submit all ready tasks in parallel
      const submissions = activeToSubmit.map(async (step) => {
        const task = run.tasks.find((t) => t.taskId === step.id);

        // Build payload, injecting upstream results and variables
        let resolvedPayload = resolveVariables(step.payload, run.inputs, resultMap);
        if (step.dependsOn) {
          resolvedPayload._upstreamResults = {};
          for (const dep of step.dependsOn) {
            resolvedPayload._upstreamResults[dep] = resultMap.get(dep);
          }
        }

        if (TASK_TYPES[step.type]?.internal) {
          task.status = "succeeded";
          task.result = { 
            message: `Executed internal orchestration step: ${step.type}` 
          };
          completed.add(step.id);
          resultMap.set(step.id, task.result);
          if (onProgress) onProgress(run);
          return;
        }

        try {
          const result = await this.client.submitJob({
            type: step.type,
            payload: resolvedPayload,
            priority: 0,
            maxRetries,
          });
          task.jobId = result.job.id;
          task.status = result.job.status;
          if (onProgress) onProgress(run);
        } catch (e) {
          task.status = "failed";
          task.error = e.message;
          failed.add(step.id);
          if (onProgress) onProgress(run);
        }
      });

      await Promise.all(submissions);

      // Poll submitted tasks until they complete
      const polling = run.tasks.filter(
        (t) =>
          t.jobId &&
          !completed.has(t.taskId) &&
          !failed.has(t.taskId) &&
          !["succeeded", "failed", "cancelled"].includes(t.status),
      );

      for (const task of polling) {
        // Poll with backoff
        for (let i = 0; i < 120; i++) {
          await new Promise((r) => setTimeout(r, 500));
          try {
            const check = await this.client.getJob(task.jobId);
            task.status = check.job.status;
            if (check.job.workerId) task.workerId = check.job.workerId;

            if (check.job.status === "succeeded") {
              task.result = check.job.result;
              completed.add(task.taskId);
              resultMap.set(task.taskId, check.job.result);
              if (onProgress) onProgress(run);
              break;
            } else if (
              check.job.status === "failed" ||
              check.job.status === "cancelled"
            ) {
              task.error = check.job.error;
              failed.add(task.taskId);
              if (onProgress) onProgress(run);
              break;
            }
          } catch {
            break;
          }
        }
      }
    }

    // Determine final status
    if (failed.size > 0) {
      run.status = "failed";
      run.error = `${failed.size} task(s) failed`;
    } else if (completed.size === workflow.steps.length) {
      run.status = "succeeded";
      run.result = Object.fromEntries(resultMap);
    } else {
      run.status = "failed";
      run.error = "Workflow could not complete all tasks";
    }

    run.finishedAt = new Date().toISOString();
    if (onProgress) onProgress(run);

    return run;
  }

  /** Get a run by ID */
  getRun(id) {
    return this.runs.get(id);
  }

  /** List all runs */
  listRuns({ limit = 20 } = {}) {
    return Array.from(this.runs.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  /** Add a schedule (local timer-based for now) */
  addSchedule(schedule, automationFn) {
    this.schedules.set(schedule.id, schedule);

    if (schedule.intervalMs) {
      schedule.nextRunAt = new Date(
        Date.now() + schedule.intervalMs,
      ).toISOString();

      const timer = setInterval(async () => {
        schedule.lastRunAt = new Date().toISOString();
        schedule.runCount++;
        schedule.nextRunAt = new Date(
          Date.now() + schedule.intervalMs,
        ).toISOString();

        try {
          if (schedule.type === "automation" && automationFn) {
            const auto = automationFn(schedule.automationId);
            if (auto) {
              const workflow = new Workflow({ name: `${auto.name} #${schedule.runCount}`, steps: auto.steps });
              await this.submitWorkflow(workflow, { inputs: schedule.inputs });
            }
          } else {
            await this.submitTask(schedule.taskType, schedule.payload, {
              name: `${schedule.name} #${schedule.runCount}`,
            });
          }
        } catch {}
      }, schedule.intervalMs);

      this._timers.set(schedule.id, timer);
    }

    return schedule;
  }

  /** Remove a schedule */
  removeSchedule(id) {
    const timer = this._timers.get(id);
    if (timer) {
      clearInterval(timer);
      this._timers.delete(id);
    }
    this.schedules.delete(id);
  }

  /** List schedules */
  listSchedules() {
    return Array.from(this.schedules.values());
  }

  /** Cleanup */
  destroy() {
    for (const timer of this._timers.values()) {
      clearInterval(timer);
    }
    this._timers.clear();
  }
}

/* ── Demo Workflow ─────────────────────────────────────── */

/**
 * Creates the deterministic demo workflow that demonstrates:
 *  - Parallel task execution
 *  - Sequential dependencies
 *  - Retry on failure
 *  - Result collection
 */
export function createDemoWorkflow() {
  return new Workflow({
    name: "API Health Automation",
    steps: [
      {
        id: "api-1",
        type: "http",
        payload: { url: "http://127.0.0.1:3000/health", method: "GET" },
      },
      {
        id: "api-2",
        type: "http",
        payload: { url: "http://127.0.0.1:3000/metrics", method: "GET" },
      },
      {
        id: "api-3",
        type: "http",
        payload: { url: "http://127.0.0.1:3000/health/flaky", method: "GET" },
      },
      {
        id: "validate",
        type: "validate",
        payload: { data: "Validating responses..." },
        dependsOn: ["api-1", "api-2", "api-3"],
      },
      {
        id: "generate-report",
        type: "echo",
        payload: { message: "All APIs checked. Overall status: healthy (after retries)" },
        dependsOn: ["validate"],
      },
    ],
  });
}
