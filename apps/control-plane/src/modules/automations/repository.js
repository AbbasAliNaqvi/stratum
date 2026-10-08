import { eq, desc } from "drizzle-orm";
import { db } from "../../db/client.js";
import { automations, automationRuns, automationRunSteps } from "../../db/schema.js";

export async function insertAutomation(data) {
  const [record] = await db.insert(automations).values(data).returning();
  return record;
}

export async function findAutomations() {
  return await db.select().from(automations).orderBy(desc(automations.createdAt));
}

export async function findAutomationById(id) {
  const [record] = await db.select().from(automations).where(eq(automations.id, id));
  return record;
}

export async function deleteAutomationById(id) {
  await db.delete(automations).where(eq(automations.id, id));
}

export async function updateAutomationById(id, data) {
  const [record] = await db
    .update(automations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(automations.id, id))
    .returning();
  return record;
}

export async function insertAutomationRun(data) {
  const [record] = await db.insert(automationRuns).values(data).returning();
  return record;
}

export async function updateAutomationRun(id, data) {
  const [record] = await db.update(automationRuns)
    .set(data)
    .where(eq(automationRuns.id, id))
    .returning();
  return record;
}

export async function findAutomationRuns(automationId) {
  const query = db.select().from(automationRuns);
  if (automationId) {
    query.where(eq(automationRuns.automationId, automationId));
  }
  query.orderBy(desc(automationRuns.createdAt));
  return await query;
}

export async function findAutomationRunById(id) {
  const [record] = await db.select().from(automationRuns).where(eq(automationRuns.id, id));
  return record;
}

export async function insertAutomationRunStep(data) {
  const [record] = await db.insert(automationRunSteps).values(data).returning();
  return record;
}

export async function findAutomationRunSteps(runId) {
  return await db.select().from(automationRunSteps).where(eq(automationRunSteps.runId, runId));
}
