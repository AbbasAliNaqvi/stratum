import { config } from "./config.js";

class ControlPlaneError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "ControlPlaneError";
    this.status = status;
    this.body = body;
  }
}

async function request(path, options = {}) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, config.REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.CONTROL_PLANE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.headers ?? {}),
      },
    });

    const text = await response.text();

    let body = null;

    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (!response.ok) {
      throw new ControlPlaneError(
        `Control plane request failed with ${response.status}`,
        {
          status: response.status,
          body,
        },
      );
    }

    return body;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ControlPlaneError(
        `Control plane request timed out after ${config.REQUEST_TIMEOUT_MS}ms`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createControlPlaneClient() {
  return {
    async registerNode() {
      return request("/nodes", {
        method: "POST",
        body: JSON.stringify({
          nodeId: config.NODE_ID,
          hostname: config.HOSTNAME,
          cpuCores: config.CPU_CORES,
          memoryMb: config.MEMORY_MB,
          platform: config.PLATFORM,
        }),
      });
    },

    async heartbeat() {
      return request(`/nodes/${encodeURIComponent(config.NODE_ID)}/heartbeat`, {
        method: "POST",
      });
    },

    async claimJob() {
      return request("/jobs/claim", {
        method: "POST",
        body: JSON.stringify({
          nodeId: config.NODE_ID,
        }),
      });
    },

    async getJob(jobId) {
      return request(`/jobs/${encodeURIComponent(jobId)}`);
    },

    async completeJob(jobId, leaseToken, result) {
      return request(`/jobs/${encodeURIComponent(jobId)}/complete`, {
        method: "POST",
        body: JSON.stringify({
          nodeId: config.NODE_ID,
          leaseToken,
          result,
        }),
      });
    },

    async acknowledgeJobCancellation(jobId, leaseToken) {
      return request(`/jobs/${encodeURIComponent(jobId)}/cancel/acknowledge`, {
        method: "POST",
        body: JSON.stringify({
          nodeId: config.NODE_ID,
          leaseToken,
        }),
      });
    },

    async renewJobLease(jobId, leaseToken) {
      return request(`/jobs/${encodeURIComponent(jobId)}/renew`, {
        method: "POST",
        body: JSON.stringify({
          nodeId: config.NODE_ID,
          leaseToken,
        }),
      });
    },
  };
}

export { ControlPlaneError };
