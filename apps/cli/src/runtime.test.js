import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkNodeVersion } from "./runtime.js";
import * as fs from "node:fs";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
  openSync: vi.fn(),
}));

describe("runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkNodeVersion", () => {
    let originalError;
    let errOutput;

    beforeEach(() => {
      originalError = console.error;
      errOutput = [];
      console.error = (...args) => errOutput.push(args.join(" "));

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(
        JSON.stringify({
          engines: { node: ">=22" },
        }),
      );
    });

    afterEach(() => {
      console.error = originalError;
    });

    it("accepts Node 22.x", () => {
      expect(checkNodeVersion({ node: "22.0.0" })).toBe(true);
      expect(errOutput).toHaveLength(0);
    });

    it("accepts Node 23.x", () => {
      expect(checkNodeVersion({ node: "23.1.0" })).toBe(true);
      expect(errOutput).toHaveLength(0);
    });

    it("rejects Node 20.x", () => {
      expect(checkNodeVersion({ node: "20.20.1" })).toBe(false);
      expect(errOutput[0]).toContain("requires Node.js 22");
    });

    it("rejects Node 21.x", () => {
      expect(checkNodeVersion({ node: "21.9.0" })).toBe(false);
      expect(errOutput[0]).toContain("requires Node.js 22");
    });
  });
});
