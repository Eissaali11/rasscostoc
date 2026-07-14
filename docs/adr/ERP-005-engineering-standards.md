# ADR ERP-005 — Engineering Standards

**Status:** Accepted as roadmap item — **Queued** (not active today)  
**Activate when:** After ERP-004 Complete **or** before material team growth — whichever comes first  
**Date:** 2026-07-14  
**Product:** StockPro Enterprise / RASSCO  
**Governed by:** [ERP-000](./ERP-000-engineering-governance.md)  

## Distinction from ERP-000

| Document | Answers |
|----------|---------|
| **[ERP-000](./ERP-000-engineering-governance.md)** | **How do we decide?** (governance, anti-patterns, Measure→Decide→Implement→Verify) |
| **ERP-005** (this) | **How do we write code?** (coding / API / DB / UI / test conventions) |

ERP-000 is policy. ERP-005 is the day-to-day engineering handbook for StockPro contributors.

Do **not** expand ERP-000 into coding rules — that would violate **One ADR = One Decision** and mix governance with standards.

## Why this ADR exists (but is queued)

ADRs now govern decisions. As the team grows, new engineers need a single answer to:

> “This is how we write code inside StockPro.”

Not only:

> “This is how we make decisions.”

Activating ERP-005 too early risks writing standards that conflict with what ERP-004 measurements will teach. Activating too late risks inconsistent code across modules.

**Recommended activation:** after Performance Map + Backlog exist (ERP-004), then codify standards that match proven pain — unless hiring forces an earlier v0.1.

## Planned contents (outline — fill when Active)

### Database Standards

- No `SELECT *` on list/hot paths  
- No deep `OFFSET` on new critical paths (prefer keyset/cursor when justified by measurement)  
- Mandatory DTO projection for every List API  
- Index review before merge when touching filters / joins / order-by  
- `EXPLAIN (ANALYZE)` required for new queries above an agreed cost/row threshold  

### API Standards

- Versioning policy  
- Pagination contract  
- Error contract  
- Response envelope  
- Idempotency expectations  

### Frontend Standards

- Virtualization after N rows  
- Lazy loading  
- Suspense usage  
- React Query keys  
- Cache invalidation rules  

### Observability

Every new API records at minimum:

- SQL Time  
- API Time  
- Request ID  
- Correlation ID  

### Testing

- Performance regression tests (where baselines exist)  
- Smoke tests  
- Migration tests  
- Load tests (Staging / gated)  

## Relationship to the series

```
ERP-000  How we decide
ERP-001…004 / 004A…  Decisions & delivery packages
ERP-005  How we write code (handbook)   ← queued
```

ERP-005 must not authorize Redis/Queue/Storage/Drive — those still require their own ADR under ERP-000 §3.

## Exit criteria when Active (future)

- Published v1.0 standards doc (or this ADR expanded to Complete)  
- Linked from onboarding / README  
- PR checklist references ERP-005 for relevant changes  

## Out of scope until activation

Writing the full handbook now, or treating this outline as enforceable merge blockers before Status flips to **Active**.
