CREATE TABLE "bearer_sessions" (
	"token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"username" varchar(255) NOT NULL,
	"region_id" varchar(255),
	"expiry" bigint NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_name" varchar(200) NOT NULL,
	"event_version" integer DEFAULT 1 NOT NULL,
	"payload" jsonb NOT NULL,
	"correlation_id" uuid NOT NULL,
	"causation_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"last_error" text,
	"locked_by" varchar(100),
	"locked_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "bearer_sessions" ADD CONSTRAINT "bearer_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;