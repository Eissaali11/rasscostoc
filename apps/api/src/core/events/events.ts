/**
 * Core Platform Events
 */

import { randomUUID } from "crypto";
import type { IEvent } from "./event.types";
import { getContext } from "../telemetry/telemetry";

/**
 * Base class for all domain events to enforce metadata consistency, versioning,
 * and distributed tracing (correlationId and causationId).
 */
export abstract class BaseDomainEvent<TPayload = any> implements IEvent<TPayload> {
  readonly id: string = randomUUID();
  readonly occurredAt: Date = new Date();
  readonly timestamp: Date = this.occurredAt;
  
  abstract readonly name: string;
  abstract readonly version: number;
  
  readonly correlationId: string;
  readonly causationId: string;

  constructor(
    readonly payload: TPayload,
    meta?: { correlationId?: string; causationId?: string }
  ) {
    const context = getContext();
    this.correlationId = meta?.correlationId || context.correlationId || this.id;
    this.causationId = meta?.causationId || context.spanId || this.id;
  }
}

export class ExecutionSavedEvent extends BaseDomainEvent<{
  requestId: number;
  actorId: string;
  execution: any;
  request: any;
}> {
  readonly name = "ExecutionSavedEvent";
  readonly version = 1;
}

export class ExecutionCompletedEvent extends BaseDomainEvent<{
  requestId: number;
  actorId: string;
  execution: any;
  request: any;
}> {
  readonly name = "ExecutionCompletedEvent";
  readonly version = 1;
}

/**
 * OPS-REMED-E4-P2: discriminated payload. `final` absent/false means an
 * ordinary per-attempt failure (retryable, InventorySubscriber's own
 * catch); `final: true` means the DEAD-letter, terminal-failure signal
 * (OutboxWorker's DEAD block), and REQUIRES `sourceEventId` — the causal
 * id of the original ExecutionCompletedEvent (== its own outbox row id),
 * used both for the correctable FAILED_FINAL transition's evidence check
 * and for the (source_event_id, operation_kind) audit-dedup key.
 * Historical/pre-P2 payloads (neither field present) satisfy the
 * AttemptFailure shape and are safely treated as non-terminal.
 */
export type InventoryDeductionFailedPayload =
  | {
      requestId: number;
      actorId: string;
      technicianCode: string;
      errors: string[];
      final?: false;
    }
  | {
      requestId: number;
      actorId: string;
      technicianCode: string;
      errors: string[];
      final: true;
      sourceEventId: string;
    };

export class InventoryDeductionFailedEvent extends BaseDomainEvent<InventoryDeductionFailedPayload> {
  readonly name = "InventoryDeductionFailedEvent";
  readonly version = 1;
}
