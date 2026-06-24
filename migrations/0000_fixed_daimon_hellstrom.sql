CREATE TABLE "item_types" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"category" text NOT NULL,
	"units_per_box" integer DEFAULT 10 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"icon" text,
	"color" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" varchar NOT NULL,
	"warehouse_id" varchar,
	"n950_boxes" integer DEFAULT 0,
	"n950_units" integer DEFAULT 0,
	"i9000s_boxes" integer DEFAULT 0,
	"i9000s_units" integer DEFAULT 0,
	"i9100_boxes" integer DEFAULT 0,
	"i9100_units" integer DEFAULT 0,
	"roll_paper_boxes" integer DEFAULT 0,
	"roll_paper_units" integer DEFAULT 0,
	"stickers_boxes" integer DEFAULT 0,
	"stickers_units" integer DEFAULT 0,
	"new_batteries_boxes" integer DEFAULT 0,
	"new_batteries_units" integer DEFAULT 0,
	"mobily_sim_boxes" integer DEFAULT 0,
	"mobily_sim_units" integer DEFAULT 0,
	"stc_sim_boxes" integer DEFAULT 0,
	"stc_sim_units" integer DEFAULT 0,
	"zain_sim_boxes" integer DEFAULT 0,
	"zain_sim_units" integer DEFAULT 0,
	"lebara_boxes" integer DEFAULT 0,
	"lebara_units" integer DEFAULT 0,
	"notes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"responded_by" varchar,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supervisor_technicians" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supervisor_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supervisor_warehouses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supervisor_id" varchar NOT NULL,
	"warehouse_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text NOT NULL,
	"profile_image" text,
	"city" text,
	"role" text DEFAULT 'technician' NOT NULL,
	"region_id" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "warehouse_inventory" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"warehouse_id" varchar NOT NULL,
	"n950_boxes" integer DEFAULT 0 NOT NULL,
	"n950_units" integer DEFAULT 0 NOT NULL,
	"i9000s_boxes" integer DEFAULT 0 NOT NULL,
	"i9000s_units" integer DEFAULT 0 NOT NULL,
	"i9100_boxes" integer DEFAULT 0 NOT NULL,
	"i9100_units" integer DEFAULT 0 NOT NULL,
	"roll_paper_boxes" integer DEFAULT 0 NOT NULL,
	"roll_paper_units" integer DEFAULT 0 NOT NULL,
	"stickers_boxes" integer DEFAULT 0 NOT NULL,
	"stickers_units" integer DEFAULT 0 NOT NULL,
	"new_batteries_boxes" integer DEFAULT 0 NOT NULL,
	"new_batteries_units" integer DEFAULT 0 NOT NULL,
	"mobily_sim_boxes" integer DEFAULT 0 NOT NULL,
	"mobily_sim_units" integer DEFAULT 0 NOT NULL,
	"stc_sim_boxes" integer DEFAULT 0 NOT NULL,
	"stc_sim_units" integer DEFAULT 0 NOT NULL,
	"zain_sim_boxes" integer DEFAULT 0 NOT NULL,
	"zain_sim_units" integer DEFAULT 0 NOT NULL,
	"lebara_boxes" integer DEFAULT 0 NOT NULL,
	"lebara_units" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "warehouse_inventory_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"warehouse_id" varchar NOT NULL,
	"item_type_id" varchar NOT NULL,
	"boxes" integer DEFAULT 0 NOT NULL,
	"units" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "warehouse_inventory_entries_warehouse_item_unique" UNIQUE("warehouse_id","item_type_id")
);
--> statement-breakpoint
CREATE TABLE "warehouse_transfers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar,
	"warehouse_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"item_type" text NOT NULL,
	"packaging_type" text NOT NULL,
	"quantity" integer NOT NULL,
	"performed_by" varchar NOT NULL,
	"notes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" varchar NOT NULL,
	"region_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"unit" text NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"min_threshold" integer DEFAULT 5 NOT NULL,
	"technician_name" text,
	"city" text,
	"region_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "received_devices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" varchar NOT NULL,
	"supervisor_id" varchar,
	"item_type_id" varchar,
	"terminal_id" text NOT NULL,
	"serial_number" text NOT NULL,
	"battery" boolean DEFAULT false NOT NULL,
	"charger_cable" boolean DEFAULT false NOT NULL,
	"charger_head" boolean DEFAULT false NOT NULL,
	"has_sim" boolean DEFAULT false NOT NULL,
	"sim_card_type" text,
	"damage_part" text DEFAULT '',
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"approved_by" varchar,
	"approved_at" timestamp,
	"region_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" varchar NOT NULL,
	"item_type" text NOT NULL,
	"packaging_type" text NOT NULL,
	"quantity" integer NOT NULL,
	"from_inventory" text NOT NULL,
	"to_inventory" text NOT NULL,
	"reason" text,
	"performed_by" varchar NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "technician_fixed_inventories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" varchar NOT NULL,
	"n950_boxes" integer DEFAULT 0 NOT NULL,
	"n950_units" integer DEFAULT 0 NOT NULL,
	"i9000s_boxes" integer DEFAULT 0 NOT NULL,
	"i9000s_units" integer DEFAULT 0 NOT NULL,
	"i9100_boxes" integer DEFAULT 0 NOT NULL,
	"i9100_units" integer DEFAULT 0 NOT NULL,
	"roll_paper_boxes" integer DEFAULT 0 NOT NULL,
	"roll_paper_units" integer DEFAULT 0 NOT NULL,
	"stickers_boxes" integer DEFAULT 0 NOT NULL,
	"stickers_units" integer DEFAULT 0 NOT NULL,
	"new_batteries_boxes" integer DEFAULT 0 NOT NULL,
	"new_batteries_units" integer DEFAULT 0 NOT NULL,
	"mobily_sim_boxes" integer DEFAULT 0 NOT NULL,
	"mobily_sim_units" integer DEFAULT 0 NOT NULL,
	"stc_sim_boxes" integer DEFAULT 0 NOT NULL,
	"stc_sim_units" integer DEFAULT 0 NOT NULL,
	"zain_sim_boxes" integer DEFAULT 0 NOT NULL,
	"zain_sim_units" integer DEFAULT 0 NOT NULL,
	"lebara_boxes" integer DEFAULT 0 NOT NULL,
	"lebara_units" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 30 NOT NULL,
	"critical_stock_threshold" integer DEFAULT 70 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "technician_fixed_inventory_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" varchar NOT NULL,
	"item_type_id" varchar NOT NULL,
	"boxes" integer DEFAULT 0 NOT NULL,
	"units" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "technician_moving_inventory_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" varchar NOT NULL,
	"item_type_id" varchar NOT NULL,
	"boxes" integer DEFAULT 0 NOT NULL,
	"units" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "technicians_inventory" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_name" text NOT NULL,
	"city" text NOT NULL,
	"n950_boxes" integer DEFAULT 0 NOT NULL,
	"n950_units" integer DEFAULT 0 NOT NULL,
	"i9000s_boxes" integer DEFAULT 0 NOT NULL,
	"i9000s_units" integer DEFAULT 0 NOT NULL,
	"i9100_boxes" integer DEFAULT 0 NOT NULL,
	"i9100_units" integer DEFAULT 0 NOT NULL,
	"roll_paper_boxes" integer DEFAULT 0 NOT NULL,
	"roll_paper_units" integer DEFAULT 0 NOT NULL,
	"stickers_boxes" integer DEFAULT 0 NOT NULL,
	"stickers_units" integer DEFAULT 0 NOT NULL,
	"new_batteries_boxes" integer DEFAULT 0 NOT NULL,
	"new_batteries_units" integer DEFAULT 0 NOT NULL,
	"mobily_sim_boxes" integer DEFAULT 0 NOT NULL,
	"mobily_sim_units" integer DEFAULT 0 NOT NULL,
	"stc_sim_boxes" integer DEFAULT 0 NOT NULL,
	"stc_sim_units" integer DEFAULT 0 NOT NULL,
	"zain_sim_boxes" integer DEFAULT 0 NOT NULL,
	"zain_sim_units" integer DEFAULT 0 NOT NULL,
	"lebara_boxes" integer DEFAULT 0 NOT NULL,
	"lebara_units" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by" varchar,
	"region_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" varchar NOT NULL,
	"user_id" varchar,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "withdrawn_devices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city" text NOT NULL,
	"technician_name" text NOT NULL,
	"terminal_id" text NOT NULL,
	"serial_number" text NOT NULL,
	"battery" text NOT NULL,
	"charger_cable" text NOT NULL,
	"charger_head" text NOT NULL,
	"has_sim" text NOT NULL,
	"sim_card_type" text,
	"damage_part" text,
	"notes" text,
	"created_by" varchar,
	"region_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chart_of_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text,
	"account_type" text NOT NULL,
	"parent_id" varchar,
	"is_postable" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "chart_of_accounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"vat_number" text,
	"address" text,
	"city" text,
	"credit_limit" double precision DEFAULT 0 NOT NULL,
	"payment_terms_days" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "customers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "einvoice_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" text NOT NULL,
	"source_id" varchar NOT NULL,
	"invoice_uuid" text NOT NULL,
	"invoice_hash" text,
	"previous_hash" text,
	"qr_payload" text,
	"xml_payload" text,
	"signed_xml_payload" text,
	"zatca_status" text DEFAULT 'draft' NOT NULL,
	"clearance_status" text DEFAULT 'pending' NOT NULL,
	"reporting_status" text DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp,
	"acknowledged_at" timestamp,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "einvoice_documents_invoice_uuid_unique" UNIQUE("invoice_uuid")
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_no" text NOT NULL,
	"posting_date" date NOT NULL,
	"source_type" text NOT NULL,
	"source_id" varchar,
	"status" text DEFAULT 'draft' NOT NULL,
	"currency" text DEFAULT 'SAR' NOT NULL,
	"exchange_rate" double precision DEFAULT 1 NOT NULL,
	"created_by" varchar,
	"posted_by" varchar,
	"posted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "journal_entries_entry_no_unique" UNIQUE("entry_no")
);
--> statement-breakpoint
CREATE TABLE "journal_entry_lines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" varchar NOT NULL,
	"account_id" varchar NOT NULL,
	"debit" double precision DEFAULT 0 NOT NULL,
	"credit" double precision DEFAULT 0 NOT NULL,
	"description" text,
	"cost_center" text,
	"region_id" varchar
);
--> statement-breakpoint
CREATE TABLE "number_sequences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"year" integer NOT NULL,
	"prefix" text NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" varchar NOT NULL,
	"document_type" text NOT NULL,
	"document_id" varchar NOT NULL,
	"allocated_amount" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_no" text NOT NULL,
	"party_type" text NOT NULL,
	"party_id" varchar,
	"method" text NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"payment_date" date NOT NULL,
	"reference_no" text,
	"status" text DEFAULT 'posted' NOT NULL,
	"payment_type" text DEFAULT 'receipt' NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "payments_voucher_no_unique" UNIQUE("voucher_no")
);
--> statement-breakpoint
CREATE TABLE "purchase_bill_lines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" varchar NOT NULL,
	"item_type_id" varchar,
	"description" text,
	"qty" double precision DEFAULT 0 NOT NULL,
	"unit_cost" double precision DEFAULT 0 NOT NULL,
	"discount" double precision DEFAULT 0 NOT NULL,
	"tax_code_id" varchar,
	"line_total" double precision DEFAULT 0 NOT NULL,
	"warehouse_id" varchar
);
--> statement-breakpoint
CREATE TABLE "purchase_bills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_no" text NOT NULL,
	"supplier_id" varchar,
	"issue_date" date NOT NULL,
	"due_date" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"subtotal" double precision DEFAULT 0 NOT NULL,
	"discount_total" double precision DEFAULT 0 NOT NULL,
	"taxable_amount" double precision DEFAULT 0 NOT NULL,
	"vat_total" double precision DEFAULT 0 NOT NULL,
	"grand_total" double precision DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'SAR' NOT NULL,
	"posted_at" timestamp,
	"posted_by" varchar,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "purchase_bills_bill_no_unique" UNIQUE("bill_no")
);
--> statement-breakpoint
CREATE TABLE "sales_invoice_lines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"item_type_id" varchar,
	"description" text,
	"qty" double precision DEFAULT 0 NOT NULL,
	"unit_price" double precision DEFAULT 0 NOT NULL,
	"discount" double precision DEFAULT 0 NOT NULL,
	"tax_code_id" varchar,
	"line_total" double precision DEFAULT 0 NOT NULL,
	"warehouse_id" varchar,
	"technician_id" varchar,
	"source_inventory_type" text,
	"qty_before_sale" double precision,
	"qty_after_sale" double precision
);
--> statement-breakpoint
CREATE TABLE "sales_invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_no" text NOT NULL,
	"invoice_type" text DEFAULT 'standard' NOT NULL,
	"customer_id" varchar,
	"issue_datetime" timestamp DEFAULT now() NOT NULL,
	"due_date" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"subtotal" double precision DEFAULT 0 NOT NULL,
	"discount_total" double precision DEFAULT 0 NOT NULL,
	"taxable_amount" double precision DEFAULT 0 NOT NULL,
	"vat_total" double precision DEFAULT 0 NOT NULL,
	"grand_total" double precision DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'SAR' NOT NULL,
	"notes" text,
	"posted_at" timestamp,
	"posted_by" varchar,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "sales_invoices_invoice_no_unique" UNIQUE("invoice_no")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"vat_number" text,
	"address" text,
	"city" text,
	"payment_terms_days" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "suppliers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "tax_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"rate" double precision DEFAULT 0 NOT NULL,
	"category" text DEFAULT 'vat' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tax_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "tax_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" text NOT NULL,
	"source_id" varchar NOT NULL,
	"tax_code_id" varchar,
	"taxable_amount" double precision DEFAULT 0 NOT NULL,
	"tax_amount" double precision DEFAULT 0 NOT NULL,
	"direction" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "technician_sales_metrics_daily" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_date" date NOT NULL,
	"technician_id" varchar NOT NULL,
	"item_type_id" varchar,
	"region_id" varchar,
	"sold_qty" double precision DEFAULT 0 NOT NULL,
	"sold_amount" double precision DEFAULT 0 NOT NULL,
	"remaining_qty_end_of_day" double precision DEFAULT 0 NOT NULL,
	"invoices_count" integer DEFAULT 0 NOT NULL,
	"returns_qty" double precision DEFAULT 0 NOT NULL,
	"avg_selling_price" double precision DEFAULT 0 NOT NULL,
	"last_sale_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"user_name" text NOT NULL,
	"user_role" text NOT NULL,
	"region_id" varchar,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar,
	"entity_name" text,
	"details" text,
	"description" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"success" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "inventory_requests" ADD CONSTRAINT "inventory_requests_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_requests" ADD CONSTRAINT "inventory_requests_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_requests" ADD CONSTRAINT "inventory_requests_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_technicians" ADD CONSTRAINT "supervisor_technicians_supervisor_id_users_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_technicians" ADD CONSTRAINT "supervisor_technicians_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_warehouses" ADD CONSTRAINT "supervisor_warehouses_supervisor_id_users_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supervisor_warehouses" ADD CONSTRAINT "supervisor_warehouses_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_inventory" ADD CONSTRAINT "warehouse_inventory_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_inventory_entries" ADD CONSTRAINT "warehouse_inventory_entries_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_inventory_entries" ADD CONSTRAINT "warehouse_inventory_entries_item_type_id_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_request_id_inventory_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."inventory_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_devices" ADD CONSTRAINT "received_devices_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_devices" ADD CONSTRAINT "received_devices_supervisor_id_users_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_devices" ADD CONSTRAINT "received_devices_item_type_id_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_devices" ADD CONSTRAINT "received_devices_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_devices" ADD CONSTRAINT "received_devices_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_fixed_inventories" ADD CONSTRAINT "technician_fixed_inventories_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_fixed_inventory_entries" ADD CONSTRAINT "technician_fixed_inventory_entries_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_fixed_inventory_entries" ADD CONSTRAINT "technician_fixed_inventory_entries_item_type_id_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_moving_inventory_entries" ADD CONSTRAINT "technician_moving_inventory_entries_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_moving_inventory_entries" ADD CONSTRAINT "technician_moving_inventory_entries_item_type_id_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technicians_inventory" ADD CONSTRAINT "technicians_inventory_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technicians_inventory" ADD CONSTRAINT "technicians_inventory_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawn_devices" ADD CONSTRAINT "withdrawn_devices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawn_devices" ADD CONSTRAINT "withdrawn_devices_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bill_lines" ADD CONSTRAINT "purchase_bill_lines_bill_id_purchase_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."purchase_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bill_lines" ADD CONSTRAINT "purchase_bill_lines_item_type_id_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_invoice_id_sales_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."sales_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_item_type_id_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_transactions" ADD CONSTRAINT "tax_transactions_tax_code_id_tax_codes_id_fk" FOREIGN KEY ("tax_code_id") REFERENCES "public"."tax_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_sales_metrics_daily" ADD CONSTRAINT "technician_sales_metrics_daily_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_sales_metrics_daily" ADD CONSTRAINT "technician_sales_metrics_daily_item_type_id_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_sales_metrics_daily" ADD CONSTRAINT "technician_sales_metrics_daily_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "item_types_name_ar_unique" ON "item_types" USING btree ("name_ar");--> statement-breakpoint
CREATE UNIQUE INDEX "item_types_name_en_unique" ON "item_types" USING btree ("name_en");