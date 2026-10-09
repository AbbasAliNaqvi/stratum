import { toolRegistry } from "./tools.js";

export async function assembleContext(query = "") {
  try {
    const healthResult = await toolRegistry.execute("read.get_system_health", {});
    const healthData = healthResult.result || {};

    const automationsResult = await toolRegistry.execute("read.list_automations", {});
    const automations = automationsResult.result || [];

    const runsResult = await toolRegistry.execute("read.list_runs", {});
    const runs = runsResult.result || [];

    const failedRuns = runs.filter((r) => r.status === "failed");
    const activeRuns = runs.filter((r) => r.status === "running" || r.status === "queued");

    const contextSummary = {
      system: {
        status: healthData.status || "healthy",
        activeWorkersCount: healthData.workers?.count || 0,
        queuedJobsCount: healthData.jobs?.queued || 0,
        runningJobsCount: healthData.jobs?.running || 0,
      },
      automations: automations.map((a) => ({ id: a.id, name: a.name, enabled: a.enabled, stepsCount: a.definition?.steps?.length || 0 })),
      runs: {
        total: runs.length,
        active: activeRuns.map((r) => ({ id: r.id, automationId: r.automationId, status: r.status })),
        recentFailed: failedRuns.slice(0, 3).map((r) => ({ id: r.id, automationId: r.automationId, startedAt: r.startedAt })),
      },
    };

    return contextSummary;
  } catch (err) {
    return { system: { status: "unknown", error: err.message } };
  }
}

export function buildSystemPrompt(context) {
  return `You are the STRATUM AI Agent — an autonomous operational and diagnostics runtime intelligence layer for the STRATUM Automation Platform.

CRITICAL INSTRUCTIONS:
1. OPERATE THROUGH GOVERNED TOOLS ONLY. Do not invent fake outputs. Always inspect real runtime state using available tools.
2. AGENT PLANNING & VISIBILITY: Whenever a goal is received, generate a clear, step-by-step operational PLAN.
3. CAUSE & EVIDENCE DIAGNOSIS: When investigating failures or health, cross-reference automations, runs, workflow steps, jobs, worker heartbeats, and telemetry before rendering a diagnosis.
4. CONTROLLED INTELLIGENCE: Respect tool risk levels (READ, SAFE, SENSITIVE, DESTRUCTIVE). Understand that sensitive actions (like cancelling active production runs) require explicit user approval.

CURRENT SYSTEM RUNTIME CONTEXT:
${JSON.stringify(context, null, 2)}
`;
}
