# ERP-005A-4 — Phase 0 Baseline Results

Date: 2026-07-17
Worktree: `d:\nulip-new.worktrees\erp-005a-4-data-ownership` (new, isolated git worktree — the original worktree's 76 uncommitted files were left untouched)
Branch: `erp-005a-4/data-ownership`
Baseline commit: `e57754f9857ab4059643ec145a378698d5e3f91b` (tagged `ERP-005A-4/baseline`)

## Setup notes

- `npm install` run fresh in this worktree (1151 packages).
- `packages/ai-extraction` required a manual `npx tsc` build (no build script wired into `npm run build`/`turbo.json` — same gap documented in the earlier production validation and ARCH-AUDIT-001). Without it, `npm run test:unit` fails 5 test files with `Failed to resolve entry for package "@stockpro/ai-extraction"`.
- `.env` copied from the original worktree (local dev DB connection only, not a production secret) so `test:unit` can reach the local Postgres instance.

## Results

| Command | Exit code | Result | Notes |
|---|---:|---|---|
| `npm run check` | 0 | ✅ PASS | `tsc -p tsconfig.runtime-check.json`, no errors |
| `npm run test:unit` | 0 | ✅ PASS | **65/65 test files, 272/272 tests** passed at the committed baseline (before Phase 0.4's new characterization test was added). After adding `accounting.service.characterization.test.ts` (Phase 0.4): **66/66 test files, 279/279 tests**, still exit 0. (Lower than the 71/301 seen in the original dirty worktree — that worktree has additional uncommitted test files not present in this clean, committed baseline.) |
| `npm run lint:architecture:strict` | **1** | ❌ **FAIL** | **New finding — see below.** |

## ⚠️ Deviation from ARCH-AUDIT-001

`npm run lint:architecture:strict` reports **1 violation** against the true committed baseline, where ARCH-AUDIT-001 reported 0:

```
error no-cross-module-internal-imports:
  apps/api/src/modules/courier/application/ai-engine/courier-pdf-extraction.adapter.ts
    → apps/api/src/modules/ai-engine-settings/vision-live-gate.ts

1 dependency violations (1 errors, 0 warnings). 508 modules, 1633 dependencies cruised.
```

Root cause: ARCH-AUDIT-001 was run against the original worktree, which had an **uncommitted, not-yet-reviewed fix** already applied on disk to exactly this file, rerouting the import through `ai-engine-settings/contracts` (the module's public barrel) instead of the internal `vision-live-gate.ts`. That uncommitted diff also changes real behavior in `resolveVisionLiveAccess()` (production AI-Vision live-call gating logic) — out of scope for this plan per direct instruction. Only the import-path violation is being tracked here, catalogued as:

```
C4: courier/application/ai-engine/courier-pdf-extraction.adapter.ts
      → ai-engine-settings/vision-live-gate.ts
    Rule violated: no-cross-module-internal-imports
    Status: confirmed, added to ERP-005A-4 scope (architecture-only fix)
```

Total confirmed issues for this plan is therefore **7** (V1, V2, V3, C1, C2, C3, C4), not 6.

## Phase 0.2 gate status

```
All existing checks run against a clean, committed baseline = YES
Results saved                                                = YES (this file)
```
