# Architecture Amendment — ERP-006A Freeze Exception

**Type:** Binding Architecture Amendment (ERP-000)  
**Date:** 2026-07-14  
**Parent:** [ERP-006](./ERP-006-ai-document-extraction-engine.md) · [ERP-000](./ERP-000-engineering-governance.md)  
**Status:** **Accepted**

## Decision

```text
ERP-006A Freeze = Lifted (Exception)
```

**ERP-006A implementation is exceptionally authorized before ERP-002 Staging completion.**

## Reason

Business priority of the **AI Document Intelligence Platform** outweighs the original sequencing that required Staging close-out before any 006A work. Staging environment is not currently available in the program tooling; waiting indefinitely would freeze high-priority platform prep and core engineering without proportional risk reduction, provided production remains gated.

This does **not** ignore ERP-000: the sequencing rule is **amended by documented Architecture Sign-off**, not bypassed silently.

## Evidence / context

| Item | Status at amendment |
|------|---------------------|
| ERP-006 parent | Architecture Complete & Locked |
| ERP-002 Staging | Conditionally Complete — Staging host unavailable |
| ERP-003 | In Progress — not Pass |
| Production ERP-002 ledger/indexes | Already applied (2026-07-14) — does **not** substitute Staging Completed |

## Constraints (mandatory)

| Constraint | Enforcement |
|------------|-------------|
| ERP-006A remains **isolated** | Own module/ports; no Courier FSM coupling |
| No impact on Courier **hot paths** | List/search/export performance paths untouched |
| No FSM / Custody changes | Forbidden |
| No Data Access redesign | No Redis/Queue/Drive; no list DAL rewrites under 006A |
| **No Production rollout** of 006A runtime until ERP-003 = Pass (and ERP-002 Staging Completed preferred) | Feature flags default **off**; no live Gemini on production |
| First delivery = **PR-006A-1 only** | Specification + Acceptance Tests + Contracts — no Gemini API, no `/courier/pdf/:id` change, no `ocr.helper` change |
| Subsequent PRs only after PR-006A-1 approval | PR-006A-2…6 as previously sequenced |

## Result

| Gate | New official status |
|------|---------------------|
| ERP-006A Freeze | **Lifted (Exception)** |
| ERP-002 Staging | Still required for Full Complete — continues in parallel |
| ERP-003 | Still required **Pass** before any production enablement of AI extraction |
| ERP-006 parent design | Remains **Locked** — no new parent architecture |

## Sign-off

| Role | Decision | Date |
|------|----------|------|
| Architecture | Accept exception | 2026-07-14 |
| Engineering | Bound by constraints above | 2026-07-14 |

## Sign-off — PR-006A-1

```text
PR-006A-1 = Approved
Architecture Sign-off: APPROVED
Date: 2026-07-14
```

## PR-006A-2

```text
PR-006A-2 = Implemented (isolated @stockpro/ai-extraction)
```

## Official status (binding)

```text
ERP-006 Architecture = Locked

PR-006A-1…7 = Implemented ✅

Current Status:
STOP

Do not start PR-006A-8 until Architecture approval is explicitly recorded.
```

### Planned child PR sequence

| PR | Scope |
|----|--------|
| **PR-006A-6** | Technician Matching Runtime | **Done** |
| **PR-006A-7** | Review UI Runtime | **Done** |
| **PR-006A-8** | Business Rules Runtime (pre-Apply) | Awaiting approval |
| **PR-006A-9** | **Courier PDF value path** (Engine → `/courier/pdf/:id` → Complete) | **Slice 1 implemented** — see [ERP-006A-pr-006a-9.md](./ERP-006A-pr-006a-9.md) |
| **PR-006A-10** | Provider & API-key settings + Pilot activation | Planned |

See [ERP-006A-pr-006a-7.md](./ERP-006A-pr-006a-7.md) · [platform model](./ERP-006A-platform-consumer-model.md) · [Courier PDF Primary UX](./ERP-006A-courier-pdf-primary-ux.md).
