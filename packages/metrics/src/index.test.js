import { describe, it, expect, beforeEach } from "vitest";
import { registry } from "./index.js";

describe("metrics registry", () => {
  beforeEach(() => {
    registry.clear();
  });

  it("increments a counter", () => {
    const counter = registry.counter({ name: "test_counter", help: "A test counter" });
    counter.inc({ label: "value" });
    counter.inc({ label: "value" }, 2);
    
    const output = registry.metrics();
    expect(output).toContain('# HELP test_counter A test counter');
    expect(output).toContain('# TYPE test_counter counter');
    expect(output).toContain('test_counter{label="value"} 3');
  });

  it("updates a gauge", () => {
    const gauge = registry.gauge({ name: "test_gauge", help: "A test gauge" });
    gauge.set({ label: "a" }, 5);
    gauge.inc({ label: "a" }, 2);
    gauge.dec({ label: "a" }, 1);
    
    const output = registry.metrics();
    expect(output).toContain('# HELP test_gauge A test gauge');
    expect(output).toContain('# TYPE test_gauge gauge');
    expect(output).toContain('test_gauge{label="a"} 6');
  });

  it("observes a histogram", () => {
    const histogram = registry.histogram({ 
      name: "test_histogram", 
      help: "A test histogram",
      buckets: [0.1, 0.5, 1] 
    });
    
    histogram.observe({ route: "/test" }, 0.2);
    histogram.observe({ route: "/test" }, 0.6);
    
    const output = registry.metrics();
    expect(output).toContain('test_histogram_bucket{route="/test",le="0.1"} 0');
    expect(output).toContain('test_histogram_bucket{route="/test",le="0.5"} 1');
    expect(output).toContain('test_histogram_bucket{route="/test",le="1"} 2');
    expect(output).toContain('test_histogram_bucket{route="/test",le="+Inf"} 2');
    expect(output).toContain('test_histogram_sum{route="/test"} 0.8');
    expect(output).toContain('test_histogram_count{route="/test"} 2');
  });

  it("escapes labels correctly", () => {
    const counter = registry.counter({ name: "test_escape", help: "test" });
    counter.inc({ tricky: 'val"\\ue\n' });
    
    const output = registry.metrics();
    expect(output).toContain('test_escape{tricky="val\\\"\\\\ue\\n"} 1');
  });
});
