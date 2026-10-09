import { eq, desc, and } from "drizzle-orm";
import { db } from "../../db/client.js";
import { agentSessions, agentMessages, agentToolCalls, agentApprovals } from "../../db/schema.js";

export async function createAgentSession(data) {
  const [session] = await db.insert(agentSessions).values(data).returning();
  return session;
}

export async function findAgentSessions() {
  return await db.select().from(agentSessions).orderBy(desc(agentSessions.createdAt));
}

export async function findAgentSessionById(id) {
  const [session] = await db.select().from(agentSessions).where(eq(agentSessions.id, id));
  return session || null;
}

export async function updateAgentSessionStatus(id, status) {
  const [session] = await db
    .update(agentSessions)
    .set({ status, updatedAt: new Date() })
    .where(eq(agentSessions.id, id))
    .returning();
  return session;
}

export async function insertAgentMessage(data) {
  const [message] = await db.insert(agentMessages).values(data).returning();
  return message;
}

export async function findSessionMessages(sessionId) {
  return await db
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.sessionId, sessionId))
    .orderBy(agentMessages.createdAt);
}

export async function insertAgentToolCall(data) {
  const [toolCall] = await db.insert(agentToolCalls).values(data).returning();
  return toolCall;
}

export async function updateAgentToolCall(id, data) {
  const [toolCall] = await db
    .update(agentToolCalls)
    .set(data)
    .where(eq(agentToolCalls.id, id))
    .returning();
  return toolCall;
}

export async function findSessionToolCalls(sessionId) {
  return await db
    .select()
    .from(agentToolCalls)
    .where(eq(agentToolCalls.sessionId, sessionId))
    .orderBy(agentToolCalls.createdAt);
}

export async function insertAgentApproval(data) {
  const [approval] = await db.insert(agentApprovals).values(data).returning();
  return approval;
}

export async function findAgentApprovalById(id) {
  const [approval] = await db.select().from(agentApprovals).where(eq(agentApprovals.id, id));
  return approval || null;
}

export async function findPendingAgentApprovals(sessionId) {
  const conditions = [eq(agentApprovals.status, "pending")];
  if (sessionId) conditions.push(eq(agentApprovals.sessionId, sessionId));
  return await db.select().from(agentApprovals).where(and(...conditions)).orderBy(desc(agentApprovals.createdAt));
}

export async function updateAgentApprovalStatus(id, status) {
  const [approval] = await db
    .update(agentApprovals)
    .set({ status, updatedAt: new Date() })
    .where(eq(agentApprovals.id, id))
    .returning();
  return approval;
}
