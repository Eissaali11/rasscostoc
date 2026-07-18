# ERP-008 — Migration Integrity Unblocker

| Field | Value |
|---|---|
| **Date** | 2026-07-18 |
| **Worktree** | `d:/nulip-new.worktrees/erp-008-phase-2-financial-integrity` |
| **Branch** | `erp-008/phase-2-financial-integrity` |
| **Base** | `75ca707` |
| **Fix commit** | `a3be98b` |
| **Scope** | Infrastructure / migration chain only — **not** Phase 2 financial work |
| **Decision** | **MIGRATION CHAIN VERIFIED** |

---

## 1. Failure symptom

Greenfield:

```text
CREATE DATABASE → npm run db:migrate
→ error: relation "courier_executions_sn_idx" already exists
```

Transaction rolled back → empty schema / empty migration ledger.

---

## 2. Root cause

| Migration | Intent | What it did |
|---|---|---|
| `0018_erp001_courier_perf_indexes.sql` | ERP-001 Package A hand-authored courier list/filter indexes | `CREATE INDEX IF NOT EXISTS` on 15 courier indexes |
| `0019_erp001_courier_pattern_ops_indexes.sql` | Pattern-ops indexes for `LIKE 'prefix%'` | Different index names (`*_pattern_idx`) — **no conflict** |
| `0020_chubby_the_enforcers.sql` | ERP-005A-4 drizzle generate for `core_jobs` | Also re-emitted the same 15 courier btree indexes **without** `IF NOT EXISTS` |

Why `0020` recreated them: Drizzle schema (`courier.schema.ts`) already declares those indexes. When `0020` was generated for `core_jobs`, drizzle emitted pending index DDL again. Hand-written `0018`/`0019` were not reflected as intermediate snapshots in `migrations/meta/` (no `0018_snapshot.json` / `0019_snapshot.json`), so the generator treated the indexes as new.

---

## 3. Diff: `0018` vs `0020` index definitions

Example (`courier_executions_sn_idx`):

| Aspect | `0018` | Original `0020` |
|---|---|---|
| Name | `courier_executions_sn_idx` | same |
| Table | `courier_executions` | same |
| Column | `sn` | same |
| Unique | no | no |
| Partial / expression | no | no |
| Method | default btree | explicit `USING btree` |
| Guard | `IF NOT EXISTS` | none |

**Conclusion:** true duplicates — identical intent and PostgreSQL semantics (default AM is btree). Not an intentional redesign of index properties.

Same comparison holds for all 15 overlapping names (8 `courier_requests_*` + 7 `courier_executions_*`).

---

## 4. Secondary drift found during acceptance

After indexes were fixed, `jobs` integration tests failed:

```text
column "progress_details" of relation "core_jobs" does not exist
```

`packages/shared-types/schemas/system.schema.ts` already declared:

- `progress_details`
- `result_metadata`
- `next_retry_at`
- `last_error_at`
- `last_heartbeat_at`

…but original `0020` CREATE TABLE / `0020_snapshot.json` omitted them (local `scratch/create-table.ts` had been compensating with `ALTER TABLE … ADD COLUMN IF NOT EXISTS`).

This is still migration integrity: greenfield schema must match the TypeScript contract at baseline.

---

## 5. Fix chosen (and why)

**Not** blindly wrapping duplicates in `IF NOT EXISTS` as the primary strategy.

Chosen:

1. **Remove** the 15 duplicate `CREATE INDEX` statements from `0020` (root-cause de-duplication; `0018` remains the source of those indexes).
2. **Align** `0020` `core_jobs` DDL (+ snapshot) to `system.schema.ts` columns.

Why not only `IF NOT EXISTS` on indexes: definitions were proven identical, so keeping two creators is unnecessary noise. Removal preserves end-state and keeps `0018` as the single owner of those indexes.

---

## 6. Fresh database proof (×2)

| DB | Migrate | Migration rows | Public tables | `core_jobs` columns | Key indexes | `core_jobs` FK |
|---|---|---|---|---|---|---|
| `stockpro_erp008_phase2_test` | PASS | 21 | 61 | 19 (incl. progress_details…) | sn / tid / sn_pattern present | present |
| `stockpro_erp008_phase2_test_b` | PASS | 21 | 61 | 19 | same | present |

PostgreSQL: **18.1**  
Host: `localhost:5432` (local only)

---

## 7. Gate results after fix

| Gate | Result |
|---|---|
| Architecture | PASS |
| Typecheck | PASS (Case A fcm committed as `f1fd684`) |
| `npm run test:unit` | **67 files / 283 tests PASS** |
| Husky on migration commit | **PASS** |

Commit:

```text
a3be98b fix(db): resolve duplicate index creation in migration chain
```

Files only:

- `migrations/0020_chubby_the_enforcers.sql`
- `migrations/meta/0020_snapshot.json`

---

## 8. Decision

```text
MIGRATION CHAIN VERIFIED
```

Greenfield path is restored:

```text
Fresh Database → All Migrations Apply → Schema Matches Expected State
```

**Note for already-applied environments:** editing historical `0020` changes the migration file hash. Greenfield / new test DBs are the acceptance target of this unblocker. Existing DBs that already recorded the old `0020` hash may need an ERP-002-style catch-up (out of this ticket’s apply path).

Next: re-run full Baseline gate → `BASELINE READY` → only then P2.1.
