# ERP-006 Preparation Assets

**Parent:** Architecture Complete & Locked  
**Freeze:** [ERP-006A Freeze = Lifted (Exception)](../ERP-006A-freeze-exception.md)

Prep assets feed **PR-006A-1** and later isolated implementation. They do **not** authorize Production AI enablement (still requires ERP-003 = Pass).

## Rules

| Allowed | Forbidden |
|---------|-----------|
| Markdown / YAML / JSON Schema drafts | Production TypeScript that changes Courier hot paths |
| Anonymized dataset manifests & ground-truth indexes | Live Gemini / Vision API on production |
| UX wireframes / Figma export notes | Changes to `/courier/pdf/:id` or `ocr.helper.ts` in 006A |
| Provider comparison notes (no secrets) | Feature flags enabled in production |
| Catalogs (profiles, rules, explainability, KPIs) | Queue / Redis / Drive / Admin key storage under 006A |

## Layout

```text
erp006-prep/
├── README.md
├── golden-dataset/
├── synthetic-dataset/
├── document-profiles/
├── schemas/
├── prompt-profiles/
├── acceptance-cases/
├── business-rules/
├── explainability/
├── review-ux/
├── provider-evaluation/
└── quality-kpis/
```

## Current delivery gate

1. **PR-006A-1** — [Spec](../ERP-006A-implementation-specification.md) · [Acceptance](../ERP-006A-acceptance-tests.md) · [Contracts](../ERP-006A-contracts.md)  
2. Later PRs only after PR-006A-1 approval  
3. **No Production rollout** until ERP-003 Pass  

Do not invent schemas/prompts in application code first — start from this tree + Registry contracts.
