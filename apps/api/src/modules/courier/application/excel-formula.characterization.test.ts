import { describe, expect, it } from "vitest";
import { parseRawDataWorkbook } from "./excel.helper";
import { buildWorkbookWithCell } from "./__fixtures__/excel-fixtures";

/**
 * ADR-002 Pre-Commit-3 — characterizes the CURRENT (xlsx) reader's handling of
 * FORMULA cells. This documents UNSAFE current behavior on purpose: the reader
 * silently trusts a formula's cached result, and silently nulls a formula with
 * no cached result or an error result. The approved policy (executive decision)
 * is that formulas in imported fields are REJECTED
 * (SPREADSHEET_FORMULA_NOT_ALLOWED). These expectations therefore INVERT in the
 * later reader-migration/policy commit — they are labelled "characterizes
 * current unsafe behavior", not compatibility requirements to preserve.
 */
function valueOnRow3(summary: Awaited<ReturnType<typeof parseRawDataWorkbook>>, field: string) {
  const row = [...summary.imported, ...summary.rejected].find((r) => r.rowNumber === 3);
  return row?.data?.[field] ?? null;
}

describe("ADR-002 characterizes current UNSAFE formula behavior (to be inverted by the new policy)", () => {
  it("formula with a numeric cached result: cached value LEAKS through as the imported value", async () => {
    const buf = await buildWorkbookWithCell("TID", { formula: "1+2", result: 3 });
    const summary = parseRawDataWorkbook(buf);
    // UNSAFE: today the "3" cached result is trusted. New policy: reject.
    expect(valueOnRow3(summary, "tid")).toBe("3");
  });

  it("formula with a string cached result: cached string LEAKS through", async () => {
    const buf = await buildWorkbookWithCell("إسم العميل", { formula: '"hi"', result: "hi" });
    const summary = parseRawDataWorkbook(buf);
    expect(valueOnRow3(summary, "customerName")).toBe("hi");
  });

  it("formula WITHOUT a cached result: silently becomes null (treated as empty)", async () => {
    const buf = await buildWorkbookWithCell("TID", { formula: "1+2" });
    const summary = parseRawDataWorkbook(buf);
    // UNSAFE: an unresolved formula is indistinguishable from an empty cell today.
    expect(valueOnRow3(summary, "tid")).toBeNull();
  });

  it("formula error cell (#DIV/0!): silently becomes null", async () => {
    const buf = await buildWorkbookWithCell("TID", { formula: "1/0", result: { error: "#DIV/0!" } });
    const summary = parseRawDataWorkbook(buf);
    expect(valueOnRow3(summary, "tid")).toBeNull();
  });
});
