# ERP-008 — Baseline Gate Resolution

| Field | Value |
|---|---|
| **Date** | 2026-07-18 |
| **Worktree** | `d:/nulip-new.worktrees/erp-008-phase-2-financial-integrity` |
| **Branch** | `erp-008/phase-2-financial-integrity` |
| **HEAD** | `f1fd684` |
| **Decision** | **BASELINE READY** |
| **Husky bypass** | **Forbidden / not used** |

---

## Checklist

| Condition | Status |
|---|---|
| HEAD contains approved fcmToken fix | **Yes** — `f1fd684` |
| Migration chain unblocker committed | **Yes** — `a3be98b` |
| Working tree clean (after docs commit) | pending this commit |
| `DATABASE_URL` → isolated test DB | **Yes** — `stockpro_erp008_phase2_test` |
| Migrations successfully applied | **Yes** — 21 rows, 61 tables (×2 fresh DBs) |
| Architecture PASS | **Yes** |
| Typecheck PASS | **Yes** |
| All required tests PASS | **Yes** — 67 files / 283 tests |
| Husky PASS | **Yes** — natural commits for `a3be98b` + `f1fd684` |
| Baseline documentation committed | this commit |

---

## Environment (redacted)

| Item | Value |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:***@localhost:5432/stockpro_erp008_phase2_test` |
| Test DB name | `stockpro_erp008_phase2_test` |
| Second proof DB | `stockpro_erp008_phase2_test_b` |
| PostgreSQL | 18.1 |
| Production / staging / dirty-tree DB | **not used** |

---

## Blockers closed

### A) Migration integrity — `a3be98b`

See `docs/production/ERP-008-MIGRATION-UNBLOCKER.md`.

- Duplicate courier indexes `0018` ↔ `0020` removed from `0020`.
- `core_jobs` DDL aligned to `system.schema.ts`.
- Decision: **MIGRATION CHAIN VERIFIED**.

### B) Typecheck `fcmToken` — `f1fd684` (Case A)

- No `fcm_token` column at baseline; no route callers.
- `updateFcmToken` / `clearFcmToken` are no-ops + warn; MemStorage assignment removed.
- No FCM migration introduced.

### C) Test environment

- Isolated DB + `SESSION_SECRET` / `JWT_SECRET` in untracked `.env`.
- Local `packages/ai-extraction` dist build required for Vitest resolve (not committed).

---

## Gate results (final)

| Gate | Result |
|---|---|
| Architecture | PASS |
| Typecheck | PASS |
| Tests | PASS (283) |
| Husky | PASS |

### Technical debt (recorded only)

```text
Separate unit tests from database integration tests
```

---

## Decision

```text
BASELINE READY
```

P2.1 `number_sequences` may start next. No financial migration was started in this unblocker.
