# Golden Dataset (prep)

**Goal:** 100–300 real RASSCO PDFs/images with **per-device** ground truth.

## Store here

- `manifest.yaml` — file id, document_type, difficulty, anonymization note  
- `ground-truth/<file-id>.json` — expected `devices[]` with `images[]` and fields  
- `NOTES.md` — collection rules, PII policy  

## Do not store

- Raw PII-heavy originals in git if policy forbids (use redacted copies or external secure store + hash index here)  
- API keys or production DB dumps  

## Minimum coverage

Multi-device packs, single device multi-shot, blur/skew/dark, AR/EN/mixed, missing TID, unclear SIM, duplicate SN candidates.
