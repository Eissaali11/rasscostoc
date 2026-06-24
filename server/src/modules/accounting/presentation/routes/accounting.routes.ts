import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "@core/middlewares/auth.middleware";
import { asyncHandler } from "@core/errors/errorHandler";
import { AuthorizationError } from "@core/errors/AppError";
import { accountingService } from "@modules/accounting/application/accounting.service";

const financeReadRoles = new Set(["admin", "supervisor", "accountant", "finance_manager", "auditor"]);
const financeWriteRoles = new Set(["admin", "accountant", "finance_manager"]);

function requireFinanceRead(req: Request, _res: Response, next: NextFunction): void {
  const role = req.user?.role || "";
  if (!financeReadRoles.has(role)) {
    return next(new AuthorizationError("ليس لديك صلاحية الوصول لبيانات المحاسبة"));
  }
  next();
}

function requireFinanceWrite(req: Request, _res: Response, next: NextFunction): void {
  const role = req.user?.role || "";
  if (!financeWriteRoles.has(role)) {
    return next(new AuthorizationError("ليس لديك صلاحية تنفيذ عمليات محاسبية"));
  }
  next();
}

const coaCreateSchema = z.object({
  code: z.string().trim().min(1),
  nameAr: z.string().trim().min(1),
  nameEn: z.string().trim().optional(),
  accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
  parentId: z.string().trim().optional().nullable(),
  isPostable: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const coaUpdateSchema = coaCreateSchema.partial();

const journalLineSchema = z.object({
  accountId: z.string().trim().min(1),
  debit: z.number().min(0).optional(),
  credit: z.number().min(0).optional(),
  description: z.string().trim().optional(),
  costCenter: z.string().trim().optional(),
  regionId: z.string().trim().optional().nullable(),
});

const journalCreateSchema = z.object({
  postingDate: z.string().trim().min(1),
  sourceType: z.string().trim().min(1),
  sourceId: z.string().trim().optional(),
  currency: z.string().trim().optional(),
  exchangeRate: z.number().positive().optional(),
  lines: z.array(journalLineSchema).min(1),
});

const salesLineSchema = z.object({
  itemTypeId: z.string().trim().optional(),
  description: z.string().trim().optional(),
  qty: z.number().nonnegative(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().optional(),
  taxCodeId: z.string().trim().optional(),
  warehouseId: z.string().trim().optional(),
  technicianId: z.string().trim().optional(),
  sourceInventoryType: z.enum(["fixed", "moving", "warehouse"]).optional(),
  qtyBeforeSale: z.number().nonnegative().optional(),
  qtyAfterSale: z.number().nonnegative().optional(),
});

const salesInvoiceCreateSchema = z.object({
  invoiceType: z.enum(["standard", "simplified"]).optional(),
  customerId: z.string().trim().optional(),
  issueDatetime: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
  currency: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  lines: z.array(salesLineSchema).min(1),
});

const purchaseLineSchema = z.object({
  itemTypeId: z.string().trim().optional(),
  description: z.string().trim().optional(),
  qty: z.number().nonnegative(),
  unitCost: z.number().nonnegative(),
  discount: z.number().nonnegative().optional(),
  taxCodeId: z.string().trim().optional(),
  warehouseId: z.string().trim().optional(),
});

const purchaseBillCreateSchema = z.object({
  supplierId: z.string().trim().optional(),
  issueDate: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
  currency: z.string().trim().optional(),
  lines: z.array(purchaseLineSchema).min(1),
});

const paymentCreateSchema = z.object({
  partyType: z.enum(["customer", "supplier"]),
  partyId: z.string().trim().optional(),
  method: z.string().trim().min(1),
  amount: z.number().positive(),
  paymentDate: z.string().trim().optional(),
  referenceNo: z.string().trim().optional(),
});

const paymentAllocationSchema = z.object({
  documentType: z.string().trim().min(1),
  documentId: z.string().trim().min(1),
  allocatedAmount: z.number().positive(),
});

const rangeFilterSchema = z.object({
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

const listPaymentsFilterSchema = z.object({
  paymentType: z.enum(["receipt", "disbursement"]).optional(),
});

const listEinvoiceFilterSchema = z.object({
  sourceType: z.string().trim().optional(),
  sourceId: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

const technicianPerformanceFilterSchema = rangeFilterSchema.extend({
  technicianId: z.string().trim().optional(),
  regionId: z.string().trim().optional(),
  itemTypeId: z.string().trim().optional(),
});

const topTechniciansFilterSchema = rangeFilterSchema.extend({
  regionId: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  metric: z.enum(["soldQty", "soldAmount"]).optional(),
});

const topItemsFilterSchema = rangeFilterSchema.extend({
  regionId: z.string().trim().optional(),
  technicianId: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const einvoiceGenerateSchema = z.object({
  sourceType: z.string().trim().min(1),
  sourceId: z.string().trim().min(1),
});

export function registerAccountingRoutes(app: Express): void {
  void accountingService.seedDefaults().catch((error) => {
    console.error("Accounting defaults seeding failed:", error);
  });

  app.get(
    "/api/accounting/coa",
    requireAuth,
    requireFinanceRead,
    asyncHandler(async (_req: Request, res: Response) => {
      const data = await accountingService.listCoa();
      res.json(data);
    })
  );

  app.post(
    "/api/accounting/coa",
    requireAuth,
    requireFinanceWrite,
    asyncHandler(async (req: Request, res: Response) => {
      const body = coaCreateSchema.parse(req.body);
      const data = await accountingService.createCoa(body);
      res.status(201).json(data);
    })
  );

  app.patch(
    "/api/accounting/coa/:id",
    requireAuth,
    requireFinanceWrite,
    asyncHandler(async (req: Request, res: Response) => {
      const body = coaUpdateSchema.parse(req.body);
      const data = await accountingService.updateCoa(req.params.id, body);
      res.json(data);
    })
  );

  app.get(
    "/api/accounting/journal-entries",
    requireAuth,
    requireFinanceRead,
    asyncHandler(async (_req: Request, res: Response) => {
      const data = await accountingService.listJournalEntries();
      res.json(data);
    })
  );

  app.post(
    "/api/accounting/journal-entries",
    requireAuth,
    requireFinanceWrite,
    asyncHandler(async (req: Request, res: Response) => {
      const body = journalCreateSchema.parse(req.body);
      const data = await accountingService.createJournalEntry(body, req.user?.id);
      res.status(201).json(data);
    })
  );

  app.post(
    "/api/accounting/journal-entries/:id/post",
    requireAuth,
    requireFinanceWrite,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.postJournalEntry(req.params.id, req.user?.id);
      res.json(data);
    })
  );

  app.get(
    "/api/sales/invoices",
    requireAuth,
    requireFinanceRead,
    asyncHandler(async (_req: Request, res: Response) => {
      const data = await accountingService.listSalesInvoices();
      res.json(data);
    })
  );

  app.post(
    "/api/sales/invoices",
    requireAuth,
    requireFinanceWrite,
    asyncHandler(async (req: Request, res: Response) => {
      const body = salesInvoiceCreateSchema.parse(req.body);
      const data = await accountingService.createSalesInvoice(body, req.user?.id);
      res.status(201).json(data);
    })
  );

  app.get(
    "/api/sales/invoices/:id",
    requireAuth,
    requireFinanceRead,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.getSalesInvoice(req.params.id);
      res.json(data);
    })
  );

  app.post(
    "/api/sales/invoices/:id/post",
    requireAuth,
    requireFinanceWrite,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.postSalesInvoice(req.params.id, req.user?.id);
      res.json(data);
    })
  );

  app.post(
    "/api/sales/invoices/:id/credit-note",
    requireAuth,
    requireFinanceWrite,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.createSalesCreditNote(req.params.id, req.user?.id);
      res.status(201).json(data);
    })
  );

  app.get(
    "/api/sales/technicians/performance",
    requireAuth,
    requireFinanceRead,
    asyncHandler(async (req: Request, res: Response) => {
      const filters = technicianPerformanceFilterSchema.parse(req.query);
      const data = await accountingService.getTechniciansPerformance(filters);
      res.json(data);
    })
  );

  app.get(
    "/api/sales/technicians/top",
    requireAuth,
    requireFinanceRead,
    asyncHandler(async (req: Request, res: Response) => {
      const filters = topTechniciansFilterSchema.parse(req.query);
      const data = await accountingService.getTopTechnicians(filters);
      res.json(data);
    })
  );

  app.get(
    "/api/sales/items/top",
    requireAuth,
    requireFinanceRead,
    asyncHandler(async (req: Request, res: Response) => {
      const filters = topItemsFilterSchema.parse(req.query);
      const data = await accountingService.getTopItems(filters);
      res.json(data);
    })
  );

  app.get(
    "/api/purchases/bills",
    requireAuth,
    requireFinanceRead,
    asyncHandler(async (_req: Request, res: Response) => {
      const data = await accountingService.listPurchaseBills();
      res.json(data);
    })
  );

  app.post(
    "/api/purchases/bills",
    requireAuth,
    requireFinanceWrite,
    asyncHandler(async (req: Request, res: Response) => {
      const body = purchaseBillCreateSchema.parse(req.body);
      const data = await accountingService.createPurchaseBill(body, req.user?.id);
      res.status(201).json(data);
    })
  );

  app.get(
    "/api/purchases/bills/:id",
    requireAuth,
    requireFinanceRead,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.getPurchaseBill(req.params.id);
      res.json(data);
    })
  );

  app.post(
    "/api/purchases/bills/:id/post",
    requireAuth,
    requireFinanceWrite,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.postPurchaseBill(req.params.id, req.user?.id);
      res.json(data);
    })
  );

  app.post(
    "/api/purchases/bills/:id/debit-note",
    requireAuth,
    requireFinanceWrite,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.createPurchaseDebitNote(req.params.id, req.user?.id);
      res.status(201).json(data);
    })
  );

  app.post(
    "/api/payments/receipts",
    requireAuth,
    requireFinanceWrite,
    asyncHandler(async (req: Request, res: Response) => {
      const body = paymentCreateSchema.parse(req.body);
      const data = await accountingService.createReceipt(body, req.user?.id);
      res.status(201).json(data);
    })
  );

  app.post(
    "/api/payments/disbursements",
    requireAuth,
    requireFinanceWrite,
    asyncHandler(async (req: Request, res: Response) => {
      const body = paymentCreateSchema.parse(req.body);
      const data = await accountingService.createDisbursement(body, req.user?.id);
      res.status(201).json(data);
    })
  );

  app.post(
    "/api/payments/:id/allocate",
    requireAuth,
    requireFinanceWrite,
    asyncHandler(async (req: Request, res: Response) => {
      const body = paymentAllocationSchema.parse(req.body);
      const data = await accountingService.allocatePayment(req.params.id, body);
      res.status(201).json(data);
    })
  );

  app.get(
    "/api/payments",
    requireAuth,
    requireFinanceRead,
    asyncHandler(async (req: Request, res: Response) => {
      const filters = listPaymentsFilterSchema.parse(req.query);
      const rows = await accountingService.listPayments();
      const data = filters.paymentType ? rows.filter((row) => row.payment_type === filters.paymentType) : rows;
      res.json(data);
    })
  );

  app.get(
    "/api/payments/:id/allocations",
    requireAuth,
    requireFinanceRead,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.listPaymentAllocations(req.params.id);
      res.json(data);
    })
  );

  app.get(
    "/api/tax/vat-summary",
    requireAuth,
    requireFinanceRead,
    asyncHandler(async (req: Request, res: Response) => {
      const filters = rangeFilterSchema.parse(req.query);
      const data = await accountingService.getVatSummary(filters.from, filters.to);
      res.json(data);
    })
  );

  app.get(
    "/api/tax/vat-transactions",
    requireAuth,
    requireFinanceRead,
    asyncHandler(async (req: Request, res: Response) => {
      const filters = rangeFilterSchema.parse(req.query);
      const data = await accountingService.getVatTransactions(filters.from, filters.to);
      res.json(data);
    })
  );

  app.post(
    "/api/einvoice/:sourceType/:sourceId/generate",
    requireAuth,
    requireFinanceWrite,
    asyncHandler(async (req: Request, res: Response) => {
      const params = einvoiceGenerateSchema.parse(req.params);
      const data = await accountingService.generateEinvoice(params.sourceType, params.sourceId);
      res.status(201).json(data);
    })
  );

  app.post(
    "/api/einvoice/:id/submit",
    requireAuth,
    requireFinanceWrite,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.submitEinvoice(req.params.id);
      res.json(data);
    })
  );

  app.get(
    "/api/einvoice/:id/status",
    requireAuth,
    requireFinanceRead,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.getEinvoiceStatus(req.params.id);
      res.json(data);
    })
  );

  app.post(
    "/api/einvoice/:id/retry",
    requireAuth,
    requireFinanceWrite,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.retryEinvoice(req.params.id);
      res.json(data);
    })
  );

  app.get(
    "/api/einvoice",
    requireAuth,
    requireFinanceRead,
    asyncHandler(async (req: Request, res: Response) => {
      const filters = listEinvoiceFilterSchema.parse(req.query);
      const data = await accountingService.listEinvoices(filters);
      res.json(data);
    })
  );
}
