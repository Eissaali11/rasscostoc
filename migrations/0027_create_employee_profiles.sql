-- Create employee_profiles table to reconcile Drizzle ORM schema drift.
-- Idempotent definition using IF NOT EXISTS: table exists in production database
-- but was missing from migrations history and test database environments.
CREATE TABLE IF NOT EXISTS "employee_profiles" (
	"user_id" varchar PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
	"profile_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
