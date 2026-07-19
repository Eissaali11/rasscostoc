/**
 * ADR-002 Commit 3 — typed spreadsheet parser errors.
 *
 * Extends ValidationError so the existing errorHandler surfaces a safe,
 * bilingual message plus a stable machine `code` (in `errors[]`) with 400,
 * and never leaks a stack trace, a raw ExcelJS message, formula text, cell
 * content, or an internal file path to the client. `internalCause` is kept
 * for server-side logging only (wiring of structured logging is Commit 4)
 * and is intentionally NOT passed to the client-facing message.
 */
import { ValidationError } from "@core/errors/AppError";

export type SpreadsheetErrorCode =
  | "INVALID_SPREADSHEET"
  | "EMPTY_WORKBOOK"
  | "WORKSHEET_NOT_FOUND"
  | "SPREADSHEET_FORMULA_NOT_ALLOWED"
  | "UNSUPPORTED_CELL_TYPE";
// SPREADSHEET_LIMIT_EXCEEDED is defined by the contract but enforced in Commit 4.

const SAFE_MESSAGES: Record<SpreadsheetErrorCode, string> = {
  INVALID_SPREADSHEET:
    "الملف المرفوع ليس ملف Excel صالحًا. | The uploaded file is not a valid Excel spreadsheet.",
  EMPTY_WORKBOOK:
    "المصنّف فارغ ولا يحتوي على أوراق عمل. | The workbook is empty and contains no worksheets.",
  WORKSHEET_NOT_FOUND:
    "تعذّر العثور على ورقة عمل قابلة للقراءة في الملف. | No readable worksheet was found in the file.",
  SPREADSHEET_FORMULA_NOT_ALLOWED:
    "لا يُسمح باستخدام الصيغ في حقول الاستيراد. يرجى تحويل الخلايا إلى قيم ثابتة ثم إعادة رفع الملف. | Formulas are not allowed in import fields. Please convert the cells to fixed values and upload the file again.",
  UNSUPPORTED_CELL_TYPE:
    "نوع خلية غير مدعوم في أحد حقول الاستيراد. | Unsupported cell type in an import field.",
};

export interface SpreadsheetErrorLocation {
  /** 1-based sheet row as reported to the user (preserves the current rowNumber semantics). */
  row?: number;
  /** Header name of the offending column, when known. */
  column?: string;
  /** Internal diagnostic detail — logged server-side, never sent to the client. */
  internalCause?: string;
}

export class SpreadsheetError extends ValidationError {
  public readonly code: SpreadsheetErrorCode;
  public readonly row?: number;
  public readonly column?: string;
  public readonly internalCause?: string;

  constructor(code: SpreadsheetErrorCode, location: SpreadsheetErrorLocation = {}) {
    // Only the safe machine code + location go to the client via errors[];
    // internalCause is deliberately excluded from the client payload.
    super(SAFE_MESSAGES[code], [
      { code, row: location.row, column: location.column },
    ]);
    this.name = "SpreadsheetError";
    this.code = code;
    this.row = location.row;
    this.column = location.column;
    this.internalCause = location.internalCause;
  }
}
