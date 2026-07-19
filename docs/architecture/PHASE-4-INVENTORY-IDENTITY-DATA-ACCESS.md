# ERP-005A-4 Phase 4 — Inventory → Identity Data Access Inventory

Date: 2026-07-17
Baseline: `ERP-005A-4/phase-3/post` (commit `77c2ba5`)
Method: full multi-line-aware source scan (not line-by-line grep, which undercounts — a plain single-line regex found only 5 files; the accurate scan, re-run against the current committed HEAD as requested, found **18 files**, matching the number reported in `DATA-OWNERSHIP-MATRIX.md`).

## Summary

| Metric | Value |
|---|---:|
| Files importing `users` from `@shared/schema` | 18 |
| Distinct query sites (`users.*` references) | ~80 |
| Read-only sites | ~76 |
| **Write sites (INSERT/UPDATE on `users`)** | **4** — all in one file, `ImportSystemBackup.use-case.ts` |
| Aggregate/statistics sites (no per-row identity) | 8 (all in `analytics.service.ts`) |

## ⚠️ New category not anticipated by the Type A / Type B framework: writes to `users`

`ImportSystemBackup.use-case.ts` does not just read `users` — it **INSERTs and UPDATEs** it directly, as part of a full-system backup-restore feature (its sibling `ExportSystemBackup.use-case.ts` has zero `users` references — export doesn't touch it, but import recreates user accounts, including `password`, `email`, `role`, `regionId`, on restore). This is a write, not a display or authorization read, and needs its own contract (see design section) rather than being forced into `IdentityUserReadPort`/`TechnicianEligibilityPort`.

## Per-file catalogue

### 1. `DrizzleDevicesRepository.ts` (1197 lines)
| Method (approx. line) | Op | Fields | Purpose | Classification | Batch-capable today? | Query count |
|---|---|---|---|---|---|---|
| ~60-90, ~117-146, ~180-209 (3 near-identical list queries) | `leftJoin` | `city`, `fullName` | Technician display name/city on device list rows | **A — display** | Yes, one JOIN per list call | 1 per call |
| ~630-636 | `where(eq(users.id, ...))` | (existence check) | Verify technician still exists before a device update | **B — business decision** (existence/eligibility) | N/A (single row) | 1 |
| ~775-780 | `select fullName` | `fullName` | Resolve one technician's display name | **A — display** | Single lookup, called per-item today (see N+1 risk below) | 1 per call — **potential N+1 if called in a loop; verify caller** |
| ~835-843 | `leftJoin` | `fullName`, `city` | Same list-display pattern as above | **A — display** | Yes | 1 |
| ~1070-1075 | `sql LOWER(username)/LOWER(fullName)` | `username`, `fullName` | Fuzzy technician-code matching (search by name or username) | **A — display / lookup**, read-only, no authorization implication | Single query, case-insensitive match | 1 |

### 2. `DrizzleInventoryRequestApprovalUnitOfWork.ts` (142 lines)
| Method | Op | Fields | Purpose | Classification |
|---|---|---|---|---|
| `DrizzleUserRegionLookupRepository.getById` (~line 77-90) | `select` | `id`, `regionId` | Resolve the approver's region to authorize an inventory-request approval | **B — business decision (authorization)** |

**Note:** this file already defines and implements `IUserRegionLookupRepository` (declared in `inventory/application/inventory-requests/contracts/IInventoryRequestApprovalUnitOfWork.ts`) — the port-level abstraction already exists at the right architectural layer; only the concrete implementation needs to stop querying `users` directly.

### 3. `DrizzleRegionRepository.ts` (106 lines)
| Method (~line 65) | Op | Fields | Purpose | Classification |
|---|---|---|---|---|
| (unnamed, region deletion guard) | `where(eq(users.regionId, ...))` | (existence count) | Block deleting a region that still has users assigned to it | **B — business decision** |

### 4. `DrizzleTransactionsReadRepository.ts` (227 lines)
| Method (~lines 29-200, 5 query sites) | Op | Fields | Purpose | Classification |
|---|---|---|---|---|
| List/detail/statistics transaction queries | `leftJoin`, `ilike` search, `groupBy` | `fullName`, `regionId` | Display user name on transaction rows; search transactions by user name; group stats by region | **A — display** for name; **B — filter** for the `regionId` conditions (line 129) and the `ilike(users.fullName, ...)` search (line 88, since it's a user-facing search filter, not just output shaping) |

### 5. `DrizzleTransactionsRepository.ts` (329 lines)
| Method (~lines 53-304, 3 near-identical query sites) | Op | Fields | Purpose | Classification |
|---|---|---|---|---|
| List/paginated transaction queries | `leftJoin`, `groupBy` | `fullName`, `role`, `city` | Display user name/role/city on transaction rows | **A — display** |

### 6. `DrizzleWarehouseRepository.ts` (541 lines) and its near-duplicate `WarehouseRepository.ts` (296 lines)
Both files contain the same pattern (appears to be two implementations of overlapping responsibility — noted but not resolved here, out of scope):
| Method | Op | Fields | Purpose | Classification |
|---|---|---|---|---|
| Warehouse list/detail (~44-51, 122-133) | `leftJoin` | `fullName` | Display warehouse creator's name | **A — display** |
| Supervisor's technicians lookup (~140-171) | `leftJoin` on `supervisorTechnicians`, filter `role='technician'`, `regionId` match | full row: `id, username, email, fullName, profileImage, city, role, regionId, isActive, createdAt, updatedAt` | Build the list of technicians a supervisor can manage, filtered by region and role | **B — business decision (authorization scope)** — and the only site returning a **full `users` row** rather than a display projection |
| ~416-417 | `leftJoin` | `fullName`, `city` | Technician display on another query | **A — display** |

### 7. `DrizzleWarehouseStockMovementsRepository.ts` (115 lines)
| Method (~lines 23-88, 3 sites) | Op | Fields | Purpose | Classification |
|---|---|---|---|---|
| Stock movement list queries | `leftJoin`, one with `where(eq(users.regionId, ...))` | `fullName`, `regionId` | Display technician name; filter movements by technician's region | **A — display** (name) / **B — filter** (region) |

### 8. `DrizzleWarehouseTransferAdminRepository.ts` (128 lines)
| Method (~line 75-77) | Op | Fields | Purpose | Classification |
|---|---|---|---|---|
| (unnamed) | `select fullName` | `fullName` | Resolve one technician's name for a transfer admin view | **A — display** |

### 9. `InventoryRequestsRepository.ts` (126 lines)
| Method (~lines 25-118, 2 sites) | Op | Fields | Purpose | Classification |
|---|---|---|---|---|
| List/detail inventory requests | `leftJoin`, `where(eq(users.regionId, ...))` | `fullName`, `username`, `city`, `regionId` | Display requester name/city; filter requests by region | **A — display** / **B — filter** |

### 10. `TransferQueryRepository.ts` (104 lines)
| Method (~line 66-71) | Op | Fields | Purpose | Classification |
|---|---|---|---|---|
| (unnamed) | `leftJoin` | `fullName` | Display technician name on a transfer query | **A — display** |

### 11. `analytics.service.ts` (429 lines) — aggregate/dashboard statistics
| Method (~lines 69-73, 131-168, 291-324, 401-404) | Op | Fields | Purpose | Classification |
|---|---|---|---|---|
| User counts by role/active status | `count()`, `sql COUNT(CASE WHEN role=...)` | `id`, `isActive`, `role` (aggregated, no per-row PII) | Dashboard tiles: total users, active users, counts by role | **New sub-category: C — aggregate statistics** (not a per-user lookup at all; needs a stats-shaped contract, not a batch-by-ids port) |
| Transaction list with user name (~131-136) | `leftJoin` | `fullName`, `role` | Same display pattern as elsewhere | **A — display** |
| Regional distribution (~159-168, 291-324) | `leftJoin`, `groupBy(users.regionId)` | `regionId` (aggregated) | Dashboard: users/requests per region | **C — aggregate statistics** |
| Distinct city count (~404) | `COUNT(DISTINCT city)` | `city` (aggregated) | Dashboard tile | **C — aggregate statistics** |

### 12. `inventory-scan.service.ts` (710 lines)
| Method | Op | Fields | Purpose | Classification |
|---|---|---|---|---|
| ~545-555 (fallback default-inventory seeding) | `select` | `fullName`, `city`, `regionId` | Snapshot technician's display fields into a newly-created `techniciansInventory` row | **A — display**, but note: this is a **snapshot-at-creation-time write into inventory's own table**, not a live join — different handling than a read-time JOIN (see design notes) |
| `assertTechnicianExists` (~639-649) | `select id`, `where role IN (technician, employee)` | `id`, `role` | Validate the actor is a real, eligible technician/employee before allowing a scan operation | **B — business decision (eligibility)** — exact match for the plan's own `TechnicianEligibilityPort` example |

### 13. `item-types.service.ts` (640 lines)
| Method (~line 206-211) | Op | Fields | Purpose | Classification |
|---|---|---|---|---|
| (unnamed, received-devices list) | `leftJoin` | `fullName` | Display technician name | **A — display** |

### 14. `serialized-items.service.ts` (534 lines)
| Method (~lines 340-345, 366-369) | Op | Fields | Purpose | Classification |
|---|---|---|---|---|
| Item lookup / history | `leftJoin` (×2) | `fullName`, `username` | Display current owner's name; display who changed an item's history entry | **A — display** |

### 15. `technician.service.ts` (573 lines)
| Method (~lines 173-179, 352-355, 408-412, 447-448, 475-485) | Op | Fields | Purpose | Classification |
|---|---|---|---|---|
| Technician directory listings (×2 near-duplicate methods) | `where(role='technician')`, `orderBy(fullName)` | `id, fullName, city, username, regionId` | Build the technician picker/directory list | **A — display list**, but the `role='technician'` filter is itself a business rule (who counts as a technician) |
| Stock-movement/fixed-inventory queries (×3) | `leftJoin`, `where(regionId=...)` | `fullName`, `regionId` | Display + regional filter, same pattern as elsewhere | **A / B mixed** |

### 16. `ExportSystemBackup.use-case.ts` (63 lines)
No `users` references. Listed in the file scan only because it sits next to `ImportSystemBackup.use-case.ts`; confirmed clean.

### 17. `ImportSystemBackup.use-case.ts` (695 lines) — 🚫 the write case
| Method (~lines 173-245, one large loop) | Op | Fields | Purpose | Classification |
|---|---|---|---|---|
| User restore loop | `SELECT` (×4 existence checks: by id, by username, by resolved username, by resolved email) then **`UPDATE users SET ...`** or **`INSERT INTO users VALUES (...)`** | full row: `username, email, password, fullName, profileImage, city, role, regionId, isActive` | Restore user accounts from a system backup snapshot, resolving id/username/email collisions | **New category — D: write/upsert**, needs a dedicated Identity-owned restore contract, not a read port |

## Aggregate counts against the plan's requested fields

```
Total distinct query sites            : ~80
Type A (display-only)                 : ~55
Type B (business decision / filter)   : ~17
Type C (aggregate statistics, new)    : 8   (all in analytics.service.ts)
Type D (write/upsert, new)            : 4   (all in ImportSystemBackup.use-case.ts)
Full-row `users.*` returned           : 1 site (WarehouseRepository/DrizzleWarehouseRepository supervisor-technicians lookup)
Batch-capable today                   : 0 — every site is a single JOIN or single-row lookup; none loop per-id (no N+1 currently present, but must not be introduced by the port design)
```

## What this means for the port design (next section, not yet implemented)

1. **`IdentityUserReadPort`** (Type A) — batch-capable `getUsersByIds(ids)` covering `fullName`, `username`, `city`, `profileImage`. Covers the ~55 display sites.
2. **`TechnicianEligibilityPort`** or similar (Type B) — covers role/region/existence checks: `assertTechnicianExists`, the region-scoped filters, the supervisor's-technicians-by-region lookup (which currently returns a full `users` row and must be narrowed to a proper view type), and the region-deletion guard in `DrizzleRegionRepository.ts`.
3. **`IdentityStatsPort`** (Type C, new) — aggregate counts (`getUserCountsByRole()`, `getUserCountsByRegion()`, `getDistinctCityCount()` or one combined stats call) for `analytics.service.ts`. Aggregate queries should not be forced through a per-id batch port.
4. **`IdentityUserRestorePort`** (Type D, new) — a dedicated, narrow contract for `ImportSystemBackup.use-case.ts`'s upsert-on-restore need. This is the highest-risk site (writes `password`/`role`/`email`) and deserves the most conservative treatment — likely deferred to a follow-up decision rather than folded into this phase silently, given it is qualitatively different from every other site catalogued here.

No code has been written yet. This document is the baseline required before Phase 4 implementation begins.
