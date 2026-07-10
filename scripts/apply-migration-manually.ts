import 'dotenv/config';
import { db, pool } from "../apps/api/src/core/config/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Applying columns to item_types...");
  try {
    await db.execute(sql`ALTER TABLE "item_types" ADD COLUMN IF NOT EXISTS "serial_prefix" text;`);
    await db.execute(sql`ALTER TABLE "item_types" ADD COLUMN IF NOT EXISTS "serial_length" integer;`);
    await db.execute(sql`ALTER TABLE "item_types" ADD COLUMN IF NOT EXISTS "serial_regex" text;`);
    await db.execute(sql`ALTER TABLE "item_types" ADD COLUMN IF NOT EXISTS "requires_serial" boolean DEFAULT false NOT NULL;`);
    console.log("Columns applied successfully!");
  } catch (err) {
    console.error("Failed:", err);
  } finally {
    await pool.end();
  }
}

main();
