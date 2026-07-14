-- ERP-001 Package A: Courier list/filter/search indexes
CREATE INDEX IF NOT EXISTS "courier_requests_tid_idx" ON "courier_requests" ("tid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_requests_terminal_id_idx" ON "courier_requests" ("terminal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_requests_incident_number_idx" ON "courier_requests" ("incident_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_requests_mobile_idx" ON "courier_requests" ("mobile");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_requests_date_idx" ON "courier_requests" ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_requests_city_idx" ON "courier_requests" ("city");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_requests_customer_name_idx" ON "courier_requests" ("customer_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_requests_vendor_type_idx" ON "courier_requests" ("vendor_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_executions_sn_idx" ON "courier_executions" ("sn");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_executions_sim_serial_idx" ON "courier_executions" ("sim_serial");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_executions_installation_status_idx" ON "courier_executions" ("installation_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_executions_sales_technician_idx" ON "courier_executions" ("sales_technician");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_executions_response_reason_idx" ON "courier_executions" ("response_reason_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_executions_sim_type_idx" ON "courier_executions" ("sim_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_executions_priority_idx" ON "courier_executions" ("request_priority_level");
