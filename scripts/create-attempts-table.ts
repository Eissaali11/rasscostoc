import 'dotenv/config';
import { db, pool } from "../apps/api/src/core/config/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("⏳ Creating table courier_execution_attempts...");
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "courier_execution_attempts" (
        "id" serial PRIMARY KEY NOT NULL,
        "request_id" integer NOT NULL REFERENCES "courier_requests"("id") ON DELETE CASCADE,
        "attempt_number" integer DEFAULT 1 NOT NULL,
        "status" text NOT NULL,
        "failure_reason_code" text REFERENCES "courier_failure_reasons"("code"),
        "notes" text,
        "sn_installed" text,
        "sim_installed" text,
        "gps_latitude" double precision,
        "gps_longitude" double precision,
        "battery_level" integer,
        "network_operator" text,
        "start_time" timestamp,
        "arrival_time" timestamp,
        "end_time" timestamp,
        "evidence_photos" jsonb,
        "customer_signature" text,
        "entered_by" varchar REFERENCES "users"("id"),
        "created_at" timestamp DEFAULT now()
      );
    `);
    console.log("✅ Table courier_execution_attempts created successfully!");
  } catch (error) {
    console.error("❌ Failed to create table:", error);
  } finally {
    await pool.end();
  }
}

main();
