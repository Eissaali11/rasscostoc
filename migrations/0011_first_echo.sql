CREATE TABLE "idempotency_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"event_id" uuid NOT NULL,
	"subscriber_name" varchar(100) NOT NULL,
	"status" varchar(20) NOT NULL,
	"response_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "idempotency_records_idempotency_key_unique" UNIQUE("idempotency_key")
);
