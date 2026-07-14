-- ERP-001 Sprint 1.5: pattern_ops indexes so LIKE 'prefix%' can use Index Scan
CREATE INDEX IF NOT EXISTS "courier_requests_tid_pattern_idx" ON "courier_requests" ("tid" text_pattern_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_requests_terminal_id_pattern_idx" ON "courier_requests" ("terminal_id" text_pattern_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_requests_incident_pattern_idx" ON "courier_requests" ("incident_number" text_pattern_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_requests_mobile_pattern_idx" ON "courier_requests" ("mobile" text_pattern_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_requests_customer_name_pattern_idx" ON "courier_requests" ("customer_name" text_pattern_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_executions_sn_pattern_idx" ON "courier_executions" ("sn" text_pattern_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_executions_sim_serial_pattern_idx" ON "courier_executions" ("sim_serial" text_pattern_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courier_executions_sales_tech_pattern_idx" ON "courier_executions" ("sales_technician" text_pattern_ops);
