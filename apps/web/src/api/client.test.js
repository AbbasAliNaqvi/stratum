import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as client from "./client.js";

describe("API Client Layer", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("getHealth fetches health endpoint correctly", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ status: "ok", uptimeSeconds: 120 }),
    });

    const res = await client.getHealth();
    expect(res).toEqual({ status: "ok", uptimeSeconds: 120 });
    expect(global.fetch).toHaveBeenCalledWith("http://localhost:3000/health", expect.any(Object));
  });

  it("getAutomations returns array of automations", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ automations: [{ id: "auto_1", name: "Test Auto" }] }),
    });

    const res = await client.getAutomations();
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("auto_1");
  });

  it("createAutomation posts payload and returns automation", async () => {
    const payload = { name: "New Auto", definition: { steps: [{ id: "step1", type: "echo" }] } };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: { get: () => "application/json" },
      json: async () => ({ automation: { id: "auto_2", ...payload } }),
    });

    const res = await client.createAutomation(payload);
    expect(res.id).toBe("auto_2");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/automations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  });

  it("handles network connection failure gracefully", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(client.getHealth()).rejects.toThrow("Network unavailable");
  });

  it("handles HTTP error status codes with custom message", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => "application/json" },
      json: async () => ({ error: { message: "Duplicate step ID: task_1" } }),
    });

    await expect(client.getAutomations()).rejects.toThrow("Duplicate step ID: task_1");
  });
});
