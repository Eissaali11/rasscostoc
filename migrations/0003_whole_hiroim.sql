CREATE TABLE "product_transfers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_warehouse_id" varchar,
	"destination_warehouse_id" varchar,
	"source_representative_id" varchar,
	"destination_representative_id" varchar,
	"responsible_representative_id" varchar,
	"affected_account" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_code" text NOT NULL,
	"barcode" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"default_price" double precision DEFAULT 0 NOT NULL,
	"default_tax_rate" double precision DEFAULT 15 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "products_product_code_unique" UNIQUE("product_code"),
	CONSTRAINT "products_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "sales_order_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"unit_price" double precision NOT NULL,
	"line_tax_amount" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"representative_id" varchar NOT NULL,
	"order_no" text NOT NULL,
	"amount_before_tax" double precision DEFAULT 0 NOT NULL,
	"tax_amount" double precision DEFAULT 0 NOT NULL,
	"total_amount" double precision DEFAULT 0 NOT NULL,
	"idempotency_key" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "sales_orders_order_no_unique" UNIQUE("order_no"),
	CONSTRAINT "sales_orders_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "technician_product_stock" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "product_transfers" ADD CONSTRAINT "product_transfers_source_warehouse_id_warehouses_id_fk" FOREIGN KEY ("source_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_transfers" ADD CONSTRAINT "product_transfers_destination_warehouse_id_warehouses_id_fk" FOREIGN KEY ("destination_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_transfers" ADD CONSTRAINT "product_transfers_source_representative_id_users_id_fk" FOREIGN KEY ("source_representative_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_transfers" ADD CONSTRAINT "product_transfers_destination_representative_id_users_id_fk" FOREIGN KEY ("destination_representative_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_transfers" ADD CONSTRAINT "product_transfers_responsible_representative_id_users_id_fk" FOREIGN KEY ("responsible_representative_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_order_id_sales_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_representative_id_users_id_fk" FOREIGN KEY ("representative_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_product_stock" ADD CONSTRAINT "technician_product_stock_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_product_stock" ADD CONSTRAINT "technician_product_stock_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transfers_source_wh_idx" ON "product_transfers" USING btree ("source_warehouse_id");--> statement-breakpoint
CREATE INDEX "transfers_dest_wh_idx" ON "product_transfers" USING btree ("destination_warehouse_id");--> statement-breakpoint
CREATE INDEX "transfers_source_rep_idx" ON "product_transfers" USING btree ("source_representative_id");--> statement-breakpoint
CREATE INDEX "transfers_dest_rep_idx" ON "product_transfers" USING btree ("destination_representative_id");--> statement-breakpoint
CREATE INDEX "products_barcode_idx" ON "products" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "products_code_idx" ON "products" USING btree ("product_code");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "sales_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_id_idx" ON "sales_order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "sales_orders_rep_idx" ON "sales_orders" USING btree ("representative_id");--> statement-breakpoint
CREATE INDEX "sales_orders_idempotency_idx" ON "sales_orders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "tech_prod_stock_idx" ON "technician_product_stock" USING btree ("technician_id","product_id");