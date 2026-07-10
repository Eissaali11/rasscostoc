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

export function registerCourierRoutes(app: Express): void {
  const controller = new CourierController();

  // Requests CRUD
  app.get("/api/courier/requests", requireAuth, controller.getRequests);
  app.get("/api/courier/requests/export", requireAuth, controller.exportExcel);
  app.post("/api/courier/requests/import", requireAuth, excelUpload.single("file"), controller.importExcel);
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
