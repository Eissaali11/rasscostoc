import { describe, it, expect } from "vitest";
import { metrics } from "./metrics";

describe("metrics.toPrometheus", () => {
  it("serializes counters, gauges, and histograms in Prometheus text format", () => {
    metrics.incrementCounter("test_requests_total", 3);
    metrics.setGauge("test_gauge_value", 42);
    metrics.recordValue("test_latency_ms", 100);
    metrics.recordValue("test_latency_ms", 200);

    const out = metrics.toPrometheus();

    expect(out).toContain("# TYPE test_requests_total counter");
    expect(out).toContain("test_requests_total 3");
    expect(out).toContain("# TYPE test_gauge_value gauge");
    expect(out).toContain("test_gauge_value 42");
    // histogram exposed as summary-style component metrics
    expect(out).toContain("test_latency_ms_count 2");
    expect(out).toContain("test_latency_ms_sum 300");
    expect(out).toContain("test_latency_ms_max 200");
    expect(out).toContain("test_latency_ms_min 100");
  });

  it("sanitizes metric names to valid Prometheus identifiers", () => {
    metrics.incrementCounter("weird.name-with/chars", 1);
    const out = metrics.toPrometheus();
    expect(out).toContain("weird_name_with_chars 1");
  });
});
