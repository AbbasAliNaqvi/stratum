import { lt, eq, and } from "drizzle-orm";

import { config } from "../../config.js";
import { db } from "../../db/client.js";
import { nodes } from "../../db/schema.js";
import { reclaimJobsForNode } from "../jobs/repository.js";

import {
  nodesStaleTotal,
  nodesActiveGauge,
  jobsReclaimedTotal,
  jobsQueuedGauge,
  jobsFailedTotal,
} from "../metrics/index.js";

export function startNodeLivenessMonitor(
  logger,
  { checkIntervalMs = config.HEARTBEAT_CHECK_INTERVAL_MS } = {},
) {
  const interval = setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - config.HEARTBEAT_TIMEOUT_MS);

      const staleNodes = await db
        .update(nodes)
        .set({
          status: "unreachable",
        })
        .where(
          and(
            eq(nodes.status, "registered"),
            lt(nodes.lastHeartbeatAt, cutoff),
          ),
        )
        .returning({
          nodeId: nodes.nodeId,
        });

      for (const node of staleNodes) {
        logger.warn(`Node ${node.nodeId} marked unreachable`);

        nodesStaleTotal.inc();
        nodesActiveGauge.dec();

        const reclaimedJobs = await reclaimJobsForNode(node.nodeId);

        for (const job of reclaimedJobs) {
          logger.warn(`Job ${job.id} reclaimed from node ${node.nodeId}`);

          jobsReclaimedTotal.inc({ job_type: job.type });
          if (job.status === "queued") {
            jobsQueuedGauge.inc({ job_type: job.type });
          } else if (job.status === "failed") {
            jobsFailedTotal.inc({
              job_type: job.type,
              reason: "reclaim_failed_max_retries",
            });
          }
        }
      }
    } catch (error) {
      logger.error(
        {
          err: error,
        },
        "Node liveness check failed",
      );
    }
  }, checkIntervalMs);

  interval.unref();

  return () => {
    clearInterval(interval);
  };
}
