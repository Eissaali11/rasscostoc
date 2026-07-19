import { describe, expect, it } from "vitest";
import { parseRawDataWorkbook } from "./excel.helper";
import { SpreadsheetError } from "./spreadsheet-errors";
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
 * ADR-002 — golden master for the import reader.
 *
 * The COMPATIBILITY tests below assert the exact same business behavior that
 * the xlsx reader produced (locked in Commit 1); they now run against the
 * ExcelJS reader (Commit 3) and their asserted values are unchanged — this is
 * the proof the library swap preserved behavior. `parseRawDataWorkbook` is now
 * async (ExcelJS has no sync buffer reader), so calls are awaited; values are
 * identical.
 *
 * The POLICY tests assert the deliberate changes approved by the executive
 * gate: invalid/empty content is now a typed rejection (was a silent empty
 * import), and legacy .xls is not readable by ExcelJS (and is already rejected
 * at the upload boundary in Commit 2).
 */
describe("ADR-002 import reader — compatibility (unchanged business behavior)", () => {
  it("valid workbook: maps known columns, normalizes dates, splits imported/rejected", async () => {
    const summary = await parseRawDataWorkbook(await buildValidWorkbook());

    expect(summary.totalRows).toBe(3); // all-null row filtered out before counting
    expect(summary.imported).toHaveLength(2);
    expect(summary.rejected).toHaveLength(1);

    expect(summary.imported[0].data.date).toBe("2026-02-01"); // dd/mm/yyyy -> ISO
    expect(summary.imported[0].data.tid).toBe("T123");
    expect(summary.imported[0].data.terminalId).toBe("TERM9");
    expect(summary.imported[0].data.customerName).toBe("عميل");
    expect(summary.imported[1].data.date).toBe("2026-03-04"); // ISO preserved
    expect(summary.imported[1].data.terminalId).toBeNull(); // empty string -> null

    expect(summary.rejected[0].error).toBe("Missing TID and Terminal ID");
  });

  it("PRESERVED QUIRK: rowNumber is the post-filter index, not the real sheet row", async () => {
    // Physically sheet row 5, reported as 4 (empty row filtered before indexing).
    // Preserved verbatim through the migration per the executive decision.
    const summary = await parseRawDataWorkbook(await buildValidWorkbook());
    expect(summary.rejected[0].rowNumber).toBe(4);
  });

  it("missing columns: absent TID/Terminal columns => every data row rejected", async () => {
    const summary = await parseRawDataWorkbook(await buildMissingColumnsWorkbook());
    expect(summary.totalRows).toBe(1);
    expect(summary.imported).toHaveLength(0);
    expect(summary.rejected).toHaveLength(1);
  });

  it("extra/unknown columns are ignored; known columns still map", async () => {
    const summary = await parseRawDataWorkbook(await buildExtraColumnsWorkbook());
    expect(summary.imported).toHaveLength(1);
    expect(summary.imported[0].data.tid).toBe("T1");
    expect(summary.imported[0].data.terminalId).toBe("TERM1");
  });

  it("header matching is case-insensitive", async () => {
    const summary = await parseRawDataWorkbook(await buildMixedCaseHeaderWorkbook());
    expect(summary.imported).toHaveLength(1);
    expect(summary.imported[0].data.tid).toBe("T1");
  });

  it("header-only workbook yields zero data rows", async () => {
    const summary = await parseRawDataWorkbook(await buildHeaderOnlyWorkbook());
    expect(summary.totalRows).toBe(0);
    expect(summary.imported).toHaveLength(0);
    expect(summary.rejected).toHaveLength(0);
  });
});

describe("ADR-002 import reader — policy (deliberate changes from Commit 1 gaps)", () => {
  it("non-spreadsheet random bytes are now rejected with INVALID_SPREADSHEET (was silent empty)", async () => {
    await expect(parseRawDataWorkbook(CORRUPT_RANDOM_BYTES)).rejects.toMatchObject({
      code: "INVALID_SPREADSHEET",
    });
    await expect(parseRawDataWorkbook(CORRUPT_RANDOM_BYTES)).rejects.toBeInstanceOf(SpreadsheetError);
  });

  it("empty buffer is now rejected with INVALID_SPREADSHEET (was silent empty)", async () => {
    await expect(parseRawDataWorkbook(EMPTY_BUFFER)).rejects.toMatchObject({
      code: "INVALID_SPREADSHEET",
    });
  });

  it("a malformed ZIP is rejected with a typed INVALID_SPREADSHEET (no raw library error)", async () => {
    await expect(parseRawDataWorkbook(FAKE_ZIP_BYTES)).rejects.toBeInstanceOf(SpreadsheetError);
  });

  it("legacy .xls is not readable by the ExcelJS reader (rejected; also blocked at upload boundary)", async () => {
    // Baseline change: the xlsx reader parsed .xls; ExcelJS cannot. In production
    // .xls never reaches here (rejected in Commit 2's upload policy), but the
    // parser itself now also refuses it rather than silently mis-reading.
    await expect(parseRawDataWorkbook(legacyXlsBuffer())).rejects.toMatchObject({
      code: "INVALID_SPREADSHEET",
    });
  });
});
