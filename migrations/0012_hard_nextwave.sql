ALTER TABLE "courier_executions" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "courier_requests" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;