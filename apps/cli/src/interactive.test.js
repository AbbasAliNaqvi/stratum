import { describe, it, expect } from "vitest";
import {
  findCommand,
  suggestCommand,
  filterCommands,
  COMMANDS,
  inlinePrompt,
} from "./interactive.js";
import readline from "node:readline";

describe("interactive console commands", () => {
  describe("findCommand", () => {
    it("finds a command by its exact name", () => {
      const cmd = findCommand("/run");
      expect(cmd).toBeDefined();
      expect(cmd.name).toBe("/run");
    });

    it("finds a command by alias", () => {
      const cmd = findCommand("/r");
      expect(cmd).toBeDefined();
      expect(cmd.name).toBe("/run");
    });

    it("is case-insensitive", () => {
      const cmd = findCommand("/RUN");
      expect(cmd).toBeDefined();
      expect(cmd.name).toBe("/run");
    });

    it("ignores trailing arguments", () => {
      const cmd = findCommand("/runs failed");
      expect(cmd).toBeDefined();
      expect(cmd.name).toBe("/runs");
    });

    it("returns undefined for unknown commands", () => {
      const cmd = findCommand("/unknown");
      expect(cmd).toBeUndefined();
    });
  });

  describe("filterCommands", () => {
    it("filters commands by prefix", () => {
      const matches = filterCommands("/ru");
      expect(matches).toHaveLength(2); // /run, /runs
      expect(matches.map((c) => c.name)).toContain("/run");
      expect(matches.map((c) => c.name)).toContain("/runs");
    });

    it("matches aliases by prefix", () => {
      // "/r" should match "/run" (name), "/runs" (name), "/r" (alias of /run)
      const matches = filterCommands("/r");
      expect(matches.map((c) => c.name)).toContain("/run");
      expect(matches.map((c) => c.name)).toContain("/runs");
    });

    it("is case-insensitive", () => {
      const matches = filterCommands("/RU");
      expect(matches).toHaveLength(2);
    });
  });

  describe("suggestCommand", () => {
    it("suggests close matches for typos", () => {
      const suggestions = suggestCommand("/runn");
      expect(suggestions).toContain("/run");
      // it might also suggest /runs depending on distance
    });

    it("suggests /status for /statu", () => {
      const suggestions = suggestCommand("/statu");
      expect(suggestions).toContain("/status");
    });

    it("returns empty for exact matches", () => {
      const suggestions = suggestCommand("/run");
      expect(suggestions).toHaveLength(0);
    });

    it("returns empty for very distant gibberish", () => {
      const suggestions = suggestCommand("/zzzzzzzz");
      expect(suggestions).toHaveLength(0);
    });
  });

  describe("COMMANDS", () => {
    it("has expected commands", () => {
      const names = COMMANDS.map((c) => c.name);
      expect(names).toContain("/run");
      expect(names).toContain("/automations");
      expect(names).toContain("/automate");
      expect(names).toContain("/about");
      expect(names).toContain("/workflow");
      expect(names).toContain("/schedule");
      expect(names).toContain("/demo");
      expect(names).toContain("/runs");
      expect(names).toContain("/tasks");
      expect(names).toContain("/workers");
      expect(names).toContain("/monitor");
      expect(names).toContain("/status");
      expect(names).toContain("/doctor");
      expect(names).toContain("/config");
      expect(names).toContain("/model");
      expect(names).toContain("/jobs");
      expect(names).toContain("/help");
      expect(names).toContain("/clear");
      expect(names).toContain("/quit");
    });
  });

  describe("inlinePrompt", () => {
    it("resolves to default value if empty input is provided", async () => {
      // Mock readline interface
      const mockRl = {
        question: (query, optionsOrCallback, callback) => {
          const cb =
            typeof optionsOrCallback === "function"
              ? optionsOrCallback
              : callback;
          cb(""); // Simulate user pressing Enter with no input
        },
      };

      const p = inlinePrompt(mockRl, "Test", "default");
      // Simulate no keypress
      const result = await p;
      expect(result).toBe("default");
    });

    it("resolves to null when escape is pressed", async () => {
      // Mock readline interface that doesn't immediately call back
      const mockRl = {
        question: (query, options, callback) => {
          // Do nothing, wait for keypress
        },
      };

      const p = inlinePrompt(mockRl, "Test", "default");

      // Simulate escape keypress
      process.stdin.emit("keypress", "", { name: "escape" });

      const result = await p;
      expect(result).toBeNull();
    });
  });
});
