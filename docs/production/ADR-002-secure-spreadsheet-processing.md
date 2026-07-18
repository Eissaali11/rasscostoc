# ADR-002 — Secure Spreadsheet Processing (xlsx → exceljs)

| | |
|---|---|
| **Status** | PROPOSED — analysis complete, awaiting approval before any code change |
| **Date** | 2026-07-18 |
| **Scope** | Server-side spreadsheet **import** path only |
| **Decision owner** | Chief Software Architect |

---

## Evidence

This architectural decision is based on the following verified evidence:

- **Repository inspection** — `grep` for `xlsx` imports across `apps/` and `packages/` returns exactly **one** product file: `apps/api/src/modules/courier/application/excel.helper.ts`. No other product module imports `xlsx`.
- **Command outputs** — installed versions: `xlsx@0.18.5`, `exceljs@4.4.0` (both already in `node_modules`; `exceljs` already a direct dependency).
- **Static reachability trace** — full call chain confirmed by reading each file (see §3).
- **Advisory** — GHSA for `xlsx`: **Prototype Pollution** and **ReDoS (Regular Expression Denial of Service)**. `npm audit` reports `fixAvailable: false` — there is no patched version on npm.

If any evidence changes, this ADR must be re-evaluated.

> Severity note (governance): the official advisory covers **Prototype Pollution + ReDoS only**. This document does **not** claim RCE or SQL injection for `xlsx`; neither is in the advisory.

---

## 1. Problem Definition

The application parses user-uploaded spreadsheets through `xlsx@0.18.5`, a version with two unpatched, upstream-won't-fix vulnerabilities (Prototype Pollution, ReDoS). The parse runs on **untrusted file content**, so the vulnerable code is genuinely reachable, not merely present in the tree.

## 2. Verified Evidence — reachability facts

| Fact | Evidence |
|---|---|
| `xlsx` used in exactly 1 product file | `excel.helper.ts` only |
| Used **only** on the **read/import** path | `XLSX.read(...)` + `XLSX.utils.sheet_to_json(...)` in `parseRawDataWorkbook` (lines 68–104) |
| **Export already uses `exceljs`** | `buildExportWorkbook` / `streamExportWorkbook` (lines 165–267) use `ExcelJS` exclusively |
| xlsx API surface used | just two calls: `XLSX.read(buffer, {type:"buffer", cellDates:true})` and `XLSX.utils.sheet_to_json(sheet, {header:1, defval:null})` — read first sheet as a 2-D grid |
| Reached via HTTP | `POST /api/courier/requests/import` |
| Auth required | `requireAuth` middleware on the route |
| Upload guarded | `excelUpload.single("file")` (20 MB cap, 1 file, `.xlsx`/`.xls` ext) → `validateExcelUploadMiddleware` (magic-byte check: `504B0304` xlsx / `D0CF11E0` xls) → `uploadErrorHandler` |
| Test coverage of the import path | **NONE** — `grep` finds zero tests referencing `excel.helper`, `parseRawDataWorkbook`, or `importRawRequests` |

## 3. Runtime Reachability (call chain, verified)

```
POST /api/courier/requests/import
  → requireAuth
  → excelUpload.single("file")          (multer diskStorage; 20 MB; ext .xlsx/.xls)
  → validateExcelUploadMiddleware()      (magic bytes 504B0304 / D0CF11E0; malware hook)
  → uploadErrorHandler
  → CourierController.importExcel        (reads file from disk into Buffer)
      → CourierService.importRawRequests(buffer, userId)
          → parseRawDataWorkbook(buffer)   ← xlsx.read + sheet_to_json  (VULNERABLE CODE)
          → per-row: requestsRepo.insertRequest(...)   (NO transaction — see §4 risk)
```

**Exposure level:** authenticated users only (not anonymous). Any logged-in user who can reach the import screen can submit a crafted workbook. Given ERP role distribution, that is a meaningful internal attack surface, not a public one.

## 4. Root Cause

Two independent issues converge on this path:

1. **Dependency risk:** `xlsx@0.18.5` has unpatched Prototype Pollution + ReDoS and no upstream fix on npm.
2. **Pre-existing import robustness gaps** (not caused by xlsx, but in the same blast radius and in scope per the directive):
   - **No transaction / staging:** `importRawRequests` inserts row-by-row with no surrounding transaction, so a mid-file failure leaves a **partial import**.
   - **No idempotency:** re-uploading the same file re-imports non-duplicate rows (dedup is only per-TID existence check, not per-file).
   - **Zero test coverage:** no characterization tests protect current import/export behavior.

## 5. Current Spreadsheet Workflows

- **Import (read):** first worksheet only; row 1 = headers matched case-insensitively against `RAW_IMPORT_COLUMNS` (22 known headers, incl. Arabic); data rows mapped to fields; rows missing both `TID` and `Terminal ID` rejected; dates normalized `dd/mm/yyyy` or ISO → ISO. Output: `{ totalRows, imported[], rejected[] }`.
- **Export (write):** **already `exceljs`** — styled workbook (frozen header, fills, fonts), plus a **streaming** writer (`streamExportWorkbook`) for large datasets in 5 000-row batches. **Out of scope for migration — already safe.**

## 6. Compatibility Matrix — xlsx (current) vs exceljs (target), import path only

| Capability used by `parseRawDataWorkbook` | xlsx 0.18.5 | exceljs 4.4.0 | Verdict |
|---|---|---|---|
| Read `.xlsx` (OOXML) from Buffer | ✅ | ✅ `workbook.xlsx.load(buffer)` | Direct equivalent |
| Read **legacy `.xls`** (BIFF, `D0CF11E0`) | ✅ | ❌ **not supported** | **GAP — decision required (§7)** |
| First worksheet access | ✅ | ✅ `workbook.worksheets[0]` | Equivalent |
| Grid extraction (`header:1`, `defval:null`) | ✅ | ⚠️ manual — iterate `eachRow`/`eachCell`, map empties to `null` | Achievable, needs care on empty cells & row indexing |
| `cellDates:true` (Date objects) | ✅ | ✅ exceljs returns JS `Date` for date cells natively | Equivalent (existing `normalizeCell` handles `Date`) |
| Formula cells | returns computed value | exceljs exposes `{ formula, result }` — must read `.result`/`.value` carefully | Needs explicit handling (also a security control, §10) |

**The single blocking incompatibility is legacy `.xls`.** Everything else has a clean exceljs equivalent.

## 7. Alternatives Considered

| Option | Analysis | Verdict |
|---|---|---|
| **A. Migrate read path to exceljs; drop `.xls`** (reject `.xls` at upload with a clear message) | Removes `xlsx` from the tree entirely. `.xls` is a legacy format; modern exports are `.xlsx`. Requires confirming no active workflow depends on `.xls`. | **Recommended** if §Acceptance evidence shows `.xls` is unused |
| B. Migrate read path to exceljs; keep a **minimal, sandboxed** `.xls`-only reader | Retains `.xls` support but keeps a vulnerable-class dependency (or adds another). Larger surface, contradicts the goal. | Fallback only if `.xls` is proven in active use |
| C. Pin/patch `xlsx` | No upstream fix exists; `npm audit fix` cannot resolve it. | Rejected — not possible |
| D. Do nothing | Leaves a reachable unpatched vuln on an untrusted-input path. | Rejected |

## 8. Chosen Solution (proposed)

**Option A**, conditional on Acceptance-criterion evidence that `.xls` is not in active use:

1. Replace `parseRawDataWorkbook`'s internals with an `exceljs` reader (`workbook.xlsx.load(buffer)` → iterate first sheet → same `ImportSummary` output). **Public function signature unchanged** — callers and return shape identical.
2. Reject `.xls` at the **upload policy** layer (remove from `EXCEL_EXT` / `detectExcelMagic`), returning a clear message directing users to save as `.xlsx`.
3. Remove `xlsx` from `package.json` and lockfile.
4. Add the import-robustness controls in §10 (transaction/staging, formula-injection defense, limits) as part of the same change, since they share the blast radius.

If `.xls` **is** in active use → escalate to a separate decision (Option B vs a controlled deprecation window) before proceeding.

## 9. Migration Plan (REVISED by executive review — contract before implementation)

The reader swap must not precede the format-contract change, or the UI would
accept `.xls` while the new reader cannot parse it (error surfaces only after
the upload gate). Revised, executed sequence:

1. **DONE** `test(import): characterization fixtures + golden master` (`d90aea3`) — locks current behavior; gaps labelled as characterized-unsafe, not requirements to preserve.
2. **THIS COMMIT** `fix(import): restrict spreadsheet uploads to xlsx` — the **format contract**: reject `.xls` at the upload boundary (bilingual message), remove `.xls`/unsupported `.csv` from the UI `accept`, boundary-rejection test with the real BIFF8 fixture. **Reader and `xlsx` dependency unchanged.**
3. `refactor(import): replace xlsx reader with exceljs` — swap `parseRawDataWorkbook` internals only; keep signature; compatibility characterization stays green; typed internal errors (no raw exceljs messages to client). NOT YET AUTHORIZED.
4. `fix(import): validation limits + integrity` — row/column ceilings, timeout, corrupt/encrypted rejection, unified API errors, structured logging, and the transaction-vs-staging decision (still `NOT VERIFIED`). NOT YET AUTHORIZED.
5. `chore(deps): remove xlsx dependency` — drop from package.json/lockfile; re-run audit. NOT YET AUTHORIZED.
6. `docs(adr): close ADR-002 with evidence + SHAs`. NOT YET AUTHORIZED.

### Commit 2 — Format Contract (this commit)

- `apps/api/src/core/uploads/upload-policy.ts`: `EXCEL_EXT` → `.xlsx` only; `fileFilter` rejects `.xls` with `LEGACY_XLS_MESSAGE` and any non-`.xlsx` with `XLSX_ONLY_MESSAGE`; `validateExcelUploadMiddleware` rejects `.xls` **by content** (`detectExcelMagic` still recognizes BIFF8) so a `.xls` renamed to `.xlsx` is caught at the boundary, never at the parser.
- UI `accept` on both courier upload pages: `.xlsx,.xls,.csv` → `.xlsx`. Evidence for dropping `.csv`: no server-side or client-side CSV handling exists (`grep` → none); the attribute was misleading.
- Tests (`excel-upload-policy.adr002.test.ts`): legacy `.xls` (renamed to `.xlsx`) rejected with the exact message and `next()` never called; genuine `.xlsx` passes; fixture integrity pinned (size 3584, magic `D0CF11E0`, SHA-256 `93b0dc99…d36596`).
- `parseRawDataWorkbook` and the `xlsx` dependency are **unchanged** (verified: empty `git diff` on `excel.helper.ts`).

Messages (bilingual):
- Legacy: `صيغة XLS القديمة غير مدعومة. يرجى حفظ الملف بصيغة XLSX ثم إعادة رفعه. | Legacy XLS files are not supported. Please save the file as XLSX and upload it again.`
- Non-xlsx: `يُقبل فقط ملف Excel بصيغة XLSX. | Only .xlsx spreadsheet files are accepted.`

## 10. Validation and Security Controls (to add/verify)

- **Formula injection (import):** never treat a cell that begins `= + - @` as a command; read only computed values (`cell.value`/`.result`), never re-emit raw formulas. On **export**, prefix-escape any string value starting with `= + - @ TAB CR` (CSV/Excel injection defense) — currently **NOT VERIFIED** in `buildExportWorkbook`.
- **Row/column ceiling:** enforce a max row and max column count during parse (defense against decompression-amplified "zip-bomb"-style sheets) — the 20 MB byte cap does **not** bound post-decompression cell count.
- **Processing timeout:** bound parse time; abort oversized/pathological sheets.
- **Type distrust:** do not trust declared cell types or header names beyond the existing case-insensitive allowlist mapping (already done for headers; extend to values).
- **Transaction/staging:** import is all-or-nothing; no partial commit on mid-file error.
- **Idempotency:** re-uploading the same file must not double-import (file-level guard, not only per-TID).
- **Safe errors & logging:** reject corrupt/encrypted files with a user-safe message; log the outcome (counts, filename) **without** logging cell contents (may hold customer PII — the headers include `إسم العميل`, `Mobile`, `ADDRESS`).

## 11. Testing Strategy

Characterization first (lock current behavior), then migrate under green tests:
- Valid current `.xlsx` fixture → exact same `ImportSummary` before/after migration (golden master).
- Missing / extra / reordered columns.
- Corrupt / non-spreadsheet bytes that pass ext but fail parse.
- Encrypted workbook.
- Formula cells (`=1+1`, `=cmd`, `@SUM`) → value read, never executed/re-emitted.
- Unexpected cell types (number where string expected, boolean, error cells).
- Duplicate TID rows (existing dedup preserved).
- Mid-import failure → **full rollback**, zero rows persisted.
- Business-rule invariants unchanged (financial/inventory effects of import identical).
- `.xls` upload → rejected cleanly with guidance (Option A).

## 12. Performance and Memory Tests

- Large-but-legal file at the 20 MB boundary and just over → bounded memory, correct rejection over the cap.
- High row count within cap → parse time within timeout; measure peak RSS.
- Confirm export streaming path (`streamExportWorkbook`) unaffected.

## 13. Rollback Strategy

Each step is an independent, revertible commit. Because the public `parseRawDataWorkbook` signature is unchanged, step 2 is revertible in isolation. `xlsx` removal (step 5) is last, so reverting it restores the old reader if a regression surfaces. No database or runtime-state change is involved.

## 14. Production Risk

- **Low runtime risk** to unrelated features (single file, unchanged signature, export already exceljs).
- **Functional risk:** `.xls` users lose import until they re-save as `.xlsx` — gated by the Acceptance evidence check.
- **Deployment:** blocked regardless by ADR-001 (production release frozen until credential rotation is confirmed). This ADR is engineering remediation, permitted to proceed in the isolated dev branch.

## 15. Acceptance Criteria

```
Reachability of xlsx via the import path                      ✓ VERIFIED (this doc)
.xls active-usage determination                               ☐ REQUIRED before choosing Option A vs B
  (evidence sources: prod access logs / product owner confirmation — NOT VERIFIED here)
Characterization tests capture current import behavior        ☐ (migration step 1)
Import path reads via exceljs; xlsx removed from tree         ☐ (steps 2,5)
Legacy .xls handled per approved option                       ☐ (step 3)
Formula injection defended on import AND export               ☐ (step 10)
Import is transactional (no partial commit)                   ☐ (step 4)
Full regression suite PASS                                    ☐
npm audit: no unresolved critical/high reachable via import   ☐
```

---

## Required Decision (before any code change) — RESOLVED

Both decisions resolved by Executive Decision (2026-07-18):
1. **`.xls` support** → **Option A adopted conditionally** (drop `.xls`, remove `xlsx`), pending the usage investigation below.
2. **Scope of controls** → §10 import-robustness controls (transaction/staging, limits, safe errors, structured logging) are **IN SCOPE** of ADR-002. Export-side **Formula Injection is deferred to ADR-003** unless a quick check proves an actively exploitable path.

---

## .xls Usage Investigation (Decision 1 gate)

Non-disruptive checks performed on the repository (2026-07-19):

| Check | Result |
|---|---|
| Tracked `.xls` fixtures / samples | **none** (`git ls-files \| grep '\.xls$'` → empty) |
| Tests referencing `.xls` | **none** |
| Server code paths for `.xls` | only the upload-policy magic-byte branch (`D0CF11E0` → `"xls"`) and `EXCEL_EXT` allowlist |
| UI advertises `.xls` | **YES** — `accept=".xlsx,.xls,.csv"` on the two courier upload pages (`courier-raw-data.tsx:260`, `courier-requests.tsx:267`) |
| Production upload logs / stored original filenames | **NOT OBSERVABLE** from source (no prod log/DB access) |

**Verdict: NO VERIFIED USAGE FOUND.** `.xls` is *offered* by the UI's `accept` attribute and accepted server-side, but there is no verified business evidence of actual `.xls` imports (no fixtures, no tests, production logs not observable). Per the governance rule *"Security remediation may proceed when legacy compatibility is not supported by verified business evidence,"* **Option A is authorized**: drop `.xls`, and update the UI `accept` attribute + user-facing docs as part of the rejection work (ADR-002 Commit 3).

Side finding (out of scope, logged): the same `accept` attributes advertise `.csv`, but the server's `EXCEL_EXT` allowlist accepts only `.xlsx`/`.xls` — `.csv` uploads are already rejected server-side. UI/server mismatch, unrelated to this ADR.
