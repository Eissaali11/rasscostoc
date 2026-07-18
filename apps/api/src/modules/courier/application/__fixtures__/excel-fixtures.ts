/**
 * ADR-002 — Deterministic spreadsheet fixtures for characterization tests.
 *
 * These builders generate workbook buffers at test time (no opaque binary
 * blobs in git) so the current xlsx reader's behavior can be locked as a
 * golden master before the exceljs migration, and re-verified identically
 * after it. The one exception is LEGACY_XLS_BASE64: a real legacy .xls
 * (BIFF8, magic D0CF11E0) captured here as base64 because exceljs cannot
 * WRITE .xls, and the future '.xls is rejected' test still needs a genuine
 * sample after xlsx is removed from the tree.
 */
import ExcelJS from "exceljs";

/** The 22 headers the importer recognizes (subset used across fixtures). */
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

/** Non-spreadsheet random bytes (passes extension, fails as content). */
export const CORRUPT_RANDOM_BYTES = Buffer.from("this is not a spreadsheet at all");

/** Empty buffer. */
export const EMPTY_BUFFER = Buffer.alloc(0);

/** Bytes that look like a ZIP header but are truncated/invalid. */
export const FAKE_ZIP_BYTES = Buffer.from("504b0304ffffff", "hex");

/** A genuine legacy .xls (BIFF8) sample — see file header for why base64. */
export const LEGACY_XLS_BASE64 =
  "0M8R4KGxGuEAAAAAAAAAAAAAAAAAAAAAPgADAP7/CQAGAAAAAAAAAAAAAAABAAAAAgAAAAAAAAAAEAAAAQAAAAEAAAD+////AAAAAAAAAAD////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////9/////v////7///8EAAAABQAAAP7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7///8CAAAAAwAAAAQAAAAFAAAABgAAAAcAAAAIAAAACQAAAAoAAAALAAAADAAAAA0AAAAOAAAADwAAABAAAAARAAAAEgAAABMAAAAUAAAA/v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+////UgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQABQH//////////wEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAQAUAAAAAAAABAFMAaAAzADMAdABKADUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEgACAf////8CAAAA/////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAFcAbwByAGsA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";

export function legacyXlsBuffer(): Buffer {
  return Buffer.from(LEGACY_XLS_BASE64, "base64");
}
