import { describe, expect, it } from "vitest";
import { parseRawDataWorkbook } from "./excel.helper";
import {
  buildValidWorkbook,
  buildMissingColumnsWorkbook,
  buildExtraColumnsWorkbook,
  buildMixedCaseHeaderWorkbook,
  buildHeaderOnlyWorkbook,
} from "./__fixtures__/excel-fixtures";
import {
  CORRUPT_RANDOM_BYTES,
  EMPTY_BUFFER,
  FAKE_ZIP_BYTES,
  legacyXlsBuffer,
} from "@core/testing/spreadsheet-fixtures";

/**
 * ADR-002 — Characterization ("golden master") of the CURRENT xlsx-based
 * import reader (parseRawDataWorkbook), captured BEFORE the exceljs
 * migration. These tests intentionally lock present behavior exactly —
 * including quirks and gaps — so the migration can be proven behavior-
 * preserving. Any behavior these tests document as undesirable (e.g. corrupt
 * files silently yielding an empty import, or rowNumber not tracking the real
 * sheet row) is addressed deliberately in a later ADR-002 commit with its own
 * assertions, NOT silently changed here.
 *
 * Runs against the current reader; must be green on the current code.
 */
describe("ADR-002 characterization — current xlsx import reader", () => {
  it("valid workbook: maps known columns, normalizes dates, splits imported/rejected", async () => {
    const summary = parseRawDataWorkbook(await buildValidWorkbook());

    // The all-null row is filtered out before counting, so totalRows = 3, not 4.
    expect(summary.totalRows).toBe(3);
    expect(summary.imported).toHaveLength(2);
    expect(summary.rejected).toHaveLength(1);

    // dd/mm/yyyy -> ISO; already-ISO preserved.
    expect(summary.imported[0].data.date).toBe("2026-02-01");
    expect(summary.imported[0].data.tid).toBe("T123");
    expect(summary.imported[0].data.terminalId).toBe("TERM9");
    expect(summary.imported[0].data.customerName).toBe("عميل");
    expect(summary.imported[1].data.date).toBe("2026-03-04");
    // Empty string cell becomes null.
    expect(summary.imported[1].data.terminalId).toBeNull();

    // Rejection rule: neither TID nor Terminal ID.
    expect(summary.rejected[0].error).toBe("Missing TID and Terminal ID");
  });

  it("KNOWN QUIRK: rowNumber is the post-filter index, not the real sheet row", async () => {
    // The rejected row is physically sheet row 5 (header=1, r2, r3, empty=4, r5),
    // but because the empty row is filtered out before indexing, it reports 4.
    // Locked here so the migration reproduces it; correcting it is a separate decision.
    const summary = parseRawDataWorkbook(await buildValidWorkbook());
    expect(summary.rejected[0].rowNumber).toBe(4);
  });

  it("missing columns: absent TID/Terminal columns => every data row rejected", async () => {
    const summary = parseRawDataWorkbook(await buildMissingColumnsWorkbook());
    expect(summary.totalRows).toBe(1);
    expect(summary.imported).toHaveLength(0);
    expect(summary.rejected).toHaveLength(1);
  });

  it("extra/unknown columns are ignored; known columns still map", async () => {
    const summary = parseRawDataWorkbook(await buildExtraColumnsWorkbook());
    expect(summary.imported).toHaveLength(1);
    expect(summary.imported[0].data.tid).toBe("T1");
    expect(summary.imported[0].data.terminalId).toBe("TERM1");
  });

  it("header matching is case-insensitive", async () => {
    const summary = parseRawDataWorkbook(await buildMixedCaseHeaderWorkbook());
    expect(summary.imported).toHaveLength(1);
    expect(summary.imported[0].data.tid).toBe("T1");
  });

  it("header-only workbook yields zero data rows", async () => {
    const summary = parseRawDataWorkbook(await buildHeaderOnlyWorkbook());
    expect(summary.totalRows).toBe(0);
    expect(summary.imported).toHaveLength(0);
    expect(summary.rejected).toHaveLength(0);
  });

  // --- Security-relevant current behavior (documented gaps) ---

  it("KNOWN GAP: non-spreadsheet random bytes are silently treated as an empty import", async () => {
    // The current reader does NOT reject garbage content; it returns an empty
    // summary. ADR-002 §10 will change this to an explicit rejection — that
    // change will land with its own assertion replacing this one.
    const summary = parseRawDataWorkbook(CORRUPT_RANDOM_BYTES);
    expect(summary.totalRows).toBe(0);
    expect(summary.imported).toHaveLength(0);
  });

  it("KNOWN GAP: empty buffer is silently treated as an empty import", () => {
    const summary = parseRawDataWorkbook(EMPTY_BUFFER);
    expect(summary.totalRows).toBe(0);
  });

  it("a malformed ZIP currently throws (uncaught by the reader)", () => {
    // Distinct from the silent-empty path above: a partial ZIP signature makes
    // the xlsx parser throw. Locked to document that error handling is not
    // uniform today (some bad inputs throw, some return empty).
    expect(() => parseRawDataWorkbook(FAKE_ZIP_BYTES)).toThrow();
  });

  it("the legacy .xls fixture is a genuine BIFF8 file (magic D0CF11E0)", () => {
    // Guards the fixture itself so the future '.xls is rejected' test has a
    // real legacy sample even after xlsx is removed from the tree.
    const buf = legacyXlsBuffer();
    expect(buf.subarray(0, 4).toString("hex").toUpperCase()).toBe("D0CF11E0");
  });

  it("the current reader still parses legacy .xls today (why removal is a behavior change)", () => {
    // Baseline proof that .xls import works right now via xlsx; dropping it in
    // ADR-002 Option A is therefore a deliberate, user-visible change, not a
    // no-op. exceljs cannot read this format.
    const summary = parseRawDataWorkbook(legacyXlsBuffer());
    expect(summary.totalRows).toBe(1);
    expect(summary.imported[0].data.tid).toBe("T123");
  });
});
