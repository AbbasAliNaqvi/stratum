import { describe, test, expect } from "vitest";
import { canTransition, assertValidTransition, JOB_STATES } from "./state.js";

describe("Job State Machine", () => {
  describe("Valid transitions", () => {
    test("valid queued -> running", () => {
      expect(canTransition(JOB_STATES.QUEUED, JOB_STATES.RUNNING)).toBe(true);
      expect(() => assertValidTransition(JOB_STATES.QUEUED, JOB_STATES.RUNNING)).not.toThrow();
    });

    test("valid queued -> cancelled", () => {
      expect(canTransition(JOB_STATES.QUEUED, JOB_STATES.CANCELLED)).toBe(true);
      expect(() => assertValidTransition(JOB_STATES.QUEUED, JOB_STATES.CANCELLED)).not.toThrow();
    });

    test("valid running -> succeeded", () => {
      expect(canTransition(JOB_STATES.RUNNING, JOB_STATES.SUCCEEDED)).toBe(true);
      expect(() => assertValidTransition(JOB_STATES.RUNNING, JOB_STATES.SUCCEEDED)).not.toThrow();
    });

    test("valid running -> failed", () => {
      expect(canTransition(JOB_STATES.RUNNING, JOB_STATES.FAILED)).toBe(true);
      expect(() => assertValidTransition(JOB_STATES.RUNNING, JOB_STATES.FAILED)).not.toThrow();
    });

    test("valid running -> cancelled", () => {
      expect(canTransition(JOB_STATES.RUNNING, JOB_STATES.CANCELLED)).toBe(true);
      expect(() => assertValidTransition(JOB_STATES.RUNNING, JOB_STATES.CANCELLED)).not.toThrow();
    });

    test("valid running -> queued for reclaim", () => {
      expect(canTransition(JOB_STATES.RUNNING, JOB_STATES.QUEUED)).toBe(true);
      expect(() => assertValidTransition(JOB_STATES.RUNNING, JOB_STATES.QUEUED)).not.toThrow();
    });
    
    test("valid running -> running for direct claim of expired", () => {
      expect(canTransition(JOB_STATES.RUNNING, JOB_STATES.RUNNING)).toBe(true);
      expect(() => assertValidTransition(JOB_STATES.RUNNING, JOB_STATES.RUNNING)).not.toThrow();
    });
  });

  describe("Invalid transitions", () => {
    test("invalid queued -> succeeded", () => {
      expect(canTransition(JOB_STATES.QUEUED, JOB_STATES.SUCCEEDED)).toBe(false);
      expect(() => assertValidTransition(JOB_STATES.QUEUED, JOB_STATES.SUCCEEDED)).toThrow(/Invalid state transition/);
    });

    test("invalid queued -> failed", () => {
      expect(canTransition(JOB_STATES.QUEUED, JOB_STATES.FAILED)).toBe(false);
      expect(() => assertValidTransition(JOB_STATES.QUEUED, JOB_STATES.FAILED)).toThrow(/Invalid state transition/);
    });

    test("invalid succeeded -> running", () => {
      expect(canTransition(JOB_STATES.SUCCEEDED, JOB_STATES.RUNNING)).toBe(false);
      expect(() => assertValidTransition(JOB_STATES.SUCCEEDED, JOB_STATES.RUNNING)).toThrow(/Invalid state transition/);
    });

    test("invalid cancelled -> running", () => {
      expect(canTransition(JOB_STATES.CANCELLED, JOB_STATES.RUNNING)).toBe(false);
      expect(() => assertValidTransition(JOB_STATES.CANCELLED, JOB_STATES.RUNNING)).toThrow(/Invalid state transition/);
    });

    test("terminal states cannot transition out", () => {
      expect(canTransition(JOB_STATES.SUCCEEDED, JOB_STATES.QUEUED)).toBe(false);
      expect(canTransition(JOB_STATES.FAILED, JOB_STATES.QUEUED)).toBe(false);
      expect(canTransition(JOB_STATES.CANCELLED, JOB_STATES.QUEUED)).toBe(false);
    });

    test("terminal states can transition to themselves (idempotency)", () => {
      expect(canTransition(JOB_STATES.SUCCEEDED, JOB_STATES.SUCCEEDED)).toBe(true);
      expect(canTransition(JOB_STATES.FAILED, JOB_STATES.FAILED)).toBe(true);
      expect(canTransition(JOB_STATES.CANCELLED, JOB_STATES.CANCELLED)).toBe(true);
      expect(() => assertValidTransition(JOB_STATES.CANCELLED, JOB_STATES.CANCELLED)).not.toThrow();
    });
  });
});
