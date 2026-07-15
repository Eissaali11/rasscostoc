# ADR ERP-006 — AI Document Extraction Engine

**Status:** **Architecture Complete & Locked** — **ERP-006A Freeze = Lifted (Exception)** — see [ERP-006A-freeze-exception.md](./ERP-006A-freeze-exception.md)  
**Date:** 2026-07-14  
**Revised:** 2026-07-14 (Freeze exception authorized; PR-006A-1 unlocked)  
**Product:** StockPro Enterprise / RASSCO  
**Governed by:** [ERP-000](./ERP-000-engineering-governance.md)  
**Primary UI (today):** `/courier/pdf/:id` (e.g. [review page](https://stc1.fun/courier/pdf/3)) — **unchanged until 006C**  
**Does not replace:** ERP-002 / ERP-003 / ERP-004 sequencing for performance governance  

### Official freeze decision (Architecture Sign-off)

| Item | Decision |
|------|----------|
| **ERP-006** | ✅ **Architecture Complete & Locked** (parent Enterprise Reference) |
| **ERP-006A Freeze** | ✅ **Lifted (Exception)** — [amendment](./ERP-006A-freeze-exception.md) |
| **ERP-006A+ runtime on Production** | ❌ Still blocked until ERP-003 = Pass (+ Staging Completed preferred) |
| Further parent design | ❌ **No more stages on this ADR** |

**Freeze is not idle time.** Non-runtime preparation is **encouraged** — see **[Allowed Preparation During Freeze](#allowed-preparation-during-freeze)** below.

**Forbidden until freeze lifts:** live Gemini (or any Vision) calls that change Courier behavior, wiring upload/review to the new engine, Admin key storage that enables production extraction, retention jobs that change PDF lifecycle in prod, changes to live `/courier/pdf/:id`, runtime adapters behind enabled feature flags, TypeScript Review UI shipping to production.

## Allowed Preparation During Freeze

> Freeze blocks **runtime behavior change**. It does **not** block building the assets that make 006A implementation fast and measurable when gates open.

All items below are **documentation / design / dataset / catalog only**. No production path changes. No live provider calls required (offline paper evaluation only for providers).

Suggested asset home:

```text
docs/adr/erp006-prep/
  README.md
  golden-dataset/
  synthetic-dataset/       # rare / edge cases for ERP-006E
  document-profiles/       # per document-type profile bundles
  schemas/
  prompt-profiles/
  acceptance-cases/
  business-rules/
  explainability/
  review-ux/
  provider-evaluation/
  quality-kpis/
```

(Tree created; fill catalogs/manifests during freeze. See [erp006-prep/README.md](./erp006-prep/README.md).)

**Document Profile** = Classifier target: type + fields + prompt + schema + validation + business rules + confidence policy + multi-device / matching flags.  
**Synthetic Dataset** complements Golden Dataset for rare failures (upside-down, no SIM, two-on-page, ultra-dark, grouping traps).

### 1) Golden Dataset

Collect **100–300** real PDFs/images (PII handled). For each file: ground truth **per device** (`device_id` / `images[]` / fields). This is the highest-leverage freeze asset.

### 1b) Synthetic Dataset

Hand-crafted rare/edge scenarios (cropped, upside-down, no SIM, two devices on one page, ultra-dark, mixed/incomplete packs, grouping traps). Complements Golden; both feed ERP-006E.

### 1c) Document Profiles

One profile per document type (Installation, Maintenance, Replacement, Withdrawal, Return, Inspection, Delivery, Inventory Count, Warehouse Transfer, …). Each profile binds fields, prompt, schema, validation, business rules, confidence policy, `multi_device`, and whether Technician Matching applies. Classifier selects a profile — not a generic instruction set.

### 2) Canonical Schemas

Finalize JSON Schemas per document type (installation, maintenance, replacement, …) aligned with multi-device `device_id` model — drafts only, no runtime registry wiring.

### 3) Prompt Engineering

Write Gemini (and alternate) prompts **per document type** with explicit versioning (`prompt_v1`, …). Store as text assets only.

### 4) Acceptance Test Library

Enumerate cases before code, including at least:

- 1 device / 2 devices / 10 devices  
- Two devices on one page; one device across pages  
- Blurry / skewed / dark images  
- AR / EN / mixed documents  
- Missing TID; unclear SIM; duplicate serial  
- Unknown document type; invalid JSON; provider timeout/disabled  
- Grouping ambiguity → Review  
- Stable `device_id`; `extraction_session_id`; registry versions recorded  
- No API key in logs; legacy OCR unchanged  

(Full suite later maps to `ERP-006A-acceptance-tests.md` when freeze lifts.)

### 5) Business Rules Catalog

Document RASSCO rules (text/YAML), e.g.:

- SN / SIM uniqueness constraints  
- TID bound to one device  
- Matched technician must be Active  
- City consistency / branch must exist  
- Other domain rules as discovered  

Runtime Rule Engine remains **006C/006G** after unfreeze.

### 6) Provider Evaluation (study only)

Compare on paper / offline samples **without** production wiring:

| Provider | Role in evaluation |
|----------|--------------------|
| Gemini 2.5 Pro | Default quality candidate |
| Gemini 2.5 Flash | Latency/cost candidate |
| Azure Document Intelligence | Structured docs |
| Claude Vision | Vision alternative |
| OpenAI Vision | Vision alternative |

Record strengths/weaknesses, cost/latency expectations, PII notes. **No secret storage in repo.**

### 7) Review UX

Full Review UX design (device table, image drill-down, match explainability checklist, feedback capture) — **no TypeScript** shipping under freeze.

### 8) Explainability Catalog

Canonical `matched_reason` vocabulary, e.g.:

- Matched by SN / SIM / TID / Merchant / Branch / Incident / Historical Assignment  
- Manual Selection  
- No match / conflict reasons  

### 9) Confidence Policy

Official bands (tunable later via measurement), e.g.:

| Band | Policy |
|------|--------|
| 97–100 | Auto Accept (field/device policy-configurable) |
| 92–96 | Review Recommended |
| 80–91 | Manual Review Required |
| &lt; 80 | Reject / clear suggestion |

Grouping confidence and match confidence use the same discipline — not extraction % alone.

### 10) Quality KPIs

Define success metrics **before** code:

- Device Grouping Accuracy  
- Extraction Accuracy / Field Accuracy  
- Technician Matching Accuracy  
- False Positive / False Negative rates  
- Average Processing Time  
- Review Rate / Auto Apply Rate  

These feed Quality Dashboard (006D) and ERP-006E gates.

### Freeze prep vs critical path

| Track | Priority |
|-------|----------|
| ERP-002 Staging → Completed | Still required for Full Complete; **no longer blocks isolated 006A** ([exception](./ERP-006A-freeze-exception.md)) |
| ERP-003 → Pass | **Blocks Production** AI enablement (not PR-006A-1 docs / isolated impl) |
| Freeze prep (§1–10) | Continues; feeds PR-006A-1+ |

## Context

Courier PDF review today uses local helpers (`ocr.helper.ts`: PDF text layer + Tesseract/regex). That is classic OCR + pattern matching, weak on phone photos, faint scans, stamps, mixed AR/EN, and tables.

**RASSCO operational facts (design drivers):**

1. A PDF is a **container of multiple devices**, not a document that represents one device.  
2. Uploaded PDFs are **heterogeneous** (installation, maintenance, replacement, removal, multi-device, image-only, scanned, foreign-system export). One prompt cannot serve all types.

Therefore:

- Primary processing unit = **device** (`device_id`) inside the file.  
- First intelligence step = **Document Type Classifier** → selects the extraction prompt/schema profile.

Business fact that also changes storage design:

> **The PDF is temporary. Its only purpose is data extraction; then its role ends.**

Persist extracted **data** (and match + rule outcomes); delete or short-TTL the PDF. No file warehouse.

This aligns with ERP-000: side service (not FSM rewrite), no Redis/Queue as first answer, Courier Import as consumer, one decision per ADR, and **not** a substitute for ERP-004 list-page performance work.

## Decision

### Canonical pipeline (mandatory)

```
Document (immutable upload identity)
    → Document Type Classifier          ← selects Document Profile
    → Extraction Session                ← extraction_session_id
        → Extraction Attempt N          ← re-runs keep prior attempts
    → Page Split + Image Detection
    → Image Quality Analyzer            ← per-image quality_score
    → Image Preprocessing
    → Device Grouping Engine            ← image + labels + spatial + doc context
    → Vision Provider (per device)
    → Relationship Engine
    → Canonical Device Graph            ← graph form of each device (not raw JSON)
    → Matching Engine + Ranking Strategy
    → Validation Rules                  ← structural / presence / schema
    → Review (versioned: v1, v2, …)
    → Business Rules                    ← domain / custody / active tech / …
    → Apply (from Graph + provenance + attempt id)
    → Delete PDF or retain ≤ TTL then delete
```

**Document ≠ Session ≠ Attempt**

```
Document
    └── Extraction Session (extraction_session_id)
            ├── Extraction Attempt 1   ← prompt_v1 / model_a / schema_v3
            ├── Extraction Attempt 2   ← after prompt or model change
            └── Extraction Attempt 3   ← never overwrite Attempt 1–2
```

Same PDF may be re-analyzed after prompt, model, or schema changes. Prior attempt outputs, provenance, and review history are retained for audit and ERP-006E.

**Implementation note:** Classifier may use a lightweight page sample; full page images from Page Split are reused by Quality Analyzer, Preprocess, and Grouping (single render pass preferred in 006A).

**Do not** default to: PDF → Gemini → OCR → Gemini again.  
**Do not** assume “one file = one device.”  
**Do not** use one universal prompt for all document types.  
**Do not** treat Matching as an AI-only Provider peer of Vision.  
A second Vision/OCR pass is allowed **only** if Quality Dashboard measurement proves a material accuracy gain (ERP-000 §1).

```mermaid
flowchart TD
  doc[Document]
  clf[DocumentTypeClassifier]
  sess[ExtractionSession]
  att[ExtractionAttempt_N]
  split[PageSplit_ImageDetection]
  qa[ImageQualityAnalyzer]
  prep[ImagePreprocessing]
  group[DeviceGroupingEngine]
  vision[VisionProvider_per_device]
  rel[RelationshipEngine]
  graph[CanonicalDeviceGraph]
  match[MatchingEngine_Ranking]
  val[ValidationRules]
  review[VersionedReview]
  biz[BusinessRules]
  apply[Apply]

  doc --> clf --> sess --> att --> split --> qa --> prep --> group
  group --> vision --> rel --> graph --> match --> val --> review --> biz --> apply
```

### 1) Document Type Classifier (before Device Grouping)

Not every upload shares the same field set. Classifier assigns a **document type** early so Vision uses the correct prompt profile.

| Type (examples) | Prompt focuses on |
|-----------------|-------------------|
| Installation report | SN, SIM, TID, Merchant, Branch |
| Maintenance report | Fault, Visit Date, Technician, SN |
| Replacement report | Old Device / New Device, Old SN / New SN |
| Removal report | Removed SN/TID, reason, technician |
| Multi-device pack | Same as installation + multi-device grouping |
| Image-only / scan-heavy | Stronger preprocess + Vision; sparse text layer |
| Foreign-system export | Mapped field profile (configurable) |

Output example:

```json
{
  "document_type": "installation_report",
  "document_type_confidence": 94,
  "prompt_profile": "installation_v1",
  "schema_profile": "installation_multi_device_v1"
}
```

Low classifier confidence → default to **generic + Review**, or force manual type selection in UI (006C). Do not guess fields that the type does not require.

### 2) Image Quality Analyzer + Preprocessing

**Quality Analyzer** scores **each image** (not only the device aggregate): blur, rotation, noise, DPI → **`quality_score`** (0–100) stored on that image node.

Example:

```json
{
  "device_id": "device-1",
  "images": [
    { "page": 3, "quality_score": 98 },
    { "page": 4, "quality_score": 15 },
    { "page": 5, "quality_score": 90 }
  ]
}
```

Reviewers and Quality Dashboard can see which image caused failure. Device-level scores may be derived (e.g. min/median) but must not hide per-image scores.

**Preprocessing** (mandatory before Vision), independent of Gemini:

- Denoise · Contrast · Sharpen · Deskew · Auto-rotate · Upscale when DPI is low  

### 3) Device Grouping Engine (before Vision) — **pluggable Grouping Provider**

**Purpose:** Partition the PDF into device candidates. Devices are **not always independent images** — one page may list multiple devices; one overview sheet may reference A and B while other pages are photos of A or B.

Grouping must combine:

```
Image
  + Detected Labels (early SN/TID/SIM/text cues when available)
  + Spatial Relation (layout / same-page adjacency / regions)
  + Document Context (type, section headers, multi-device table rows)
```

**Not** image similarity alone.

```
Grouping Provider   ← heuristic / vision-assisted / future specialized model  (swappable)
Vision Provider     ← Gemini | OpenAI | Azure | Claude | …                 (swappable)
```

Matching is **not** listed here as a peer AI Provider — see Matching Engine (§6).

| Signal | Role |
|--------|------|
| Page sequence | Proximity prior |
| Spatial / layout regions | Same-page multi-device tables |
| Detected labels | Hard links across pages |
| Visual similarity | Soft photo clustering |
| Document context | Installation pack vs overview sheet |

**Conflict / low confidence rule (mandatory):**

> If signals conflict or **Grouping Confidence** is below threshold → **do not merge**. Create **two separate devices** and set status **Review**. Wrong merge is worse than extra Review rows.

Each group gets stable **`device_id`**, `images[]` (with per-image `quality_score`), and `grouping_confidence`.

### 4) Vision extraction (per device) — **pluggable Vision Provider**

Run Vision **once per `device_id`** on that device’s image set. Structured JSON only. Temperature default **0.0**. Prompt/schema from Document Profile / Registry.

### 5) Relationship Engine → **Canonical Device Graph**

**Relationship Engine** binds SN ↔ SIM ↔ TID ↔ merchant/branch within a device and flags conflicts.

Then build **Canonical Device Graph** (mandatory layer) — the **only** object Matching, Validation, Business Rules, Review, and Apply consume. Downstream stages do **not** operate on raw Vision JSON.

Graph nodes/edges include (minimum):

- Device node (`device_id`, fingerprint, status)  
- Identifier nodes (SN, SIM, TID)  
- Commercial nodes (merchant, branch)  
- Image/page nodes (`quality_score`)  
- Edges: extracted_from, co_located_on_page, conflicts_with, …  

New document types or data sources attach to the graph without rewriting Matching/Rules.

### 6) Matching Engine + Ranking Strategy (not an AI Provider)

Matching is a **domain engine**, not a Vision-style provider:

```
Matching Engine
    └── Ranking Strategy   ← SQL cascade + rules + scoring (+ optional embeddings later)
```

May compose:

- SQL lookups  
- Deterministic rules  
- Weighted scoring  
- Optional embedding similarity (future)  

**Cascade when a key is missing:** SN → SIM → TID → Mobile → Merchant → Incident → Branch  

Returns best candidate + `match_confidence` + `matched_by` + **`matched_reason[]`**. Ranking Strategy is versioned and swappable without changing Graph or Review contracts.

### 7) Module topology

```
Document
      │
Document Type Classifier → Document Profile / Schema Registry
      │
Extraction Session → Extraction Attempt N
      │
Grouping Provider
      │
Vision Provider
      │
Relationship Engine → Canonical Device Graph
      │
Matching Engine + Ranking Strategy
      │
Validation Rules
      │
Versioned Review (v1..vn)
      │
Business Rules
      │
Apply (attempt_id + session_id + graph snapshot)
```

### 7b) Canonical Extraction Schema Registry (mandatory)

Each document type is not “a prompt only.” It is a **versioned bundle** resolved by the Classifier:

```
Document Type / Document Profile
      → Schema Version
      → Prompt Version
      → Validation Rules Version
      → Business Rules Version
```

Example registry entries:

| document_type | bundle_id | schema | prompt | validation | business_rules |
|---------------|-----------|--------|--------|------------|----------------|
| installation_report | installation_v1 | schema_v3 | prompt_v2 | validation_v2 | rules_v2 |
| installation_report | installation_v2 | schema_v4 | prompt_v3 | validation_v3 | rules_v3 |
| maintenance_report | maintenance_v1 | schema_v1 | prompt_v1 | validation_v1 | rules_v1 |

**Validation Rules vs Business Rules (mandatory split):**

| Kind | Examples |
|------|----------|
| **Validation Rules** | SN present; SIM present when required by profile; schema-valid JSON; field types/lengths |
| **Business Rules** | Technician inactive; custody closed; device already delivered; branch missing in master; domain policy conflicts |

Separate catalogs and version streams — easier maintenance and clearer Review messages.

**Audit / replay rule:** an extraction **attempt** stores the exact bundle versions used. Reprocessing creates a **new attempt** under the same session (or a new session — policy in 006A spec); never silently overwrite prior attempts. Registry entries are immutable once published.

### 7c) Extraction Session + Attempt IDs (mandatory)

Every run correlates as:

| ID | Role |
|----|------|
| `document_id` | Immutable uploaded file / courier PDF id |
| `extraction_session_id` | e.g. `extract_20260714_000231` — logical analysis campaign for that document |
| `extraction_attempt_id` | e.g. `attempt_3` — one concrete engine run (prompt/model/schema combo) |

Session aggregates attempts; each attempt stores provider/model/registry versions, graph snapshot, devices, timings, and review versions produced against that attempt.

Troubleshooting uses these ids + stored artifacts — not the ephemeral PDF.

### 7d) Human Feedback Loop (cross-cutting — not a new pipeline stage)

Today the path is AI → Review → Apply. Corrections by the reviewer must **not** be discarded.

```
AI → Review → Reviewer Corrections → Learning Dataset → Golden Dataset / ERP-006E
```

When a reviewer edits SN, SIM, TID, Merchant (or match choice), persist:

| Artifact | Purpose |
|----------|---------|
| AI suggestion (pre-edit) | What the engine proposed |
| Human ground truth (post-edit) | What was accepted |
| `extraction_session_id` / `device_id` | Correlation |
| Field-level diffs | Prompt/regression analysis |

Over time this yields thousands of real corrections — the primary fuel for prompt/registry improvements and ERP-006E. **Do not train production models blindly from feedback without 006E gates.** Feedback collection may land in **006C** (on Apply) and feed **006D/006E** datasets.

### 7e) Matching Explainability (cross-cutting)

Confidence alone is insufficient for support and audit. Every match decision includes human-readable reasons:

```json
{
  "matched_by": "serial_number",
  "match_confidence": 97,
  "matched_reason": [
    "SN matched",
    "Branch matched",
    "City matched"
  ]
}
```

Review UI shows checklist evidence (e.g. ✓ SN · ✓ Branch · ✓ City), not only `97%`. Support can answer “why this technician?” from stored reasons bound to `extraction_session_id` / `device_id`.

### 7f) Device Fingerprint (cross-cutting)

Derived **`device_fingerprint`** for operational dedup / cross-file detection — **not** official business identity.

Include more than SN/SIM/TID to reduce collisions. Example (normalize then hash; algorithm versioned as `fingerprint_v2`):

```
device_fingerprint = SHA256(
  document_type | SN | SIM | TID | merchant | branch | model | manufacturer
)
```

Missing parts are omitted or marked empty per policy — never invent identifiers to force a hash. Store fingerprint version in attempt/device provenance.

### 7g) Versioned Review (mandatory for 006C)

Review is not a single overwrite:

```
Review v1 → Review v2 → Review v3
```

Each review version records: who, when, what changed (field diffs), why (optional note), linked `extraction_attempt_id` / `device_id`. Apply binds to a specific review version + attempt. Supports audit and Human Feedback Loop.

### 8) Admin: AI Providers

Vision is **pluggable** — the engine is a multi-provider platform (Gemini | OpenAI | Azure | Claude | …).  
Provider choice, API key, model, enablement, timeouts, and default Document Profile are configured in **system settings** (not inside Courier code).

| Setting | Example |
|---------|---------|
| Vision Provider / Model / Key | Gemini `gemini-2.5-pro` · or OpenAI · or Claude |
| Grouping Provider | `heuristic_v1` / future model id |
| Matching Ranking Strategy | `db_cascade_v1` / `hybrid_score_v1` |
| Temperature / Max Tokens / Timeouts | as needed |
| Confidence / Grouping thresholds | force Review bands |
| Schema Registry / Document Profiles | active bundles |
| Enabled / Disabled | toggle |

**Hard rule:** modules (Courier, Inventory, …) call the AI Engine only via a **Consumer Adapter**. Provider SDKs stay behind the Vision Provider port inside the engine.  
Courier is the **first consumer**, not the owner of the platform — see [ERP-006A-platform-consumer-model.md](./ERP-006A-platform-consumer-model.md).


### 9) JSON only — multi-device schema with stable `device_id`

Never accept free-form model text. Invalid JSON → extraction failure → full manual review.

**Identity rule:** use `device_id` as the cross-stage reference (images, Vision, Relationship, Matching, Review, Apply, provenance). Do **not** rely on array order. `device_index` is display-only ordering.

```json
{
  "extraction_session_id": "extract_20260714_000231",
  "extraction_attempt_id": "attempt_1",
  "document_type": "installation_report",
  "document_type_confidence": 94,
  "registry_bundle_id": "installation_v1",
  "schema_version": "schema_v3",
  "prompt_version": "prompt_v2",
  "validation_rules_version": "validation_v2",
  "business_rules_version": "rules_v2",
  "devices": [
    {
      "device_id": "device-1",
      "device_index": 1,
      "device_fingerprint": "sha256:…",
      "images": [
        { "page": 3, "quality_score": 98 },
        { "page": 4, "quality_score": 15 },
        { "page": 5, "quality_score": 90 }
      ],
      "serial_number": { "value": "...", "confidence": 98 },
      "sim_serial": { "value": "...", "confidence": 95 },
      "tid": { "value": "...", "confidence": 99 },
      "merchant": { "value": "...", "confidence": 90 },
      "branch": { "value": "...", "confidence": 85 },
      "extraction_confidence": 97,
      "grouping_confidence": 92,
      "status": "Ready",
      "match": {
        "technician": { "id": "TECH-193", "name": "أحمد" },
        "city": "الرياض",
        "branch": "...",
        "request_id": 12345,
        "custody_status": "...",
        "installation_status": "...",
        "last_movement": "...",
        "matched_by": "serial_number",
        "match_confidence": 97,
        "matched_reason": ["SN matched", "Branch matched", "City matched"],
        "mismatch_reason": null
      },
      "provenance": {
        "device_id": "device-1",
        "grouping_confidence": 92,
        "extraction_confidence": 97,
        "matching_confidence": 97,
        "processing_time_ms": 1830
      }
    },
    {
      "device_id": "device-2",
      "device_index": 2,
      "device_fingerprint": "sha256:…",
      "images": [
        { "page": 6, "quality_score": 88 },
        { "page": 7, "quality_score": 72 }
      ],
      "serial_number": { "value": "...", "confidence": 96 },
      "sim_serial": { "value": "...", "confidence": 90 },
      "tid": { "value": "...", "confidence": 94 },
      "merchant": { "value": "...", "confidence": 80 },
      "branch": { "value": "...", "confidence": 70 },
      "extraction_confidence": 96,
      "grouping_confidence": 55,
      "status": "Review",
      "match": {
        "technician": null,
        "matched_by": null,
        "match_confidence": 0,
        "matched_reason": [],
        "mismatch_reason": "no_match"
      },
      "provenance": {
        "device_id": "device-2",
        "grouping_confidence": 55,
        "extraction_confidence": 96,
        "matching_confidence": 0,
        "processing_time_ms": 1205
      }
    }
  ],
  "document_meta": {},
  "overall_confidence": 92,
  "missing_fields": []
}
```

**Rejected outputs:** flat `serial_numbers[]` / `sims[]`; “whole PDF = one device” without Grouping; identity by array index only.

### 10) Quality dimensions (independent)

| Metric | Question |
|--------|----------|
| **Document Type Accuracy** | Was the correct prompt/profile selected? |
| **Device Grouping Accuracy** / Grouping Confidence | Correct images per physical device? |
| **Device Extraction Accuracy** | Correct fields once grouped? |
| **Technician Matching Accuracy** | Correct technician/request attached? |
| **Business Rule Pass Rate** | How often Apply is blocked by rules? |

A 99% extraction score on a wrongly merged set is still a **failed** document. Dashboard + Golden Dataset report these separately (ERP-000 §1).

### 11) Smart review bands

| Signal | Policy |
|--------|--------|
| Field confidence **> 95** | Auto-accept field (configurable) |
| Field confidence **80 – 95** | Highlight for reviewer |
| Field confidence **&lt; 80** | Untrusted — force manual |
| Grouping confidence below threshold | Device **Review** |
| Classifier confidence low | Document **Review** / manual type |
| Critical field missing / match failed | **Review** |
| Business Rule Engine violation | Block Apply for affected device(s) |

### 12) Specialized RASSCO prompts (per document type)

Not “Extract all text.” Each profile is directional, e.g.:

- **Installation:** SN, SIM, TID, Merchant, Branch only; empty + low confidence if unsure.  
- **Maintenance:** Fault, Visit Date, Technician, SN.  
- **Replacement:** Old Device / New Device, Old SN / New SN.

Anti-hallucination rule is global: **do not invent** identifiers; JSON only.

### 13) Review UI (reference for 006C — not shipping now)

Device table keyed by `device_id`:

| الجهاز | SN | TID | SIM | عدد الصور | الفني المطابق | الحالة |
|--------|----|-----|-----|-----------|---------------|--------|
| device-1 | … | … | … | 4 | أحمد | Ready |
| device-2 | … | … | … | 3 | محمد | Review |

On select `device_id`: left = images with **per-image quality_score**; center = fields from **Canonical Device Graph**; right = match explainability. Reviews are **versioned** (who/when/diff/why). On Apply, persist corrections into the Human Feedback Loop. Live `/courier/pdf/:id` stays legacy until 006C.

### 14) Validation Rules then Business Rules (before Apply)

Two separate engines on the **Canonical Device Graph**:

| Engine | Role | Examples |
|--------|------|----------|
| **Validation Rules** | Structural / presence / schema | SN required; SIM required by profile; JSON/graph shape valid |
| **Business Rules** | Domain / operational policy | Inactive technician; closed custody; already delivered; branch not in master |

Failures attach to `device_id` (+ review version). Measurable separately on the Quality Dashboard.

### 15) Document lifecycle

```
Document → Session → Attempt → classify → group → Vision → Relationship → Device Graph
  → Matching Engine → Validation Rules → Versioned Review → Business Rules → Apply
```

Optional: retain ≤ 24h then delete. No Drive as primary path under this ADR.

### 16) Quality Dashboard (measurement — ERP-000 §1)

- Documents / devices processed; latency by stage  
- Schema-valid JSON rate  
- Document Type Accuracy  
- Device Grouping / Extraction / Matching Accuracy  
- Average grouping / extraction / matching confidence (**per device**)  
- Business Rule block rate  
- % devices needing Review; top failing fields  

### 17) Golden Dataset

**100–300** documents covering types above + multi-device packs. Ground truth includes `document_type`, `device_id` ↔ `images[]`, fields, and optional match labels.

Measure type / grouping / extraction / matching / rule outcomes after every prompt, model, grouping, schema, or ruleset change. “Feels better” is non-compliant.

Curation allowed during Freeze; live provider benchmarks wait until freeze lifts.

### 18) Provenance — document + **per device** (required when 006A+ ships)

**Document-level** (shared run context):

```json
{
  "extraction_session_id": "extract_20260714_000231",
  "extraction_attempt_id": "attempt_1",
  "document_id": "pdf-3",
  "vision_provider": "gemini",
  "vision_model": "gemini-2.5-pro",
  "grouping_provider": "heuristic_v1",
  "matching_ranking_strategy": "db_cascade_v1",
  "document_type": "installation_report",
  "registry_bundle_id": "installation_v1",
  "prompt_version": "prompt_v2",
  "schema_version": "schema_v3",
  "validation_rules_version": "validation_v2",
  "business_rules_version": "rules_v2",
  "fingerprint_version": "fingerprint_v2",
  "preprocessing_version": "v1",
  "classifier_version": "v1",
  "engine_version": "006A",
  "processing_time_ms": 18420,
  "extracted_at": "ISO-8601"
}
```

**Per-device** (so a 20-device file shows which units need Review):

```json
{
  "device_id": "device-1",
  "grouping_confidence": 98,
  "extraction_confidence": 97,
  "matching_confidence": 94,
  "processing_time_ms": 1830,
  "matched_technician": "TECH-193",
  "matched_by": "serial_number",
  "rule_results": []
}
```

ERP-006E compares against these versions. **Do not implement until freeze lifts.**

### 19) ERP-006E — AI Evaluation & Regression (future, after 006D)

Before accepting changes to model, prompt profiles, preprocessing, **grouping**, **classifier**, schema, or **business rules**: run full Golden Dataset; reject if primary metrics (including Device Grouping Accuracy and Document Type Accuracy) breach approved bands.

## Non-goals

- Treating Matching as an AI Provider peer of Vision (use Matching Engine + Ranking Strategy)  
- Operating Matching/Rules/Review/Apply on raw Vision JSON instead of Canonical Device Graph  
- Overwriting prior Extraction Attempts on re-run  
- Unversioned Review overwrites without who/when/diff  
- Mixing Validation Rules and Business Rules in one undifferentiated engine  
- Per-device quality only without per-image `quality_score`  
- Fingerprint from SN/SIM/TID alone when richer fields are available  
- Embedding Gemini inside Courier FSM  
- Dual Gemini+OCR cascade without measurement proof  
- Hard-wiring Grouping or Vision to a single vendor/model  
- One universal prompt without Document Profiles / Registry  
- Flat unlinked SN/SIM arrays; identity by array index only  
- Forced merge on grouping ambiguity  
- Match results with confidence % only (no `matched_reason[]`)  
- Dropping reviewer corrections  
- Using fingerprint as substitute for official SN/TID business writes  
- Audit that depends on keeping the PDF  
- Shipping Review UI or live Gemini while Freeze is on  
- Claiming list-page performance wins  

## Current baseline (as-is)

| Piece | Today |
|-------|--------|
| Upload | `POST /api/courier/pdf/upload` |
| Review UI | `/courier/pdf/:id` (legacy single-document OCR) |
| Extraction | `extractFromPdf` — text layer + Tesseract + regex |
| Apply | `POST /api/courier/pdf/:id/apply` |

## Implementation packages (when freeze lifts)

**ERP-006** remains the **parent Enterprise Reference Architecture**. After unfreeze, delivery uses **child ADRs** (ERP-000: One ADR = One Decision) so the parent does not keep absorbing implementation detail:

| Child ADR | Decision / scope | Status |
|-----------|------------------|--------|
| **ERP-006A** | Extraction Core … | **PR-006A-1…7 done** — STOP before PR-006A-8 |
| **ERP-006B** | Provider Management (Vision/Grouping admin + secrets) | Frozen |
| **ERP-006C** | **Versioned Review** UI + **Matching Engine/Ranking** + Business Rules runtime + Apply + feedback | Frozen |
| **ERP-006D** | Quality Dashboard + Retention + Metrics (incl. per-image quality) | Frozen |
| **ERP-006E** | Regression + Golden + Synthetic runners (compare attempts) | Frozen (after 006D) |
| **ERP-006F** | Prompt / Schema / Document Profile registry | Planned |
| **ERP-006G** | Validation Rules catalog + Business Rules catalog/runtime split | Planned |
| **ERP-006H** | Explainability + Provenance + Graph audit contracts | Planned |

**Unfreeze (normal path):** ERP-002 Staging Completed **and** ERP-003 = Pass.  
**Unfreeze (exception path — active):** [ERP-006A-freeze-exception.md](./ERP-006A-freeze-exception.md) — docs/contracts/isolated implementation allowed; **no Production rollout** until ERP-003 Pass.

Child ADRs are opened **after** freeze lifts (or as thin prep stubs under `docs/adr/` that contain catalogs only — no code). Do not invent parallel architectures outside this map.

### Architecture lock (2026-07-14) — **CLOSED**

**Decision: ERP-006 Architecture Complete & Locked.**  
No further additions to this parent ADR. Future work = freeze prep assets, then child ADRs / PRs after gates.

Reference flow (immutable for parent scope):

```text
Document
  → Extraction Session
    → Extraction Attempts
      → Device Groups
        → Relationship
          → Canonical Device Graph
            → Matching Engine + Ranking Strategy
              → Validation Rules
                → Versioned Review
                  → Business Rules
                    → Apply
```

Cross-cutting locks (already in this ADR — do not reopen for redesign):

- Schema Registry / Document Profiles · session + attempt ids  
- Pluggable Grouping + Vision providers · Matching = Engine + Ranking Strategy  
- Human Feedback Loop · expanded fingerprint · Explainability · per-image `quality_score`  
- Validation Rules ≠ Business Rules · Graph (not raw Vision JSON) downstream  

**Hard rules:**

1. Grouping ambiguity → split + Review (never auto-merge).  
2. Decisions use grouping + extraction + matching + validation + business rules — not one confidence %.  
3. Registry bundles immutable; upgrades = new versions + 006E.  
4. Re-runs create new **Attempts**; never erase old attempt outputs.  
5. Downstream of Relationship consumes **Device Graph**, not raw Vision JSON.  
6. Review is versioned (who / when / what / why).  
7. Match UI exposes `matched_reason[]`.  
8. Reviewer corrections retained for learning / 006E.

### First deliverable — **PR-006A-1** (authorized now under exception)

```text
GATES: ERP-006A Freeze = Lifted (Exception)
PR-006A-1: Specification → Acceptance Tests → Contracts
```

Files:

- [ERP-006A-implementation-specification.md](./ERP-006A-implementation-specification.md)  
- [ERP-006A-acceptance-tests.md](./ERP-006A-acceptance-tests.md)  
- [ERP-006A-contracts.md](./ERP-006A-contracts.md)  

**No live Gemini / no `/courier/pdf/:id` / no `ocr.helper` in PR-006A-1.**  
Parent architecture remains **Locked**.

## Sequencing vs ERP-002…004

| Track | Rule |
|-------|------|
| ERP-002 / 003 / 004 | Critical path for stability; Staging + 003 Pass still required before **Production** AI |
| ERP-006 design | ✅ Architecture Complete & Locked |
| ERP-006A Freeze | ✅ Lifted (Exception) — [amendment](./ERP-006A-freeze-exception.md) |
| ERP-006A+ Prod rollout | ❌ Until ERP-003 = Pass (+ Staging Completed preferred) |
| Prep work | Continues under `erp006-prep/` |

## Success criteria (engine)

- [ ] Document / Session / **Attempt** model; re-runs preserve prior attempts  
- [ ] **Canonical Device Graph** between Relationship and Matching; Apply from Graph  
- [ ] Grouping uses image + labels + spatial + document context  
- [ ] Per-image **quality_score**  
- [ ] Matching = **Engine + Ranking Strategy** (not Vision-style Provider)  
- [ ] **Validation Rules** separate from **Business Rules**  
- [ ] **Versioned Review** (who/when/diff/why)  
- [ ] Expanded **device_fingerprint** (type/merchant/branch/model/manufacturer + ids)  
- [ ] Schema Registry + Document Profiles; session/attempt correlation ids  
- [ ] Grouping / Vision swappable providers  
- [ ] `matched_reason[]` explainability  
- [ ] Human Feedback Loop  
- [ ] Document Type / Grouping / Extraction / Matching accuracy KPIs  
- [ ] Golden + Synthetic datasets for 006E  
- [ ] Legacy `/courier/pdf/:id` unchanged until 006C  
- [ ] ERP-006E before promoting prompt/model/schema/grouping/rules/ranking changes  

## Consequences

### Positive

- Fits heterogeneous RASSCO document types and multi-device PDFs  
- Higher extraction precision via type-specific prompts  
- Traceable per-device quality in large files  
- Business errors caught before DB write  
- Wrong merges avoided via Review-on-ambiguity  

### Negative / risks

- Classifier mis-type → wrong prompt (mitigate: low confidence → Review)  
- Grouping + Vision + rules add latency — measure on Dashboard  
- Ruleset maintenance required (versioned like prompts)  
- Vendor PII exposure — privacy/retention note required  

## Compliance with ERP-000

| Principle | How ERP-006 complies |
|-----------|----------------------|
| No Optimization Without Measurement | Separate KPIs including type / grouping / extraction / matching / rules |
| No Rewrite Without Justification | Adapter + import only; FSM untouched |
| Performance Before Infrastructure | No Redis/Queue for v1 |
| Backward Compatibility | Legacy `/courier/pdf/:id` until 006C |
| One ADR = One Decision | Engine design; 006A–E deliver packages |
| Measure → Decide → Implement → Verify | Golden Dataset + Dashboard + 006E |
