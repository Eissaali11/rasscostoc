-- ERP-008 migration integrity:
-- 1) Courier btree indexes previously listed here duplicated
--    0018_erp001_courier_perf_indexes.sql (same names/columns/non-unique btree)
--    and were removed so greenfield migrate does not fail with
--    "relation already exists".
-- 2) core_jobs CREATE TABLE aligned to packages/shared-types/schemas/system.schema.ts
--    (progress_details, result_metadata, retry/heartbeat columns were missing
--    from the original drizzle-generated DDL while already declared in schema).
CREATE TABLE "core_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"owner_id" varchar NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"progress_details" text,
	"payload" text,
	"result_url" varchar(512),
	"result_metadata" text,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"next_retry_at" timestamp,
	"last_error_at" timestamp,
	"last_heartbeat_at" timestamp,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_jobs" ADD CONSTRAINT "core_jobs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
