# ERP-008 Phase 2 — Baseline Gate Report

| Field | Value |
|---|---|
| **Date** | 2026-07-18 |
| **Worktree** | `d:/nulip-new.worktrees/erp-008-phase-2-financial-integrity` |
| **Branch** | `erp-008/phase-2-financial-integrity` |
| **HEAD** | `f1fd684` |
| **Dirty parent branch** | `courier-custody-tech-fix` (untouched) |
| **Baseline decision** | **BASELINE READY** |

Unblocker commits since `75ca707`:

| SHA | Message |
|---|---|
| `a3be98b` | `fix(db): resolve duplicate index creation in migration chain` |
| `f1fd684` | `fix(auth): align fcm token usage with baseline schema` |

See also: `ERP-008-MIGRATION-UNBLOCKER.md`, `ERP-008-BASELINE-BLOCKER.md`.

---

## 1. Isolation gate (PASS)

```text
Branch:  erp-008/phase-2-financial-integrity
Base:    75ca707 + infrastructure unblockers only
Dirty parent worktree: untouched
```

---

## 2. Environment (PASS)

| Item | Result |
|---|---|
| Node | `v24.12.0` |
| npm | `11.6.2` |
| `.env` | untracked — isolated test DB only |
| `DATABASE_URL` (redacted) | `postgresql://postgres:***@localhost:5432/stockpro_erp008_phase2_test` |
| PostgreSQL | **18.1** |
| Database name | `stockpro_erp008_phase2_test` |
| Second greenfield proof | `stockpro_erp008_phase2_test_b` |
| Migration status | **21 / 21 applied**, 61 public tables |
| Production / staging / dirty DB | **not used** |

---

## 3. Tooling baseline (PASS)

| Check | Result | Notes |
|---|---|---|
| `npm run check` | **PASS** | after Case A fcm fix `f1fd684` |
| `npm run lint:architecture` | **PASS** | 0 new violations (1 known ignored) |
| `npm run test:unit` | **PASS** | 67 files / 283 tests |
| Husky (natural commit) | **PASS** | on `a3be98b` and `f1fd684` |

### Technical debt (not fixed in Phase 2)

```text
Separate unit tests from database integration tests
```

---

## 4. Static schema evidence (financial — still open for P2.x)

These defects are **proven** and remain the Phase 2 work items. They are **not** baseline blockers anymore.

### 4.1 `number_sequences` → P2.1

| Source | Finding |
|---|---|
| Drizzle schema (`accounting.schema.ts`) | Columns: `scope`, `year`, `prefix`, `next_number` — **no unique()** on `(scope, year)` |
| Migration `0000_...sql` | `CREATE TABLE number_sequences` — **no UNIQUE(scope, year)** |
| Snapshot `0020_snapshot.json` | `"uniqueConstraints": {}`, `"indexes": {}` for `number_sequences` |
| Code `accounting.service.ts` `nextSequence` | `ON CONFLICT (scope, year) DO UPDATE ...` |

**Mismatch proven:** SQL conflict target `(scope, year)` has **no matching unique constraint/index**.

### 4.2 `technician_sales_metrics_daily` → P2.2

| Source | Finding |
|---|---|
| Drizzle schema | `salesDate`, `technicianId`, `itemTypeId?`, `regionId?` — only non-unique indexes |
| Migration `0000` + `0002` | **no unique** on `(sales_date, technician_id, item_type_id, region_id)` |
| Snapshot `0020` | Unique constraints absent; `item_type_id` / `region_id` **nullable** |
| Code upsert | `ON CONFLICT (sales_date, technician_id, item_type_id, region_id)` |

**NULL policy unresolved:** must decide before P2.2 migration (`NULLS NOT DISTINCT` vs sentinel vs NOT NULL).

---

## 5. Live DB readiness

| Item | Status |
|---|---|
| Connect to PostgreSQL | **PASS** |
| Greenfield migrate (×2 DBs) | **PASS** |
| Query constraints / indexes | **PASS** |
| Execute financial ON CONFLICT reproduce | **deferred to P2.1/P2.2** |

---

## 6. Baseline decision

```text
BASELINE READY
```

Allowed next step only:

```text
P2.1 number_sequences → Commit → P2.2 technician_sales_metrics_daily → Commit → Full Phase 2 Gate → Stop
```

---

## 7. What was NOT done (compliance)

- No stash / checkout from dirty tree for Phase 2 financial code
- No P2.1 / P2.2 financial migrations yet
- No changes to `accounting.service.ts` financial logic
- No touch of `courier-custody-tech-fix` worktree for this program
- No `--no-verify` / `HUSKY=0`
