import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";

// =======================
// CONTEXT
// =======================

export const traceStorage = new AsyncLocalStorage();

export function generateTraceId() {
  return crypto.randomBytes(16).toString("hex");
}

export function generateSpanId() {
  return crypto.randomBytes(8).toString("hex");
}

export function withSpanContext(span, callback) {
  return traceStorage.run(span, callback);
}

export function getActiveSpan() {
  return traceStorage.getStore() || null;
}

export function parseTraceparent(traceparent) {
  if (!traceparent) return null;
  const match = traceparent.match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/);
  if (!match) return null;
  // Ensure we don't accept all-zero traceId or spanId
  if (match[1] === '00000000000000000000000000000000' || match[2] === '0000000000000000') {
    return null;
  }
  return {
    traceId: match[1],
    spanId: match[2],
    flags: match[3],
  };
}

export function formatTraceparent(traceId, spanId) {
  return `00-${traceId}-${spanId}-01`;
}

// =======================
// EXPORTER
// =======================

let currentExporter = null;

export function setExporter(exporter) {
  currentExporter = exporter;
}

export function getExporter() {
  return currentExporter;
}

export class ConsoleExporter {
  constructor(enabled = true) {
    this.enabled = enabled;
  }

  export(span) {
    if (this.enabled) {
      console.log(JSON.stringify({
        event: "span.ended",
        name: span.name,
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId,
        durationMs: span.endTime - span.startTime,
        status: span.status,
        attributes: span.attributes,
        error: span.error ? span.error.message : undefined
      }));
    }
  }
}

// Auto-configure console exporter if requested via environment
if (process.env.STRATUM_TRACING_ENABLED === "true") {
  setExporter(new ConsoleExporter());
}

export class InMemoryExporter {
  constructor() {
    this.spans = [];
  }

  export(span) {
    this.spans.push(span);
  }

  getFinishedSpans() {
    return this.spans;
  }

  reset() {
    this.spans = [];
  }
}

// =======================
// SPAN
// =======================

export class Span {
  constructor(name, options = {}) {
    this.name = name;
    
    let parentTraceId = null;
    let parentSpanId = null;
    
    if (options.traceparent) {
      const parsed = typeof options.traceparent === 'string' 
        ? parseTraceparent(options.traceparent) 
        : options.traceparent;
        
      if (parsed) {
        parentTraceId = parsed.traceId;
        parentSpanId = parsed.spanId;
      }
    }
    
    if (!parentTraceId) {
      const activeSpan = getActiveSpan();
      if (activeSpan) {
        parentTraceId = activeSpan.traceId;
        parentSpanId = activeSpan.spanId;
      }
    }

    this.traceId = parentTraceId || generateTraceId();
    this.parentSpanId = parentSpanId || null;
    this.spanId = generateSpanId();
    
    this.startTime = Date.now();
    this.endTime = null;
    this.attributes = { ...options.attributes };
    this.status = "ok";
    this.error = null;
  }

  setAttribute(key, value) {
    this.attributes[key] = value;
    return this;
  }

  recordException(error) {
    this.error = error;
    this.status = "error";
    return this;
  }

  setStatus(status) {
    this.status = status;
    return this;
  }
  
  getTraceparent() {
    return formatTraceparent(this.traceId, this.spanId);
  }

  end() {
    this.endTime = Date.now();
    const exporter = getExporter();
    if (exporter) {
      exporter.export(this);
    }
  }
}

export function startSpan(name, options = {}) {
  return new Span(name, options);
}

export async function withSpan(name, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  
  const span = startSpan(name, options);
  return withSpanContext(span, async () => {
    try {
      const result = await callback(span);
      span.end();
      return result;
    } catch (err) {
      span.recordException(err);
      span.end();
      throw err;
    }
  });
}
