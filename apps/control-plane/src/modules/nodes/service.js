import { eq } from "drizzle-orm";

import { db } from "../../db/client.js";
import { nodes } from "../../db/schema.js";

export async function registerNode(input) {
  const existing = await db
    .select()
    .from(nodes)
    .where(eq(nodes.nodeId, input.nodeId))
    .limit(1);

  if (existing.length > 0) {
    const error = new Error("Node already registered");
    error.code = "NODE_ALREADY_EXISTS";
    throw error;
  }

  const [node] = await db
    .insert(nodes)
    .values({
      nodeId: input.nodeId,
      hostname: input.hostname,
      cpuCores: input.cpuCores,
      memoryMb: input.memoryMb,
      platform: input.platform ?? null,
      status: "registered"
    })
    .returning();

  return node;
}

export async function heartbeatNode(nodeId) {
  const now = new Date();

  const [node] = await db
    .update(nodes)
    .set({
      status: "registered",
      updatedAt: now
    })
    .where(eq(nodes.nodeId, nodeId))
    .returning();

  if (!node) {
    const error = new Error(`Node '${nodeId}' not found`);
    error.code = "NODE_NOT_FOUND";
    throw error;
  }

  return node;
}
