ALTER TABLE "received_devices" ALTER COLUMN "terminal_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "received_devices" ADD COLUMN "inventory_type" text DEFAULT 'fixed' NOT NULL;