-- ERP-008 Phase 4: shared rate-limit counter store.
-- The per-IP request counter previously lived only in an in-memory Map
-- (apps/api/src/core/middlewares/security.middleware.ts), so under
-- multi-process/PM2-cluster operation each process enforced its own
-- independent limit -- a client could bypass the aggregate limit simply by
-- landing on a different process. This table gives every process a single
-- shared counter per key, updated atomically via one INSERT ... ON CONFLICT
-- statement (see incrementRateLimitCounter in security.middleware.ts).
-- Rollback:
--   DROP TABLE "rate_limit_counters";
CREATE TABLE IF NOT EXISTS "rate_limit_counters" (
  "key" varchar PRIMARY KEY,
  "count" integer NOT NULL DEFAULT 0,
  "reset_at" timestamp NOT NULL
);
