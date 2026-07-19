/**
 * ADR-002 — Courier-domain spreadsheet fixtures for characterization tests.
 *
 * These builders generate workbook buffers at test time using the courier
 * import's known headers, so the current xlsx reader's behavior can be locked
 * as a golden master before the exceljs migration and re-verified after it.
 *
 * Domain-neutral, format-level fixtures (legacy .xls sample, corrupt/empty
 * buffers, a minimal valid xlsx) live in
 * `@core/testing/spreadsheet-fixtures` so core-layer tests can use them
 * without a core -> modules dependency.
 */
import ExcelJS from "exceljs";

/** The headers the courier importer recognizes (subset used across fixtures). */
export const KNOWN_HEADERS = [
  "Date", "TID", "TERMINAL ID", "إسم العميل", "Mobile", "Installation type",
] as const;

async function toBuffer(build: (ws: ExcelJS.Worksheet) => void, sheetName = "Sheet1"): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  build(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Valid workbook: header row + 2 importable rows + 1 empty + 1 rejected (no TID/terminal). */
export function buildValidWorkbook(): Promise<Buffer> {
  return toBuffer((ws) => {
    ws.addRow(["Date", "TID", "TERMINAL ID", "إسم العميل", "Mobile"]);
    ws.addRow(["01/02/2026", "T123", "TERM9", "عميل", "0500000000"]);
    ws.addRow(["2026-03-04", "T999", "", "اسم", "0511111111"]);
    ws.addRow([null, null, null, null, null]);
    ws.addRow(["05/06/2026", null, null, "no-tid", null]);
  });
}

/** Header present but TERMINAL ID / TID columns absent entirely. */
export function buildMissingColumnsWorkbook(): Promise<Buffer> {
  return toBuffer((ws) => {
    ws.addRow(["Date", "إسم العميل", "Mobile"]);
    ws.addRow(["01/02/2026", "عميل", "0500000000"]);
  });
}

/** Known headers plus unrecognized extra columns (must be ignored). */
export function buildExtraColumnsWorkbook(): Promise<Buffer> {
  return toBuffer((ws) => {
    ws.addRow(["Date", "TID", "UNKNOWN_COL", "TERMINAL ID", "another junk"]);
    ws.addRow(["01/02/2026", "T1", "ignored", "TERM1", "ignored2"]);
  });
}

/** Header case differs from canonical (importer matches case-insensitively). */
export function buildMixedCaseHeaderWorkbook(): Promise<Buffer> {
  return toBuffer((ws) => {
    ws.addRow(["date", "tid", "terminal id"]);
    ws.addRow(["01/02/2026", "T1", "TERM1"]);
  });
}

/** Only a header row, no data. */
export function buildHeaderOnlyWorkbook(): Promise<Buffer> {
  return toBuffer((ws) => {
    ws.addRow(["Date", "TID", "TERMINAL ID"]);
  });
}

/** Large workbook with N importable rows (perf / row-ceiling fixture). */
export function buildLargeWorkbook(rowCount: number): Promise<Buffer> {
  return toBuffer((ws) => {
    ws.addRow(["Date", "TID", "TERMINAL ID"]);
    for (let i = 0; i < rowCount; i++) {
      ws.addRow(["01/02/2026", "T" + i, "TERM" + i]);
    }
  });
}

/**
 * Workbook whose row-3 cell in `header`'s column holds an arbitrary ExcelJS
 * cell value (used to characterize formula-cell handling). Row 2 is a plain
 * baseline row; the special cell is placed on row 3.
 */
export function buildWorkbookWithCell(
  header: "Date" | "TID" | "TERMINAL ID" | "إسم العميل",
  cellValue: unknown,
): Promise<Buffer> {
  const headers = ["Date", "TID", "TERMINAL ID", "إسم العميل"];
  const colIndex = headers.indexOf(header) + 1;
  return toBuffer((ws) => {
    ws.addRow(headers);
    ws.addRow(["01/02/2026", "T-PLAIN", "TERM1", "plain"]);
    const r3 = ws.addRow(["02/02/2026", "T2", "TERM2", "c2"]);
    r3.getCell(colIndex).value = cellValue as ExcelJS.CellValue;
  });
}
