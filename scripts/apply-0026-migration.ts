import 'dotenv/config';
import { db, pool } from "../apps/api/src/core/config/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Applying Migration 0026: expanding courier_audit_logs...");
  try {
    await db.execute(sql`
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
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS courier_audit_logs_record_id_idx ON courier_audit_logs (record_id);
      CREATE INDEX IF NOT EXISTS courier_audit_logs_changed_by_idx ON courier_audit_logs (changed_by);
      CREATE INDEX IF NOT EXISTS courier_audit_logs_changed_at_idx ON courier_audit_logs (changed_at);
      CREATE INDEX IF NOT EXISTS courier_audit_logs_table_record_changed_idx ON courier_audit_logs (table_name, record_id, changed_at);
    `);

    console.log("✅ Migration 0026 applied successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    await pool.end();
  }
}

main();
