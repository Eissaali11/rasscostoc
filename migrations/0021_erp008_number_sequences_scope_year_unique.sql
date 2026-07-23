-- ERP-008-P2.1: enforce business key for atomic document numbering
-- Conflict target in accounting.service.ts nextSequence: ON CONFLICT (scope, year)
-- Rollback:
--   ALTER TABLE "number_sequences" DROP CONSTRAINT "number_sequences_scope_year_unique";
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'number_sequences_scope_year_unique'
    ) THEN
        ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_scope_year_unique" UNIQUE ("scope", "year");
    END IF;
END $$;
