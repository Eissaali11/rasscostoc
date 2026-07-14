ALTER TABLE "courier_executions" ADD COLUMN IF NOT EXISTS "paper_roll_qty" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "courier_executions" ADD COLUMN IF NOT EXISTS "stickers_qty" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "courier_executions" ADD COLUMN IF NOT EXISTS "nulip_cards_qty" integer DEFAULT 0;