/**
 * ERP-005A-4 Phase 6 — verifies tracer.ts and metrics.ts still work
 * end-to-end after breaking their circular dependency (Span moved to
 * span.types.ts, metrics.ts no longer imports from tracer.ts). Previously
 * this module had zero dedicated test coverage.
 */
import { describe, it, expect } from "vitest";
import { tracer, recentSpans, getRecentSpans } from "./tracer";
import { metrics } from "./metrics";
import { runWithContext } from "./telemetry";

describe("telemetry — tracer/metrics integration (post Phase 6 cycle break)", () => {
  it("startSpan/end records a span into the recent-spans ring buffer with correct timing", () => {
    const before = recentSpans.length;
    const span = tracer.startSpan("Phase6Test:basic-span");
    expect(span.name).toBe("Phase6Test:basic-span");
    expect(span.endTime).toBeUndefined();

    span.end();

    expect(span.endTime).toBeDefined();
    expect(span.duration).toBeGreaterThanOrEqual(0);
    expect(recentSpans.length).toBe(before + 1);
    expect(getRecentSpans().at(-1)?.name).toBe("Phase6Test:basic-span");
  });

  it("propagates trace context: a span started within a parent context inherits its traceId and links parentId", () => {
    const parentTraceId = "phase6-test-trace-id";
    runWithContext({ traceId: parentTraceId, correlationId: parentTraceId }, () => {
      const parentSpan = tracer.startSpan("Phase6Test:parent");
      const childSpan = tracer.startSpan("Phase6Test:child");

      expect(childSpan.traceId).toBe(parentTraceId);
      expect(childSpan.parentId).toBe(parentSpan.spanId);

      childSpan.end();
      parentSpan.end();
    });
  });

  it("recordSpanMetric (invoked via span.end()) routes named spans into the correct metrics histogram", () => {
    const before = metrics.getHistogram("workflow_execution_duration_ms").count;

    const span = tracer.startSpan("WorkflowExecution");
    span.end();

    const after = metrics.getHistogram("workflow_execution_duration_ms");
    expect(after.count).toBe(before + 1);
    expect(after.max).toBeGreaterThanOrEqual(0);
  });

  it("API-prefixed spans route into api_latency_ms, independent of the workflow bucket", () => {
    const before = metrics.getHistogram("api_latency_ms").count;

    const span = tracer.startSpan("API:GET /phase6-test");
    span.end();

    expect(metrics.getHistogram("api_latency_ms").count).toBe(before + 1);
  });

  it("metrics registry counters/gauges work independently of tracing", () => {
    metrics.incrementCounter("phase6_test_counter", 3);
    expect(metrics.getCounter("phase6_test_counter")).toBeGreaterThanOrEqual(3);

    metrics.setGauge("phase6_test_gauge", 42);
    expect(metrics.getGauge("phase6_test_gauge")).toBe(42);
  });
});
