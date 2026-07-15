# Acceptance Cases Library (prep)

Case catalog seeds [ERP-006A-acceptance-tests.md](../ERP-006A-acceptance-tests.md) (PR-006A-1).

## Format

Prefer IDs aligned with the official suite (`A01`…`A45`). Fixtures may be YAML/JSON under golden/synthetic trees.

## Mapping (prep → official)

| Prep ID | Official | Scenario |
|---------|----------|----------|
| A01 | A13 | One device, several images |
| A02 | A14 | Three devices, different SNs |
| A03 | A15 | Two devices on one page |
| A04 | A16 | One device across pages |
| A05–A07 | A11–A12 | Skewed / faint / blurry |
| A08 | A23 | Clear SN, unclear SIM |
| A09–A11 | A43 | AR / EN / mixed |
| A12 | A06 | Unknown document type |
| A13 | A20 | Invalid provider JSON |
| A14 | A21 | Provider timeout |
| A15 | A22 | Provider disabled |
| A16 | A44 | Duplicate serial |
| A17 | A17 | Grouping ambiguity → Review |
| A18 | A18 | Stable `device_id` |
| A19 | A01 | `extraction_session_id` created |
| A20 | A30 | Registry versions recorded |
| A21 | A42 | No API key in logs |
| A22 | A39–A40 | Legacy OCR path unchanged |

Full normative suite: **A01–A45** in `ERP-006A-acceptance-tests.md`.
