# ERP-006A — Acceptance Tests (PR-006A-1)

**Package:** ERP-006A — Extraction Core  
**Parent:** [ERP-006](./ERP-006-ai-document-extraction-engine.md)  
**Companion:** [Implementation Spec](./ERP-006A-implementation-specification.md) · [Contracts](./ERP-006A-contracts.md)  
**Prep seed:** [erp006-prep/acceptance-cases](./erp006-prep/acceptance-cases/README.md)  
**Status:** **Approved** (Architecture Sign-off 2026-07-14) — harness starts with PR-006A-2 unit coverage  
**Date:** 2026-07-14

## How to use

Each case has: **ID**, **Given**, **When**, **Then**, **Package**.  
Cases marked `006A` must pass before ERP-006A is considered Complete.  
Cases marked `006A-contract` validate shapes/fixtures without live Gemini.  
Cases marked `006C+` are tracked here for regression awareness but are **not** 006A exit criteria.

Fixtures may live under `docs/adr/erp006-prep/golden-dataset/` and `synthetic-dataset/`.

## Suite A — Document / Session / Attempt

| ID | Given | When | Then | Package |
|----|-------|------|------|---------|
| **A01** | One uploaded PDF | Create analysis | `document_id` + `extraction_session_id` + `extraction_attempt_id` exist | 006A |
| **A02** | Existing Session with Attempt 1 | Reprocess with new prompt version | Attempt 2 created; Attempt 1 payload unchanged | 006A |
| **A03** | Two Attempts on same Session | Compare outputs | Both graph snapshots addressable; no overwrite | 006A |
| **A04** | Explicit “new session” request | Start second Session | Prior Session + Attempts retained | 006A |

## Suite B — Classification & profiles

| ID | Given | When | Then | Package |
|----|-------|------|------|---------|
| **A05** | Clear installation report | Classify | `document_type=installation_report` + registry bundle resolved | 006A |
| **A06** | Ambiguous / unknown type | Classify | Low confidence → generic + Review flag; no invented required fields | 006A |
| **A07** | Maintenance-style sample | Classify | Maintenance profile selected (or Review if below threshold) | 006A |

## Suite C — Pages, quality, preprocess

| ID | Given | When | Then | Package |
|----|-------|------|------|---------|
| **A08** | Multi-page PDF | Page split | Pages/images enumerated with stable indices | 006A |
| **A09** | Mix of sharp + blurry images | Quality analyze | Each image has `quality_score` 0–100 | 006A |
| **A10** | Image with `quality_score=15` among high scores | Aggregate device view | Per-image scores preserved; low image visible | 006A |
| **A11** | Skewed scan | Preprocess | Deskew/rotate applied before Vision port input | 006A |
| **A12** | Faint / low-DPI image | Preprocess | Contrast/upscale path invoked (deterministic fixture) | 006A |

## Suite D — Grouping

| ID | Given | When | Then | Package |
|----|-------|------|------|---------|
| **A13** | One device, several images | Group | Single `device_id`; images[] bound | 006A |
| **A14** | Three devices, different SNs | Group | Three `device_id`s; no cross-merge | 006A |
| **A15** | Two devices on one page | Group | Two devices via spatial/context signals | 006A |
| **A16** | One device across pages | Group | One `device_id` spanning pages | 006A |
| **A17** | Conflicting grouping signals | Group | Split + Review; **no auto-merge** | 006A |
| **A18** | Same Attempt re-run grouping | Group | Stable `device_id` policy documented & tested | 006A |

## Suite E — Vision port & JSON

| ID | Given | When | Then | Package |
|----|-------|------|------|---------|
| **A19** | Valid fixture Vision JSON | Ingest | Device fields populated; Graph buildable | 006A-contract |
| **A20** | Invalid / non-JSON Vision output | Ingest | Failure → Review; no free-form accept | 006A |
| **A21** | Provider timeout | Call Vision port | Explicit fail status; no hang without deadline | 006A |
| **A22** | Provider disabled | Run Attempt | Explicit disabled error; no silent invent | 006A |
| **A23** | Clear SN, unclear SIM | Extract fixture | SN high confidence; SIM low/null; Review eligible | 006A-contract |

## Suite F — Relationship & Canonical Device Graph

| ID | Given | When | Then | Package |
|----|-------|------|------|---------|
| **A24** | Consistent SN/SIM/TID | Relationship → Graph | Graph nodes/edges present; no conflict edge | 006A |
| **A25** | Conflicting SN on same device images | Relationship | `conflicts_with` (or equivalent) + Review | 006A |
| **A26** | Downstream Matching stub | Consume Graph | Stub reads Graph only — **not** raw Vision JSON | 006A |
| **A27** | Validation Rules run | Against Graph | Pass/fail messages structural only | 006A |

## Suite G — Fingerprint, registry, provenance

| ID | Given | When | Then | Package |
|----|-------|------|------|---------|
| **A28** | Device with SN+merchant+branch | Fingerprint | `fingerprint_v2` set; version stored | 006A |
| **A29** | Missing SIM | Fingerprint | Hash omits missing part; no invented SIM | 006A |
| **A30** | Successful Attempt | Persist | schema/prompt/validation versions recorded | 006A |
| **A31** | Published registry bundle | Attempt to mutate | Rejected / new version required | 006A-contract |

## Suite H — Matching / explainability contracts

| ID | Given | When | Then | Package |
|----|-------|------|------|---------|
| **A32** | Match result fixture | Serialize | `matched_by`, `match_confidence`, `matched_reason[]` present | 006A-contract |
| **A33** | Empty match (006A stub) | Serialize | Explicit unmatched / deferred status — not fake 100% | 006A |

## Suite I — Validation vs Business; Review / Feedback shapes

| ID | Given | When | Then | Package |
|----|-------|------|------|---------|
| **A34** | Missing required SN (profile) | Validation | Validation failure (not Business Rule) | 006A |
| **A35** | Inactive technician scenario | Catalog only | Business Rule id exists; **not** executed as Validation | 006A-contract |
| **A36** | Review version fixture | Persist shape | who/when/diff/why + attempt/device ids | 006A-contract |
| **A37** | Reviewer correction fixture | Feedback shape | AI suggestion + ground truth + field diffs | 006A-contract |

## Suite J — Isolation & legacy non-goals

| ID | Given | When | Then | Package |
|----|-------|------|------|---------|
| **A38** | Production build with flags default | Smoke | AI extraction feature **off**; legacy OCR path unchanged | 006A |
| **A39** | Call legacy `/courier/pdf/:id` | Existing flow | Behavior unchanged vs baseline | 006A |
| **A40** | `ocr.helper.ts` | Diff check in 006A PRs | No required behavioral change | 006A |
| **A41** | Courier list/search | Regression | Hot paths untouched | 006A |
| **A42** | Log sample from failed Vision call | Inspect | No API key / secret material | 006A |
| **A43** | AR / EN / mixed label fixtures | Group/Vision fixtures | Handled without crash (accuracy gated later) | 006A-contract |
| **A44** | Duplicate serial across two devices in one file | Graph/Validation | Both devices retained; duplicate flagged for Review | 006A |
| **A45** | Multi-device pack profile | Classify + Group | Profile `multi_device=true` honored | 006A |

## Exit criteria (ERP-006A Complete — later)

All **006A** rows above Pass on agreed fixtures.  
**006A-contract** rows Pass on schema/fixture tests.  
**006C+** rows remain open until their packages.

## Traceability

| Locked ERP-006 topic | Cases |
|----------------------|-------|
| Session / Attempt | A01–A04 |
| Classifier / Profiles | A05–A07, A45 |
| Per-image quality | A09–A10 |
| Grouping policy | A13–A18, A17 |
| Graph not raw JSON | A24–A26 |
| Validation ≠ Business | A34–A35 |
| Fingerprint | A28–A29 |
| Registry immutability | A30–A31 |
| Explainability | A32–A33 |
| Review / Feedback shapes | A36–A37 |
| Legacy isolation | A38–A41 |

## References

- [ERP-006A-implementation-specification.md](./ERP-006A-implementation-specification.md)  
- [ERP-006A-contracts.md](./ERP-006A-contracts.md)  
- [ERP-006A-freeze-exception.md](./ERP-006A-freeze-exception.md)  
