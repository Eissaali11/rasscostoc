/**
 * ERP-005A-4 Phase 6 — the Span shape, extracted from tracer.ts into its own
 * file so metrics.ts can reference it without importing tracer.ts. Pure
 * data shape, zero logic — tracer.ts still owns span creation/lifecycle
 * (startSpan/end), metrics.ts still owns metric recording (recordSpanMetric);
 * only the shared type moved, breaking the tracer<->metrics cycle at both
 * the pre-compilation dependency graph level and (already-benign) the
 * runtime level.
 */
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
