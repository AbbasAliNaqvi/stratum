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
      const response = await fetch(
        `${config.CONTROL_PLANE_URL}${path}`,
        {
          ...options,
          signal: controller.signal,
          headers: {
            "traceparent": span.getTraceparent(),
            ...(options.body
              ? { "content-type": "application/json" }
              : {}),
            ...(options.headers ?? {}),
          },
        },
      );

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
          body?.error ??
            `Request failed with status ${response.status}`,
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
      return request(
        `/jobs/${encodeURIComponent(jobId)}`,
      );
    },

    async cancelJob(jobId) {
      return request(
        `/jobs/${encodeURIComponent(jobId)}/cancel`,
        {
          method: "POST",
        },
      );
    },

    async getNodes() {
      return request("/nodes");
    },

    async getHealth() {
      return request("/health");
    },

    baseUrl: config.CONTROL_PLANE_URL
  };
}
