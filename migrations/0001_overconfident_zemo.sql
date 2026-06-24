CREATE TABLE "idempotency_keys" (
	"key" varchar PRIMARY KEY NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL
);
