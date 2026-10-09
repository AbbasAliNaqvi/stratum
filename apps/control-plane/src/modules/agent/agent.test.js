import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ModelProvider, getModelConfig } from "./model.js";
import { toolRegistry } from "./tools.js";
import { policyEngine, RiskLevels } from "./policy.js";
import * as service from "./service.js";
import { createAutomation, createAutomationRun, updateRunStatus } from "../automations/service.js";
import { db } from "../../db/client.js";
import { agentSessions, agentMessages, agentToolCalls, agentApprovals, automations, automationRuns, schedules } from "../../db/schema.js";

describe("STRATUM AI Agent Subsystem Test Suite", () => {
  beforeAll(async () => {
    // Enable AI for test execution
    process.env.STRATUM_AI_ENABLED = "true";
  });

  describe("1. Model Provider Abstraction", () => {
    it("reports correct model configuration", () => {
      const cfg = getModelConfig();
      expect(cfg).toBeDefined();
      expect(cfg.enabled).toBe(true);
    });

    it("generates mock model responses for system queries", async () => {
      const provider = new ModelProvider({ provider: "mock" });
      const res = await provider.generate({
        messages: [{ role: "user", content: "Show me the current STRATUM health" }],
        tools: toolRegistry.getSchemas(),
      });

      expect(res).toBeDefined();
      expect(res.toolCalls).toHaveLength(1);
      expect(res.toolCalls[0].name).toBe("read.get_system_health");
    });
  });

  describe("2. Tool Registry & Schemas", () => {
    it("lists all registered tools with risk levels", () => {
      const tools = toolRegistry.list();
      expect(tools.length).toBeGreaterThanOrEqual(15);
      
      const healthTool = toolRegistry.get("read.get_system_health");
      expect(healthTool).toBeDefined();
      expect(healthTool.riskLevel).toBe(RiskLevels.READ);

      const cancelTool = toolRegistry.get("run.cancel");
      expect(cancelTool).toBeDefined();
      expect(cancelTool.riskLevel).toBe(RiskLevels.SENSITIVE);
    });

    it("executes read.get_system_health cleanly", async () => {
      const res = await toolRegistry.execute("read.get_system_health", {});
      expect(res.success).toBe(true);
      expect(res.result.status).toBe("healthy");
    });

    it("handles execution of unknown tool gracefully", async () => {
      await expect(toolRegistry.execute("unknown.tool", {})).rejects.toThrow("Tool not found");
    });
  });

  describe("3. Policy & Approval Engine", () => {
    it("auto-approves READ operations", () => {
      const dec = policyEngine.evaluate("read.get_run", { id: "r1" }, RiskLevels.READ);
      expect(dec.allowed).toBe(true);
      expect(dec.requiresApproval).toBe(false);
    });

    it("requires approval for SENSITIVE operations like run.cancel", () => {
      const dec = policyEngine.evaluate("run.cancel", { id: "run_active123" }, RiskLevels.SENSITIVE);
      expect(dec.allowed).toBe(false);
      expect(dec.requiresApproval).toBe(true);
      expect(dec.reason).toContain("requires approval");
    });
  });

  describe("4. End-to-End Agent Runtime & Integration", () => {
    it("creates a session and processes health goal query", async () => {
      const session = await service.createSession("Test Health Goal");
      expect(session.id).toBeDefined();

      const updatedSess = await service.processUserMessage(session.id, "Show me the current STRATUM health");
      expect(updatedSess.status).toBe("completed");
      expect(updatedSess.messages.length).toBeGreaterThan(1);
      expect(updatedSess.toolCalls.length).toBeGreaterThan(0);
    });

    it("diagnoses failed runs by cross-referencing state and telemetry", async () => {
      // Create automation & failed run
      const auto = await createAutomation({
        name: "Test Failing Pipeline",
        description: "Fails on network check",
        definition: { steps: [{ id: "step_http", type: "http" }] },
      });

      const run = await createAutomationRun(auto.id, {});
      await updateRunStatus(run.id, "failed", null, { message: "Worker timeout during HTTP request" });

      const session = await service.createSession("Diagnose Failure Session");
      const updatedSess = await service.processUserMessage(session.id, "Why did the last run fail?");

      expect(updatedSess).toBeDefined();
      expect(updatedSess.messages.length).toBeGreaterThan(1);

      // Verify agent produced diagnosis response
      const assistantMsgs = updatedSess.messages.filter((m) => m.role === "assistant" && m.content);
      expect(assistantMsgs.length).toBeGreaterThan(0);
    });

    it("generates and persists new automation + schedule from natural language goal", async () => {
      const session = await service.createSession("Create Automation Goal");
      const updatedSess = await service.processUserMessage(
        session.id,
        "Create an automation that checks my API every minute"
      );

      expect(updatedSess).toBeDefined();
      const allAutos = await db.select().from(automations);
      const createdAuto = allAutos.find((a) => a.name.includes("API"));
      expect(createdAuto).toBeDefined();

      const allSchedules = await db.select().from(schedules);
      expect(allSchedules.length).toBeGreaterThan(0);
    });

    it("triggers approval request on sensitive action and executes after approval", async () => {
      const session = await service.createSession("Cancel Run Goal");
      const updatedSess = await service.processUserMessage(session.id, "Cancel the active run");

      expect(updatedSess.status).toBe("waiting_approval");
      expect(updatedSess.pendingApprovals.length).toBe(1);

      const approval = updatedSess.pendingApprovals[0];
      expect(approval.toolName).toBe("run.cancel");

      // Approve action
      const resumedSess = await service.approveAction(approval.id);
      expect(resumedSess.status).toBe("completed");
    });
  });
});
