-- Active-account authentication remediation. Adds the credential-generation
-- columns that make deactivation permanently invalidate every generation-bound
-- credential issued before it (JWT, refresh token, Express session), and
-- separates any account already inactive at migration time from the shared
-- legacy generation-0 default so a later reactivation cannot revive its
-- pre-existing credential lineage.
--
-- ============================================================
-- LOCK / OPERATIONAL BEHAVIOR — PostgreSQL 16:
-- ============================================================
--
-- Both ADD COLUMN statements use a constant literal DEFAULT (0):
--   - Do NOT rewrite existing table rows (PostgreSQL 11+ fast-default path
--     for a constant, non-volatile default value).
--   - DO still acquire ACCESS EXCLUSIVE on their respective table for the
--     duration of the statement — a separate fact from "no rewrite" and
--     must not be conflated with it. ACCESS EXCLUSIVE blocks ALL concurrent
--     access (reads and writes) to that table while held.
--   - StockPro's Drizzle migration runner wraps every pending migration file
--     in ONE transaction, so each lock is held until that entire wrapping
--     transaction commits — not merely until its own statement finishes.
--
-- Existing rows read back as auth_generation = 0 for both tables — this is
-- the intentional pre-migration compatibility value: an account that has
-- never been deactivated remains at generation 0, and any credential issued
-- before this migration (which carries no generation claim at all) is
-- treated as generation 0 by the application layer for comparison purposes.
--
-- Explicitly NOT included in this migration:
--   - Any index on either new column (neither is used as a lookup predicate;
--     both are read alongside a primary-key/unique lookup that is already
--     indexed).
--   - Any change to bearer_sessions, the Express session table, or any TTL/
--     expiry configuration.
--
-- Manual rollback statements (below) are only safe to run before any
-- downstream application code depends on this column's presence; like the
-- forward statements above, the DROP operations also acquire DDL locks
-- subject to the same StockPro-migrator transaction-lifetime behavior
-- described above:
--   ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "auth_generation";
--   ALTER TABLE "users" DROP COLUMN IF EXISTS "auth_generation";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_generation" integer NOT NULL DEFAULT 0;

ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "auth_generation" integer NOT NULL DEFAULT 0;

-- Credentials created before generation metadata existed are treated as
-- generation 0 by compatibility logic. Accounts already inactive during the
-- migration must be moved to a distinct generation before a future
-- reactivation, while currently active accounts retain generation 0 for
-- compatibility. Idempotent: a row already moved off 0 is excluded by this
-- WHERE clause on replay.
UPDATE "users" SET "auth_generation" = 1 WHERE "is_active" = false AND "auth_generation" = 0;

-- Bearer-session credentials carry no generation binding, so changing the
-- user's authentication generation cannot invalidate them. Remove bearer
-- sessions belonging to accounts already inactive at migration time so a
-- later reactivation cannot restore authority to those historical sessions.
DELETE FROM "bearer_sessions" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "is_active" = false);
