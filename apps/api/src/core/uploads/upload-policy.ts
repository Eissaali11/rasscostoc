/**
 * PLATFORM-P0 — Unified upload policy (size, MIME, extension, magic bytes, path safety).
 */

import fs from "fs";
import path from "path";
import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { ValidationError } from "@core/errors/AppError";

export const UPLOAD_LIMITS = {
  pdfImageMaxBytes: 15 * 1024 * 1024, // 15 MB
  excelMaxBytes: 20 * 1024 * 1024, // 20 MB
} as const;

export const PDF_IMAGE_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export const PDF_IMAGE_EXT = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp"]);

export const EXCEL_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

export const EXCEL_EXT = new Set([".xlsx", ".xls"]);

export type MalwareScanResult = { clean: boolean; reason?: string };

/**
 * Malware scan hook — default pass-through.
 * Set UPLOAD_MALWARE_SCANNER=reject to force rejection (tests / future scanner wiring).
 */
export async function scanUploadForMalware(_filePath: string): Promise<MalwareScanResult> {
  if (process.env.UPLOAD_MALWARE_SCANNER === "reject") {
    return { clean: false, reason: "Rejected by malware scan hook" };
  }
  return { clean: true };
}

/** Strip directories and unsafe characters; keep a safe basename + allowlisted extension. */
export function sanitizeUploadFilename(originalName: string, allowedExt: Set<string>): string {
  const base = path.basename(String(originalName || "upload")).replace(/\0/g, "");
  if (base.includes("..") || base.includes("/") || base.includes("\\")) {
    throw new ValidationError("Invalid upload filename");
  }
  const ext = path.extname(base).toLowerCase();
  if (!allowedExt.has(ext)) {
    throw new ValidationError(`File extension not allowed: ${ext || "(none)"}`);
  }
  const stem = path.basename(base, ext).replace(/[^\w.\-()+ ]/g, "_").slice(0, 80) || "file";
  return `${stem}${ext}`;
}

export function assertNoPathTraversal(storedName: string): void {
  const normalized = path.normalize(storedName);
  if (
    normalized.includes("..") ||
    path.isAbsolute(normalized) ||
    normalized.includes("/") ||
    normalized.includes("\\")
  ) {
    throw new ValidationError("Path traversal is not allowed in stored filenames");
  }
}

function readMagicHex(filePath: string, length: number): string {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const n = fs.readSync(fd, buffer, 0, length, 0);
    return buffer.subarray(0, n).toString("hex").toUpperCase();
  } finally {
    fs.closeSync(fd);
  }
}

export function detectPdfOrImageMagic(filePath: string): "pdf" | "png" | "jpeg" | "webp" | null {
  const hex = readMagicHex(filePath, 12);
  if (hex.startsWith("25504446")) return "pdf";
  if (hex.startsWith("89504E47")) return "png";
  if (hex.startsWith("FFD8FF")) return "jpeg";
  if (hex.startsWith("52494646") && hex.includes("57454250")) return "webp";
  return null;
}

export function detectExcelMagic(filePath: string): "xlsx" | "xls" | null {
  const hex = readMagicHex(filePath, 4);
  if (hex === "504B0304") return "xlsx";
  if (hex === "D0CF11E0") return "xls";
  return null;
}

function unlinkQuiet(filePath?: string) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

function rejectUpload(res: Response, message: string, status = 400) {
  return res.status(status).json({
    success: false,
    code: "UPLOAD_POLICY_VIOLATION",
    message,
  });
}

export function createPdfImageUpload(destDir: string) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, destDir),
    filename: (_req, file, cb) => {
      try {
        const safe = sanitizeUploadFilename(file.originalname, PDF_IMAGE_EXT);
        const ext = path.extname(safe).toLowerCase();
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        assertNoPathTraversal(unique);
        cb(null, unique);
      } catch (err) {
        cb(err as Error, "");
      }
    },
  });

  return multer({
    storage,
    limits: { fileSize: UPLOAD_LIMITS.pdfImageMaxBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const mimeOk = PDF_IMAGE_MIME.has(file.mimetype) || file.mimetype.startsWith("image/");
      const extOk = PDF_IMAGE_EXT.has(ext);
      if (mimeOk && extOk) {
        cb(null, true);
      } else {
        cb(new ValidationError("Only PDF and Image files (PNG, JPG, JPEG, WEBP) are allowed") as any);
      }
    },
  });
}

export function createExcelUpload(destDir: string) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, destDir),
    filename: (_req, file, cb) => {
      try {
        const safe = sanitizeUploadFilename(file.originalname, EXCEL_EXT);
        const ext = path.extname(safe).toLowerCase();
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        assertNoPathTraversal(unique);
        cb(null, unique);
      } catch (err) {
        cb(err as Error, "");
      }
    },
  });

  return multer({
    storage,
    limits: { fileSize: UPLOAD_LIMITS.excelMaxBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!EXCEL_EXT.has(ext)) {
        cb(new ValidationError("Only Excel files (.xlsx, .xls) are allowed") as any);
        return;
      }
      if (!EXCEL_MIME.has(file.mimetype) && file.mimetype !== "") {
        // Some browsers send empty/odd MIME; extension + magic bytes are authoritative.
      }
      cb(null, true);
    },
  });
}

export function validatePdfImageUploadMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return next();

    try {
      assertNoPathTraversal(path.basename(file.filename || file.path));
      const kind = detectPdfOrImageMagic(file.path);
      if (!kind) {
        unlinkQuiet(file.path);
        return rejectUpload(
          res,
          "الملف المرفوع غير صالح. الأنواع المسموح بها هي PDF و PNG و JPG و WEBP فقط بناءً على محتوى الملف.",
        );
      }

      const scan = await scanUploadForMalware(file.path);
      if (!scan.clean) {
        unlinkQuiet(file.path);
        return rejectUpload(res, scan.reason || "Upload rejected by security scan", 400);
      }

      return next();
    } catch (err) {
      unlinkQuiet(file.path);
      return next(err);
    }
  };
}

export function validateExcelUploadMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return next();

    try {
      assertNoPathTraversal(path.basename(file.filename || file.path));
      const kind = detectExcelMagic(file.path);
      if (!kind) {
        unlinkQuiet(file.path);
        return rejectUpload(
          res,
          "الملف المرفوع غير صالح. يجب أن يكون ملف Excel حقيقي (.xlsx أو .xls).",
        );
      }

      const scan = await scanUploadForMalware(file.path);
      if (!scan.clean) {
        unlinkQuiet(file.path);
        return rejectUpload(res, scan.reason || "Upload rejected by security scan", 400);
      }

      return next();
    } catch (err) {
      unlinkQuiet(file.path);
      return next(err);
    }
  };
}

/** Multer error → consistent JSON (file size / unexpected field). */
export function uploadErrorHandler(err: any, _req: Request, res: Response, next: NextFunction) {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return rejectUpload(res, "File exceeds the maximum allowed size", 413);
    }
    return rejectUpload(res, err.message || "Upload failed", 400);
  }
  if (err instanceof ValidationError) {
    return rejectUpload(res, err.message, 400);
  }
  return next(err);
}
