import { describe, it, expect, vi } from "vitest";
import {
  c,
  sym,
  box,
  stripAnsi,
  statusDot,
  statusIcon,
  kvPanel,
  table,
  timeAgo,
} from "./ui.js";

describe("ui primitives", () => {
  describe("stripAnsi", () => {
    it("removes ANSI escape sequences", () => {
      const input = "\u001b[31mred\u001b[0m text";
      expect(stripAnsi(input)).toBe("red text");
    });

    it("returns plain text unchanged", () => {
      expect(stripAnsi("hello")).toBe("hello");
    });
  });

  describe("statusIcon", () => {
    it("returns check for succeeded", () => {
      expect(stripAnsi(statusIcon("succeeded"))).toBe(sym.check);
    });

    it("returns dot for running", () => {
      expect(stripAnsi(statusIcon("running"))).toBe(sym.dot);
    });

    it("returns circle for queued", () => {
      expect(stripAnsi(statusIcon("queued"))).toBe(sym.circle);
    });

    it("returns cross for failed", () => {
      expect(stripAnsi(statusIcon("failed"))).toBe(sym.cross);
    });
  });

  describe("statusDot", () => {
    it("returns green dot for true", () => {
      expect(stripAnsi(statusDot(true))).toBe(sym.dot);
    });

    it("returns red circle for false", () => {
      expect(stripAnsi(statusDot(false))).toBe(sym.circle);
    });
  });

  describe("kvPanel", () => {
    it("formats key-value pairs", () => {
      const output = kvPanel([
        ["Key", "value"],
        ["Longer Key", "another"],
      ]);
      const plain = stripAnsi(output);
      expect(plain).toContain("Key");
      expect(plain).toContain("value");
      expect(plain).toContain("Longer Key");
      expect(plain).toContain("another");
    });
  });

  describe("table", () => {
    it("formats headers and rows", () => {
      const output = table(
        ["ID", "TYPE", "STATUS"],
        [
          ["abc", "echo", "queued"],
          ["def", "sleep", "running"],
        ],
      );
      const plain = stripAnsi(output);
      expect(plain).toContain("ID");
      expect(plain).toContain("TYPE");
      expect(plain).toContain("abc");
      expect(plain).toContain("echo");
      expect(plain).toContain("def");
      expect(plain).toContain("sleep");
    });
  });

  describe("box", () => {
    it("wraps lines in a box", () => {
      const output = box(["Hello", "World"]);
      const plain = stripAnsi(output);
      expect(plain).toContain("╭");
      expect(plain).toContain("╰");
      expect(plain).toContain("Hello");
      expect(plain).toContain("World");
    });
  });

  describe("timeAgo", () => {
    it("returns 'just now' for recent timestamps", () => {
      const now = new Date().toISOString();
      expect(timeAgo(now)).toBe("just now");
    });

    it("returns dash for null", () => {
      expect(timeAgo(null)).toBe("—");
    });

    it("returns seconds ago", () => {
      const ts = new Date(Date.now() - 5000).toISOString();
      expect(timeAgo(ts)).toMatch(/\ds ago/);
    });
  });
});
