-- ERP-008 Phase 5: bring the session table into the migration chain.
-- Until now this table was created only at app startup by connect-pg-simple's
-- createTableIfMissing (core/config/session.ts) -- runtime DDL outside the
-- migration chain, and the single schema-drift finding of the Phase 5 drift
-- check (a fresh migration replay lacked it while every live DB had it).
-- Definition matches connect-pg-simple's table.sql exactly, so this is a
-- codification of current state, not a behavior change; the app's
-- auto-creation remains in place as a harmless IF-NOT-EXISTS fallback.
-- Rollback:
--   DROP TABLE "session";  -- (connect-pg-simple would recreate it at next boot)
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
