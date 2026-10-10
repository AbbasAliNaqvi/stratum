import { db } from "../../db/client.js";
import { automations, automationRuns, automationRunSteps, jobs } from "../../db/schema.js";
import { eq, inArray, and, isNull } from "drizzle-orm";
import { createJob } from "../jobs/service.js";
import { updateRunStatus, linkRunStepToJob } from "./service.js";

// Evaluates whether a condition is met
function evaluateCondition(conditionStr, completedStepsMap) {
  if (!conditionStr) return true;
  
  const match = conditionStr.match(/([a-zA-Z0-9_-]+)(?:\.status)?\s*==\s*([a-zA-Z0-9_-]+)/);
  if (match) {
    const stepId = match[1];
    const expected = match[2];
    const task = completedStepsMap.get(stepId);
    if (!task) return false;
    return task.status === expected;
  }
  
  const matchNeq = conditionStr.match(/([a-zA-Z0-9_-]+)(?:\.status)?\s*!=\s*([a-zA-Z0-9_-]+)/);
  if (matchNeq) {
    const stepId = matchNeq[1];
    const expected = matchNeq[2];
    const task = completedStepsMap.get(stepId);
    if (!task) return false;
    return task.status !== expected;
  }
  
  return true;
}

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

export async function processActiveRuns() {
  try {
    // 1. Fetch runs that are queued or running
    const activeRuns = await db.select()
      .from(automationRuns)
      .where(inArray(automationRuns.status, ["queued", "running"]));
      
    if (activeRuns.length === 0) return;
    
    // 2. Fetch the automation definitions
    const automationIds = [...new Set(activeRuns.map(r => r.automationId))];
    const autos = await db.select().from(automations).where(inArray(automations.id, automationIds));
    const autoMap = new Map(autos.map(a => [a.id, a]));

    for (const run of activeRuns) {
      const auto = autoMap.get(run.automationId);
      if (!auto) {
        await updateRunStatus(run.id, "failed", null, "Automation definition not found");
        continue;
      }

      // If queued, transition to running
      if (run.status === "queued") {
        await updateRunStatus(run.id, "running");
        run.status = "running";
      }

      // 3. Fetch linked steps & corresponding jobs
      const runSteps = await db.select().from(automationRunSteps).where(eq(automationRunSteps.runId, run.id));
      const jobIds = runSteps.map(s => s.jobId).filter(Boolean);
      
      let linkedJobs = [];
      if (jobIds.length > 0) {
        linkedJobs = await db.select().from(jobs).where(inArray(jobs.id, jobIds));
      }
      const jobMap = new Map(linkedJobs.map(j => [j.id, j]));

      const completedStepsMap = new Map();
      const resultMap = new Map();
      const failedSteps = [];
      const activeSteps = [];

      for (const step of runSteps) {
        const job = jobMap.get(step.jobId);
        if (job) {
          if (["succeeded", "failed", "cancelled"].includes(job.status)) {
            completedStepsMap.set(step.stepId, job);
            resultMap.set(step.stepId, job.result);
            if (job.status === "failed") failedSteps.push({ stepId: step.stepId, error: job.error });
            if (job.status === "cancelled") failedSteps.push({ stepId: step.stepId, error: "Job cancelled" });
          } else {
            activeSteps.push(step);
          }
        } else {
          // Internal step (e.g. echo) that succeeded immediately
          // Need to fetch from step result? We didn't persist results on steps.
          // Wait, for simplicity, internal steps will just be full jobs in this implementation.
        }
      }

      if (failedSteps.length > 0) {
        await updateRunStatus(run.id, "failed", null, `Step failed: ${failedSteps[0].stepId}. Error: ${failedSteps[0].error}`);
        continue;
      }

      const workflowSteps = auto.definition.steps || [];
      const totalSteps = workflowSteps.length;
      
      if (completedStepsMap.size === totalSteps) {
        await updateRunStatus(run.id, "succeeded", Object.fromEntries(resultMap));
        continue;
      }

      // If there are active steps, we just wait
      if (activeSteps.length > 0) {
        continue;
      }

      // Otherwise, find ready steps
      for (const step of workflowSteps) {
        if (completedStepsMap.has(step.id)) continue;
        
        const isReady = !step.dependsOn || step.dependsOn.length === 0 || step.dependsOn.every(dep => completedStepsMap.has(dep));
        
        if (isReady) {
          const runStepLinks = runSteps.filter(s => s.stepId === step.id);
          if (runStepLinks.length > 0) continue; // Already dispatched

          if (!evaluateCondition(step.condition, completedStepsMap)) {
            // Skipped step
            // We can create a dummy successful job, or just ignore for now (skip implementation)
            const job = await createJob({
              type: "echo",
              payload: { message: "Skipped" }
            });
            await linkRunStepToJob(run.id, step.id, job.id);
            // Immediately complete it? For now let the worker complete it.
            continue;
          }

          let resolvedPayload = resolveVariables(step.payload, run.input || {}, resultMap);
          if (step.dependsOn) {
            if (!resolvedPayload || typeof resolvedPayload !== "object") {
              resolvedPayload = {};
            }
            resolvedPayload._upstreamResults = {};
            for (const dep of step.dependsOn) {
              resolvedPayload._upstreamResults[dep] = resultMap.get(dep);
            }
          }

          const job = await createJob({
            type: step.type,
            payload: resolvedPayload
          });

          await linkRunStepToJob(run.id, step.id, job.id);
        }
      }
    }
  } catch (error) {
    console.error("Orchestrator loop error:", error);
  }
}

let timer = null;

export function startOrchestrator() {
  if (timer) return;
  timer = setInterval(() => {
    processActiveRuns().catch(console.error);
  }, 2000);
}

export function stopOrchestrator() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
