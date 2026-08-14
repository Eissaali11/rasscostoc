-- OPS-REMED-E4-P2 — atomic dedup for the courier-saga.subscriber.ts
-- final-transition operation (dedup + evidence-check + guarded CAS +
-- mandatory audit, all one transaction). Composite primary key by
-- (source_event_id, operation_kind), not source_event_id alone, so a
-- FINAL_FAILURE record for a given event never collides with a later
-- SUCCESS_PROJECTION correction for the same event.
CREATE TABLE IF NOT EXISTS "courier_execution_audit_dedup" (
  "source_event_id" varchar NOT NULL,
  "operation_kind" text NOT NULL,
  "event_name" varchar NOT NULL,
  "processed_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "courier_execution_audit_dedup_pk" PRIMARY KEY ("source_event_id", "operation_kind")
);
