# ERP-005A-4 — Phase 0 Performance Baseline

Date: 2026-07-17
Environment: local (`NODE_ENV=production node dist/server.js`, port 5055), against the local dev PostgreSQL instance used by `npm run test:unit`
Commit: `e57754f9857ab4059643ec145a378698d5e3f91b` (tag `ERP-005A-4/baseline`)
Auth: default bootstrap admin (`admin` / `admin123`, hardcoded in `core/bootstrap/use-cases/BootstrapDefaults.use-case.ts` for local/dev seeding only — not a production credential), Bearer JWT from `POST /api/auth/login`

## ⚠️ Caveat

This local database was freshly bootstrapped (empty schema + default seed data — one admin/tech/supervisor user, default region, default item types). Row counts are near zero, so these numbers characterize **query-plan/round-trip overhead only**, not production-scale performance. They are a valid reference for "did this endpoint get meaningfully slower after the refactor" (relative regression), not for absolute production latency. A production-scale performance comparison would require a data-populated staging environment, which is outside Phase 0's scope.

## Endpoints tied to the files touched by Phases 3–5

| Endpoint | Method | Touches (Phase) | Run 1 | Run 2 | Run 3 | Status |
|---|---|---|---:|---:|---:|---:|
| `/api/regions` | GET | `DrizzleRegionRepository.ts` (Phase 4, V2) | 39.0ms | 4.5ms | 5.6ms | 200 |
| `/api/transactions` | GET | `DrizzleTransactionsReadRepository.ts` (Phase 4, V2) | 24.2ms | 4.1ms | 5.3ms | 200 |
| `/api/stock-movements` | GET | `DrizzleWarehouseStockMovementsRepository.ts` (Phase 4, V2) | 23.9ms | 3.6ms | 4.9ms | 200 |
| `/api/items/lookup/:serialNumber` | GET | `SerializedItemsAdapter.ts` path / `serialized-items.service.ts` (Phase 3 V1, Phase 4 V2) | 71.3ms | 4.8ms | 5.5ms | 404 (SN not seeded — expected) |
| `/api/accounting/coa` | GET | `accounting.service.ts` (Phase 5, V3) | 9.9ms | 2.9ms | 2.9ms | 200 |
| `/api/accounting/journal-entries` | GET | `accounting.service.ts` (Phase 5, V3) | 37.3ms | 3.1ms | 3.0ms | 200 |
| `/api/sales/invoices` | GET | `accounting.service.ts` (Phase 5, V3 — via `sales_invoices` join path) | 24.2ms | 4.3ms | 3.5ms | 200 |

Run 1 in each row includes one-time JIT/connection-pool warmup; Run 2/3 are the more representative steady-state numbers (all sub-6ms against this near-empty dataset).

Query counts per request were not instrumented in this pass (no per-request query-count middleware currently wired in); the doc's own regression gate (`Query count regression documented = YES`) will be satisfied by comparing `EXPLAIN`/pg query-log counts before and after each phase's port/adapter change, not by this baseline file alone. Noted as a gap to close in Phase 3/4's own before/after comparison rather than blocking Phase 0.

## Phase 0.3 gate status

```
Performance baseline documented for affected endpoints = YES (relative baseline; see caveat above)
```
