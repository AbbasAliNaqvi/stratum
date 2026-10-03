import os from "node:os";
import { randomUUID } from "node:crypto";

const hostname = os
  .hostname()
  .replace(/[^a-zA-Z0-9_-]/g, "-")
  .slice(0, 48);

const generatedNodeId = `${hostname}-${randomUUID().slice(0, 8)}`;

export const config = {
  CONTROL_PLANE_URL:
    process.env.STRATUM_CONTROL_PLANE_URL ?? "http://127.0.0.1:3000",

  NODE_ID: process.env.STRATUM_NODE_ID ?? generatedNodeId,

  HOSTNAME: os.hostname(),

  CPU_CORES: os.cpus().length,

  MEMORY_MB: Math.floor(os.totalmem() / 1024 / 1024),

  PLATFORM: `${os.platform()}-${os.arch()}`,

  HEARTBEAT_INTERVAL_MS: Number(
    process.env.STRATUM_HEARTBEAT_INTERVAL_MS ?? 10_000,
  ),

  REQUEST_TIMEOUT_MS: Number(process.env.STRATUM_REQUEST_TIMEOUT_MS ?? 5_000),

  JOB_POLL_INTERVAL_MS: Number(
    process.env.STRATUM_JOB_POLL_INTERVAL_MS ?? 2000,
  ),

  JOB_CANCEL_CHECK_INTERVAL_MS: Number(
    process.env.STRATUM_JOB_CANCEL_CHECK_INTERVAL_MS ?? 500,
  ),
};
