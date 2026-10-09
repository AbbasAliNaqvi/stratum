import * as automationService from "../automations/service.js";
import * as scheduleService from "../schedules/service.js";
import * as jobService from "../jobs/service.js";
import { db } from "../../db/client.js";
import { nodes, jobs } from "../../db/schema.js";
import { registry as metricsRegistry } from "@stratum/metrics";

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this._registerDefaultTools();
  }

  register(tool) {
    if (!tool.name || !tool.execute || !tool.riskLevel) {
      throw new Error(`Invalid tool registration: missing name, execute, or riskLevel`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name) {
    return this.tools.get(name);
  }

  list() {
    return Array.from(this.tools.values());
  }

  getSchemas() {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      riskLevel: t.riskLevel,
      category: t.category,
    }));
  }

  async execute(name, args, context = {}) {
    const tool = this.get(name);
    if (!tool) {
      throw new Error(`Tool not found in registry: ${name}`);
    }

    const startTime = Date.now();
    try {
      const result = await tool.execute(args, context);
      const durationMs = Date.now() - startTime;
      return { success: true, result, durationMs, riskLevel: tool.riskLevel };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      return { success: false, error: err.message, durationMs, riskLevel: tool.riskLevel };
    }
  }

  _registerDefaultTools() {
    // 1. read.get_system_health
    this.register({
      name: "read.get_system_health",
      description: "Inspect active workers, queued jobs, running runs, and overall STRATUM status.",
      category: "read",
      riskLevel: "READ",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const workerList = await db.select().from(nodes);
        const queuedJobsList = await jobService.getJobs({ status: "queued" });
        const runningJobsList = await jobService.getJobs({ status: "running" });
        const automations = await automationService.getAutomations();
        const runs = await automationService.getRuns();

        return {
          status: "healthy",
          workers: { count: workerList.length, items: workerList },
          jobs: { queued: queuedJobsList.length, running: runningJobsList.length },
          automations: { count: automations.length },
          runs: { total: runs.length },
        };
      },
    });

    // 2. read.list_automations
    this.register({
      name: "read.list_automations",
      description: "List all persisted automations and DAG specifications.",
      category: "read",
      riskLevel: "READ",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        return await automationService.getAutomations();
      },
    });

    // 3. read.get_automation
    this.register({
      name: "read.get_automation",
      description: "Get detailed workflow spec for a specific automation by ID.",
      category: "read",
      riskLevel: "READ",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Automation ID" } },
        required: ["id"],
      },
      execute: async ({ id }) => {
        return await automationService.getAutomation(id);
      },
    });

    // 4. read.list_runs
    this.register({
      name: "read.list_runs",
      description: "List historical and active automation execution runs.",
      category: "read",
      riskLevel: "READ",
      inputSchema: {
        type: "object",
        properties: { automationId: { type: "string", description: "Optional filter by automation ID" } },
      },
      execute: async ({ automationId }) => {
        return await automationService.getRuns(automationId);
      },
    });

    // 5. read.get_run
    this.register({
      name: "read.get_run",
      description: "Get detailed execution status, step graph, and result for a run.",
      category: "read",
      riskLevel: "READ",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Run ID" } },
        required: ["id"],
      },
      execute: async ({ id }) => {
        return await automationService.getRun(id);
      },
    });

    // 6. read.list_workers
    this.register({
      name: "read.list_workers",
      description: "List registered worker nodes and their heartbeat timestamps.",
      category: "read",
      riskLevel: "READ",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        return await db.select().from(nodes);
      },
    });

    // 7. read.list_jobs
    this.register({
      name: "read.list_jobs",
      description: "List low-level execution jobs filtered by status or type.",
      category: "read",
      riskLevel: "READ",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", description: "Job status (queued, running, succeeded, failed, cancelled)" },
          type: { type: "string", description: "Task type" },
        },
      },
      execute: async (filters) => {
        return await jobService.getJobs(filters);
      },
    });

    // 8. read.get_job_events
    this.register({
      name: "read.get_job_events",
      description: "Fetch structured event logs for a specific job or system-wide.",
      category: "read",
      riskLevel: "READ",
      inputSchema: {
        type: "object",
        properties: {
          jobId: { type: "string", description: "Optional job ID" },
          limit: { type: "number", description: "Max logs to fetch" },
        },
      },
      execute: async ({ jobId, limit = 50 }) => {
        if (jobId) return await jobService.getEventsForJob(jobId);
        return await jobService.getAllEvents(limit);
      },
    });

    // 9. read.get_metrics
    this.register({
      name: "read.get_metrics",
      description: "Fetch Prometheus metrics exposition output.",
      category: "read",
      riskLevel: "READ",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        return await metricsRegistry.metrics();
      },
    });

    // 10. read.list_schedules
    this.register({
      name: "read.list_schedules",
      description: "List active and recurring schedules.",
      category: "read",
      riskLevel: "READ",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        return await scheduleService.getSchedules();
      },
    });

    // 11. automation.create
    this.register({
      name: "automation.create",
      description: "Create a new validated automation workflow DAG.",
      category: "automation",
      riskLevel: "SAFE",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          definition: {
            type: "object",
            properties: {
              steps: { type: "array", description: "Array of DAG step objects ({id, type, payload, dependsOn})" },
            },
            required: ["steps"],
          },
        },
        required: ["name", "definition"],
      },
      execute: async (data) => {
        return await automationService.createAutomation(data);
      },
    });

    // 12. automation.update
    this.register({
      name: "automation.update",
      description: "Update an existing automation definition or enabled status.",
      category: "automation",
      riskLevel: "SENSITIVE",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          enabled: { type: "number" },
        },
        required: ["id"],
      },
      execute: async ({ id, ...data }) => {
        return await automationService.updateAutomation(id, data);
      },
    });

    // 13. automation.run
    this.register({
      name: "automation.run",
      description: "Trigger a new execution run for an automation.",
      category: "automation",
      riskLevel: "SAFE",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Automation ID to run" },
          input: { type: "object", description: "Optional input payload" },
        },
        required: ["id"],
      },
      execute: async ({ id, input }) => {
        return await automationService.createAutomationRun(id, input);
      },
    });

    // 14. run.cancel
    this.register({
      name: "run.cancel",
      description: "Cancel an active or queued automation run.",
      category: "run",
      riskLevel: "SENSITIVE", // Requires approval!
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Run ID to cancel" },
        },
        required: ["id"],
      },
      execute: async ({ id }) => {
        return await automationService.updateRunStatus(id, "cancelled");
      },
    });

    // 15. schedule.create
    this.register({
      name: "schedule.create",
      description: "Create a recurring interval trigger schedule for an automation.",
      category: "schedule",
      riskLevel: "SENSITIVE",
      inputSchema: {
        type: "object",
        properties: {
          automationId: { type: "string" },
          intervalMs: { type: "number" },
          type: { type: "string" },
        },
        required: ["automationId", "intervalMs"],
      },
      execute: async (data) => {
        return await scheduleService.createSchedule(data);
      },
    });

    // 16. schedule.enable
    this.register({
      name: "schedule.enable",
      description: "Enable a schedule.",
      category: "schedule",
      riskLevel: "SENSITIVE",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      execute: async ({ id }) => {
        return await scheduleService.updateSchedule(id, { enabled: 1 });
      },
    });

    // 17. schedule.disable
    this.register({
      name: "schedule.disable",
      description: "Disable a schedule.",
      category: "schedule",
      riskLevel: "SENSITIVE",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      execute: async ({ id }) => {
        return await scheduleService.updateSchedule(id, { enabled: 0 });
      },
    });

    // 18. diagnostics.inspect_run
    this.register({
      name: "diagnostics.inspect_run",
      description: "Perform root cause analysis on a failed run by cross-referencing steps, jobs, events, and workers.",
      category: "diagnostics",
      riskLevel: "READ",
      inputSchema: {
        type: "object",
        properties: { runId: { type: "string" } },
        required: ["runId"],
      },
      execute: async ({ runId }) => {
        const run = await automationService.getRun(runId);
        if (!run) return { error: `Run ${runId} not found` };

        const events = await jobService.getAllEvents(30);
        const workersList = await db.select().from(nodes);

        return {
          runId,
          status: run.status,
          automationId: run.automationId,
          steps: run.steps,
          error: run.error,
          recentEvents: events.filter((e) => run.steps?.some((s) => s.jobId === e.jobId)),
          activeWorkersCount: workersList.length,
        };
      },
    });
  }
}

export const toolRegistry = new ToolRegistry();
