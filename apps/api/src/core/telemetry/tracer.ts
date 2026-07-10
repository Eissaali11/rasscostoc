/**
 * Tracer Utility
 *
 * Implements lightweight, OpenTelemetry-compatible distributed tracing.
 */

import { randomUUID } from "node:crypto";
import { getContext, telemetryContextStore, type TelemetryContext } from "./telemetry";
import { recordSpanMetric } from "./metrics";

export interface Span {
  name: string;
  traceId: string;
  spanId: string;
  parentId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  attributes: Record<string, any>;
  end: () => void;
}

// In-memory ring buffer of recent spans for dashboard observability
const MAX_RECENT_SPANS = 500;
export const recentSpans: Span[] = [];

export function getRecentSpans(): Span[] {
  return [...recentSpans];
}

class Tracer {
  /**
   * Start a new span. Resolves traceId and parent relationship automatically from context.
   */
  startSpan(name: string, attributes: Record<string, any> = {}): Span {
    const context = getContext();
    const spanId = randomUUID();
    const parentId = context.spanId;

    const span: Span = {
      name,
      traceId: context.traceId,
      spanId,
      parentId,
      startTime: Date.now(),
      attributes,
      end: () => {
        span.endTime = Date.now();
        span.duration = span.endTime - span.startTime;

        // Record metrics for this span
        recordSpanMetric(span);

        // Add to ring buffer
        recentSpans.push(span);
        if (recentSpans.length > MAX_RECENT_SPANS) {
          recentSpans.shift();
        }

        // Restore context if nested
        const currentStore = telemetryContextStore.getStore();
        if (currentStore) {
          telemetryContextStore.enterWith({
            ...currentStore,
            spanId: parentId, // Revert to parent
          });
        }
      },
    };

    // Update context with the new spanId
    const currentStore = telemetryContextStore.getStore();
    if (currentStore) {
      telemetryContextStore.enterWith({
        ...currentStore,
        spanId,
      });
    }

    return span;
  }
}

export const tracer = new Tracer();
export default tracer;
