-- Telegram installation bot integration: link a user account to the Telegram
-- user id of the technician using @stockpro_installation_bot, so courier/pdf
-- reports submitted via the bot can be attributed to the real technician
-- (region, technician_code, full name) instead of a generic service account.
-- Nullable + unique: most users never touch the bot, and one Telegram account
-- must not silently map to two different technicians.
-- Rollback:
--   ALTER TABLE "users" DROP COLUMN "telegram_user_id";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_user_id" text;
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_telegram_user_id_unique" UNIQUE ("telegram_user_id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
