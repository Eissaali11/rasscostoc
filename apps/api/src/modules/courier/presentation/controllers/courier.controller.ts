import type { Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import { CourierService } from "../../application/courier.service";
import { ValidationError, NotFoundError } from "@core/errors/AppError";
import fs from "fs";
import path from "path";

export class CourierController {
  private readonly service = new CourierService();

  getRequests = asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      q: req.query.q as string,
      city: req.query.city as string,
      technician: req.query.technician as string,
      status: req.query.status as string,
      reason: req.query.reason as string,
      simType: req.query.simType as string,
      vendor: req.query.vendor as string,
      priority: req.query.priority as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 50,
    };
    const result = await this.service.listRequests(filters);
    res.json(result);
  });

  getRequest = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) throw new ValidationError("Invalid request ID");
    const result = await this.service.getRequestById(id);
    if (!result) throw new NotFoundError("Request not found");
    res.json(result);
  });

  createRequest = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const result = await this.service.createRequest(req.body, user.id);
    res.status(201).json(result);
  });

  updateRequest = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const id = Number(req.params.id);
    if (isNaN(id)) throw new ValidationError("Invalid request ID");
    const result = await this.service.updateRequest(id, req.body, user.id);
    if (!result) throw new NotFoundError("Request not found");
    res.json(result);
  });

  deleteRequest = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const id = Number(req.params.id);
    if (isNaN(id)) throw new ValidationError("Invalid request ID");
    const success = await this.service.deleteRequest(id, user.id);
    if (!success) throw new NotFoundError("Request not found");
    res.json({ success: true });
  });

  saveExecution = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const requestId = Number(req.params.requestId);
    if (isNaN(requestId)) throw new ValidationError("Invalid request ID");
    const result = await this.service.saveExecution(requestId, req.body, user.id);
    res.json(result);
  });

  getRequestItems = asyncHandler(async (req: Request, res: Response) => {
    const requestId = Number(req.params.requestId);
    if (isNaN(requestId)) throw new ValidationError("Invalid request ID");
    const result = await this.service.getRequestItems(requestId);
    res.json(result);
  });

  assignRequestItems = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const requestId = Number(req.params.requestId);
    if (isNaN(requestId)) throw new ValidationError("Invalid request ID");
    if (!Array.isArray(req.body)) throw new ValidationError("Items data must be an array");
    const result = await this.service.assignRequestItems(requestId, req.body, user.id);
    res.status(201).json(result);
  });

  acceptRequest = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const requestId = Number(req.params.requestId);
    if (isNaN(requestId)) throw new ValidationError("Invalid request ID");
    const result = await this.service.acceptRequest(requestId, user.id);
    res.json(result);
  });

  scanRequestItem = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const requestId = Number(req.params.requestId);
    const { serial } = req.body;
    if (isNaN(requestId)) throw new ValidationError("Invalid request ID");
    if (!serial) throw new ValidationError("Serial is required");
    const result = await this.service.scanRequestItem(requestId, serial, user.id);
    res.json(result);
  });

  confirmReceiving = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const requestId = Number(req.params.requestId);
    const { itemStatuses, sessionMetadata } = req.body;
    if (isNaN(requestId)) throw new ValidationError("Invalid request ID");
    const result = await this.service.confirmReceiving(requestId, user.id, itemStatuses, sessionMetadata);
    res.json(result);
  });

  startTask = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const requestId = Number(req.params.requestId);
    if (isNaN(requestId)) throw new ValidationError("Invalid request ID");
    const result = await this.service.startTask(requestId, user.id);
    res.json(result);
  });

  getLookups = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.getLookups();
    res.json(result);
  });

  getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.getDashboardStats();
    res.json(result);
  });

  getAiMonitorStats = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.getAiMonitorStats();
    res.json(result);
  });

  getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.listAuditLogs();
    res.json(result);
  });

  getPdfReports = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.getPdfReports();
    res.json(result);
  });

  uploadPdf = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const file = req.file;
    const requestId = req.body.request_id ? Number(req.body.request_id) : undefined;

    if (!file) throw new ValidationError("No PDF file uploaded");

    const result = await this.service.uploadPdfReport(
      file.originalname,
      file.filename, // Using stored multer filename
      file.buffer || Buffer.alloc(0), // If using memoryStorage
      user.id,
      requestId
    );

    res.json(result);
  });

  applyPdf = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const pdfId = Number(req.params.id);
    const requestId = Number(req.body.request_id);

    if (isNaN(pdfId)) throw new ValidationError("Invalid PDF ID");
    if (isNaN(requestId)) throw new ValidationError("Invalid request ID");

    const result = await this.service.applyPdfReport(
      pdfId,
      requestId,
      req.body.fields,
      req.body.confidence,
      user.id
    );

    res.json(result);
  });

  getPdfReport = asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) throw new ValidationError("Invalid PDF ID");
    const result = await this.service.getPdfReportById(id);
    if (!result) throw new NotFoundError("PDF Report not found");

    if (req.query.raw === "1") {
      const uploadDir = path.join(process.cwd(), "uploads", "pdf");
      const filePath = path.join(uploadDir, result.filePath);
      if (!fs.existsSync(filePath)) throw new NotFoundError("File not found on disk");
      
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(result.fileName).toLowerCase();
      let contentType = "application/pdf";
      if (ext === ".png") contentType = "image/png";
      else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
      else if (ext === ".webp") contentType = "image/webp";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename="${result.fileName}"`);
      return res.send(buffer);
    }

    res.json({
      ...result,
      extractedJson: JSON.parse(result.extractedJson || "{}")
    });
  });

  importExcel = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const file = req.file;
    if (!file) throw new ValidationError("No Excel file uploaded");

    // Read file buffer from multer (disk or memory storage)
    const buffer = fs.readFileSync(file.path);
    const result = await this.service.importRawRequests(buffer, user.id);

    // Clean up temporary uploaded file
    try {
      fs.unlinkSync(file.path);
    } catch (e) {
      // Ignore cleanup error
    }

    res.json(result);
  });

  exportExcel = asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      q: req.query.q as string,
      city: req.query.city as string,
      technician: req.query.technician as string,
      status: req.query.status as string,
      reason: req.query.reason as string,
      simType: req.query.simType as string,
      vendor: req.query.vendor as string,
      priority: req.query.priority as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string
    };

    const buffer = await this.service.exportRequests(filters);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="neoleap-export-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(buffer);
  });

  startRoute = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const requestId = Number(req.params.requestId);
    if (isNaN(requestId)) throw new ValidationError("Invalid request ID");
    const result = await this.service.startRoute(requestId, user.id);
    res.json(result);
  });

  arriveCustomer = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const requestId = Number(req.params.requestId);
    if (isNaN(requestId)) throw new ValidationError("Invalid request ID");
    const result = await this.service.arriveCustomer(requestId, user.id);
    res.json(result);
  });

  startInstallation = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const requestId = Number(req.params.requestId);
    if (isNaN(requestId)) throw new ValidationError("Invalid request ID");
    const result = await this.service.startInstallation(requestId, user.id);
    res.json(result);
  });

  getExecutionAttempts = asyncHandler(async (req: Request, res: Response) => {
    const requestId = Number(req.params.requestId);
    if (isNaN(requestId)) throw new ValidationError("Invalid request ID");
    const result = await this.service.getExecutionAttempts(requestId);
    res.json(result);
  });

  createExecutionAttempt = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const requestId = Number(req.params.requestId);
    if (isNaN(requestId)) throw new ValidationError("Invalid request ID");
    const result = await this.service.createExecutionAttempt(requestId, user.id, req.body);
    res.status(201).json(result);
  });

  serialLookup = asyncHandler(async (req: Request, res: Response) => {
    const { sn } = req.body;
    if (!sn || String(sn).trim() === "") throw new ValidationError("sn is required");
    const result = await this.service.serialLookup(String(sn).trim());
    res.json(result);
  });
}
