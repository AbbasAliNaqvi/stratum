export function getBaseUrl() {
  if (typeof window !== "undefined" && window.localStorage?.getItem("stratum_cp_url")) {
    return window.localStorage.getItem("stratum_cp_url").replace(/\/$/, "");
  }
  if (import.meta.env?.VITE_CONTROL_PLANE_URL) {
    return import.meta.env.VITE_CONTROL_PLANE_URL.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

async function request(path, options = {}) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;
  
  const defaultHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    if (res.status === 204) {
      return null;
    }

    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("text/plain")) {
      const text = await res.text();
      if (!res.ok) throw new Error(`API Error (${res.status}): ${text}`);
      return text;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data.error?.message || data.error || `HTTP ${res.status}`;
      throw new Error(errMsg);
    }
    return data;
  } catch (err) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      throw new Error(`Network unavailable: Failed to connect to Control Plane at ${baseUrl}`);
    }
    throw err;
  }
}

export async function getHealth() {
  return request("/health");
}

export async function getAutomations() {
  const data = await request("/automations");
  return data.automations || [];
}

export async function getAutomation(id) {
  const data = await request(`/automations/${id}`);
  return data.automation;
}

export async function createAutomation(data) {
  const res = await request("/automations", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.automation;
}

export async function updateAutomation(id, data) {
  const res = await request(`/automations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return res.automation;
}

export async function enableAutomation(id) {
  const res = await request(`/automations/${id}/enable`, {
    method: "POST",
  });
  return res.automation;
}

export async function disableAutomation(id) {
  const res = await request(`/automations/${id}/disable`, {
    method: "POST",
  });
  return res.automation;
}

export async function deleteAutomation(id) {
  await request(`/automations/${id}`, {
    method: "DELETE",
  });
}

export async function runAutomation(id, input = {}) {
  const res = await request(`/automations/${id}/runs`, {
    method: "POST",
    body: JSON.stringify({ input }),
  });
  return res.run;
}

export async function getRuns(automationId) {
  const path = automationId ? `/automations/${automationId}/runs` : "/runs";
  const data = await request(path);
  return data.runs || [];
}

export async function getRun(id) {
  const data = await request(`/runs/${id}`);
  return data.run;
}

export async function cancelRun(id) {
  const data = await request(`/runs/${id}/cancel`, {
    method: "POST",
  });
  return data.run;
}

export async function getSchedules() {
  const data = await request("/schedules");
  return data.schedules || [];
}

export async function createSchedule(data) {
  const res = await request("/schedules", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.schedule;
}

export async function updateSchedule(id, data) {
  const res = await request(`/schedules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return res.schedule;
}

export async function enableSchedule(id) {
  const res = await request(`/schedules/${id}/enable`, {
    method: "POST",
  });
  return res.schedule;
}

export async function disableSchedule(id) {
  const res = await request(`/schedules/${id}/disable`, {
    method: "POST",
  });
  return res.schedule;
}

export async function runSchedule(id) {
  const res = await request(`/schedules/${id}/run`, {
    method: "POST",
  });
  return res.run;
}

export async function deleteSchedule(id) {
  await request(`/schedules/${id}`, {
    method: "DELETE",
  });
}

export async function getWorkers() {
  const data = await request("/nodes");
  return data.nodes || [];
}

export async function getJobs(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.type) params.set("type", filters.type);
  const queryStr = params.toString() ? `?${params.toString()}` : "";
  const data = await request(`/jobs${queryStr}`);
  return data.jobs || [];
}

export async function getJobEvents(jobId) {
  const data = await request(`/jobs/${jobId}/events`);
  return data.events || [];
}

export async function getAllEvents(limit = 100) {
  const data = await request(`/events?limit=${limit}`);
  return data.events || [];
}

export async function getMetrics() {
  return request("/metrics");
}

export async function getAgentConfig() {
  return request("/agent/config");
}

export async function getAgentSessions() {
  const data = await request("/agent/sessions");
  return data.sessions || [];
}

export async function getAgentSession(id) {
  const data = await request(`/agent/sessions/${id}`);
  return data.session;
}

export async function createAgentSession(title) {
  const res = await request("/agent/sessions", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  return res.session;
}

export async function sendAgentMessage(sessionId, content) {
  const res = await request(`/agent/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  return res.session;
}

export async function getPendingApprovals(sessionId) {
  const queryStr = sessionId ? `?sessionId=${sessionId}` : "";
  const data = await request(`/agent/approvals${queryStr}`);
  return data.approvals || [];
}

export async function approveAgentAction(id) {
  const res = await request(`/agent/approvals/${id}/approve`, {
    method: "POST",
  });
  return res.session;
}

export async function rejectAgentAction(id, reason) {
  const res = await request(`/agent/approvals/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  return res.session;
}
