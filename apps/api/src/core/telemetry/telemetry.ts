/**
 * Telemetry Context Manager
 *
 * Implements correlation ID and trace propagation using Node's AsyncLocalStorage.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export interface TelemetryContext {
  traceId: string;
  correlationId: string;
  requestId?: string;
  userId?: string;
  username?: string;
  spanId?: string;
}

export const telemetryContextStore = new AsyncLocalStorage<TelemetryContext>();

/**
 * Run a callback function within a telemetry context.
 */
export function runWithContext<T>(context: TelemetryContext, callback: () => T): T {
  return telemetryContextStore.run(context, callback);
}

/**
 * Run an asynchronous callback function within a telemetry context.
 */
export async function runWithContextAsync<T>(context: TelemetryContext, callback: () => Promise<T>): Promise<T> {
  return telemetryContextStore.run(context, callback);
}

/**
 * Get the current telemetry context or fallback to a new one if not running in context.
 */
export function getContext(): TelemetryContext {
  const ctx = telemetryContextStore.getStore();
  if (ctx) return ctx;

  const id = randomUUID();
  return {
    traceId: id,
    correlationId: id,
  };
}

/**
 * Express Middleware to capture or generate correlation and trace IDs.
 * Attaches the context to AsyncLocalStorage for the request lifecycle.
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req.header("X-Correlation-ID") || req.header("x-correlation-id") || randomUUID()) as string;
  const traceId = (req.header("X-Trace-ID") || req.header("x-trace-id") || correlationId) as string;
  const requestId = randomUUID();

  // Attach to response headers so client gets confirmation
  res.setHeader("X-Correlation-ID", correlationId);
  res.setHeader("X-Trace-ID", traceId);

  const context: TelemetryContext = {
    correlationId,
    traceId,
    requestId,
    userId: (req as any).session?.userId || undefined,
    username: (req as any).session?.username || undefined,
  };

  telemetryContextStore.run(context, () => {
    next();
  });
}
