# ERP-006A — Courier PDF Primary UX (product decision)

**Type:** Product / UX clarification (does **not** reopen ERP-006 parent design)  
**Date:** 2026-07-14  
**Status:** **Accepted** — binding for PR-006A-9 framing  
**Does not:** start PR-006A-8 or PR-006A-9 · does not enable production AI

## Decision

The **daily user path** for extraction value is the existing Courier PDF surface — not `/ai-review`.

```text
المستخدم
    ↓
يرفع PDF                    →  /courier/pdf
    ↓
المحرك يحلل المستند         →  AI Engine (خلفية)
    ↓
يستخرج جميع الأجهزة
    ↓
يملأ الحقول تلقائيًا        →  /courier/pdf/:id
    ↓
يطابق كل جهاز مع الفني
    ↓
يعرض النتيجة للمراجعة       →  بطاقات أجهزة بسيطة
    ↓
المستخدم يضغط «إكمال»
    ↓
نفس منطق شاشة التنفيذ الحالية (خصم العهدة / الحالة / إنشاء التنفيذ)
```

**Users must not need to learn** Graph, Session, Attempt, Provider, or `/ai-review`.

## Surface roles

| Surface | Role |
|---------|------|
| **`/courier/pdf` + `/courier/pdf/:id`** | **Primary work UI** — upload, wait, review devices, complete |
| **AI Engine** (`@stockpro/ai-extraction`) | Background service — multi-provider, not owned by Courier |
| **`/ai-review`** | **Internal only** — admin / QA / developers / support for hard cases |

## Target user screen (on `/courier/pdf/:id`)

Keep the user on the same route. Present a **simple device list**, for example:

- Summary: «تم اكتشاف N جهازًا»
- Per device card: SN · SIM · TID · الفني المقترح · الثقة · الحالة (مطابقة ناجحة / تحتاج مراجعة)
- Actions: تصحيح الحالات الغامضة · **إكمال جميع الأجهزة**
- Complete = existing execution / custody deduction path (no parallel FSM)

Do **not** expose engine internals in this UI.

## PR-006A-9 reframed (value delivery)

| Old framing | New official framing |
|-------------|----------------------|
| Thin “Consumer Adapter” only | **User-value delivery phase** — wire AI Engine into Courier PDF so the path above works end-to-end |

Still true (hard rules unchanged):

- No provider SDKs inside Courier  
- Courier calls AI Engine only  
- Engine remains multi-consumer platform  
- Complete uses **existing** execution / custody logic  

Suggested pipeline the user never sees:

```text
رفع PDF → AI Engine → استخراج الأجهزة → مطابقة الفني
      → تعبئة /courier/pdf/:id → إكمال الطلب
```

## Relation to PR-006A-7 / 8

| Item | Implication |
|------|-------------|
| PR-006A-7 `/ai-review` | Remains **internal quality tool**; not the daily path |
| UX Gate on `/ai-review` | Still useful for engine explainability / graph / matching QA |
| PR-006A-8 Business Rules | Pre-Apply validation feeding the simple Courier cards |
| PR-006A-9 | Delivers the product loop on `/courier/pdf` |

## Official gate (unchanged for live engine)

```text
PR-006A-9 Slice 1 = Implemented (OCR → cards → complete via saveExecution)
PR-006A-7 Accepted / UX Gate PASS → PENDING (internal tool)
START PR-006A-8 → NOT issued
Live AI Engine Slice 2 → NOT issued (flag off)
```

## Slice 1 delivery note

See [ERP-006A-pr-006a-9.md](./ERP-006A-pr-006a-9.md): upload normalizes to `devices[]`, review UI shows simple cards + serial-lookup, complete uses `saveExecution`.

## References

- [ERP-006A-platform-consumer-model.md](./ERP-006A-platform-consumer-model.md)  
- [ERP-006A-pr-006a-7.md](./ERP-006A-pr-006a-7.md)  
- [ERP-006A-pr-006a-7-ux-gate.md](./ERP-006A-pr-006a-7-ux-gate.md)  
- Production surfaces: https://stc1.fun/courier/pdf · https://stc1.fun/courier/requests  
