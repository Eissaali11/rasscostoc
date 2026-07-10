CREATE TABLE "courier_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"table_name" text NOT NULL,
	"record_id" integer NOT NULL,
	"field_name" text,
	"old_value" text,
	"new_value" text,
	"action" text NOT NULL,
	"changed_by" varchar,
	"changed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "courier_cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text
);
--> statement-breakpoint
CREATE TABLE "courier_executions" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"request_priority_level" text,
	"push_back" text,
	"installation_status" text,
	"paper_roll" text,
	"time" text,
	"delivery_date" text,
	"response_date" text,
	"sn" text,
	"sim_serial" text,
	"sim_type" text,
	"customer_notes" text,
	"extra_field_1" text,
	"extra_field_2" text,
	"response_reason_code" text,
	"sales_technician" text,
	"technician_code" text,
	"extraction_confidence" text,
	"entered_by" varchar,
	"entered_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "courier_executions_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "courier_failure_reasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"label_en" text NOT NULL,
	"label_ar" text NOT NULL,
	"suggested_note_en" text,
	"suggested_note_ar" text,
	"requires_field" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "courier_failure_reasons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "courier_pdf_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"uploaded_by" varchar,
	"uploaded_at" timestamp DEFAULT now(),
	"ocr_text" text,
	"extracted_json" text,
	"overall_confidence" real,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courier_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text,
	"installation_type" text,
	"sim" text,
	"tid" text,
	"otp" text,
	"ticketing_holouly" text,
	"incident_number" text,
	"pin_code" text,
	"trsm" text,
	"terminal_id" text,
	"sim_sn" text,
	"id_data" text,
	"vendor_type" text,
	"city" text,
	"city_tec" text,
	"customer_name" text,
	"retailer_name" text,
	"address_ar" text,
	"address_en" text,
	"mobile" text,
	"mobile2" text,
	"tec_name" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "courier_sim_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "courier_sim_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "courier_vendor_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "courier_vendor_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "courier_audit_logs" ADD CONSTRAINT "courier_audit_logs_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_executions" ADD CONSTRAINT "courier_executions_request_id_courier_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."courier_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_executions" ADD CONSTRAINT "courier_executions_response_reason_code_courier_failure_reasons_code_fk" FOREIGN KEY ("response_reason_code") REFERENCES "public"."courier_failure_reasons"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_executions" ADD CONSTRAINT "courier_executions_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_pdf_reports" ADD CONSTRAINT "courier_pdf_reports_request_id_courier_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."courier_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_pdf_reports" ADD CONSTRAINT "courier_pdf_reports_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_requests" ADD CONSTRAINT "courier_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;