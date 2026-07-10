CREATE TABLE "courier_execution_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"status" text NOT NULL,
	"failure_reason_code" text,
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
	"entered_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "courier_request_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"item_type" text NOT NULL,
	"inventory_item_id" integer,
	"serial_number" text,
	"sim_serial" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'PENDING_RECEIPT' NOT NULL,
	"scanned_at" timestamp,
	"received_at" timestamp,
	"installed_at" timestamp,
	"delivered_at" timestamp,
	"technician_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "courier_execution_attempts" ADD CONSTRAINT "courier_execution_attempts_request_id_courier_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."courier_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_execution_attempts" ADD CONSTRAINT "courier_execution_attempts_failure_reason_code_courier_failure_reasons_code_fk" FOREIGN KEY ("failure_reason_code") REFERENCES "public"."courier_failure_reasons"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_execution_attempts" ADD CONSTRAINT "courier_execution_attempts_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_request_items" ADD CONSTRAINT "courier_request_items_request_id_courier_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."courier_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_request_items" ADD CONSTRAINT "courier_request_items_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;