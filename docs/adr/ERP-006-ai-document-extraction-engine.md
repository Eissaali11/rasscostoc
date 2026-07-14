# ADR ERP-006 — AI Document Extraction Engine

**Status:** **Approved & Implementation Ready** — **Implementation Freeze** (006A deferred)  
**Date:** 2026-07-14  
**Product:** StockPro Enterprise / RASSCO  
**Governed by:** [ERP-000](./ERP-000-engineering-governance.md)  
**Primary UI:** `/courier/pdf/:id` (e.g. [review page](https://stc1.fun/courier/pdf/3))  
**Does not replace:** ERP-002 / ERP-003 / ERP-004 sequencing for performance governance  

### Official freeze decision (Architecture Sign-off)

| Item | Decision |
|------|----------|
| **ERP-006** | ✅ Approved as final architectural reference |
| **ERP-006A+** | ❌ **Deferred** until **ERP-002 Completed on Staging** **and** **ERP-003 Pass** |
| Rationale | ERP-000: do not open new implementation while critical-path gates are open |

**Allowed now (prep only — no runtime behavior change):**

- Interfaces: `AIExtractionProvider`, `ImagePreprocessor`, `ExtractionValidator`  
- Final JSON Schema (per-field confidence)  
- Official RASSCO extraction prompt (text/assets only)  
- AI Providers admin **UI/UX design** (not wired to live providers)  
- **Golden Dataset** collection (see below)  

**Forbidden until freeze lifts:** live Gemini calls, wiring upload/review to the new engine, Admin key storage that enables production extraction, retention jobs that change PDF lifecycle in prod.

## Context

Courier PDF review today uses local helpers (`ocr.helper.ts`: PDF text layer + Tesseract/regex). That is classic OCR + pattern matching, weak on phone photos, faint scans, stamps, mixed AR/EN, and tables.

Business fact that changes the design:

> **The PDF is temporary. Its only purpose is data extraction; then its role ends.**

The system must **not** become a file warehouse. Persist extracted **data**; delete or short-TTL the PDF.

This aligns with ERP-000: side service (not FSM rewrite), no Redis/Queue as first answer, Courier Import as consumer, one decision per ADR, and **not** a substitute for ERP-004 list-page performance work.

## Decision

### Canonical pipeline (mandatory)

```
PDF Upload
    → Split pages (Page 1..N)
    → Image Preprocessing (per page)
    → Gemini Vision (single pass per page — default)
    → Merge page results
    → Validation Engine (per-field confidence)
    → Courier Review / Import
    → Delete PDF or retain ≤ TTL (e.g. 24h) then delete
```

**Do not** default to: PDF → Gemini → OCR → Gemini again.  
A second Vision/OCR pass is allowed **only** if Quality Dashboard measurement proves a material accuracy gain (ERP-000 §1).

### 1) Image Preprocessing (mandatory before Vision)

Many failures are image quality, not the model. Before each page is sent to the provider:

- Denoise  
- Contrast enhancement  
- Sharpening  
- Deskew  
- Auto-rotate  
- Upscale when resolution is low  

This layer is part of the Extraction Engine, independent of Gemini.

### 2) Page-by-page extraction + merge

Do not send entire multi-page PDFs as one opaque blob when avoidable.

```
PDF → Page 1, Page 2, Page 3 → preprocess → Vision each → Merge
```

Better accuracy on long documents; merge policy documented in Extraction Engine (last non-empty wins / highest confidence wins — decide in 006A and measure).

### 3) Independent module + Provider Adapter

```
PDF Upload
      │
AI Extraction Service
      │
Image Preprocessing
      │
Provider Adapter          ← Gemini | OpenAI | Azure | Claude | …
      │
Extraction Engine         ← RASSCO prompt, schema, single-pass policy
      │
Validation Engine         ← per-field confidence bands
      │
Courier Import / Review   ← no FSM rewrite
```

### 4) Default provider: Gemini Vision

`gemini-2.5-pro` or `gemini-2.5-flash` (configurable). Temperature default **0.0**.

### 5) Admin: AI Providers

Administration → **AI Providers** (switch without code deploy):

| Setting | Example |
|---------|---------|
| Provider | Gemini / OpenAI / Azure / Claude |
| API Key | masked |
| Model | `gemini-2.5-pro` |
| Temperature | `0.0` |
| Max Tokens | `8192` |
| Vision Mode | enabled |
| Confidence Threshold (auto / review bands) | see §7 |
| Timeout | e.g. 60s |
| Retry Count | e.g. 2 |
| Enabled / Disabled | toggle |

### 6) JSON only + **per-field confidence** (critical)

Never accept free-form model text as truth. Invalid / non-JSON → extraction failure → full manual review.

**Required shape** (per field = `{ value, confidence }`):

```json
{
  "customer_name": { "value": "محمد", "confidence": 98 },
  "mobile": { "value": "05xxxxxxxx", "confidence": 96 },
  "tid": { "value": "12345678", "confidence": 99 },
  "serial_number": { "value": "...", "confidence": 74 },
  "sim_serial": { "value": "", "confidence": 0 },
  "city": { "value": "", "confidence": 0 },
  "branch": { "value": "", "confidence": 0 },
  "missing_fields": ["sim_serial", "city", "branch"],
  "overall_confidence": 88
}
```

`overall_confidence` is derived (e.g. min or weighted average of present fields) for list badges only — **review decisions use per-field confidence**.

Maps to existing `extractedJson` on `/courier/pdf/:id` (extend field objects if today they already have `value` + `confidence`).

### 7) Smart review bands (per field)

| Confidence | UI / policy |
|------------|-------------|
| **> 95** | Auto-accept field (policy-configurable; default on) |
| **80 – 95** | Show to reviewer (highlight) |
| **< 80** | Untrusted — force manual entry / clear suggestion |

Document-level “Review Required” if any critical field (TID, serial, SIM — configurable) is &lt; 80 or missing.

### 8) Specialized RASSCO prompt (anti-hallucination)

Not “Extract all text”. Directional requirements:

> You are a document analyst for **RASSCO**. Extract **only** the required fields. **Do not guess.** If unsure, leave `value` empty and set low `confidence`. Return **JSON only** matching the schema.

### 9) Document lifecycle

```
PDF → preprocess → Vision (once/page) → JSON → Validation → Save data → Delete PDF
```

Optional: retain ≤ 24h then delete. No Drive as primary path under this ADR.

### 10) Quality Dashboard (measurement — ERP-000 §1)

Extraction Quality metrics (Admin / Observability):

- Documents processed  
- Average extraction latency  
- Extraction success rate (schema-valid JSON)  
- Average confidence **per field** (TID, serial, SIM, customer name, …)  
- % documents needing manual review  
- Top failing / low-confidence fields  

Prompt/model changes require before/after numbers from this dashboard — no blind tuning.

### 11) Golden Dataset (mandatory before claiming quality gains)

Build a reference set of **100–300 real documents** (PII redacted/anonymized as needed) covering:

- Clear scans  
- Weak / faint images  
- Phone photos  
- Skewed pages  
- Bilingual AR/EN  
- Documents with stamps  

For each document store:

| Artifact | Purpose |
|----------|---------|
| Source file (or redacted copy) | Input |
| Ground-truth JSON | Expected fields |
| Expected fields list | Coverage |
| Difficulty tag | easy / medium / hard |

After every prompt change or model switch, measure on the Golden Dataset:

- Field Accuracy (%)  
- Precision / Recall (per field where applicable)  
- Average Confidence  
- Extraction Time  
- Manual Review Rate  

“The model feels better” is **non-compliant**. Numbers from the Golden Dataset + Quality Dashboard are required (ERP-000 §1).

Dataset curation is **allowed during Implementation Freeze**; running live provider benchmarks against it waits until freeze lifts (or a documented offline dry-run with a non-prod key that does not change Courier behavior).

### 12) Extraction provenance (required when 006A+ ships — not now)

Every extraction result must record versions used, so regressions can be traced months later:

| Field | Example |
|-------|---------|
| Provider | `Gemini` |
| Model | `gemini-2.5-pro` |
| Prompt Version | `v1.3` |
| Schema Version | `v2` |
| Preprocessing Version | `v1` |
| Extraction Engine Version | `006A.1` |
| Extracted At | ISO timestamp |

Store alongside `extractedJson` / audit metadata. ERP-006E regressions compare against these versions. **Do not implement until freeze lifts.**

### 13) ERP-006E — AI Evaluation & Regression (future, after 006D)

**Not implemented now.** Roadmap package after ERP-006D.

AI systems regress silently when models, prompts, preprocessing, or schemas change. The Golden Dataset becomes true value only as **regression testing**, not a one-time smoke set.

**Rule:** Before accepting any change to:

- Model (e.g. Gemini 2.5 Pro → newer)  
- Prompt  
- Image Preprocessing  
- JSON Schema  

run the **full Golden Dataset**, then auto-compare:

| Metric | Before | After | Gate |
|--------|--------|-------|------|
| Field Accuracy (%) | … | … | Must not drop below approved threshold |
| Precision | … | … | Same |
| Recall | … | … | Same |
| Manual Review Rate | … | … | Prefer decrease; cap max increase |
| Average Extraction Time | … | … | Cap max increase |

If any **primary** metric breaches the approved band → **reject the change** (ERP-000 §1 / §6).  
“Feels better on a few samples” is non-compliant without 006E report.

## Non-goals

- Embedding Gemini inside Courier FSM  
- Dual Gemini+OCR cascade without measurement proof  
- Long-term file warehouse / Drive-centric design  
- Free-form chat as source of truth  
- Claiming list-page performance wins  

## Current baseline (as-is)

| Piece | Today |
|-------|--------|
| Upload | `POST /api/courier/pdf/upload` |
| Review UI | `/courier/pdf/:id` |
| Extraction | `extractFromPdf` — text layer + Tesseract + regex |
| Apply | `POST /api/courier/pdf/:id/apply` |

## Implementation packages (when freeze lifts)

| Package | Scope | Status |
|---------|--------|--------|
| **ERP-006A** | Service skeleton + preprocessing + page split + Provider port + Gemini adapter + **per-field JSON schema** + RASSCO prompt + **extraction provenance** | **Deferred** |
| **ERP-006B** | Admin AI Providers (full settings) + secure key storage | Deferred |
| **ERP-006C** | Wire Courier PDF upload/review + smart review bands + optional OCR fallback | Deferred |
| **ERP-006D** | Retention TTL + **Quality Dashboard** + Golden Dataset runner | Deferred |
| **ERP-006E** | **AI Evaluation & Regression** — automated Golden Dataset compare before accepting model/prompt/preprocess/schema changes | Deferred (after 006D) |

**Unfreeze condition (006A–D):** ERP-002 Status = Completed (Staging) **and** ERP-003 = Pass.  
**006E** activates after Quality Dashboard + Golden Dataset runner exist (post-006D).

## Sequencing vs ERP-002…004

| Track | Rule |
|-------|------|
| ERP-002 / 003 / 004 | Performance/governance **critical path** — blocks 006A |
| ERP-006 design | ✅ **Approved & Implementation Ready** |
| ERP-006A+ | ❌ **Implementation Freeze** until ERP-002 Staging complete + ERP-003 Pass |
| Prep work | Interfaces, schema, prompt, UI mock, Golden Dataset — OK |
| Capacity conflict | Staging ERP-002 always wins over 006 implementation |

## Success criteria (engine)

- [ ] Each extraction stores Provider / Model / Prompt / Schema / Preprocess / Engine versions  
- [ ] Golden Dataset (100–300) with ground truth exists before quality claims  
- [ ] ERP-006E regression gate defined and used before model/prompt/preprocess/schema promotions  
- [ ] Schema-valid JSON with **per-field** confidence  
- [ ] Preprocessing runs before Vision on each page  
- [ ] Page-by-page extract + merge for multi-page PDFs  
- [ ] Review bands (&gt;95 / 80–95 / &lt;80) enforced in UI policy  
- [ ] Single Vision pass by default (no dual cascade without proof)  
- [ ] Courier apply without FSM changes  
- [ ] Provider swappable via adapter  
- [ ] PDF deleted or TTL-expired  
- [ ] Quality Dashboard live for extract KPIs  

## Consequences

### Positive

- Higher accuracy on weak phone/scan images  
- Reviewers fix only weak fields  
- Reusable engine for other modules later  
- Storage stays small (data over files)  

### Negative / risks

- Preprocessing CPU cost — measure latency on Quality Dashboard  
- Vendor PII exposure — privacy/retention note required  
- Hallucination — empty + low confidence preferred over inventing values  

## Compliance with ERP-000

| Principle | How ERP-006 complies |
|-----------|----------------------|
| No Optimization Without Measurement | Quality Dashboard; no dual-pass without proof |
| No Rewrite Without Justification | Adapter + import only |
| Performance Before Infrastructure | No Redis/Queue for v1 |
| Backward Compatibility | Review/apply UX preserved |
| One ADR = One Decision | Engine design; 006A–D deliver |
| Measure → Decide → Implement → Verify | Sample docs + field confidence stats |
