-- OPS-REMED-E4-P2 — durable Inventory-owned deduction-completion evidence,
-- doubling as the projection-obligation record for CourierProjectionWorker.
-- Written as the last statement inside InventoryEngine.deduct()'s own
-- transaction — see inventory.engine.ts. Not read or written by any P1
-- code; purely additive, no other table touched.
CREATE TABLE IF NOT EXISTS "inventory_deduction_completions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "request_id" integer NOT NULL,
  "source_event_id" varchar NOT NULL,
  "general_inventory_deducted" boolean NOT NULL,
  "serialized_item_count" integer NOT NULL,
  "completed_at" timestamp NOT NULL DEFAULT now(),
  "result_version" integer NOT NULL DEFAULT 1,
  "projection_status" text NOT NULL DEFAULT 'PENDING',
  "projection_attempt_count" integer NOT NULL DEFAULT 0,
  "projection_next_attempt_at" timestamp NOT NULL DEFAULT now(),
  "projection_lease_owner" varchar,
  "projection_lease_token" varchar,
  "projection_lease_expires_at" timestamp,
  "projection_last_error" text,
  "projected_at" timestamp,
  CONSTRAINT "inventory_deduction_completions_request_id_unique" UNIQUE ("request_id"),
  CONSTRAINT "inventory_deduction_completions_source_event_id_unique" UNIQUE ("source_event_id")
);

CREATE INDEX IF NOT EXISTS "inv_ded_compl_due_idx"
  ON "inventory_deduction_completions" ("projection_next_attempt_at")
  WHERE "projection_status" IN ('PENDING','FAILED_RETRYABLE');

CREATE INDEX IF NOT EXISTS "inv_ded_compl_expired_claim_idx"
  ON "inventory_deduction_completions" ("projection_lease_expires_at")
  WHERE "projection_status" = 'CLAIMED';
