import { describe, it, expect } from "vitest";
import { getAutomations, getAutomation, Automation } from "./automation.js";

describe("Automation abstractions", () => {
  it("loads built-in automations", () => {
    const autos = getAutomations();
    expect(autos.length).toBeGreaterThan(0);
    const health = autos.find(a => a.id === "api-health-monitor");
    expect(health).toBeDefined();
    expect(health.name).toBe("API Health Monitor");
    expect(health.steps.length).toBe(3);
  });

  it("can get a specific automation", () => {
    const auto = getAutomation("api-health-monitor");
    expect(auto).toBeDefined();
    expect(auto.id).toBe("api-health-monitor");
    expect(auto.inputs).toBeDefined();
  });

  it("returns null for unknown automation", () => {
    expect(getAutomation("unknown-123")).toBeNull();
  });

  it("constructs an Automation with defaults", () => {
    const auto = new Automation({ name: "Test" });
    expect(auto.id).toBeDefined();
    expect(auto.name).toBe("Test");
    expect(auto.version).toBe("1.0.0");
    expect(auto.inputs).toEqual([]);
    expect(auto.steps).toEqual([]);
  });
});
