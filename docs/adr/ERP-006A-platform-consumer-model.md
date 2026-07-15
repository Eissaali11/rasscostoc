# ERP-006A — Platform & Consumer Model (clarification)

**Type:** Architecture clarification (does **not** reopen ERP-006 parent design)  
**Date:** 2026-07-14  
**Status:** Binding terminology for PR-006A-7…10  

## Decision

The AI Document Intelligence Engine is a **central, multi-provider platform**, not a Courier-only feature.

```text
StockPro
   ↓
AI Document Extraction Engine  (@stockpro/ai-extraction + future API)
   ↓
Provider Adapter (Vision port)
   ├── Gemini
   ├── OpenAI
   ├── Claude
   └── future providers
```

**Courier is the first consumer**, not the owner of the engine.

## Hard rule

> Provider SDKs / API keys / model selection **must not** live inside Courier modules.  
> Courier calls the **AI Engine API** only. The engine resolves the active provider from **system settings**.

## Admin settings (target — PR-006A-10)

Operators configure centrally:

| Setting | Example |
|---------|---------|
| Provider | Gemini / OpenAI / Claude / … |
| API Key | stored as secret (not in Courier code) |
| Model | e.g. `gemini-2.0-flash` |
| Enabled | Yes / No |
| Timeout / retries | operational |
| Default extraction profile | Document Profile / registry bundle |

Changing provider does **not** require rewriting PDF review flow.

## Consumer adapters

Each StockPro module that needs extraction uses a **Consumer Adapter** that calls the engine and maps results into that module’s **existing** work UI.

```text
Module UI (e.g. Courier PDF page)   ← user stays here
        ↓
AI Extraction API  (engine boundary)
        ↓
Active Provider Adapter
        ↓
Engine pipeline (process → vision → graph → match → …)
        ↓
Structured result back to the module
```

**Courier product path (binding — see [Courier PDF Primary UX](./ERP-006A-courier-pdf-primary-ux.md)):**

```text
/courier/pdf  = primary work UI
AI Engine     = background service (user does not “enter” the engine)
/ai-review    = internal QA / support tool only
```

Future consumers (same engine):

```text
Inventory → AI Engine
Accounting → AI Engine
Contracts → AI Engine
Courier → AI Engine   ← first consumer
```

## Renamed delivery item

| Old name | New official name |
|----------|-------------------|
| Courier Integration Adapter | **AI Engine Consumer Adapter — Courier** |

### PR-006A-9 value framing (updated 2026-07-14)

PR-006A-9 is the **user-value delivery phase**, not a invisible plumbing-only PR:

- invokes the central engine from **`/courier/pdf`**
- maps multi-device extraction + technician match into **simple cards** on `/courier/pdf/:id`
- completes via **existing** execution / custody flow
- does **not** embed Gemini/OpenAI/Claude
- does **not** make `/ai-review` the daily path

## Planned PR wording (006A-7…10)

| PR | Scope |
|----|--------|
| **PR-006A-7** | Internal AI Review Workspace (`/ai-review`) — QA / support |
| **PR-006A-8** | Business Rules Runtime (pre-Apply) |
| **PR-006A-9** | **Courier PDF value path** — Engine → fill `/courier/pdf/:id` → Complete | **Slice 1 implemented** |
| **PR-006A-10** | Provider & API-key settings UI + Pilot activation (flag) |

Current gate: **STOP before PR-006A-8** until Architecture Sign-off (and product UX decision above remains binding for 006A-9).

## References

- [ERP-006](./ERP-006-ai-document-extraction-engine.md) §8 Admin: AI Providers · pluggable Vision Provider  
- [ERP-006A-freeze-exception.md](./ERP-006A-freeze-exception.md)  
- [ERP-006A-courier-pdf-primary-ux.md](./ERP-006A-courier-pdf-primary-ux.md)  
- [ERP-006A-pr-006a-6.md](./ERP-006A-pr-006a-6.md)  
