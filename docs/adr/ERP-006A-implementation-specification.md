# ERP-006A — Implementation Specification (PR-006A-1)

**Package:** ERP-006A — Extraction Core  
**Parent:** [ERP-006](./ERP-006-ai-document-extraction-engine.md) (Architecture Complete & Locked)  
**Authority:** [ERP-006A Freeze Exception](./ERP-006A-freeze-exception.md)  
**Companion:** [Acceptance Tests](./ERP-006A-acceptance-tests.md) · [Contracts](./ERP-006A-contracts.md)  
**Status:** **Approved** (Architecture Sign-off 2026-07-14)  
**Date:** 2026-07-14

## 1. Purpose

Define the **first implementable slice** of the AI Document Intelligence Platform so Engineering can build isolated core modules without reopening parent architecture and without touching Courier production paths.

PR-006A-1 delivers **specification + acceptance + contracts only**.  
Runtime modules start in later PRs (006A-2+) **after this PR is approved**.

## 2. Scope of ERP-006A

### In scope (core)

| Capability | Notes |
|------------|--------|
| Document / Session / Attempt model | Immutable Document; Session aggregates Attempts; re-runs never overwrite |
| Document Type Classifier → Document Profile | Selects registry bundle |
| Page split + image detection | Shared render pass preferred |
| Per-image `quality_score` | Quality Analyzer |
| Image preprocessing | Independent of Vision provider |
| Device Grouping Provider (pluggable) | Image + labels + spatial + document context |
| Vision Provider port (pluggable) | Contract only in early PRs; live Gemini later, flag-gated |
| Relationship Engine | Bind identifiers within device |
| Canonical Device Graph | Sole downstream object |
| Validation Rules (structural) | Separate from Business Rules |
| Device fingerprint (`fingerprint_v2`) | Dedup / cross-file — not business identity |
| Provenance + registry versions on Attempt | Immutable published bundles |
| Explainability fields on match **contract** | Engine may stub until 006C |
| Feedback / Review **shapes** | Persistable contracts; UI in 006C |

### Explicitly out of scope for 006A

| Non-goal | Owner |
|----------|--------|
| Live `/courier/pdf/:id` UX rewrite | ERP-006C |
| Changes to `ocr.helper.ts` / legacy OCR path | Unchanged until 006C cutover |
| Business Rules runtime + Apply to custody/FSM | ERP-006C / 006G |
| Matching Engine full cascade against live DB | Contract in 006A; runtime primarily 006C |
| Versioned Review UI | ERP-006C |
| Production feature flag ON / live Gemini in prod | Forbidden until ERP-003 = Pass |
| Redis / Queue / Drive / Data Access redesign | Forbidden (exception constraints) |
| Courier list/search/export hot paths | Untouched |
| FSM / custody state changes | Forbidden |
| Parent ERP-006 design expansion | Locked |

## 3. Package boundaries

```text
apps/… (Courier)          ← consumer later; not modified in 006A core PRs
packages/ai-extraction/   ← proposed home for isolated core (name may vary)
  ports/                  ← Classifier, Grouping, Vision, Registry, …
  domain/                 ← Session, Attempt, Device Graph, Validation
  adapters/               ← later: Gemini, heuristic grouping, …
```

**Isolation rule:** Courier imports ports/adapters; 006A must not import Courier FSM, list DAL, or custody writers.

## 4. Lifecycle — Document / Session / Attempt

### 4.1 Document

- Immutable upload identity (`document_id`).
- Stores source metadata (mime, page count estimate, hash, uploaded_by, created_at).
- PDF bytes are **temporary** (delete or short TTL) — persistence is data + graph + attempts, not a file warehouse.

### 4.2 Extraction Session

- One logical analysis campaign for a document (`extraction_session_id`).
- Holds selected `document_type` / active profile intent, status, and attempt list.
- Policy: **default = one Session per Document**; opening a new Session is explicit (e.g. “new analysis campaign”) and does not delete prior Sessions.

### 4.3 Extraction Attempt

- One concrete engine run (`extraction_attempt_id`) under a Session.
- Records exact Registry bundle versions, provider/model ids, timings, graph snapshot, device outputs, validation outcomes.
- **Reprocess = new Attempt.** Never mutate prior Attempt payloads in place.
- Attempt status examples: `queued` | `running` | `succeeded` | `failed` | `partial`.

```text
Document
  └── Session (extract_…)
        ├── Attempt 1  (prompt_v1 / model_a / schema_v3)
        ├── Attempt 2  (prompt_v2 / model_a / schema_v3)  ← compare, do not erase #1
        └── Attempt 3  …
```

## 5. Pipeline stages owned by 006A

Stages follow locked ERP-006 order. 006A implements through **Validation Rules** on the Graph (Matching may be stubbed with empty candidate / deferred status). Review / Business Rules / Apply remain **contract-shaped** only.

```text
Document → Classifier → Session → Attempt N
  → Page Split → Quality → Preprocess → Grouping
  → Vision (per device) → Relationship → Canonical Device Graph
  → [Matching stub / port] → Validation Rules
  → (Review / Business / Apply deferred to later packages)
```

### 5.1 Classifier

- Input: document sample (lightweight pages/text cues).
- Output: `document_type`, confidence, resolved Document Profile / `registry_bundle_id`.
- Low confidence → `generic` + force Review flag (no invented required fields).

### 5.2 Quality + Preprocess

- Every image node MUST carry `quality_score` (0–100).
- Device-level aggregates allowed only as derived views; never hide per-image scores.
- Preprocess before Vision: denoise, contrast, sharpen, deskew, auto-rotate, upscale when DPI low.

### 5.3 Grouping Provider

- Signals: image + early labels + spatial + document context — **not** similarity alone.
- Conflict / low confidence → **split devices + Review** (never auto-merge).
- Stable `device_id` per group within the Attempt.

### 5.4 Vision Provider

- One call (logical) per `device_id` on that device’s image set.
- Structured JSON only; temperature default 0.0.
- Invalid JSON → device/attempt failure path → Review — never free-form text accepted.

### 5.5 Relationship → Canonical Device Graph

- Relationship binds SN ↔ SIM ↔ TID ↔ merchant/branch; flags conflicts.
- **Canonical Device Graph** is the only object Matching, Validation, Review, Business Rules, and Apply may consume.
- Downstream MUST NOT read raw Vision JSON.

### 5.6 Matching (006A posture)

- Define **Matching Engine + Ranking Strategy** ports and result shapes (`matched_by`, `match_confidence`, `matched_reason[]`).
- Full SQL cascade against live technician/custody data may remain stubbed until 006C.
- Ranking Strategy is versioned and swappable without changing Graph contracts.

### 5.7 Validation Rules vs Business Rules

| Kind | 006A | Later |
|------|------|-------|
| **Validation Rules** | Implement against Graph + schema | — |
| **Business Rules** | Catalog / contract only | 006C / 006G before Apply |

Validation examples: required fields per profile, schema-valid types/lengths, identifier format.  
Business examples: inactive technician, closed custody, already delivered — **not** mixed into Validation.

## 6. Canonical Device Graph (summary)

Minimum node kinds:

| Node | Key fields |
|------|------------|
| Device | `device_id`, fingerprint, status, confidences |
| Identifier | SN / SIM / TID (+ confidence) |
| Commercial | merchant, branch |
| Image | page/region, `quality_score` |
| MatchCandidate (optional) | technician/request refs + reasons |

Edges (examples): `extracted_from`, `co_located_on_page`, `conflicts_with`, `matched_to`.

Full TypeScript/JSON Schema shapes: [ERP-006A-contracts.md](./ERP-006A-contracts.md).

## 7. Fingerprint

```text
fingerprint_v2 = SHA256(
  document_type | SN | SIM | TID | merchant | branch | model | manufacturer
)
```

- Normalize then hash; omit missing parts — never invent identifiers.
- Store `fingerprint_version` on device/provenance.
- Fingerprint is **not** official business identity.

## 8. Versioned Review & Feedback (contracts only in 006A)

- Review versions: `v1`, `v2`, … with who / when / field diffs / optional why / linked attempt + device.
- Feedback artifacts: AI suggestion, human ground truth, session/device ids, field diffs.
- Collection runtime belongs primarily to 006C on Apply; 006A must not prevent persistence shapes.

## 9. Schema Registry

- Published bundles immutable: schema + prompt + validation (+ business rules version pointer).
- Attempt stores exact versions used.
- Upgrades = new bundle version + ERP-006E before promotion.

Prep catalogs: `docs/adr/erp006-prep/`.

## 10. Error / Review policy (006A)

| Condition | Behavior |
|-----------|----------|
| Classifier low confidence | Generic profile + Review |
| Grouping ambiguity | Split devices + Review |
| Vision invalid JSON / timeout | Fail device or attempt; Review |
| Validation failure | Device status ValidationFailed / Review |
| Provider disabled | Explicit failure — no silent fallback to inventing fields |
| Secrets | Never log API keys |

## 11. Non-impact guarantees

Aligned with Freeze Exception:

1. No Courier hot-path changes.  
2. No FSM / custody mutations.  
3. No Data Access redesign.  
4. Legacy OCR path remains default for production until 006C + ERP-003 Pass.  
5. Any experimental runtime behind feature flag **default off**.

## 12. PR sequence after this document

| PR | Content |
|----|---------|
| **PR-006A-1** (this) | Spec + Acceptance + Contracts |
| PR-006A-2 | Domain model + Session/Attempt persistence (isolated) |
| PR-006A-3 | Page/Quality/Preprocess + Grouping heuristic | **Implemented** — see [ERP-006A-pr-006a-3.md](./ERP-006A-pr-006a-3.md) |
| PR-006A-4 | Vision adapter (dev only; flag off in prod) | **Implemented** — see [ERP-006A-pr-006a-4.md](./ERP-006A-pr-006a-4.md) |
| PR-006A-5 | Relationship + Device Graph runtime from Vision | **Implemented** — see [ERP-006A-pr-006a-5.md](./ERP-006A-pr-006a-5.md) |
| PR-006A-6 | **Technician Matching Runtime** (cascade + ranking + explainability) | **Implemented** — see [ERP-006A-pr-006a-6.md](./ERP-006A-pr-006a-6.md) |
| PR-006A-7 | Internal AI Review Workspace (`/ai-review`) | **Implemented** — daily path is `/courier/pdf` ([Primary UX](./ERP-006A-courier-pdf-primary-ux.md)) |
| PR-006A-8 | Business Rules Runtime (pre-Apply) | **Blocked** — needs Architecture approval |
| PR-006A-9 | **Courier PDF value path** (Engine → `/courier/pdf/:id` → Complete) | **Slice 1 implemented** — [ERP-006A-pr-006a-9.md](./ERP-006A-pr-006a-9.md) |
| PR-006A-10 | Provider & API-key settings + Pilot activation | Planned (requires ERP-003 Pass) |

**Terminology:** The engine is a **central multi-provider platform**. Courier is the **first consumer** only.  
Hard rule: no Gemini/OpenAI/Claude code inside Courier — see [ERP-006A-platform-consumer-model.md](./ERP-006A-platform-consumer-model.md) · [Courier PDF Primary UX](./ERP-006A-courier-pdf-primary-ux.md).
| PR-006A-5 | Relationship + Device Graph + Validation |
| PR-006A-6 | Wiring, fixtures, golden harness (still no prod enablement) |

Exact PR numbering may adjust; **no PR may skip approved contracts**.

## 13. Success criteria for PR-006A-1 approval

- [ ] Spec covers Session/Attempt, Graph, Validation vs Business, fingerprint, quality, registry immutability, legacy non-goals  
- [ ] Acceptance suite ≥ 25 cases with clear pass/fail  
- [ ] Contracts define portable TypeScript/JSON shapes for Graph, Attempt, providers, validation, review, feedback  
- [ ] No TypeScript runtime / Gemini / PDF route / `ocr.helper` changes in the same PR  
- [ ] Architecture Sign-off recorded on this PR  

## 14. References

- [ERP-000](./ERP-000-engineering-governance.md)  
- [ERP-006](./ERP-006-ai-document-extraction-engine.md)  
- [ERP-006A-freeze-exception.md](./ERP-006A-freeze-exception.md)  
- [erp006-prep/](./erp006-prep/README.md)  
