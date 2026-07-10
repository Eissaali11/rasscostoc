ALTER TABLE "item_types" ADD COLUMN "serial_prefix" text;--> statement-breakpoint
ALTER TABLE "item_types" ADD COLUMN "serial_length" integer;--> statement-breakpoint
ALTER TABLE "item_types" ADD COLUMN "serial_regex" text;--> statement-breakpoint
ALTER TABLE "item_types" ADD COLUMN "requires_serial" boolean DEFAULT false NOT NULL;