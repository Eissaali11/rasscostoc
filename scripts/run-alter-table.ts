import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db, pool } from '../apps/api/src/core/config/db';

async function run() {
  console.log("⏳ Running alter table query...");
  try {
    await db.execute(sql`ALTER TABLE "warehouse_transfers" ADD COLUMN IF NOT EXISTS "transfer_type" text DEFAULT 'WAREHOUSE_TRANSFER' NOT NULL;`);
    console.log("✅ Alter table query executed successfully!");
  } catch (error) {
    console.error("❌ Execution failed:", error);
  } finally {
    await pool.end();
  }
}

run();
