-- OPS-PERM-S1-F4 — Permission Engine storage foundation.
--
-- Two new, additive tables only:
--   employee_permission_overrides — per-employee assigned page/action grants and revokes.
--   permission_change_audit       — append-only history of every write to the above.
--
-- Neither duplicates an existing relationship: region scope reads the existing
-- users.region_id, warehouse scope reads the existing supervisor_warehouses
-- table. Nothing here touches users.permissions (legacy, retired by OPS-PERM-
-- S1-F2) or any existing table.
--
-- ============================================================
-- LOCK / OPERATIONAL BEHAVIOR — PostgreSQL 16:
-- ============================================================
-- Both are CREATE TABLE — each acquires no lock on any existing table; only
-- the new table itself is locked for the (near-instant) duration of its own
-- creation. Existing traffic on users/regions/warehouses is unaffected.
--
-- Rollback (safe at any point before application code depends on these
-- tables — neither statement below touches any other table):
--   DROP TABLE IF EXISTS "permission_change_audit";
--   DROP TABLE IF EXISTS "employee_permission_overrides";

CREATE TABLE IF NOT EXISTS "employee_permission_overrides" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "page" text NOT NULL,
  "action" text NOT NULL,
  "value" text NOT NULL,
  "granted_by" varchar NOT NULL REFERENCES "users"("id"),
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "employee_permission_overrides_user_page_action_key" UNIQUE ("user_id", "page", "action")
);

-- Every effective-permission lookup starts from "give me this user's overrides" — index the
-- lookup path, not just the uniqueness constraint (Postgres does back the unique constraint with
-- an index, but leading only on user_id would still require this if the constraint were ever
-- relaxed; declaring it explicitly makes the intent independent of that implementation detail).
CREATE INDEX IF NOT EXISTS "employee_permission_overrides_user_id_idx"
  ON "employee_permission_overrides" ("user_id");

CREATE TABLE IF NOT EXISTS "permission_change_audit" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "changed_by" varchar NOT NULL REFERENCES "users"("id"),
  "target_user_id" varchar NOT NULL REFERENCES "users"("id"),
  "page" text NOT NULL,
  "action" text NOT NULL,
  "old_value" text,
  "new_value" text,
  "reason" text,
  "changed_at" timestamp DEFAULT now()
);

-- History is always read scoped to one employee, newest first.
CREATE INDEX IF NOT EXISTS "permission_change_audit_target_user_id_changed_at_idx"
  ON "permission_change_audit" ("target_user_id", "changed_at" DESC);
