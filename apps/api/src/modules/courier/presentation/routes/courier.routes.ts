import type { Express } from "express";
import path from "path";
import fs from "fs";
import { bootstrapCourierModule } from "../../composition/courier.container";
import { requireAuth } from "@core/middlewares/auth.middleware";
import {
  createExcelUpload,
  createPdfImageUpload,
  uploadErrorHandler,
  validateExcelUploadMiddleware,
  validatePdfImageUploadMiddleware,
} from "@core/uploads/upload-policy";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "pdf");
const EXCEL_TEMP_DIR = path.join(process.cwd(), "uploads", "temp");

const upload = createPdfImageUpload(UPLOAD_DIR);
const excelUpload = createExcelUpload(EXCEL_TEMP_DIR);

export function registerCourierRoutes(app: Express): void {
  const controller = bootstrapCourierModule();

  // Requests CRUD
  app.get("/api/courier/requests", requireAuth, controller.getRequests);
  app.get("/api/courier/requests/export", requireAuth, controller.exportExcel);
  app.post(
    "/api/courier/requests/import",
    requireAuth,
    excelUpload.single("file"),
    validateExcelUploadMiddleware(),
    uploadErrorHandler,
    controller.importExcel,
  );
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
  app.post("/api/courier/serial-lookup", requireAuth, controller.serialLookup);

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

  app.post(
    "/api/courier/pdf/upload",
    requireAuth,
    upload.single("file"),
    validatePdfImageUploadMiddleware(),
    uploadErrorHandler,
    async (req: any, res, next) => {
      if (req.file) {
        try {
          req.file.buffer = fs.readFileSync(req.file.path);
        } catch (err) {
          return next(err);
        }
      }
      next();
    },
    controller.uploadPdf,
  );

  app.post("/api/courier/pdf/:id/apply", requireAuth, controller.applyPdf);
  app.post("/api/courier/pdf/:id/complete", requireAuth, controller.completePdf);
  app.post("/api/courier/pdf/:id/reextract", requireAuth, controller.reextractPdf);
}
