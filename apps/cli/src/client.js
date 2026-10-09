import { config } from "./config.js";

export class ApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

import { withSpan } from "@stratum/tracing";

async function request(path, options = {}) {
  const method = options.method || "GET";

  return withSpan(`CLI ${method} ${path}`, async (span) => {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, config.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${config.CONTROL_PLANE_URL}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          traceparent: span.getTraceparent(),
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
        throw new ApiError(
          body?.error ?? `Request failed with status ${response.status}`,
          {
            status: response.status,
            body,
          },
        );
      }

      span.setStatus("ok");
      return body;
    } catch (error) {
      if (error.name === "AbortError") {
        const err = new ApiError(
          `Request timed out after ${config.REQUEST_TIMEOUT_MS}ms`,
        );
        span.recordException(err);
        throw err;
      }

      span.recordException(error);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  });
}

export function createClient() {
  return {
    async submitJob(data) {
      return request("/jobs", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    async listJobs({ status, type } = {}) {
      const params = new URLSearchParams();

      if (status) {
        params.set("status", status);
      }

      if (type) {
        params.set("type", type);
      }

      const query = params.toString();
      const path = query ? `/jobs?${query}` : "/jobs";

      return request(path);
    },

    async getJob(jobId) {
      return request(`/jobs/${encodeURIComponent(jobId)}`);
    },

    async cancelJob(jobId) {
      return request(`/jobs/${encodeURIComponent(jobId)}/cancel`, {
        method: "POST",
      });
    },

    async getNodes() {
      return request("/nodes");
    },

    async getHealth() {
      return request("/health");
    },

    async createAutomation(data) {
      return request("/automations", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    async getAutomations() {
      return request("/automations");
    },

    async getAutomation(id) {
      return request(`/automations/${encodeURIComponent(id)}`);
    },

    async createRun(automationId, input = {}) {
      return request(`/automations/${encodeURIComponent(automationId)}/runs`, {
        method: "POST",
        body: JSON.stringify({ input }),
      });
    },

    async getRuns(automationId) {
      const path = automationId 
        ? `/automations/${encodeURIComponent(automationId)}/runs`
        : "/runs";
      return request(path);
    },

    async getRun(id) {
      return request(`/runs/${encodeURIComponent(id)}`);
    },

    async cancelRun(id) {
      return request(`/runs/${encodeURIComponent(id)}/cancel`, {
        method: "POST",
      });
    },

    async updateRunStatus(id, data) {
      return request(`/runs/${encodeURIComponent(id)}/status`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    async linkRunStep(id, stepId, jobId) {
      return request(`/runs/${encodeURIComponent(id)}/steps`, {
        method: "POST",
        body: JSON.stringify({ stepId, jobId }),
      });
    },

    async createSchedule(data) {
      return request("/schedules", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    async getSchedules() {
      return request("/schedules");
    },

    async removeSchedule(id) {
      return request(`/schedules/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },

    async getAgentConfig() {
      return request("/agent/config");
    },

    async createAgentSession(title) {
      return request("/agent/sessions", {
        method: "POST",
        body: JSON.stringify({ title }),
      });
    },

    async getAgentSession(id) {
      return request(`/agent/sessions/${encodeURIComponent(id)}`);
    },

    async sendAgentMessage(sessionId, content) {
      return request(`/agent/sessions/${encodeURIComponent(sessionId)}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
    },

    async approveAgentAction(id) {
      return request(`/agent/approvals/${encodeURIComponent(id)}/approve`, {
        method: "POST",
      });
    },

    async rejectAgentAction(id, reason) {
      return request(`/agent/approvals/${encodeURIComponent(id)}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    },

    baseUrl: config.CONTROL_PLANE_URL,
  };
}
