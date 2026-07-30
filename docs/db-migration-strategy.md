# Database migration strategy

Applies to every future migration, starting with `0026_expand_courier_audit_logs.sql` (currently pending, on `erp-008/phase-2-financial-integrity` only, not run against production).

## Rules

1. **Take and verify a backup before running any migration against production.** "Verify" means restore it somewhere and confirm it opens/queries — an untested backup is not a backup.
2. **Expand → Migrate → Contract, never all at once:**
   - **Expand:** add the new column/table/index as nullable or with a safe default. Deploy this alone first. Old code keeps working untouched; new code can start using the new shape.
   - **Migrate:** backfill data, switch application code to read/write the new shape. Deploy. Both old and new code paths should tolerate the schema during this window (see rollback window below).
   - **Contract:** only once the new code has been live and stable for the agreed rollback window, drop/rename the old column, tighten constraints, remove the compatibility shim.
3. **Never drop a column in the same release that adds its replacement.** The two must be separate deploys with a real gap between them.
4. **Support the previous code version during the rollback window.** If code is rolled back to the previous commit, the *current* schema must still satisfy it. This is what makes `0026`-style additive migrations safe to run ahead of the code that uses them, but makes destructive migrations (drops, renames, type narrowing) unsafe to bundle with the code change that needs them.
5. **Migrations run on staging first, against a representative copy of the schema**, before touching production.
6. **Record a checksum per migration file** (already done implicitly by drizzle's `meta/_journal.json` + `__drizzle_migrations.hash`) — do not hand-edit an already-applied migration file; add a new one instead.
7. **Code rollback ≠ database rollback.** Rolling back to a previous release commit (via the `current` symlink) never automatically reverts a migration. If a migration must be undone, that is a separate, explicitly-reviewed action with its own backup/verify cycle — see the Pre-Deploy Guard's rollback check (§11 of the release process), which refuses silent rollbacks and requires a stated `DATABASE_COMPATIBILITY` / `MIGRATION_IMPACT` assessment.

## Specifically for `0026_expand_courier_audit_logs.sql`

It is already additive-only (every column is nullable or has a default — confirmed by reading the file), so it satisfies the Expand step on its own. Before running it against production:

- [ ] Confirm current row count / table size of `courier_audit_logs` (so the `ALTER TABLE ... ADD COLUMN` timing is understood — should be near-instant for nullable adds on Postgres, but verify on staging first).
- [ ] Run it on staging, confirm `insertAuditLog`'s new enrichment fields populate correctly.
- [ ] Only then run against production, as its own deploy step — not bundled with unrelated code changes.
- [ ] The Zero-Storage `register-drive` code (`968d7cc`) that actually *depends* on these columns stays on its own branch until reviewed separately (see main report) — applying `0026` alone does not commit to shipping that code.

## Outstanding item this report does not resolve

Production's `__drizzle_migrations` table has 2 more applied rows than there are `.sql` files in `main`. Until that gap is explained (see Database Drift Report), do not treat a fresh migration run from `main` as guaranteed to reproduce production's exact schema — diff the live schema against a freshly-migrated staging database first.
