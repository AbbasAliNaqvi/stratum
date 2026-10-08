import crypto from "node:crypto";
import * as repo from "./repository.js";

// Basic validation for automation definitions
function validateDefinition(definition) {
  if (!definition || !Array.isArray(definition.steps)) {
    throw new Error("Invalid definition: must contain a 'steps' array.");
  }
  
  const stepIds = new Set();
  
  for (const step of definition.steps) {
    if (!step.id) throw new Error("Step is missing 'id'.");
    if (!step.type) throw new Error(`Step ${step.id} is missing 'type'.`);
    if (stepIds.has(step.id)) throw new Error(`Duplicate step ID: ${step.id}`);
    stepIds.add(step.id);
  }
  
  for (const step of definition.steps) {
    if (step.dependsOn) {
      if (!Array.isArray(step.dependsOn)) {
        throw new Error(`Step ${step.id} dependsOn must be an array.`);
      }
      for (const dep of step.dependsOn) {
        if (!stepIds.has(dep)) {
          throw new Error(`Step ${step.id} depends on unknown step: ${dep}`);
        }
      }
    }
  }
}

export async function createAutomation(data) {
  validateDefinition(data.definition);
  
  const id = `auto_${crypto.randomBytes(4).toString('hex')}`;
  
  return await repo.insertAutomation({
    id,
    name: data.name,
    description: data.description,
    definition: data.definition,
    enabled: data.enabled !== undefined ? data.enabled : 1,
  });
}

export async function getAutomations() {
  return await repo.findAutomations();
}

export async function getAutomation(id) {
  return await repo.findAutomationById(id);
}

export async function removeAutomation(id) {
  return await repo.deleteAutomationById(id);
}

export async function updateAutomation(id, data) {
  if (data.definition) {
    validateDefinition(data.definition);
  }
  return await repo.updateAutomationById(id, data);
}

export async function createAutomationRun(automationId, input) {
  const automation = await getAutomation(automationId);
  if (!automation) {
    throw new Error("Automation not found");
  }

  const runId = `run_${crypto.randomBytes(4).toString('hex')}`;
  
  return await repo.insertAutomationRun({
    id: runId,
    automationId,
    input: input || {},
    status: "queued"
  });
}

export async function updateRunStatus(runId, status, result = null, error = null) {
  const data = { status, updatedAt: new Date() };
  if (status === 'running' && !result && !error) {
    data.startedAt = new Date();
  }
  if (status === 'succeeded' || status === 'failed' || status === 'cancelled') {
    data.completedAt = new Date();
  }
  if (result) data.result = result;
  if (error) data.error = error;

  return await repo.updateAutomationRun(runId, data);
}

export async function getRuns(automationId) {
  return await repo.findAutomationRuns(automationId);
}

export async function getRun(id) {
  const run = await repo.findAutomationRunById(id);
  if (!run) return null;
  const steps = await repo.findAutomationRunSteps(id);
  return { ...run, steps };
}

export async function linkRunStepToJob(runId, stepId, jobId) {
  const id = `step_${crypto.randomBytes(4).toString('hex')}`;
  return await repo.insertAutomationRunStep({
    id,
    runId,
    stepId,
    jobId,
  });
}
