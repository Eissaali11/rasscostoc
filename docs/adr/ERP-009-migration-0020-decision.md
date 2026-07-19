# Architecture Decision Record (ADR): Historical Migration 0020 Modification

## Context
When running database migrations to reconcile the production database drift, the Drizzle-kit migration runner executes migrations `0007_fantastic_sentinels` to `0021_erp_exec_002_financial_sequence_constraints` sequentially. 

During staging rehearsal, a critical failure occurred while executing migration `0020_chubby_the_enforcers.sql`:
`error: relation "courier_executions_sn_idx" already exists`

### Cause of Failure
Migration `0018_erp001_courier_perf_indexes.sql` successfully creates performance indexes (including `courier_executions_sn_idx`) on the `courier_executions` table using `CREATE INDEX IF NOT EXISTS`.
However, migration `0020_chubby_the_enforcers.sql` attempts to recreate the exact same set of indexes without `IF NOT EXISTS` guards (e.g. `CREATE INDEX "courier_executions_sn_idx" ON "courier_executions" USING btree ("sn")`). Because the migrator runs all pending migrations in a single sequence, this results in an immediate crash when `0020` is executed on any clean database or database running migrations from pre-0018 state.

## Decided Resolution: Option A (Direct Migration Modification)
We decide to modify the historical migration file `migrations/0020_chubby_the_enforcers.sql` directly to add `IF NOT EXISTS` guards to all 15 index creation statements (lines 19 to 33).

### Justification
- **No Production Hash Drift**: The production database has only applied migrations up to `0006_public_firebrand` (7 entries total in the `drizzle.__drizzle_migrations` ledger). Therefore, migrations `0007` to `0021` have never been applied on production. Modifying `0020` directly will not trigger database hash mismatches during the production migration execution.
- **Sequential Execution Block**: Creating a new migration (e.g. `0022`) to clean up indexes is not viable because the migration runner executes in sequential order (`0018` -> `0019` -> `0020`). The crash occurs *during* the execution of `0020`, preventing the migrator from ever reaching any subsequent migration.
- **Runbook Drops are Non-Viable**: Pre-migration index dropping in the runbook is ineffective because the indexes are created by `0018` and then duplicated by `0020` in the *same* execution run.

### Verification of Hash Changes
- **Original SHA-256 Checksum**: `ae5858ff8fdda58e0b046b863b4ec2da63537f7898bfb039a2f076a170a1e91a`
- **Modified SHA-256 Checksum**: `97cb347886ce31dc5c957674377041dec5d54f5d283c1c3010a6ff39deeb8170`

## Impact on Environments
- **Production**: No impact. The database ledger does not contain `0020`.
- **Other Environments**: `OTHER ENVIRONMENTS: NOT VERIFIED`. If any local or staging database has already applied the original `0020` migration, the migration audit tool will report a hash mismatch. This can be safely synchronized by updating the hash in the local ledger.
- **New Environments**: Future database installations will execute migrations from scratch successfully without crashing.

## Rollback Plan
To revert this decision:
1. Discard changes to `migrations/0020_chubby_the_enforcers.sql` using Git.
2. Note that doing so will re-introduce the relation collision crash on clean database runs.
