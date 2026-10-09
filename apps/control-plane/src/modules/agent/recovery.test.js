import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../../db/client.js";
import { automations, automationRuns } from "../../db/schema.js";
import * as service from "./service.js";
import { createAutomation, createAutomationRun, updateRunStatus } from "../automations/service.js";
import { eq } from "drizzle-orm";

describe("STRATUM AI Agent Recovery Integration", () => {
  beforeAll(async () => {
    process.env.STRATUM_AI_ENABLED = "true";
  });

  it("executes end-to-end controlled recovery for a failed automation", async () => {
    // 1. Create Known failed automation
    const auto = await createAutomation({
      name: "API Monitor Workflow",
      description: "Checks API availability (broken)",
      definition: { steps: [{ id: "check_api", type: "http", payload: { url: "https://api.github.com/api/heath", method: "GET" } }] },
    });

    const run = await createAutomationRun(auto.id, {});
    await updateRunStatus(run.id, "failed", null, { message: "HTTP 404 Not Found" });

    // 2. Agent retrieves actual evidence & proposes correction
    const session = await service.createSession("Investigate and Fix Goal");
    const updatedSess = await service.processUserMessage(session.id, "Investigate the failed API Health Monitor and propose a safe fix.");
    
    // 3. Policy requires approval
    console.log(JSON.stringify(updatedSess.messages, null, 2));
    console.log(JSON.stringify(updatedSess.toolCalls, null, 2));
    expect(updatedSess.status).toBe("waiting_approval");
    expect(updatedSess.pendingApprovals.length).toBe(1);

    const approval = updatedSess.pendingApprovals[0];
    expect(approval.toolName).toBe("automation.update");

    // 4. Test explicitly approves the exact action
    const resumedSess = await service.approveAction(approval.id);
    expect(resumedSess.status).toBe("completed");

    // 5. Control Plane updates automation
    const updatedAutos = await db.select().from(automations).where(eq(automations.id, auto.id));
    const updatedAuto = updatedAutos[0];
    
    const steps = updatedAuto.definition.steps;
    expect(steps[0].payload.url).toBe("https://api.github.com/api/health");

    // 6. Existing execution engine executes new run
    const tcRun = resumedSess.toolCalls.find(t => t.toolName === "automation.run");
    expect(tcRun).toBeDefined();

    // 7. Persisted run result is checked
    const runsList = await db.select().from(automationRuns);
    const newRun = runsList.find(r => r.automationId === auto.id && r.id !== run.id);
    expect(newRun).toBeDefined();
    expect(newRun.status).toBe("queued");
  });
});
