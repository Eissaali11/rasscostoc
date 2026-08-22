-- OPS-PERM-S0-B1-A.I1 — additive canonical courier-request regional
-- ownership foundation, file 1 of 2.
--
-- Adds a nullable region_id column to courier_executions' parent table
-- (courier_requests), plus its FK (added NOT VALID: metadata-only, near-
-- instant, does not scan or lock existing rows) and one evidence-backed
-- index. This is purely additive storage; no application code writes to
-- this column yet, and no existing row is touched.
--
-- This column represents canonical operational regional OWNERSHIP —
-- explicitly NOT derived from createdBy (creator), execution.enteredBy
-- (mutable/reassignable executor), or the free-text city/cityTec fields.
-- See OPS-PERM-S0-B1.D1 for the full evidence trail on why none of those
-- qualify as a stable security-ownership boundary.
--
-- Legacy rows intentionally remain NULL after this migration (and after
-- 0056) — no backfill, no guess, no default derived from any actor. Per
-- the frozen owner contract (OPS-PERM-S0-B1.D1/adjudication): a
-- NULL-owner row must never become visible to a Regional Supervisor,
-- while Admin retains full operational visibility for reconciliation.
-- Enforcing that visibility rule is authorization-layer work for a later
-- S0-B slice — this migration only creates the storage location.
--
-- Delete behavior is NO ACTION (Postgres default when ON DELETE is omitted).
-- A referenced region cannot be deleted while courier_requests rows still
-- reference it. No CASCADE and no SET NULL are used: regional ownership must
-- not disappear silently.
--
-- Index: (region_id, id DESC) — the dominant future query shape is a
-- region-scoped request list ordered by request id descending (matching
-- listRequests'/exportExcel's own existing ORDER BY desc(courierRequests.id)
-- pattern, confirmed in OPS-PERM-S0-B1.D1 §12). No other regional index
-- is added here — no evidence-backed need for region+status/date/city/
-- technician composites at this stage.
--
-- Rollback (safe at any point before 0056 validates):
--   DROP INDEX IF EXISTS "courier_requests_region_id_idx";
--   ALTER TABLE "courier_requests"
--     DROP CONSTRAINT IF EXISTS "courier_requests_region_id_regions_id_fk";
--   ALTER TABLE "courier_requests" DROP COLUMN IF EXISTS "region_id";
ALTER TABLE "courier_requests" ADD COLUMN IF NOT EXISTS "region_id" varchar;

ALTER TABLE "courier_requests"
  ADD CONSTRAINT "courier_requests_region_id_regions_id_fk"
  FOREIGN KEY ("region_id") REFERENCES "regions"("id") NOT VALID;

CREATE INDEX IF NOT EXISTS "courier_requests_region_id_idx"
  ON "courier_requests" ("region_id", "id" DESC);
