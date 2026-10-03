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
      const cmd = findCommand("/work");
      expect(cmd).toBeDefined();
      expect(cmd.name).toBe("/work");
    });

    it("finds a command by alias", () => {
      const cmd = findCommand("/w");
      expect(cmd).toBeDefined();
      expect(cmd.name).toBe("/work");
    });

    it("is case-insensitive", () => {
      const cmd = findCommand("/WORK");
      expect(cmd).toBeDefined();
      expect(cmd.name).toBe("/work");
    });

    it("ignores trailing arguments", () => {
      const cmd = findCommand("/jobs failed");
      expect(cmd).toBeDefined();
      expect(cmd.name).toBe("/jobs");
    });

    it("returns undefined for unknown commands", () => {
      const cmd = findCommand("/unknown");
      expect(cmd).toBeUndefined();
    });
  });

  describe("filterCommands", () => {
    it("filters commands by prefix", () => {
      const matches = filterCommands("/wo");
      expect(matches).toHaveLength(2);
      expect(matches.map((c) => c.name)).toContain("/work");
      expect(matches.map((c) => c.name)).toContain("/workers");
    });

    it("matches aliases by prefix", () => {
      // "/w" should match "/work" (name), "/workers" (name), "/w" (alias of /work)
      const matches = filterCommands("/w");
      expect(matches.map((c) => c.name)).toContain("/work");
      expect(matches.map((c) => c.name)).toContain("/workers");
    });

    it("is case-insensitive", () => {
      const matches = filterCommands("/WO");
      expect(matches).toHaveLength(2);
    });
  });

  describe("suggestCommand", () => {
    it("suggests close matches for typos", () => {
      const suggestions = suggestCommand("/worrk");
      expect(suggestions).toContain("/work");
      // it might also suggest /workers depending on distance
    });

    it("suggests /status for /statu", () => {
      const suggestions = suggestCommand("/statu");
      expect(suggestions).toContain("/status");
    });

    it("returns empty for exact matches", () => {
      const suggestions = suggestCommand("/work");
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
      expect(names).toContain("/work");
      expect(names).toContain("/jobs");
      expect(names).toContain("/workers");
      expect(names).toContain("/doctor");
      expect(names).toContain("/status");
      expect(names).toContain("/logs");
      expect(names).toContain("/model");
      expect(names).toContain("/config");
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
