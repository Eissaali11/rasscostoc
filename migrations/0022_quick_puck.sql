ALTER TABLE "core_jobs" ADD COLUMN "progress_details" text;--> statement-breakpoint
ALTER TABLE "core_jobs" ADD COLUMN "result_metadata" text;--> statement-breakpoint
ALTER TABLE "core_jobs" ADD COLUMN "next_retry_at" timestamp;--> statement-breakpoint
ALTER TABLE "core_jobs" ADD COLUMN "last_error_at" timestamp;--> statement-breakpoint
ALTER TABLE "core_jobs" ADD COLUMN "last_heartbeat_at" timestamp;