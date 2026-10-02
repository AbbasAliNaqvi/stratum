import { config } from "./config.js";
import { createControlPlaneClient, ControlPlaneError } from "./client.js";
import { logger } from "./logger.js";
import { createJobPoller } from "./poller.js";
import { workerHeartbeatTotal } from "./metrics.js";
import { registry } from "@stratum/metrics";

const client = createControlPlaneClient();
const jobPoller = createJobPoller({
  client,
  logger,
});

let heartbeatTimer = null;
let metricsTimer = null;
let shuttingDown = false;

async function registerOrRestoreNode() {
  try {
    const node = await client.registerNode();

    logger.info("Worker registered", {
      nodeId: node.nodeId,
      hostname: node.hostname,
    });

    return node;
  } catch (error) {
    if (error instanceof ControlPlaneError && error.status === 409) {
      logger.info("Node already exists; restoring worker session", {
        nodeId: config.NODE_ID,
      });

      return null;
    }

    throw error;
  }
}

async function sendHeartbeat() {
  if (shuttingDown) {
    return;
  }

  try {
    const node = await client.heartbeat();
    workerHeartbeatTotal.inc();

    logger.debug("Heartbeat sent", {
      nodeId: node.nodeId,
      status: node.status,
    });
  } catch (error) {
    logger.error("Heartbeat failed", {
      nodeId: config.NODE_ID,
      error: error.message,
    });
  }
}

function startHeartbeat() {
  heartbeatTimer = setInterval(() => {
    void sendHeartbeat();
  }, config.HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function startMetricsDump() {
  // Dump metrics every 60 seconds as a simple mechanism since there is no HTTP server
  metricsTimer = setInterval(() => {
    logger.info({ event: "worker_metrics_dump" }, `\n${registry.metrics()}`);
  }, 60000);
}

function stopMetricsDump() {
  if (metricsTimer) {
    clearInterval(metricsTimer);
    metricsTimer = null;
  }
}

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  logger.info("Worker shutting down", {
    signal,
    nodeId: config.NODE_ID,
  });

  stopHeartbeat();
  stopMetricsDump();
  jobPoller.stop();
  
  // Dump metrics one last time on exit
  logger.info({ event: "worker_metrics_dump_final" }, `\n${registry.metrics()}`);
}

async function start() {
  logger.info("Starting Stratum worker", {
    nodeId: config.NODE_ID,
    hostname: config.HOSTNAME,
    controlPlane: config.CONTROL_PLANE_URL,
  });

  try {
    await registerOrRestoreNode();

    await sendHeartbeat();

    startHeartbeat();
    startMetricsDump();
    jobPoller.start();

    logger.info("Worker is ready", {
      nodeId: config.NODE_ID,
      heartbeatIntervalMs: config.HEARTBEAT_INTERVAL_MS,
    });
  } catch (error) {
    logger.error("Worker startup failed", {
      error: error.message,
    });

    process.exitCode = 1;
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

void start();

