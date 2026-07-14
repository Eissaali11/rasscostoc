# ERP-000 Addendum — Architecture Lint Baseline (Technical Debt)

**Status:** Accepted (temporary control)  
**Date:** 2026-07-14  
**Parent:** [ERP-000 — Engineering Governance](./ERP-000-engineering-governance.md)  
**Related:** `.dependency-cruiser-known-violations.json`, `npm run lint:architecture`

## Decision

Pre-commit / CI must continue to run `lint:architecture`, but **pre-existing** dependency-cruiser violations are recorded in a **known-violations baseline** so they do not block unrelated releases.

**New** architecture violations (not in the baseline) remain hard failures.

This is **not** permanent permission to ignore layering rules. It is a controlled debt register until violations are burned down under ERP-005 / a dedicated cleanup package.

## Why

At ERP-001 Package A release, `depcruise` reported ~20 errors concentrated in Courier/Inventory (cross-module internals, application→drizzle, domain→application types, etc.). Those errors predate Package A. Blocking `main` deploy on that backlog would force either:

1. a large unscoped architecture rewrite (violates ERP-000: one decision / no rewrite without business justification), or  
2. habitually using `--no-verify` (unsafe as policy).

Option chosen: **baseline + fail on regression**.

## Mechanism

| Script | Behavior |
|--------|----------|
| `npm run lint:architecture` | Full cruise of `apps/api/src` with `--ignore-known` |
| `npm run lint:architecture:strict` | Full cruise **without** ignoring known debt (debt burn-down / audits) |
| Baseline file | `.dependency-cruiser-known-violations.json` |

## Rules

1. Do **not** enlarge the baseline to hide new Package work. Fix the new edge or split the change.  
2. Shrinking the baseline (removing fixed entries) is encouraged and needs no new ADR.  
3. Enlarging the baseline requires Architecture note (who / why / follow-up ticket).  
4. `--no-verify` remains exceptional and must cite this addendum + release SHA if ever used.

## Follow-up

- Track burn-down under ERP-005 when activated, or open a small “Architecture debt Package” after ERP-004 measurement if layering blocks performance work.  
- Target: reduce known violations toward zero without big-bang rewrites.

## Release note (2026-07-14)

Baseline established for ERP-001 Package A + ERP-002 tooling release so pre-commit can pass without `--no-verify`. Package A itself was adjusted so export list filtering lives in the courier repository (no new application→list-query edge).

Also: `vitest.config.ts` excludes `e2e-stress-simulation.test.ts` from the unit gate (incomplete drizzle mock vs SerialRecognition); repair that mock separately — do not treat it as Package A regression.
