import { describe, expect, it } from "vitest";
import { parseRawDataWorkbook } from "./excel.helper";
import { buildWorkbookWithCell, buildWorkbookWithUnmappedFormula } from "./__fixtures__/excel-fixtures";

/**
 * ADR-002 Commit 3 — formula SECURITY POLICY (inverted from the Commit 1
 * characterization of unsafe behavior). Formulas and error cells in mapped
 * import fields are now REJECTED at the file level with a typed error, instead
 * of leaking a cached result or silently becoming null.
 */
describe("ADR-002 formula policy — formulas in mapped import fields are rejected", () => {
  it("formula with a numeric cached result is rejected (SPREADSHEET_FORMULA_NOT_ALLOWED)", async () => {
    const buf = await buildWorkbookWithCell("TID", { formula: "1+2", result: 3 });
    await expect(parseRawDataWorkbook(buf)).rejects.toMatchObject({
      code: "SPREADSHEET_FORMULA_NOT_ALLOWED",
      row: 3,
      column: "TID",
    });
  });

  it("formula with a string cached result is rejected", async () => {
    const buf = await buildWorkbookWithCell("إسم العميل", { formula: '"hi"', result: "hi" });
    await expect(parseRawDataWorkbook(buf)).rejects.toMatchObject({
      code: "SPREADSHEET_FORMULA_NOT_ALLOWED",
      column: "إسم العميل",
    });
  });

  it("formula without a cached result is rejected (not silently treated as empty)", async () => {
    const buf = await buildWorkbookWithCell("TID", { formula: "1+2" });
    await expect(parseRawDataWorkbook(buf)).rejects.toMatchObject({
      code: "SPREADSHEET_FORMULA_NOT_ALLOWED",
    });
  });

  it("a formula error cell is rejected (not silently treated as empty)", async () => {
    const buf = await buildWorkbookWithCell("TID", { formula: "1/0", result: { error: "#DIV/0!" } });
    await expect(parseRawDataWorkbook(buf)).rejects.toMatchObject({
      code: "SPREADSHEET_FORMULA_NOT_ALLOWED",
    });
  });

  it("a formula in an UNMAPPED column does not affect the import (column is ignored)", async () => {
    // The formula sits in a column with an unknown header, so it is never read;
    // the row imports on its mapped values.
    const summary = await parseRawDataWorkbook(await buildWorkbookWithUnmappedFormula());
    expect(summary.imported.some((r) => r.rowNumber === 3 && r.data.tid === "T3")).toBe(true);
    expect(summary.rejected).toHaveLength(0);
  });
});
