import type { Express, Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { bootstrapCourierModule } from "../../composition/courier.container";
import { requireAuth } from "@core/middlewares/auth.middleware";
import { AuthorizationError } from "@core/errors/AppError";

// Roles allowed to MUTATE courier data. Read-only (`viewer`) and inventory
// (`warehouse`) roles are excluded — they have no business creating, updating,
// deleting, or executing courier requests (which carry customer PII).
// Note: this gates by role only; region/ownership-scoped read authorization
// (an authenticated operator reading another region's requests) is a deeper
// follow-up that needs the domain's role-responsibility model.
const courierWriteRoles = new Set(["admin", "supervisor", "courier_supervisor", "technician"]);

function requireCourierWrite(req: Request, _res: Response, next: NextFunction): void {
  const role = req.user?.role || "";
  if (!courierWriteRoles.has(role)) {
    return next(new AuthorizationError("ليس لديك صلاحية تنفيذ عمليات المندوبين"));
  }
  next();
}
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
    requireCourierWrite,
    excelUpload.single("file"),
    validateExcelUploadMiddleware(),
    uploadErrorHandler,
    controller.importExcel,
  );
  app.get("/api/courier/requests/:id", requireAuth, controller.getRequest);
  app.post("/api/courier/requests", requireAuth, requireCourierWrite, controller.createRequest);
  app.put("/api/courier/requests/:id", requireAuth, requireCourierWrite, controller.updateRequest);
  app.delete("/api/courier/requests/:id", requireAuth, requireCourierWrite, controller.deleteRequest);

  // Request Items & Two-Phase Custody Acceptance
  app.get("/api/courier/requests/:requestId/items", requireAuth, controller.getRequestItems);
  app.post("/api/courier/requests/:requestId/items", requireAuth, requireCourierWrite, controller.assignRequestItems);
  app.post("/api/courier/requests/:requestId/accept", requireAuth, requireCourierWrite, controller.acceptRequest);
  app.post("/api/courier/requests/:requestId/scan", requireAuth, requireCourierWrite, controller.scanRequestItem);
  app.post("/api/courier/requests/:requestId/confirm-receiving", requireAuth, requireCourierWrite, controller.confirmReceiving);
  app.post("/api/courier/requests/:requestId/start-task", requireAuth, requireCourierWrite, controller.startTask);
  app.post("/api/courier/requests/:requestId/start-route", requireAuth, requireCourierWrite, controller.startRoute);
  app.post("/api/courier/requests/:requestId/arrive-customer", requireAuth, requireCourierWrite, controller.arriveCustomer);
  app.post("/api/courier/requests/:requestId/start-installation", requireAuth, requireCourierWrite, controller.startInstallation);
  app.get("/api/courier/requests/:requestId/execution-attempts", requireAuth, controller.getExecutionAttempts);
  app.post("/api/courier/requests/:requestId/execution-attempts", requireAuth, requireCourierWrite, controller.createExecutionAttempt);

  // Executions (Courier execution forms)
  app.post("/api/courier/executions/:requestId", requireAuth, requireCourierWrite, controller.saveExecution);
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
    requireCourierWrite,
    upload.single("file"),
    validatePdfImageUploadMiddleware(),
    uploadErrorHandler,
    async (req: any, res: Response, next: NextFunction) => {
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

  app.post("/api/courier/pdf/:id/apply", requireAuth, requireCourierWrite, controller.applyPdf);
  app.post("/api/courier/pdf/:id/complete", requireAuth, requireCourierWrite, controller.completePdf);
  app.post("/api/courier/pdf/:id/reextract", requireAuth, requireCourierWrite, controller.reextractPdf);
}
