import { describe, it, expect, beforeEach } from "vitest";
import {
  setExporter,
  InMemoryExporter,
  startSpan,
  withSpan,
  parseTraceparent,
  getActiveSpan,
  formatTraceparent
} from "./index.js";

describe("Tracing Package", () => {
  let exporter;

  beforeEach(() => {
    exporter = new InMemoryExporter();
    setExporter(exporter);
  });

  describe("Tracing context", () => {
    it("creates a new root trace", () => {
      const span = startSpan("root");
      expect(span.traceId).toBeDefined();
      expect(span.spanId).toBeDefined();
      expect(span.parentSpanId).toBeNull();
      
      span.end();
      
      const finished = exporter.getFinishedSpans();
      expect(finished).toHaveLength(1);
      expect(finished[0].name).toBe("root");
    });

    it("creates child spans and preserves parent/child relationship", async () => {
      await withSpan("parent", async (parentSpan) => {
        expect(parentSpan.parentSpanId).toBeNull();
        
        await withSpan("child", async (childSpan) => {
          expect(childSpan.traceId).toBe(parentSpan.traceId);
          expect(childSpan.parentSpanId).toBe(parentSpan.spanId);
          
          await withSpan("grandchild", async (grandchildSpan) => {
            expect(grandchildSpan.traceId).toBe(parentSpan.traceId);
            expect(grandchildSpan.parentSpanId).toBe(childSpan.spanId);
          });
        });
      });
      
      const finished = exporter.getFinishedSpans();
      expect(finished).toHaveLength(3);
      // Spans are ended from innermost to outermost
      expect(finished[0].name).toBe("grandchild");
      expect(finished[1].name).toBe("child");
      expect(finished[2].name).toBe("parent");
    });

    it("handles nested async operations safely", async () => {
      await withSpan("root", async (rootSpan) => {
        const promises = [
          withSpan("branch1", async (span1) => {
            await new Promise(r => setTimeout(r, 10));
            expect(getActiveSpan().spanId).toBe(span1.spanId);
          }),
          withSpan("branch2", async (span2) => {
            await new Promise(r => setTimeout(r, 10));
            expect(getActiveSpan().spanId).toBe(span2.spanId);
          })
        ];
        
        await Promise.all(promises);
        
        expect(getActiveSpan().spanId).toBe(rootSpan.spanId);
      });
      
      const finished = exporter.getFinishedSpans();
      expect(finished).toHaveLength(3);
    });

    it("rejects malformed incoming trace context", () => {
      expect(parseTraceparent("invalid-trace")).toBeNull();
      expect(parseTraceparent("00-00000000000000000000000000000000-0000000000000000-01")).toBeNull(); // All zeros
      expect(parseTraceparent("01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")).toBeNull(); // Wrong version
      expect(parseTraceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067zz0ba902b7-01")).toBeNull(); // Invalid hex
      
      const valid = parseTraceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
      expect(valid).not.toBeNull();
      expect(valid.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
      expect(valid.spanId).toBe("00f067aa0ba902b7");
    });
    
    it("formats traceparent correctly", () => {
      const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
      const spanId = "00f067aa0ba902b7";
      expect(formatTraceparent(traceId, spanId)).toBe("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
    });
  });

  describe("Exporter", () => {
    it("in-memory exporter captures spans with expected attributes/status", async () => {
      await withSpan("test-span", { attributes: { "http.method": "GET" } }, async (span) => {
        span.setAttribute("custom", "value");
        span.setStatus("ok");
      });
      
      const finished = exporter.getFinishedSpans();
      expect(finished).toHaveLength(1);
      
      const span = finished[0];
      expect(span.name).toBe("test-span");
      expect(span.attributes).toEqual({
        "http.method": "GET",
        "custom": "value"
      });
      expect(span.status).toBe("ok");
      expect(span.error).toBeNull();
      expect(span.startTime).toBeLessThanOrEqual(span.endTime);
    });
    
    it("captures exceptions", async () => {
      const error = new Error("Test error");
      
      await expect(withSpan("fail-span", async () => {
        throw error;
      })).rejects.toThrow("Test error");
      
      const finished = exporter.getFinishedSpans();
      expect(finished).toHaveLength(1);
      
      const span = finished[0];
      expect(span.status).toBe("error");
      expect(span.error).toBe(error);
    });
  });
});
