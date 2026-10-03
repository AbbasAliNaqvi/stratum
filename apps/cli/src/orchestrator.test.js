import { describe, it, expect } from "vitest";
import {
  TASK_TYPES,
  Run,
  Workflow,
  Schedule,
  Orchestrator,
  createDemoWorkflow,
} from "./orchestrator.js";

describe("orchestrator", () => {
  describe("TASK_TYPES", () => {
    it("defines http, command, echo, sleep, validate, transform, combine", () => {
      expect(TASK_TYPES.http).toBeDefined();
      expect(TASK_TYPES.command).toBeDefined();
      expect(TASK_TYPES.echo).toBeDefined();
      expect(TASK_TYPES.sleep).toBeDefined();
      expect(TASK_TYPES.validate).toBeDefined();
      expect(TASK_TYPES.transform).toBeDefined();
      expect(TASK_TYPES.combine).toBeDefined();
    });

    it("marks command as privileged", () => {
      expect(TASK_TYPES.command.privileged).toBe(true);
      expect(TASK_TYPES.command.envGate).toBe("STRATUM_ENABLE_COMMAND_JOBS");
    });

    it("http has required url field", () => {
      const url = TASK_TYPES.http.fields.find((f) => f.name === "url");
      expect(url).toBeDefined();
      expect(url.required).toBe(true);
    });

    it("sleep has validation on durationMs", () => {
      const dur = TASK_TYPES.sleep.fields.find(
        (f) => f.name === "durationMs",
      );
      expect(dur.validate).toBeDefined();
      expect(dur.validate("abc")).toBeTruthy();
      expect(dur.validate("5000")).toBeNull();
      expect(dur.validate("-1")).toBeTruthy();
      expect(dur.validate("500000")).toBeTruthy();
    });
  });

  describe("Run", () => {
    it("creates with default values", () => {
      const run = new Run({ name: "test", type: "task" });
      expect(run.id).toBeTruthy();
      expect(run.status).toBe("pending");
      expect(run.tasks).toEqual([]);
      expect(run.isComplete).toBe(false);
    });

    it("tracks task counts", () => {
      const run = new Run({
        name: "test",
        type: "workflow",
        tasks: [
          { taskId: "a", status: "succeeded" },
          { taskId: "b", status: "running" },
          { taskId: "c", status: "failed" },
          { taskId: "d", status: "queued" },
        ],
      });
      expect(run.totalTaskCount).toBe(4);
      expect(run.completedTaskCount).toBe(1);
      expect(run.failedTaskCount).toBe(1);
      expect(run.activeTaskCount).toBe(2);
    });

    it("serializes to JSON", () => {
      const run = new Run({ name: "test", type: "task" });
      const json = run.toJSON();
      expect(json.id).toBe(run.id);
      expect(json.name).toBe("test");
    });
  });

  describe("Workflow", () => {
    it("identifies root nodes", () => {
      const wf = new Workflow({
        name: "test",
        steps: [
          { id: "a", type: "echo", payload: {} },
          { id: "b", type: "echo", payload: {}, dependsOn: ["a"] },
        ],
      });
      const roots = wf.getRoots();
      expect(roots).toHaveLength(1);
      expect(roots[0].id).toBe("a");
    });

    it("identifies ready steps", () => {
      const wf = new Workflow({
        name: "test",
        steps: [
          { id: "a", type: "echo", payload: {} },
          { id: "b", type: "echo", payload: {}, dependsOn: ["a"] },
          { id: "c", type: "echo", payload: {}, dependsOn: ["a"] },
          {
            id: "d",
            type: "echo",
            payload: {},
            dependsOn: ["b", "c"],
          },
        ],
      });

      const completed = new Set(["a"]);
      const ready = wf.getReady(completed);
      expect(ready).toHaveLength(2);
      expect(ready.map((s) => s.id).sort()).toEqual(["b", "c"]);
    });

    it("validates missing dependencies", () => {
      const wf = new Workflow({
        name: "test",
        steps: [
          {
            id: "a",
            type: "echo",
            payload: {},
            dependsOn: ["nonexistent"],
          },
        ],
      });
      const errors = wf.validate();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("nonexistent");
    });

    it("detects cycles", () => {
      const wf = new Workflow({
        name: "test",
        steps: [
          { id: "a", type: "echo", payload: {}, dependsOn: ["b"] },
          { id: "b", type: "echo", payload: {}, dependsOn: ["a"] },
        ],
      });
      const errors = wf.validate();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("Cycle");
    });

    it("validates clean DAG", () => {
      const wf = new Workflow({
        name: "test",
        steps: [
          { id: "a", type: "echo", payload: {} },
          { id: "b", type: "echo", payload: {}, dependsOn: ["a"] },
        ],
      });
      const errors = wf.validate();
      expect(errors).toHaveLength(0);
    });
  });

  describe("Schedule", () => {
    it("creates with defaults", () => {
      const s = new Schedule({
        name: "health",
        taskType: "http",
        payload: { url: "https://example.com" },
        intervalMs: 60000,
      });
      expect(s.id).toBeTruthy();
      expect(s.enabled).toBe(true);
      expect(s.runCount).toBe(0);
    });
  });

  describe("createDemoWorkflow", () => {
    it("creates a valid workflow", () => {
      const wf = createDemoWorkflow();
      expect(wf.name).toBe("API Health Automation");
      expect(wf.steps.length).toBe(5);
      const errors = wf.validate();
      expect(errors).toHaveLength(0);
    });

    it("has parallel branches", () => {
      const wf = createDemoWorkflow();
      const completed = new Set([]);
      const ready = wf.getReady(completed);
      // api-1, api-2, api-3 should all be ready
      expect(ready.length).toBe(3);
    });

    it("validate depends on all api steps", () => {
      const wf = createDemoWorkflow();
      const validate = wf.steps.find((s) => s.id === "validate");
      expect(validate.dependsOn).toContain("api-1");
      expect(validate.dependsOn).toContain("api-2");
      expect(validate.dependsOn).toContain("api-3");
    });
  });

  describe("Orchestrator", () => {
    function mockClient(jobResults = {}) {
      const submitted = [];
      let jobCounter = 0;

      return {
        submitted,
        async submitJob(data) {
          const id = `job-${++jobCounter}`;
          submitted.push({ id, ...data });
          return { job: { id, status: "queued" } };
        },
        async getJob(id) {
          if (jobResults[id]) return jobResults[id];
          return { job: { id, status: "succeeded", result: { ok: true } } };
        },
        async listJobs() {
          return { jobs: [] };
        },
        async getNodes() {
          return { nodes: [] };
        },
        async getHealth() {
          return {};
        },
      };
    }

    it("submits a single task", async () => {
      const client = mockClient();
      const orch = new Orchestrator(client);

      const run = await orch.submitTask("echo", { message: "hello" });
      expect(run.status).toBe("running");
      expect(run.type).toBe("task");
      expect(run.tasks[0].jobId).toBe("job-1");
      expect(client.submitted).toHaveLength(1);
      expect(client.submitted[0].type).toBe("echo");
    });

    it("tracks runs", async () => {
      const client = mockClient();
      const orch = new Orchestrator(client);

      await orch.submitTask("echo", { message: "a" });
      await orch.submitTask("echo", { message: "b" });

      const runs = orch.listRuns();
      expect(runs).toHaveLength(2);
    });

    it("manages schedules", () => {
      const client = mockClient();
      const orch = new Orchestrator(client);

      const sched = orch.addSchedule(
        new Schedule({
          name: "test",
          taskType: "echo",
          payload: {},
          intervalMs: 999999,
        }),
      );

      expect(orch.listSchedules()).toHaveLength(1);
      orch.removeSchedule(sched.id);
      expect(orch.listSchedules()).toHaveLength(0);

      orch.destroy();
    });

    it("cleans up on destroy", () => {
      const client = mockClient();
      const orch = new Orchestrator(client);

      orch.addSchedule(
        new Schedule({
          name: "test",
          taskType: "echo",
          payload: {},
          intervalMs: 999999,
        }),
      );

      orch.destroy();
      // Should not throw
    });
  });
});
