import type { Express } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { CourierController } from "../controllers/courier.controller";
import { requireAuth } from "@core/middlewares/auth.middleware";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "pdf");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isPdf = file.mimetype === "application/pdf" || ext === ".pdf";
    const isImage = file.mimetype.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp"].includes(ext);
    if (isPdf || isImage) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and Image files (PNG, JPG, JPEG, WEBP) are allowed") as any);
    }
  }
});

const excelUpload = multer({
  dest: path.join(process.cwd(), "uploads", "temp")
});

function validateFileMagicBytes(req: any, res: any, next: any) {
  if (!req.file) {
    return next();
  }
  
  try {
    const fd = fs.openSync(req.file.path, "r");
    const buffer = Buffer.alloc(12);
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    const hex = buffer.toString("hex").toUpperCase();

    // Check PDF: %PDF (25504446)
    const isPdf = hex.startsWith("25504446");
    
    // Check PNG: 89504E47
    const isPng = hex.startsWith("89504E47");
    
    // Check JPEG: FFD8FF
    const isJpeg = hex.startsWith("FFD8FF");
    
    // Check WEBP: RIFF....WEBP (52494646....57454250)
    const isWebp = hex.startsWith("52494646") && hex.endsWith("57454250");

    if (isPdf || isPng || isJpeg || isWebp) {
      return next();
    }

    // Delete the invalid file
    fs.unlinkSync(req.file.path);
    return res.status(400).json({
      success: false,
      message: "الملف المرفوع غير صالح. الأنواع المسموح بها هي PDF و PNG و JPG و WEBP فقط بناءً على محتوى الملف."
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    return next(err);
  }
}

function validateExcelMagicBytes(req: any, res: any, next: any) {
  if (!req.file) {
    return next();
  }
  
  try {
    const fd = fs.openSync(req.file.path, "r");
    const buffer = Buffer.alloc(4);
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);

    const hex = buffer.toString("hex").toUpperCase();

    // Check ZIP/Office Open XML (PK..): 504B0304 or legacy D0CF11E0
    const isXlsx = hex === "504B0304";
    const isXls = hex === "D0CF11E0";

    if (isXlsx || isXls) {
      return next();
    }

    // Delete the invalid file
    fs.unlinkSync(req.file.path);
    return res.status(400).json({
      success: false,
      message: "الملف المرفوع غير صالح. يجب أن يكون ملف Excel حقيقي (.xlsx أو .xls)."
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    return next(err);
  }
}

export function registerCourierRoutes(app: Express): void {
  const controller = new CourierController();

  // Requests CRUD
  app.get("/api/courier/requests", requireAuth, controller.getRequests);
  app.get("/api/courier/requests/export", requireAuth, controller.exportExcel);
  app.post("/api/courier/requests/import", requireAuth, excelUpload.single("file"), validateExcelMagicBytes, controller.importExcel);
  app.get("/api/courier/requests/:id", requireAuth, controller.getRequest);
  app.post("/api/courier/requests", requireAuth, controller.createRequest);
  app.put("/api/courier/requests/:id", requireAuth, controller.updateRequest);
  app.delete("/api/courier/requests/:id", requireAuth, controller.deleteRequest);

  // Request Items & Two-Phase Custody Acceptance
  app.get("/api/courier/requests/:requestId/items", requireAuth, controller.getRequestItems);
  app.post("/api/courier/requests/:requestId/items", requireAuth, controller.assignRequestItems);
  app.post("/api/courier/requests/:requestId/accept", requireAuth, controller.acceptRequest);
  app.post("/api/courier/requests/:requestId/scan", requireAuth, controller.scanRequestItem);
  app.post("/api/courier/requests/:requestId/confirm-receiving", requireAuth, controller.confirmReceiving);
  app.post("/api/courier/requests/:requestId/start-task", requireAuth, controller.startTask);
  app.post("/api/courier/requests/:requestId/start-route", requireAuth, controller.startRoute);
  app.post("/api/courier/requests/:requestId/arrive-customer", requireAuth, controller.arriveCustomer);
  app.post("/api/courier/requests/:requestId/start-installation", requireAuth, controller.startInstallation);
  app.get("/api/courier/requests/:requestId/execution-attempts", requireAuth, controller.getExecutionAttempts);
  app.post("/api/courier/requests/:requestId/execution-attempts", requireAuth, controller.createExecutionAttempt);

  // Executions (Courier execution forms)
  app.post("/api/courier/executions/:requestId", requireAuth, controller.saveExecution);

  // Lookups
  app.get("/api/courier/lookups", requireAuth, controller.getLookups);

  // Dashboard & AI statistics
  app.get("/api/courier/dashboard/stats", requireAuth, controller.getDashboardStats);
  app.get("/api/courier/ai-monitor/stats", requireAuth, controller.getAiMonitorStats);

  // Audit logs
  app.get("/api/courier/audit-log", requireAuth, controller.getAuditLogs);

  // PDF Upload & Application
  app.get("/api/courier/pdf", requireAuth, controller.getPdfReports);
  app.get("/api/courier/pdf/:id", requireAuth, controller.getPdfReport);
  
  // Custom upload route to read file buffer for OCR
  app.post(
    "/api/courier/pdf/upload",
    requireAuth,
    upload.single("file"),
    validateFileMagicBytes,
    async (req: any, res, next) => {
      if (req.file) {
        // Read file buffer for OCR
        try {
          req.file.buffer = fs.readFileSync(req.file.path);
        } catch (err) {
          return next(err);
        }
      }
      next();
    },
    controller.uploadPdf
  );

  app.post("/api/courier/pdf/:id/apply", requireAuth, controller.applyPdf);
}
