import { lt, eq, and } from "drizzle-orm";

import { config } from "../../config.js";
import { db } from "../../db/client.js";
import { nodes } from "../../db/schema.js";

export function startNodeLivenessMonitor(logger) {
  const interval = setInterval(async () => {
    try {
      const cutoff = new Date(
        Date.now() - config.HEARTBEAT_TIMEOUT_MS
      );

      const staleNodes = await db
        .update(nodes)
        .set({
          status: "unreachable"
        })
        .where(
          and(
            eq(nodes.status, "registered"),
            lt(nodes.updatedAt, cutoff)
          )
        )
        .returning({
          nodeId: nodes.nodeId
        });

      for (const node of staleNodes) {
        logger.warn(
          `Node ${node.nodeId} marked unreachable`
        );
      }
    } catch (error) {
      logger.error(
        { err: error },
        "Node liveness check failed"
      );
    }
  }, config.HEARTBEAT_CHECK_INTERVAL_MS);

  interval.unref();

  return () => {
    clearInterval(interval);
  };
}
