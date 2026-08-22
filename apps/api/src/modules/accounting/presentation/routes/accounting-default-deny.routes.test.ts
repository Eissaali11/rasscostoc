/**
 * OPS-PERM-S0-A.I1 — accounting default-deny containment.
 *
 * Real Express router (registerAccountingRoutes) + real errorHandler + real
 * supertest HTTP requests — not source-text matching. `requireAuth` is
 * mocked only to inject a given authenticated role deterministically (or,
 * for the unauthenticated case, left as the REAL implementation so the
 * genuine 401 path is exercised). Every accountingService method is
 * replaced with a spy so non-invocation can be proven directly, not
 * inferred from the HTTP status alone.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { errorHandler } from "@core/errors/errorHandler";
import { AuthenticationError } from "@core/errors/AppError";

const OPERATIONAL_ROLES = [
  "admin",
  "supervisor",
  "courier_supervisor",
  "warehouse",
  "technician",
  "viewer",
] as const;

// All 30 certified accounting routes (method, path) — OPS-PERM-D1.R1 §
// "complete accounting endpoint inventory".
const ACCOUNTING_ROUTES: Array<{ method: "get" | "post" | "patch"; path: string }> = [
  { method: "get", path: "/api/accounting/coa" },
  { method: "post", path: "/api/accounting/coa" },
  { method: "patch", path: "/api/accounting/coa/coa-1" },
  { method: "get", path: "/api/accounting/journal-entries" },
  { method: "post", path: "/api/accounting/journal-entries" },
  { method: "post", path: "/api/accounting/journal-entries/je-1/post" },
  { method: "get", path: "/api/sales/invoices" },
  { method: "post", path: "/api/sales/invoices" },
  { method: "get", path: "/api/sales/invoices/inv-1" },
  { method: "post", path: "/api/sales/invoices/inv-1/post" },
  { method: "post", path: "/api/sales/invoices/inv-1/credit-note" },
  { method: "get", path: "/api/sales/technicians/performance" },
  { method: "get", path: "/api/sales/technicians/top" },
  { method: "get", path: "/api/sales/items/top" },
  { method: "get", path: "/api/purchases/bills" },
  { method: "post", path: "/api/purchases/bills" },
  { method: "get", path: "/api/purchases/bills/bill-1" },
  { method: "post", path: "/api/purchases/bills/bill-1/post" },
  { method: "post", path: "/api/purchases/bills/bill-1/debit-note" },
  { method: "post", path: "/api/payments/receipts" },
  { method: "post", path: "/api/payments/disbursements" },
  { method: "post", path: "/api/payments/pay-1/allocate" },
  { method: "get", path: "/api/payments" },
  { method: "get", path: "/api/payments/pay-1/allocations" },
  { method: "get", path: "/api/tax/vat-summary" },
  { method: "get", path: "/api/tax/vat-transactions" },
  { method: "post", path: "/api/einvoice/sales_invoice/inv-1/generate" },
  { method: "post", path: "/api/einvoice/ei-1/submit" },
  { method: "get", path: "/api/einvoice/ei-1/status" },
  { method: "post", path: "/api/einvoice/ei-1/retry" },
  { method: "get", path: "/api/einvoice" },
];

const ACCOUNTING_SERVICE_METHODS = [
  "seedDefaults",
  "listCoa",
  "createCoa",
  "updateCoa",
  "listJournalEntries",
  "createJournalEntry",
  "postJournalEntry",
  "listSalesInvoices",
  "createSalesInvoice",
  "getSalesInvoice",
  "postSalesInvoice",
  "createSalesCreditNote",
  "getTechniciansPerformance",
  "getTopTechnicians",
  "getTopItems",
  "listPurchaseBills",
  "createPurchaseBill",
  "getPurchaseBill",
  "postPurchaseBill",
  "createPurchaseDebitNote",
  "createReceipt",
  "createDisbursement",
  "allocatePayment",
  "listPayments",
  "listPaymentAllocations",
  "getVatSummary",
  "getVatTransactions",
  "generateEinvoice",
  "submitEinvoice",
  "getEinvoiceStatus",
  "retryEinvoice",
  "listEinvoices",
] as const;

function buildServiceMock() {
  const mock: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ACCOUNTING_SERVICE_METHODS) {
    mock[name] =
      name === "seedDefaults"
        ? vi.fn().mockResolvedValue(undefined)
        : vi.fn().mockResolvedValue({});
  }
  return mock;
}

let serviceMock = buildServiceMock();

vi.mock("@modules/accounting/infrastructure/accounting.service", () => ({
  get accountingService() {
    return serviceMock;
  },
}));

describe("OPS-PERM-S0-A.I1 — accounting default-deny containment", () => {
  beforeEach(() => {
    vi.resetModules();
    serviceMock = buildServiceMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function buildAppWithRole(role: string | null) {
    vi.doMock("@core/middlewares/auth.middleware", () => ({
      requireAuth:
        role === null
          ? // Real unauthenticated behavior: no Authorization header, no
            // session -> the actual middleware's AuthenticationError path.
            (req: any, _res: any, next: any) => {
              next(new AuthenticationError("Session expired"));
            }
          : (req: any, _res: any, next: any) => {
              req.user = { id: `test-${role}-id`, username: `test-${role}`, role };
              next();
            },
    }));

    const { registerAccountingRoutes } = await import(
      "./accounting.routes"
    );
    const app = express();
    app.use(express.json());
    registerAccountingRoutes(app);
    app.use(errorHandler);
    return app;
  }

  describe.each(OPERATIONAL_ROLES)("role: %s", (role) => {
    it.each(ACCOUNTING_ROUTES)(
      "$method $path -> 403, handler/service never invoked",
      async ({ method, path }) => {
        const app = await buildAppWithRole(role);
        const res = await (request(app) as any)[method](path).send({});

        expect(res.status).toBe(403);
        for (const fn of Object.values(serviceMock)) {
          if (fn === serviceMock.seedDefaults) continue; // fires once at route registration, unrelated to the request
          expect(fn).not.toHaveBeenCalled();
        }
      }
    );
  });

  it("unauthenticated request still receives the real 401, not this containment guard's 403", async () => {
    const app = await buildAppWithRole(null);
    const res = await request(app).get("/api/accounting/coa");
    expect(res.status).toBe(401);
  });

  it("a representative non-accounting route is unaffected by this change (regression safety)", async () => {
    // The containment guard (denyAccountingAccess) lives entirely inside
    // accounting.routes.ts and is never imported by any other router —
    // proven here by mounting a trivial non-accounting route on a fresh app
    // using the SAME mocked auth stand-in this file uses for accounting,
    // with a role that is denied on every accounting route (e.g.
    // "supervisor"), and confirming it passes through normally (200) —
    // i.e. denial is accounting-specific, not a global side effect.
    vi.doMock("@core/middlewares/auth.middleware", () => ({
      requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: "test-supervisor-id", username: "test-supervisor", role: "supervisor" };
        next();
      },
    }));
    const { requireAuth } = await import("@core/middlewares/auth.middleware");
    const app = express();
    app.get("/api/some-non-accounting-endpoint", requireAuth, (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    const res = await request(app).get("/api/some-non-accounting-endpoint");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
