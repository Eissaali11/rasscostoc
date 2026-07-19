import { describe, expect, it } from "vitest";
import { normalizeSpreadsheetCell } from "./excel.helper";
import { SpreadsheetError } from "./spreadsheet-errors";

/**
 * ADR-002 Commit 3 — unit tests for the central cell-value adapter. This is the
 * single boundary where ExcelJS cell shapes are interpreted; the service layer
 * only ever sees the domain value it returns (string | number | Date | null).
 * Mapping table (ADR-002 §D): String/Number/Date/Null ACCEPT; RichText and
 * Hyperlink accept text only; Boolean/Formula/Error/unknown REJECT (typed).
 */
describe("ADR-002 normalizeSpreadsheetCell adapter", () => {
  it("string -> string", () => {
    expect(normalizeSpreadsheetCell("hello")).toBe("hello");
  });

  it("number -> number", () => {
    expect(normalizeSpreadsheetCell(42)).toBe(42);
  });

  it("Date -> Date (unchanged; downstream normalization handles ISO)", () => {
    const d = new Date("2026-02-01T00:00:00Z");
    expect(normalizeSpreadsheetCell(d)).toBe(d);
  });

  it("null -> null", () => {
    expect(normalizeSpreadsheetCell(null)).toBeNull();
  });

  it("undefined -> null", () => {
    expect(normalizeSpreadsheetCell(undefined as unknown as null)).toBeNull();
  });

  it("rich text -> concatenated plain text only (styles dropped)", () => {
    const rich = { richText: [{ text: "Hel" }, { text: "lo" }] } as never;
    expect(normalizeSpreadsheetCell(rich)).toBe("Hello");
  });

  it("hyperlink -> display text only (URL never surfaced)", () => {
    const link = { text: "click here", hyperlink: "https://evil.example/x" } as never;
    expect(normalizeSpreadsheetCell(link)).toBe("click here");
  });

  it("boolean -> rejected UNSUPPORTED_CELL_TYPE (no silent 'true'/'false')", () => {
    expect(() => normalizeSpreadsheetCell(true as never)).toThrow(SpreadsheetError);
    try {
      normalizeSpreadsheetCell(true as never);
    } catch (e) {
      expect((e as SpreadsheetError).code).toBe("UNSUPPORTED_CELL_TYPE");
    }
  });

  it("formula -> rejected SPREADSHEET_FORMULA_NOT_ALLOWED", () => {
    const cell = { formula: "1+2", result: 3 } as never;
    try {
      normalizeSpreadsheetCell(cell);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(SpreadsheetError);
      expect((e as SpreadsheetError).code).toBe("SPREADSHEET_FORMULA_NOT_ALLOWED");
    }
  });

  it("shared formula -> rejected SPREADSHEET_FORMULA_NOT_ALLOWED", () => {
    const cell = { sharedFormula: "A1", result: 5 } as never;
    try {
      normalizeSpreadsheetCell(cell);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as SpreadsheetError).code).toBe("SPREADSHEET_FORMULA_NOT_ALLOWED");
    }
  });

  it("error cell -> rejected UNSUPPORTED_CELL_TYPE", () => {
    const cell = { error: "#DIV/0!" } as never;
    try {
      normalizeSpreadsheetCell(cell);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as SpreadsheetError).code).toBe("UNSUPPORTED_CELL_TYPE");
    }
  });

  it("unknown object -> rejected (never String(object) fallback)", () => {
    const cell = { somethingWeird: 1 } as never;
    expect(() => normalizeSpreadsheetCell(cell)).toThrow(SpreadsheetError);
  });
});
