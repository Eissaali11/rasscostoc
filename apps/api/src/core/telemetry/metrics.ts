/**
 * Metrics Registry
 *
 * Implements lightweight in-memory metrics collection for system performance.
 */

import type { Span } from "./tracer";

export interface MetricValue {
  value: number;
  timestamp: Date;
  labels: Record<string, string>;
}

class MetricsRegistry {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, { count: number; sum: number; min: number; max: number }>();

  incrementCounter(name: string, value = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  recordValue(name: string, value: number): void {
    const current = this.histograms.get(name) || { count: 0, sum: 0, min: Infinity, max: -Infinity };
    current.count += 1;
    current.sum += value;
    if (value < current.min) current.min = value;
    if (value > current.max) current.max = value;
    this.histograms.set(name, current);
  }

  getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }

  getGauge(name: string): number {
    return this.gauges.get(name) || 0;
  }

  getHistogram(name: string) {
    const hist = this.histograms.get(name);
    if (!hist) return { count: 0, sum: 0, avg: 0, min: 0, max: 0 };
    return {
      count: hist.count,
      sum: hist.sum,
      avg: hist.count > 0 ? Math.round(hist.sum / hist.count) : 0,
      min: hist.min === Infinity ? 0 : hist.min,
      max: hist.max === -Infinity ? 0 : hist.max,
    };
  }

  getAllMetrics() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([k, v]) => [
          k,
          {
            count: v.count,
            sum: v.sum,
            avg: v.count > 0 ? Math.round(v.sum / v.count) : 0,
            min: v.min === Infinity ? 0 : v.min,
            max: v.max === -Infinity ? 0 : v.max,
          },
        ])
      ),
    };
  }
}

export const metrics = new MetricsRegistry();

/**
 * Automap trace spans to specific performance metrics based on name.
 */
export function recordSpanMetric(span: Span): void {
  if (span.duration === undefined) return;

  const duration = span.duration;

  if (span.name === "WorkflowExecution") {
    metrics.recordValue("workflow_execution_duration_ms", duration);
  } else if (span.name === "InventoryDeduction") {
    metrics.recordValue("inventory_deduction_duration_ms", duration);
  } else if (span.name.startsWith("EventProcessing:")) {
    metrics.recordValue("event_processing_duration_ms", duration);
  } else if (span.name.startsWith("API:")) {
    metrics.recordValue("api_latency_ms", duration);
  } else if (span.name.startsWith("CourierList")) {
    metrics.recordValue("courier_list_span_ms", duration);
  }
}
