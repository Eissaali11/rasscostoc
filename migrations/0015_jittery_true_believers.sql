CREATE TABLE "custody_movements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" varchar NOT NULL,
	"from_owner_id" varchar,
	"to_owner_id" varchar,
	"from_warehouse_id" varchar,
	"to_warehouse_id" varchar,
	"reason" text NOT NULL,
	"reference_type" text,
	"reference_id" varchar,
	"performed_by_id" varchar NOT NULL,
	"performed_at" timestamp DEFAULT now() NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "custody_movements" ADD CONSTRAINT "custody_movements_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custody_movements" ADD CONSTRAINT "custody_movements_from_owner_id_users_id_fk" FOREIGN KEY ("from_owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custody_movements" ADD CONSTRAINT "custody_movements_to_owner_id_users_id_fk" FOREIGN KEY ("to_owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custody_movements" ADD CONSTRAINT "custody_movements_from_warehouse_id_warehouses_id_fk" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custody_movements" ADD CONSTRAINT "custody_movements_to_warehouse_id_warehouses_id_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custody_movements" ADD CONSTRAINT "custody_movements_performed_by_id_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custody_movements_item_id_idx" ON "custody_movements" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "custody_movements_from_owner_idx" ON "custody_movements" USING btree ("from_owner_id");--> statement-breakpoint
CREATE INDEX "custody_movements_to_owner_idx" ON "custody_movements" USING btree ("to_owner_id");