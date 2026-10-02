import { eq } from "drizzle-orm";

import { db } from "../../db/client.js";
import { nodes } from "../../db/schema.js";
import { logger } from "@stratum/logger";

import {
  nodesRegisteredTotal,
  nodesHeartbeatTotal,
  nodesRecoveredTotal,
  nodesActiveGauge
} from "../metrics/index.js";

export async function registerNode(input) {
  const existing = await db
    .select()
    .from(nodes)
    .where(eq(nodes.nodeId, input.nodeId))
    .limit(1);

  if (existing.length > 0) {
    const error = new Error(
      "Node already registered"
    );

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

  nodesRegisteredTotal.inc();
  nodesActiveGauge.inc();
  
  logger.info({
    event: "node_registered",
    nodeId: node.nodeId
  }, `Node ${node.nodeId} registered`);

  return node;
}

export async function heartbeatNode(nodeId) {
  const [existing] = await db
    .select({ status: nodes.status })
    .from(nodes)
    .where(eq(nodes.nodeId, nodeId));
    
  if (!existing) {
    const error = new Error(
      `Node '${nodeId}' not found`
    );

    error.code = "NODE_NOT_FOUND";

    throw error;
  }

  const now = new Date();

  const [node] = await db
    .update(nodes)
    .set({
      status: "registered",
      lastHeartbeatAt: now,
      updatedAt: now
    })
    .where(eq(nodes.nodeId, nodeId))
    .returning();

  nodesHeartbeatTotal.inc();
  
  if (existing.status === "unreachable") {
    nodesRecoveredTotal.inc();
    nodesActiveGauge.inc();
    
    logger.info({
      event: "node_recovery_detected",
      nodeId: node.nodeId,
      status: node.status
    }, `Node ${node.nodeId} recovered from unreachable state`);
  } else {
    logger.debug({
      event: "heartbeat_received",
      nodeId: node.nodeId
    }, `Heartbeat received from node ${node.nodeId}`);
  }

  return node;
}