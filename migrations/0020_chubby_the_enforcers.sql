CREATE TABLE "core_jobs" (
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
--> statement-breakpoint
ALTER TABLE "core_jobs" ADD CONSTRAINT "core_jobs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "courier_executions_sn_idx" ON "courier_executions" USING btree ("sn");--> statement-breakpoint
CREATE INDEX "courier_executions_sim_serial_idx" ON "courier_executions" USING btree ("sim_serial");--> statement-breakpoint
CREATE INDEX "courier_executions_installation_status_idx" ON "courier_executions" USING btree ("installation_status");--> statement-breakpoint
CREATE INDEX "courier_executions_sales_technician_idx" ON "courier_executions" USING btree ("sales_technician");--> statement-breakpoint
CREATE INDEX "courier_executions_response_reason_idx" ON "courier_executions" USING btree ("response_reason_code");--> statement-breakpoint
CREATE INDEX "courier_executions_sim_type_idx" ON "courier_executions" USING btree ("sim_type");--> statement-breakpoint
CREATE INDEX "courier_executions_priority_idx" ON "courier_executions" USING btree ("request_priority_level");--> statement-breakpoint
CREATE INDEX "courier_requests_tid_idx" ON "courier_requests" USING btree ("tid");--> statement-breakpoint
CREATE INDEX "courier_requests_terminal_id_idx" ON "courier_requests" USING btree ("terminal_id");--> statement-breakpoint
CREATE INDEX "courier_requests_incident_number_idx" ON "courier_requests" USING btree ("incident_number");--> statement-breakpoint
CREATE INDEX "courier_requests_mobile_idx" ON "courier_requests" USING btree ("mobile");--> statement-breakpoint
CREATE INDEX "courier_requests_date_idx" ON "courier_requests" USING btree ("date");--> statement-breakpoint
CREATE INDEX "courier_requests_city_idx" ON "courier_requests" USING btree ("city");--> statement-breakpoint
CREATE INDEX "courier_requests_customer_name_idx" ON "courier_requests" USING btree ("customer_name");--> statement-breakpoint
CREATE INDEX "courier_requests_vendor_type_idx" ON "courier_requests" USING btree ("vendor_type");