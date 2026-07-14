# ADR ERP-002 — Drizzle Migration History Drift

**Governed by:** [ERP-000](./ERP-000-engineering-governance.md)  
**Status:** Conditionally Complete — Local + Greenfield proven; Staging required for Full Complete  
**Date:** 2026-07-14  
**Product:** StockPro Enterprise / RASSCO  
**Blocks:** Formal **Completed** status · Production deploy of ERP-001 path · Formal start of ERP-003  
**Related:** [ERP-001](./ERP-001-courier-performance-package-a.md) · [Audit](./ERP-002-migration-drift-audit.md) · [Runbook](./ERP-002-migration-runbook.md) · [ERP-003](./ERP-003-release-readiness-check.md) · [ERP-004](./ERP-004-enterprise-performance-audit.md)

## Architecture position (2026-07-14)

| Classification | Meaning |
|----------------|---------|
| **Conditionally Complete** | Local Option A + greenfield proof accepted as progress |
| **Not Fully Complete** | Staging runbook not executed yet |

Do **not** mark Status: `Completed` until Staging checklist below is signed.

## Single objective

> Make deployment and database migrations **100% reliable and repeatable**.

No performance work. No features. No PDF/AI/Storage/Redis/Queue.

## Phases (approved scope)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 Audit (read-only) | Ledger ↔ journal ↔ schema matrix | **Done** (local) |
| 2 Runbook | Staging/Production/failure/rollback | **Done** — [ERP-002-migration-runbook.md](./ERP-002-migration-runbook.md) |
| 3 Reconciliation | **One** strategy per environment | **Option A on local** · Staging/Prod pending |

## Audit findings (local `nulip_inventory`)

| Item | Before | After Option A |
|------|--------|----------------|
| Journal entries | 20 (`0000`…`0019`) | 20 |
| Ledger rows | 10 (`0000`…`0009`) | **20** |
| Missing tags | `0010`…`0019` | **0** |
| Schema probes | All present for drifted tags | Pass |
| `npm run db:migrate` | Failed (`bearer_sessions` already exists) | **Exit 0** |
| Greenfield proof | — | **PASS** (20/20) |

Root cause: schema was applied (manually / partial) for `0010+` without recording rows in `drizzle.__drizzle_migrations`.

## Chosen strategy (local)

**Option A — Ledger Catch-up only** (schema matched probes).

- Inserted SHA-256(file) + journal `when` for tags `0010`…`0019`.
- **No DDL** re-run.
- Tooling: `npm run db:erp002:catch-up`

Do **not** mix with Repair or Rebuild on the same DB.

## Staging close-out checklist (required for Full Complete)

1. [ ] Execute [runbook](./ERP-002-migration-runbook.md) on Staging
2. [ ] `npm run db:migrate` exit 0
3. [ ] Ledger matches Journal (audit: missing = 0)
4. [ ] Application healthy after migrate (`/health/ready` + smoke)
5. [ ] Result documented (date, operator, commit SHA, strategy A/B/C)

Then flip this ADR to **Status: Completed**.

## Tooling (ERP-002 only)

```bash
npm run db:erp002:audit
npm run db:erp002:catch-up-dry
npm run db:erp002:catch-up
npm run db:erp002:greenfield-proof
npm run db:migrate
```

## Out of scope (enforced)

Search, DTO, new indexes, Redis, Queue, Storage, PDF, OCR, AI, business logic.

## Next

1. Staging runbook → Full Complete ERP-002  
2. **ERP-003** Quality Gate only (ready for ERP-004?)  
3. **ERP-004** diagnosis only (Map + Backlog) → **ERP-004A/B** for fixes  
