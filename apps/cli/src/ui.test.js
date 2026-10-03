import { describe, it, expect } from "vitest";
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
  formatDuration,
  timeline,
  levenshtein,
  fuzzyMatch,
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

    it("returns cross for cancelled", () => {
      expect(stripAnsi(statusIcon("cancelled"))).toBe(sym.cross);
    });

    it("returns dash for unknown status", () => {
      expect(stripAnsi(statusIcon("unknown"))).toBe(sym.dash);
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

    it("aligns keys by longest key", () => {
      const output = kvPanel([
        ["A", "1"],
        ["BB", "2"],
      ]);
      const plain = stripAnsi(output);
      const lines = plain.split("\n");
      // "BB" is the longest key (2 chars), so "A" should be padded
      expect(lines[0]).toMatch(/A\s{3,}/);
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

    it("includes separator line", () => {
      const output = table(["A"], [["x"]]);
      const plain = stripAnsi(output);
      expect(plain).toContain(sym.dash);
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

    it("respects custom width", () => {
      const output = box(["Test"], { width: 30 });
      const plain = stripAnsi(output);
      const firstLine = plain.split("\n")[0];
      // width 30 = 2 corners + 28 dashes
      expect(firstLine.length).toBe(30);
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

    it("returns minutes ago", () => {
      const ts = new Date(Date.now() - 120_000).toISOString();
      expect(timeAgo(ts)).toMatch(/\dm ago/);
    });
  });

  describe("formatDuration", () => {
    it("returns dash for missing timestamps", () => {
      expect(formatDuration(null, null)).toBe("—");
    });

    it("formats milliseconds", () => {
      const start = "2026-01-01T00:00:00.000Z";
      const end = "2026-01-01T00:00:00.500Z";
      expect(formatDuration(start, end)).toBe("500ms");
    });

    it("formats seconds", () => {
      const start = "2026-01-01T00:00:00.000Z";
      const end = "2026-01-01T00:00:05.000Z";
      expect(formatDuration(start, end)).toBe("5.0s");
    });

    it("formats minutes", () => {
      const start = "2026-01-01T00:00:00.000Z";
      const end = "2026-01-01T00:02:30.000Z";
      expect(formatDuration(start, end)).toBe("2m 30s");
    });
  });

  describe("timeline", () => {
    it("renders steps with tree characters", () => {
      const output = timeline(["queued", "running", "succeeded"]);
      const plain = stripAnsi(output);
      expect(plain).toContain("├─");
      expect(plain).toContain("└─");
      expect(plain).toContain("queued");
      expect(plain).toContain("succeeded");
    });

    it("uses └─ only for the last step", () => {
      const output = timeline(["a", "b"]);
      const plain = stripAnsi(output);
      const lines = plain.split("\n");
      expect(lines[0]).toContain("├─");
      expect(lines[1]).toContain("└─");
    });
  });

  describe("levenshtein", () => {
    it("returns 0 for identical strings", () => {
      expect(levenshtein("abc", "abc")).toBe(0);
    });

    it("returns correct distance for single edit", () => {
      expect(levenshtein("abc", "ab")).toBe(1);
      expect(levenshtein("abc", "axc")).toBe(1);
    });

    it("returns correct distance for multiple edits", () => {
      expect(levenshtein("kitten", "sitting")).toBe(3);
    });

    it("handles empty strings", () => {
      expect(levenshtein("", "abc")).toBe(3);
      expect(levenshtein("abc", "")).toBe(3);
    });
  });

  describe("fuzzyMatch", () => {
    const candidates = ["/work", "/workers", "/jobs", "/status", "/quit"];

    it("finds close matches", () => {
      const matches = fuzzyMatch("/worrk", candidates);
      expect(matches).toContain("/work");
    });

    it("returns empty for exact match", () => {
      const matches = fuzzyMatch("/work", candidates);
      // dist 0 is filtered out (it means exact match)
      expect(matches).not.toContain("/work");
    });

    it("returns empty for very distant strings", () => {
      const matches = fuzzyMatch("/zzzzzzz", candidates, 2);
      expect(matches).toHaveLength(0);
    });

    it("sorts by distance", () => {
      const matches = fuzzyMatch("/wor", candidates);
      // /work (dist 1) should come before /workers (dist 4)
      if (matches.includes("/work")) {
        expect(matches.indexOf("/work")).toBeLessThan(
          matches.indexOf("/workers") === -1
            ? Infinity
            : matches.indexOf("/workers"),
        );
      }
    });
  });
});
