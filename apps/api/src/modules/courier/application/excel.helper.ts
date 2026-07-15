import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

export interface ImportRowResult {
  rowNumber: number;
  data: Record<string, string | null>;
  error?: string;
}

export interface ImportSummary {
  totalRows: number;
  imported: ImportRowResult[];
  rejected: ImportRowResult[];
}

function normalizeCell(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const str = String(value).trim();
  return str === "" ? null : str;
}

function toIsoDate(value: string | null): string | null {
  if (!value) return null;
  const dmY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (dmY) {
    const [, d, m, y] = dmY;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return iso[0];
  return value;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Mappings of database field names to the headers found in Excel
export const RAW_IMPORT_COLUMNS = [
  { header: "Date", field: "date" },
  { header: "Installation type", field: "installationType" },
  { header: "SIM", field: "sim" },
  { header: "TID", field: "tid" },
  { header: "OTP", field: "otp" },
  { header: "TICKETING HOLOULY", field: "ticketingHolouly" },
  { header: "INCIDENT NUMBER", field: "incidentNumber" },
  { header: "Pin Code", field: "pinCode" },
  { header: "TRSM", field: "trsm" },
  { header: "TERMINAL ID", field: "terminalId" },
  { header: "SIM S/N", field: "simSn" },
  { header: "ID DATA", field: "idData" },
  { header: "Vendor Type", field: "vendorType" },
  { header: "CITY", field: "city" },
  { header: "CITY Tec", field: "cityTec" },
  { header: "إسم العميل", field: "customerName" },
  { header: "RETAILER NAME", field: "retailerName" },
  { header: "عنوان", field: "addressAr" },
  { header: "ADDRESS", field: "addressEn" },
  { header: "Mobile", field: "mobile" },
  { header: "Mobile2", field: "mobile2" },
  { header: "Tec Name", field: "tecName" }
];

export function parseRawDataWorkbook(buffer: Buffer): ImportSummary {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });

  const headerRow = grid[0] || [];
  const normalizedHeaders = headerRow.map(normalizeHeader);

  const fieldToColumnIndex = new Map<string, number>();
  for (const col of RAW_IMPORT_COLUMNS) {
    const idx = normalizedHeaders.findIndex((h) => h.toLowerCase() === col.header.toLowerCase());
    if (idx !== -1) fieldToColumnIndex.set(col.field, idx);
  }

  const dataRows = grid.slice(1).filter((row) => row.some((cell) => cell !== null && cell !== ""));

  const imported: ImportRowResult[] = [];
  const rejected: ImportRowResult[] = [];

  dataRows.forEach((row, idx) => {
    const data: Record<string, string | null> = {};
    for (const col of RAW_IMPORT_COLUMNS) {
      const colIndex = fieldToColumnIndex.get(col.field);
      const raw = colIndex === undefined ? null : row[colIndex];
      data[col.field] = col.field === "date" ? toIsoDate(normalizeCell(raw)) : normalizeCell(raw);
    }

    const rowNumber = idx + 2; // account for header row
    if (!data.tid && !data.terminalId) {
      rejected.push({ rowNumber, data, error: "Missing TID and Terminal ID" });
      return;
    }
    imported.push({ rowNumber, data });
  });

  return { totalRows: dataRows.length, imported, rejected };
}

function fmtTime(t: string | null): string | null {
  if (!t) return t;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min}:00 ${ampm}`;
}

function fmtDate(d: string | null): string | null {
  if (!d) return d;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export const EXPORT_COLUMNS = [
  { header: "Date", get: (r: any) => fmtDate(r.date) },
  { header: "Installation type", get: (r: any) => r.installationType },
  { header: "SIM", get: (r: any) => r.sim },
  { header: "TID", get: (r: any) => r.tid },
  { header: "OTP", get: (r: any) => r.otp },
  { header: "TICKETING HOLOULY", get: (r: any) => r.ticketingHolouly },
  { header: "INCIDENT NUMBER", get: (r: any) => r.incidentNumber },
  { header: "Pin Code", get: (r: any) => r.pinCode },
  { header: "TRSM", get: (r: any) => r.trsm },
  { header: "TERMINAL ID", get: (r: any) => r.terminalId },
  { header: "SIM S/N", get: (r: any) => r.simSn },
  { header: "ID DATA", get: (r: any) => r.idData },
  { header: "Vendor Type", get: (r: any) => r.vendorType },
  { header: "CITY", get: (r: any) => r.city },
  { header: "CITY Tec", get: (r: any) => r.cityTec },
  { header: "إسم العميل", get: (r: any) => r.customerName },
  { header: "RETAILER NAME", get: (r: any) => r.retailerName },
  { header: "عنوان", get: (r: any) => r.addressAr },
  { header: "ADDRESS", get: (r: any) => r.addressEn },
  { header: "Mobile", get: (r: any) => r.mobile },
  { header: "Mobile2", get: (r: any) => r.mobile2 },
  { header: "Tec Name", get: (r: any) => r.tecName },
  { header: "Request Priority Level", get: (r: any) => r.execution?.requestPriorityLevel ?? null },
  { header: "Push Back", get: (r: any) => r.execution?.pushBack ?? null },
  { header: "Installation Status", get: (r: any) => r.execution?.installationStatus ?? null },
  { header: "Paper roll", get: (r: any) => r.execution?.paperRoll ?? null },
  { header: "Time", get: (r: any) => fmtTime(r.execution?.time ?? null) },
  { header: "Delivery Date", get: (r: any) => fmtDate(r.execution?.deliveryDate ?? null) },
  { header: "Response Date", get: (r: any) => fmtDate(r.execution?.responseDate ?? null) },
  { header: "SN", get: (r: any) => r.execution?.sn ?? null },
  { header: "SIM Serial", get: (r: any) => r.execution?.simSerial ?? null },
  { header: "SIM Type", get: (r: any) => r.execution?.simType ?? null },
  { header: "Customer Notes", get: (r: any) => r.execution?.customerNotes ?? null },
  { header: "#", get: (r: any) => r.execution?.extraField1 ?? null },
  { header: "#2", get: (r: any) => r.execution?.extraField2 ?? null },
  { header: "Sales Technician", get: (r: any) => r.execution?.salesTechnician ?? null },
  { header: "Technician code", get: (r: any) => r.execution?.technicianCode ?? null }
];

export async function buildExportWorkbook(rows: any[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "StockPro Operations";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Operations Report", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  sheet.columns = EXPORT_COLUMNS.map((col) => ({
    header: col.header,
    key: col.header,
    width: Math.max(col.header.length + 4, 14)
  }));

  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF284B63" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  rows.forEach((row) => {
    const record: Record<string, string | number | null> = {};
    for (const col of EXPORT_COLUMNS) {
      record[col.header] = col.get(row);
    }
    sheet.addRow(record);
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
      });
    }
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function streamExportWorkbook(
  filePath: string,
  fetchBatch: (offset: number, limit: number) => Promise<any[]>
): Promise<void> {
  const workbookWriter = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: filePath,
    useStyles: true,
    useSharedStrings: true,
  });

  const sheet = workbookWriter.addWorksheet("Operations Report", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  sheet.columns = EXPORT_COLUMNS.map((col) => ({
    header: col.header,
    key: col.header,
    width: Math.max(col.header.length + 4, 14)
  }));

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF284B63" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  headerRow.commit();

  let offset = 0;
  const limit = 5000;
  let rowNumber = 2;

  while (true) {
    const rows = await fetchBatch(offset, limit);
    if (!rows || rows.length === 0) {
      break;
    }

    for (const rowData of rows) {
      const record: Record<string, string | number | null> = {};
      for (const col of EXPORT_COLUMNS) {
        record[col.header] = col.get(rowData);
      }

      const excelRow = sheet.addRow(record);
      if (rowNumber % 2 === 0) {
        excelRow.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
        });
      }
      excelRow.commit();
      rowNumber++;
    }

    offset += limit;
  }

  await sheet.commit();
  await workbookWriter.commit();
}

