import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "@core/middlewares/auth.middleware";
import { asyncHandler } from "@core/errors/errorHandler";
import { AuthorizationError } from "@core/errors/AppError";
import { accountingService } from "@modules/accounting/infrastructure/accounting.service";

/**
 * OPS-PERM-S0-A.I1 — accounting is excluded from the operational permissions
 * program entirely (owner decision, OPS-PERM-D1.R1 §2 Decision B). Every
 * current operational role — including admin — is denied, unconditionally.
 * This does NOT check any role allow-list (the previous requireFinanceRead/
 * requireFinanceWrite implementation did, via financeReadRoles/
 * financeWriteRoles, which incorrectly permitted "admin" and "supervisor"
 * for read access) — an allow-list can accidentally admit a newly-added
 * operational role in the future; this guard cannot, because it never
 * consults one. Authentication (requireAuth) always runs first, so an
 * unauthenticated caller still receives the normal 401, never this 403.
 * No internal-service/background-job/non-human exception is introduced —
 * OPS-PERM-D1.R1 found no legitimate internal consumer of any accounting
 * endpoint anywhere in the backend or Portal.
 */
function denyAccountingAccess(req: Request, _res: Response, next: NextFunction): void {
  next(new AuthorizationError("المحاسبة خارج نطاق هذا المشروع التشغيلي"));
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
    denyAccountingAccess,
    asyncHandler(async (_req: Request, res: Response) => {
      const data = await accountingService.listCoa();
      res.json(data);
    })
  );

  app.post(
    "/api/accounting/coa",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const body = coaCreateSchema.parse(req.body);
      const data = await accountingService.createCoa(body);
      res.status(201).json(data);
    })
  );

  app.patch(
    "/api/accounting/coa/:id",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const body = coaUpdateSchema.parse(req.body);
      const data = await accountingService.updateCoa(req.params.id, body);
      res.json(data);
    })
  );

  app.get(
    "/api/accounting/journal-entries",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (_req: Request, res: Response) => {
      const data = await accountingService.listJournalEntries();
      res.json(data);
    })
  );

  app.post(
    "/api/accounting/journal-entries",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const body = journalCreateSchema.parse(req.body);
      const data = await accountingService.createJournalEntry(body, req.user?.id);
      res.status(201).json(data);
    })
  );

  app.post(
    "/api/accounting/journal-entries/:id/post",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.postJournalEntry(req.params.id, req.user?.id);
      res.json(data);
    })
  );

  app.get(
    "/api/sales/invoices",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (_req: Request, res: Response) => {
      const data = await accountingService.listSalesInvoices();
      res.json(data);
    })
  );

  app.post(
    "/api/sales/invoices",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const body = salesInvoiceCreateSchema.parse(req.body);
      const data = await accountingService.createSalesInvoice(body, req.user?.id);
      res.status(201).json(data);
    })
  );

  app.get(
    "/api/sales/invoices/:id",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.getSalesInvoice(req.params.id);
      res.json(data);
    })
  );

  app.post(
    "/api/sales/invoices/:id/post",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.postSalesInvoice(req.params.id, req.user?.id);
      res.json(data);
    })
  );

  app.post(
    "/api/sales/invoices/:id/credit-note",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.createSalesCreditNote(req.params.id, req.user?.id);
      res.status(201).json(data);
    })
  );

  app.get(
    "/api/sales/technicians/performance",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const filters = technicianPerformanceFilterSchema.parse(req.query);
      const data = await accountingService.getTechniciansPerformance(filters);
      res.json(data);
    })
  );

  app.get(
    "/api/sales/technicians/top",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const filters = topTechniciansFilterSchema.parse(req.query);
      const data = await accountingService.getTopTechnicians(filters);
      res.json(data);
    })
  );

  app.get(
    "/api/sales/items/top",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const filters = topItemsFilterSchema.parse(req.query);
      const data = await accountingService.getTopItems(filters);
      res.json(data);
    })
  );

  app.get(
    "/api/purchases/bills",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (_req: Request, res: Response) => {
      const data = await accountingService.listPurchaseBills();
      res.json(data);
    })
  );

  app.post(
    "/api/purchases/bills",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const body = purchaseBillCreateSchema.parse(req.body);
      const data = await accountingService.createPurchaseBill(body, req.user?.id);
      res.status(201).json(data);
    })
  );

  app.get(
    "/api/purchases/bills/:id",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.getPurchaseBill(req.params.id);
      res.json(data);
    })
  );

  app.post(
    "/api/purchases/bills/:id/post",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.postPurchaseBill(req.params.id, req.user?.id);
      res.json(data);
    })
  );

  app.post(
    "/api/purchases/bills/:id/debit-note",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.createPurchaseDebitNote(req.params.id, req.user?.id);
      res.status(201).json(data);
    })
  );

  app.post(
    "/api/payments/receipts",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const body = paymentCreateSchema.parse(req.body);
      const data = await accountingService.createReceipt(body, req.user?.id);
      res.status(201).json(data);
    })
  );

  app.post(
    "/api/payments/disbursements",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const body = paymentCreateSchema.parse(req.body);
      const data = await accountingService.createDisbursement(body, req.user?.id);
      res.status(201).json(data);
    })
  );

  app.post(
    "/api/payments/:id/allocate",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const body = paymentAllocationSchema.parse(req.body);
      const data = await accountingService.allocatePayment(req.params.id, body);
      res.status(201).json(data);
    })
  );

  app.get(
    "/api/payments",
    requireAuth,
    denyAccountingAccess,
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
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.listPaymentAllocations(req.params.id);
      res.json(data);
    })
  );

  app.get(
    "/api/tax/vat-summary",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const filters = rangeFilterSchema.parse(req.query);
      const data = await accountingService.getVatSummary(filters.from, filters.to);
      res.json(data);
    })
  );

  app.get(
    "/api/tax/vat-transactions",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const filters = rangeFilterSchema.parse(req.query);
      const data = await accountingService.getVatTransactions(filters.from, filters.to);
      res.json(data);
    })
  );

  app.post(
    "/api/einvoice/:sourceType/:sourceId/generate",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const params = einvoiceGenerateSchema.parse(req.params);
      const data = await accountingService.generateEinvoice(params.sourceType, params.sourceId);
      res.status(201).json(data);
    })
  );

  app.post(
    "/api/einvoice/:id/submit",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.submitEinvoice(req.params.id);
      res.json(data);
    })
  );

  app.get(
    "/api/einvoice/:id/status",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.getEinvoiceStatus(req.params.id);
      res.json(data);
    })
  );

  app.post(
    "/api/einvoice/:id/retry",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const data = await accountingService.retryEinvoice(req.params.id);
      res.json(data);
    })
  );

  app.get(
    "/api/einvoice",
    requireAuth,
    denyAccountingAccess,
    asyncHandler(async (req: Request, res: Response) => {
      const filters = listEinvoiceFilterSchema.parse(req.query);
      const data = await accountingService.listEinvoices(filters);
      res.json(data);
    })
  );
}
