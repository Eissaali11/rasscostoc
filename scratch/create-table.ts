import { db } from "../apps/api/src/core/config/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("⏳ Checking/creating core_jobs table...");
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "core_jobs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "type" varchar(50) NOT NULL,
        "status" varchar(20) DEFAULT 'PENDING' NOT NULL,
        "owner_id" varchar NOT NULL,
        "progress" integer DEFAULT 0 NOT NULL,
        "payload" text,
        "result_url" varchar(512),
        "error_message" text,
        "retry_count" integer DEFAULT 0 NOT NULL,
        "max_retries" integer DEFAULT 3 NOT NULL,
        "started_at" timestamp,
        "finished_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "expires_at" timestamp NOT NULL
      );
    `);
    console.log("✅ core_jobs table verified/created!");
    
    // Add new columns to existing table
    const columnsToAlter = [
      { name: "progress_details", type: "text" },
      { name: "result_metadata", type: "text" },
      { name: "next_retry_at", type: "timestamp" },
      { name: "last_error_at", type: "timestamp" },
      { name: "last_heartbeat_at", type: "timestamp" }
    ];

    for (const col of columnsToAlter) {
      try {
        await db.execute(sql.raw(`ALTER TABLE "core_jobs" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type};`));
        console.log(`✅ Column ${col.name} verified/added.`);
      } catch (alterErr) {
        console.log(`ℹ️ Column ${col.name} alter error (might already exist):`, alterErr);
      }
    }

    try {
      await db.execute(sql`
        ALTER TABLE "core_jobs" ADD CONSTRAINT "core_jobs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
      `);
      console.log("✅ Foreign key constraint added!");
    } catch (fkErr) {
      console.log("ℹ️ Foreign key constraint might already exist or wasn't added (this is fine if it already exists).");
    }
  } catch (err) {
    console.error("❌ Error creating table:", err);
  } finally {
    process.exit(0);
  }
}

main();
