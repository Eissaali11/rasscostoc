# ERP-006A-7 — UX Acceptance Gate (before PR-006A-8)

**Status:** `Pending manual acceptance` — **not** `PR-006A-7 = Accepted`  
**Architecture Sign-off for 006A-8:** **Not issued**  
**Route:** `/ai-review` (admin) · Fixtures only · Package: `@stockpro/ai-review-ui`

## Honest repo evidence (what exists)

| Artifact | Path |
|----------|------|
| UI package | `packages/ai-review-ui/` |
| Portal host | `apps/portal/src/pages/ai-review/ai-review-workspace-page.tsx` |
| Route | `apps/portal/src/App.tsx` → `/ai-review` |
| Demo fixture | `createDemoReviewFixture()` |
| Scenario fixtures | `createUxScenarioFixture("UX-1"…"UX-5")` |

This document does **not** claim a human Pass. Automated unit tests cover state mapping only.

## Official engine status (unchanged)

```text
PR-006A-1…7 = Implemented (code present)
PR-006A-7 = Accepted         → PENDING
UX Gate = PASS               → PENDING
Architecture Sign-off        → NOT APPROVED for 006A-8
```

Do **not** start Business Rules until the sign-off block below is filled with Pass (or accepted Waivers) **and** Architecture issues `START PR-006A-8`.

Product note: daily user value is on `/courier/pdf` ([Primary UX](./ERP-006A-courier-pdf-primary-ux.md)); this gate validates the **internal** `/ai-review` tool.

## Separation to preserve

```text
AI Engine          (@stockpro/ai-extraction)     ← background service
/courier/pdf       primary daily work UI         ← user value (PR-006A-9)
/ai-review         internal QA / support only    ← this gate
```

## Exit criteria (must all Pass or Waiver)

### 1. Performance

| # | Criterion | Pass? | Notes |
|---|-----------|-------|-------|
| P1 | `/ai-review` opens in &lt; 2s on fixture data | | |
| P2 | Page/device navigation without noticeable jank | | |
| P3 | No obvious wasted full-workspace thrash when switching device/page | | |

### 2. User experience

| # | Criterion | Pass? | Notes |
|---|-----------|-------|-------|
| U1 | Selecting a device highlights **all** linked images | | |
| U2 | Selecting an image/page selects the linked device | | |
| U3 | Selecting a field highlights image; shows bbox **when coords exist** | | |
| U4 | Field confidence shows clear مرتفع / متوسط / منخفض | | |

### 3. Matching

| # | Criterion | Pass? | Notes |
|---|-----------|-------|-------|
| M1 | All candidates listed (not first-only) | | |
| M2 | `matched_reason[]` and rejection reasons visible | | |
| M3 | Ambiguity banner when multiple candidates | | |

### 4. Graph

| # | Criterion | Pass? | Notes |
|---|-----------|-------|-------|
| G1 | Each device is an independent node | | |
| G2 | SN ↔ SIM ↔ TID ↔ Merchant ↔ Branch readable | | |
| G3 | Conflicts shown visually (`conflicts_with`), not hidden | | |

### 5. Usability

| # | Criterion | Pass? | Notes |
|---|-----------|-------|-------|
| A1 | Full RTL | | |
| A2 | Usable at 1920×1080 and narrower (&lt;1100 stacks) | | |
| A3 | Basic a11y: keyboard on table rows, fields, page strip; labels | | |

### 6. Scenario pack results

| ID | Portal URL | Intent | Pass/Fail | Notes |
|----|------------|--------|-----------|-------|
| UX-1 | `/ai-review?scenario=UX-1` | Single device | | |
| UX-2 | `/ai-review?scenario=UX-2` | ~10 devices | | |
| UX-3 | `/ai-review?scenario=UX-3` | 100 devices / 50 pages | | |
| UX-4 | `/ai-review?scenario=UX-4` | Low-quality images | | |
| UX-5 | `/ai-review?scenario=UX-5` | Near-duplicates / ambiguity | | |
| Demo | `/ai-review` | Baseline demo | | |

## Sign-off (fill only after manual run)

```text
AI Review UX Gate = ________  (Pass / Fail)
PR-006A-7 = ________          (Accepted / Rejected)
Date: ________
Reviewer: ________
Waivers (if any): ________
Notes: ________
```

Only after **Pass** (or accepted Waivers) should Architecture issue:

```text
PR-006A-7 = Accepted
UX Gate = PASS
Architecture Sign-off: APPROVED
START PR-006A-8
```

If Fail: fix UX before Business Rules — cheaper now than after rules + Courier wiring.
