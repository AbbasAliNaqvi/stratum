import { config } from "./config.js";

export class ApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "ApiError";
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
    const response = await fetch(
      `${config.CONTROL_PLANE_URL}${path}`,
      {
        ...options,
        signal: controller.signal,
        headers: {
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

    return body;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ApiError(
        `Request timed out after ${config.REQUEST_TIMEOUT_MS}ms`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
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
  };
}
