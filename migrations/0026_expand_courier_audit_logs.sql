-- Migration 0026: Expand courier_audit_logs for comprehensive audit trail tracking
-- Backwards compatible: All added columns are NULLABLE or have safe DEFAULT values.

ALTER TABLE courier_audit_logs
  ADD COLUMN IF NOT EXISTS actor_name_snapshot text,
  ADD COLUMN IF NOT EXISTS actor_role_snapshot text,
  ADD COLUMN IF NOT EXISTS actor_avatar_url text,
  ADD COLUMN IF NOT EXISTS action_type text,
  ADD COLUMN IF NOT EXISTS action_description text,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'DASHBOARD',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'SUCCESS',
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS device_id text;

-- Indexes for high-performance audit querying
CREATE INDEX IF NOT EXISTS courier_audit_logs_record_id_idx ON courier_audit_logs (record_id);
CREATE INDEX IF NOT EXISTS courier_audit_logs_changed_by_idx ON courier_audit_logs (changed_by);
CREATE INDEX IF NOT EXISTS courier_audit_logs_changed_at_idx ON courier_audit_logs (changed_at);
CREATE INDEX IF NOT EXISTS courier_audit_logs_table_record_changed_idx ON courier_audit_logs (table_name, record_id, changed_at);
