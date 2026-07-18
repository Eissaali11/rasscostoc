/**
 * ADR-002 — Format-level spreadsheet test fixtures (domain-neutral).
 *
 * Lives in core/testing so both the core upload-policy tests and feature
 * modules can use it without a core -> modules dependency. Domain-specific
 * workbooks (courier headers, etc.) belong in their own module's fixtures.
 */
import ExcelJS from "exceljs";

/** A minimal, valid .xlsx with neutral headers (no domain meaning). */
export async function buildMinimalXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(["A", "B", "C"]);
  ws.addRow(["1", "2", "3"]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Non-spreadsheet random bytes (passes an extension check, fails as content). */
export const CORRUPT_RANDOM_BYTES = Buffer.from("this is not a spreadsheet at all");

/** Empty buffer. */
export const EMPTY_BUFFER = Buffer.alloc(0);

/** Bytes that look like a ZIP header but are truncated/invalid. */
export const FAKE_ZIP_BYTES = Buffer.from("504b0304ffffff", "hex");

/**
 * legacy-xls-minimal-fixture — a genuine legacy .xls (BIFF8) sample.
 *
 * Purpose: gives the ".xls is rejected" tests a real BIFF8 file even after
 * the xlsx package is removed from the tree (exceljs cannot write .xls).
 * Creation (deterministic, one-off): generated with the currently-installed
 * xlsx writer from the array
 *   [["Date","TID","TERMINAL ID","customer"],
 *    ["01/02/2026","T123","TERM9","sample"]]
 * via XLSX.write(wb, { bookType: "xls", type: "buffer" }).
 * Contains no real or sensitive data. Integrity pinned below and asserted in
 * tests, so it is never silently swapped or regenerated.
 */
export const LEGACY_XLS_SHA256 =
  "93b0dc992a4b0480ce44e56dc6fb881161e967447130bfe38b6c082860d36596";
export const LEGACY_XLS_BYTES = 3584;

export const LEGACY_XLS_BASE64 =
  "0M8R4KGxGuEAAAAAAAAAAAAAAAAAAAAAPgADAP7/CQAGAAAAAAAAAAAAAAABAAAAAgAAAAAAAAAAEAAAAQAAAAEAAAD+////AAAAAAAAAAD////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////9/////v////7///8EAAAABQAAAP7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7///8CAAAAAwAAAAQAAAAFAAAABgAAAAcAAAAIAAAACQAAAAoAAAALAAAADAAAAA0AAAAOAAAADwAAABAAAAARAAAAEgAAABMAAAAUAAAA/v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+/////v////7////+////UgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQABQH//////////wEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAQAUAAAAAAAABAFMAaAAzADMAdABKADUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEgACAf////8CAAAA/////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAFcAbwByAGsAYgBvAG8AawAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASAAIB////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAPYEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD///////////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3MjYyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACQgQAAAGBQBics0HCcABAAYHAADhAAIAsATBAAIAAADiAAAAXABwAAcAAFNoMzN0SlMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABCAAIAsARhAQIAAADAAQAAPQECAAEAnAACABEAGQACAAAAEgACAAAAEwACAAAArwECAAAAvAECAAAAPQASAAAAAABgcsBEOAAAAAAAAQD0AUAAAgAAAI0AAgAAACIAAgAAAA4AAgABALcBAgAAANoAAgAAADEAGgDwAAAAAACQAQAAAAAAAAUBQQByAGkAYQBsAB4ENQA4ABgAASIACk5IUy8AC05IUyAAIgBoAGgAIgBCZiIAbQBtACIABlIiAHMAcwAiANJ5IAAiAOAAFAAAAAAA9P8AAAAAAAAAAAAAAAAAAOAAFAAAAAAA9P8AAAAAAAAAAAAAAAAAAOAAFAAAAAAA9P8AAAAAAAAAAAAAAAAAAOAAFAAAAAAA9P8AAAAAAAAAAAAAAAAAAOAAFAAAAAAA9P8AAAAAAAAAAAAAAAAAAOAAFAAAAAAA9P8AAAAAAAAAAAAAAAAAAOAAFAAAAAAA9P8AAAAAAAAAAAAAAAAAAOAAFAAAAAAA9P8AAAAAAAAAAAAAAAAAAOAAFAAAAAAA9P8AAAAAAAAAAAAAAAAAAOAAFAAAAAAA9P8AAAAAAAAAAAAAAAAAAOAAFAAAAAAA9P8AAAAAAAAAAAAAAAAAAOAAFAAAAAAA9P8AAAAAAAAAAAAAAAAAAOAAFAAAAAAA9P8AAAAAAAAAAAAAAAAAAOAAFAAAAAAA9P8AAAAAAAAAAAAAAAAAAOAAFAAAAAAA9P8AAAAAAAAAAAAAAAAAAOAAFAAAAAAA9P8AAAAAAAAAAAAAAAAAAOAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAGABAgAAAIUAFAAxAwAAAAAGAVMAaABlAGUAdAAxAIwABAABAAEA/AAIAAAAAAAAAAAACgAAAAkIEAAABhAAYnLNBwnAAQAGBwAADQACAAEADAACAGQADwACAAEAEQACAAAAEAAIAPyp8dJNYlA/XwACAAEAKgACAAAAKwACAAAAggACAAEAgAAIAAAAAAAAAAAAgwACAAAAhAACAAAAAAIOAAAAAAACAAAAAAAEAAAABAIRAAAAAAAQAAQAAUQAYQB0AGUABAIPAAAAAQAQAAMAAVQASQBEAAQCHwAAAAIAEAALAAFUAEUAUgBNAEkATgBBAEwAIABJAEQABAIdAAAAAwAQAAoAASUGMwZFBiAAJwZEBjkGRQZKBkQGBAIdAAEAAAAQAAoAATAAMQAvADAAMgAvADIAMAAyADYABAIRAAEAAQAQAAQAAVQAMQAyADMABAITAAEAAgAQAAUAAVQARQBSAE0AOQAEAh8AAQADABAACwABOQZFBkoGRAYgACoGLAYxBkoGKAZKBj4CEgC2BgAAAABAAAAAAAAAAAAAAAC6AQ8ABgABUwBoAGUAZQB0ADEAZwgTAGcIAAAAAAAAAAAAAAMAAQAAAABoCCcAaAgAAAAAAAAAAAAAAwAAAAAAAAEABAAAAAAAAAABAAAAAwAEAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

export function legacyXlsBuffer(): Buffer {
  return Buffer.from(LEGACY_XLS_BASE64, "base64");
}
