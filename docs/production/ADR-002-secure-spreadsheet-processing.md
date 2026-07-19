# ADR-002 — Secure Spreadsheet Processing (xlsx → exceljs)

| | |
|---|---|
| **Status** | IN PROGRESS — Commits 1 (`d90aea3`), 2 (`2e794dd`), 3 (`7dcd117`, reader→ExcelJS) APPROVED; Commit 4 (remove xlsx dep) IMPLEMENTED. Remaining (executive renumbering): Commit 5 = import validation & resource controls; Commit 6 = atomicity/transaction/staging decision; Commit 7 = ADR closure. |
| **Date** | 2026-07-18 (updated 2026-07-19) |
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

1. Replace `parseRawDataWorkbook`'s internals with an `exceljs` reader (`workbook.xlsx.load(buffer)` → iterate first sheet → same `ImportSummary` output). Function name and resolved result shape are preserved, but the invocation contract changed **sync → async** — see the "Invocation-contract note" under Commit 3 (this earlier "signature unchanged" wording is superseded there).
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

---

## Pre-Commit-3 Analysis (authorized: analysis + tests + docs only; reader UNCHANGED)

Required by the executive review gate before the reader migration is authorized.
No production code changed in this phase; evidence added as characterization
tests (`excel-formula.characterization.test.ts`) and this section.

### A. rowNumber usage classification

Traced every `rowNumber` from `parseRawDataWorkbook` outward:

| Hop | Evidence |
|---|---|
| Produced | `excel.helper.ts:95` — `rowNumber = idx + 2` (post-empty-filter index, +1 header) |
| Service | `courier.service.ts:1172` (rejected) and `:1208` (imported: `{rowNumber, id, tid}`) |
| API response | returned via the import controller's `res.json(result)` |
| **UI (user-visible)** | `courier-requests.tsx:331` and `:340` render `{rowNumber}: {error}` in the import-result list |
| Persisted in DB | **NO** — `insertRequest({date, tid, ...})` does not store `rowNumber` |
| Tests / integrations depending on it | **NONE** (outside the ADR-002 characterization test) |
| `item-types-management.tsx` `rowNumber` | **separate, unrelated** client-side import (its own exceljs loop) — out of scope |

**Classification: USER-VISIBLE** (shown in the import-result screen) and part of
the import endpoint's response shape; **NOT PERSISTED**; external-consumer
contract **NOT VERIFIED** (internal admin UI, no evidence of external
consumers). 

**Decision (per executive gate): PRESERVE existing rowNumber semantics exactly
during the reader migration** — including the known quirk that it is the
post-empty-filter index, not the true sheet row. Any correction is a separate,
independently-tested change (proposed follow-up: *"Correct source spreadsheet
row reporting"*), never bundled into the library swap.

### B. Current formula-cell behavior (characterized, UNSAFE)

Probed the current `xlsx` reader; locked as `excel-formula.characterization.test.ts`:

| Formula cell | Current xlsx behavior | New policy (approved) |
|---|---|---|
| numeric cached result | **leaks** the cached value (`"3"`) as the imported value | REJECT — `SPREADSHEET_FORMULA_NOT_ALLOWED` |
| string cached result | **leaks** the cached value (`"hi"`) | REJECT |
| no cached result | silently → `null` (indistinguishable from empty) | REJECT |
| error result (`#DIV/0!`) | silently → `null` | REJECT |

The current reader silently trusts cached results and silently nulls the rest —
exactly the "don't pass a formula through silently as text/0/null/untrusted
cached result" case the policy forbids. The characterization expectations
**invert** in the policy commit.

### C. Cell-value adapter (design only — not implemented)

To keep ExcelJS specifics out of business logic, the new reader introduces one
boundary function in the import layer:

```
normalizeSpreadsheetCell(cell: ExcelJS.Cell): DomainCellValue
```

- `DomainCellValue = string | number | Date | null` (domain-neutral; the service
  layer never sees an ExcelJS object).
- All ExcelJS cell-type rules live in this one adapter; unit-tested in isolation.
- Formula/error handling is enforced here (reject → typed error), so the row
  mapper stays simple and the policy has a single choke point.

### D. ExcelJS cell-type → domain mapping table

| ExcelJS cell type | Imported value | Decision |
|---|---|---|
| `String` | trimmed string (current `normalizeCell`) | ACCEPT |
| `Number` | number → string per current normalization | ACCEPT |
| `Date` | ISO-normalized (current `toIsoDate`/`normalizeCell` handles `Date`) | ACCEPT |
| `Boolean` | not used by any import field | REJECT as `UNSUPPORTED_CELL_TYPE` if in a mapped field; ignore in unmapped columns |
| `Null` / empty | `null` | ACCEPT (per field rules) |
| `RichText` | flattened plain text only | ACCEPT (flatten to `.text`) |
| `Hyperlink` | displayed text only (`.text`), never the URL | ACCEPT (text only) |
| `Formula` | — | **REJECT** → `SPREADSHEET_FORMULA_NOT_ALLOWED` |
| `Error` | — | **REJECT** → `SPREADSHEET_FORMULA_NOT_ALLOWED` (error cells are formula-class) |

`Boolean`, `RichText`, `Hyperlink` decisions are marked **DEFINE** and will get
their own fixtures/tests in the migration commit; none are known to appear in
current legitimate imports (NOT VERIFIED against production data).

### E. Typed parser error contract (design only)

| Code | When | Client message (safe, bilingual) |
|---|---|---|
| `INVALID_SPREADSHEET` | not a readable workbook (was: silent empty import) | "ملف غير صالح… / Invalid spreadsheet file." |
| `EMPTY_WORKBOOK` | zero worksheets | "المصنّف فارغ… / The workbook is empty." |
| `WORKSHEET_NOT_FOUND` | first sheet missing/unreadable | "لا توجد ورقة عمل… / No worksheet found." |
| `SPREADSHEET_FORMULA_NOT_ALLOWED` | formula/error cell in a mapped field | "لا يُسمح باستخدام الصيغ في حقول الاستيراد… / Formulas are not allowed in import fields…" |
| `UNSUPPORTED_CELL_TYPE` | unmappable cell type in a mapped field | "نوع خلية غير مدعوم… / Unsupported cell type…" |
| `SPREADSHEET_LIMIT_EXCEEDED` | row/column ceiling exceeded (Commit 4) | "الملف يتجاوز الحد المسموح… / File exceeds allowed limits." |

Requirements: stable `code`; safe user message; internal cause logged only;
no stack trace, no raw exceljs text, no formula text to the client; carry
`{ row, column }` when available.

> Note: `INVALID_SPREADSHEET` / `EMPTY_WORKBOOK` change the current silent-empty
> behavior (characterized as a gap in Commit 1). Per the executive gate, the
> *typed-error return shape* lands in the reader commit; the enforced **limits**
> (size/row/column/timeout, encrypted rejection) land in the following
> validation commit — kept separate so a regression is attributable.

### F. Estimated xlsx → exceljs result differences

| Aspect | Risk | Mitigation |
|---|---|---|
| Empty-cell → `null` | exceljs iteration must map missing/empty cells to `null` to match `xlsx`'s `defval:null` | adapter + compatibility characterization tests |
| Grid indexing | exceljs `eachRow` skips truly-empty rows differently; rowNumber quirk must be reproduced exactly | preserve current `idx+2` post-filter logic explicitly |
| Dates | both yield JS `Date`; low risk | existing `normalizeCell` |
| Formulas | **behavior intentionally changes** (leak/null → reject) | policy tests (inverted characterization) |
| Number formatting | exceljs may surface numbers vs xlsx strings | normalize in adapter; assert via golden master |

### G. Commit-3 authorization checklist (status)

```
[x] rowNumber usages classified (USER-VISIBLE, not persisted, no integrations)
[x] current formula behavior documented by tests (4 characterization tests)
[x] new formula policy represented (test plan + inverted-expectation note)
[x] ExcelJS cell-type table complete (3 DEFINE items flagged)
[x] adapter boundary designed (normalizeSpreadsheetCell)
[x] typed error contract defined
[x] no production code changed in analysis phase
[x] git tree contains only tests + docs
```

---

## Commit 3 — Reader migration to ExcelJS (IMPLEMENTED)

Authorized scope only: internal reader swap. `xlsx` dependency retained
(removal is Commit 5); no UI, no upload-policy, no transaction/staging, no
limits, no rowNumber change, no row-acceptance-rule change.

### Production files changed
| File | Change |
|---|---|
| `excel.helper.ts` | `parseRawDataWorkbook` reads via ExcelJS (was xlsx); added `normalizeSpreadsheetCell` adapter + internal `structuralCellValue`; now async; throws typed errors. `import * as XLSX` removed. Export path (`buildExportWorkbook`/`streamExportWorkbook`) untouched (already ExcelJS). |
| `spreadsheet-errors.ts` (new) | `SpreadsheetError extends ValidationError` + codes; safe bilingual messages; `internalCause` kept server-side only. |
| `courier.service.ts` | one line: `const summary = await parseRawDataWorkbook(buffer)` (unavoidable async consequence). |

### Invocation-contract note (executive correction — do NOT call this "signature preserved")

`parseRawDataWorkbook` changed from **synchronous to asynchronous** invocation
(`Buffer -> ImportSummary` became `Buffer -> Promise<ImportSummary>`). This is a
contract change, not a fully-preserved signature. Precise classification:

| Aspect | Status |
|---|---|
| Function name | **PRESERVED** |
| Resolved result shape (`ImportSummary`) | **PRESERVED** |
| Invocation contract (sync → async) | **CHANGED** |
| Known repository callers | **UPDATED AND VERIFIED** (only `courier.service.ts`; searched repo-wide) |
| External / undocumented consumers | **NOT VERIFIED** |

Accepted because: all repository call sites were searched, all identified
callers were updated, TypeScript validation passed, and the full regression
suite passed. ExcelJS has no synchronous buffer reader, so the async change is
unavoidable. Earlier phrasing "public signature unchanged" (§8) is superseded by
this classification.

### rowNumber — preserved
Verified identical: the rejected row of the valid fixture is physically sheet
row 5 but still reported as `4` (post-empty-filter index), exactly as before.

### Final cell-type decisions (implemented)
| ExcelJS value | Result |
|---|---|
| string / number / Date / null | ACCEPT (then existing `normalizeCell`/`toIsoDate`) |
| richText | plain text only (joined `.text`) |
| hyperlink | display `.text` only (URL never surfaced) |
| boolean | **REJECT** `UNSUPPORTED_CELL_TYPE` (no proven business use; no silent "true"/"false") |
| formula / sharedFormula | **REJECT** `SPREADSHEET_FORMULA_NOT_ALLOWED` |
| error cell | **REJECT** `UNSUPPORTED_CELL_TYPE` |
| unknown object | **REJECT** `UNSUPPORTED_CELL_TYPE` (never `String(object)`) |

Policy applies only to **mapped** fields; a formula in an unmapped column is
never read (test-proven).

### Errors implemented
`INVALID_SPREADSHEET`, `EMPTY_WORKBOOK`, `WORKSHEET_NOT_FOUND`,
`SPREADSHEET_FORMULA_NOT_ALLOWED`, `UNSUPPORTED_CELL_TYPE` (all thrown, file-
level; formula/unsupported carry `{row, column}`). `SPREADSHEET_LIMIT_EXCEEDED`
defined by the contract but **not enforced** here (Commit 4). Surfaced via the
existing `errorHandler` as safe 400s (`{success:false, message, errors:[{code,
row,column}]}`) — no stack, no raw ExcelJS text, no formula text, no path.

### Deliberate behavior changes (from Commit 1 gaps, approved)
- invalid / empty / non-spreadsheet content: was a **silent empty import** → now
  a typed `INVALID_SPREADSHEET` rejection.
- legacy `.xls`: xlsx read it; ExcelJS cannot → `INVALID_SPREADSHEET` (also
  already blocked at the upload boundary in Commit 2).
- formula/error in a mapped field: was leaked (cached result) or silently nulled
  → now rejected.

### Tests
- `excel-import.characterization.test.ts`: 6 compatibility (identical values) + 4 policy.
- `excel-formula.characterization.test.ts`: 5 policy (formula/error rejected; unmapped-column formula ignored).
- `normalize-spreadsheet-cell.test.ts`: 12 adapter unit tests (all cell types).

### Dependency
`xlsx` **retained** in `package.json` (removal is Commit 5). Verified: **zero
runtime `xlsx` imports remain in production code** (`grep` across `apps/`).

---

## Commit 4 — Remove xlsx dependency (IMPLEMENTED)

Executive renumbering: Commit 4 = remove xlsx; Commit 5 = import validation &
resource controls; Commit 6 = atomicity/transaction/staging decision; Commit 7 =
ADR closure. Dependency removal comes first: isolated, low-risk, independently
reviewable, directly tied to the active advisory, and already backed by zero
runtime imports.

Authorized scope only: remove the package + lockfile + prove absence. No parser
behavior change, no adapter/policy/error change, no limits, no transaction, no
schema/UI/upload-policy change.

### Mandatory dependency search (all forms)

| Pattern | Result |
|---|---|
| `from "xlsx"` / `require("xlsx")` / `import("xlsx")` / `from "xlsx/..."` | **zero** matches (repo-wide) |
| quoted `'xlsx'` / `"xlsx"` | only `package.json` (the dep, removed) + `upload-policy.ts` return-value string `"xlsx"` (magic-byte discriminant — **FALSE POSITIVE**, not the package) |
| executable scripts / test utils / fixture generators requiring xlsx | **none** |
| other `\bxlsx\b` textual hits (45 files) | `.xlsx` extension, ExcelJS's `.xlsx` property, i18n strings, docs — none reference the package |

Classification: PRODUCTION RUNTIME = 0; executable TEST/SCRIPT = 0; the rest are
`.xlsx`-extension / ExcelJS-property / HISTORICAL DOCUMENTATION / FALSE POSITIVE.

### Removal evidence
- Command: `npm uninstall xlsx` (repo package manager: npm; updates package.json + package-lock.json).
- `package.json`: xlsx **removed**.
- Dependency tree: `npm ls xlsx` → **absent**.
- Lockfile: `node_modules/xlsx` entries → **0**.

### Audit delta (npm audit)
| | total | critical | high | moderate | low | xlsx advisory |
|---|---|---|---|---|---|---|
| Before | 38 | 3 | 17 | 15 | 3 | present (HIGH: Prototype Pollution + ReDoS, no fix) |
| After | 37 | 3 | 16 | 15 | 3 | **absent** |

Delta: **−1 HIGH (the xlsx advisory), removed by deleting the package.** The
remaining 37 findings are **other** dependencies (e.g. drizzle-orm, jspdf, vite,
ws, vitest) — their runtime reachability is **NOT VERIFIED** and is separate,
future per-advisory work. Per the executive gate, the success criterion for this
commit is *the xlsx advisory removed + xlsx absent from the tree + no
regression*, not zero advisories repo-wide.

### Fixture safety
The legacy `.xls` BIFF8 fixture is a **static base64 constant** in
`core/testing/spreadsheet-fixtures.ts` — it does **not** import or require xlsx
at test time and is not regenerated during tests. Integrity pinned and asserted
(bytes 3584, magic `D0CF11E0`, SHA-256 `93b0dc99…d36596`). Independent of the
removed package. ✅

### richText note (from the Commit 3 executive review) — confirmed
`normalizeSpreadsheetCell` on a 3-segment rich-text value returns
`"AAABBBCCC"` — segment order preserved, no `[object Object]`. Already covered by
the adapter unit test.
