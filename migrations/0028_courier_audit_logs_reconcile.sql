-- Reconcile courier_audit_logs schema drift: the repository/service code has
-- referenced actor-snapshot, categorization, and metadata columns on this
-- table since the module was extended, but no migration ever added them
-- (Phase 2 database governance finding). Idempotent with IF NOT EXISTS so
-- this is safe to run against environments that may have partially patched
-- this table by hand already.
ALTER TABLE "courier_audit_logs" ADD COLUMN IF NOT EXISTS "actor_name_snapshot" text;
ALTER TABLE "courier_audit_logs" ADD COLUMN IF NOT EXISTS "actor_role_snapshot" text;
ALTER TABLE "courier_audit_logs" ADD COLUMN IF NOT EXISTS "actor_avatar_url" text;
ALTER TABLE "courier_audit_logs" ADD COLUMN IF NOT EXISTS "action_type" text NOT NULL DEFAULT 'UPDATE';
ALTER TABLE "courier_audit_logs" ADD COLUMN IF NOT EXISTS "action_description" text;
ALTER TABLE "courier_audit_logs" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'DASHBOARD';
ALTER TABLE "courier_audit_logs" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'SUCCESS';
ALTER TABLE "courier_audit_logs" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
ALTER TABLE "courier_audit_logs" ADD COLUMN IF NOT EXISTS "ip_address" text;
ALTER TABLE "courier_audit_logs" ADD COLUMN IF NOT EXISTS "device_id" text;
