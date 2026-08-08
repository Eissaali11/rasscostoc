/**
 * DB-R1 regression — Phase C4.6B.4 — sales order / sales invoice line
 * quantity invariants.
 *
 * Runs only via a real disposable Postgres test database (guarded below,
 * same pattern as the DB-R1 C4.6B.1/C4.6B.2/C4.6B.3 regression tests).
 *
 * Root cause (Phase C — Database Certification, DB-R1, confirmed live in
 * Phase C4.6B.4): sales_order_items.quantity and sales_invoice_lines
 * qtyBeforeSale/qtyAfterSale accepted illegal integers with no rejection.
 *
 *   sales_order_items.quantity  -- > 0, zero/negative illegal (requested
 *     order quantity; no legitimate zero/negative write path found)
 *   sales_invoice_lines.qtyBeforeSale / qtyAfterSale  -- >= 0, negative
 *     illegal, zero legal (nonnegative inventory-balance snapshots; app
 *     layer already enforces z.number().nonnegative())
 *
 * Fix (migrations/0037 + 0038): CHECK constraints for exactly these three
 * columns.
 *
 * IMPORTANT — explicitly and deliberately NOT covered here, on governance
 * STOP grounds (Phase C4.6B.4 Step 8): sales_invoice_lines.qty and
 * purchase_bill_lines.qty. Both have a confirmed-live active business
 * write path (AccountingService.createSalesCreditNote /
 * createPurchaseDebitNote) that intentionally inserts a NEGATIVE qty to
 * represent a reversal/return line -- a real, current feature, not dead
 * code. Adding a positive-only CHECK constraint to either column would
 * break that feature. These two columns remain unconstrained pending a
 * separate design decision (e.g. a signed-quantity model or a dedicated
 * "reversal" flag) that is out of scope for a database-only remediation
 * round.
 *
 * Also explicitly NOT covered here (different buckets/rounds):
 * purchase_bill_lines.* (see above), technician_sales_metrics_daily.*
 * (deferred), inventory_items.quantity/technician_product_stock.quantity/
 * technicians_inventory.* (C4.6B.1), transactions.quantity/
 * stock_movements.quantity (C4.6B.2), warehouse_transfers.quantity/
 * courier_request_items.quantity/item_types.unitsPerBox/
 * courier_executions.*Qty/inventory_requests.* (C4.6B.3),
 * technician_fixed_inventories/*_entries and warehouse_inventory/
 * *_entries (Bucket B), technician_moving_inventory_entries (Bucket C).
 * All financial/monetary fields remain deferred to DB-R10.
 */
import { describe, expect, it, afterEach, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../../../../core/config/db";
import {
  salesOrderItems,
  salesOrders,
  salesInvoiceLines,
  salesInvoices,
  products,
  users,
} from "@shared/schema";

describe("DB-R1 — sales order/invoice quantity CHECK constraints (Phase C4.6B.4)", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
  });

  const createdSalesOrderItemIds: string[] = [];
  const createdSalesInvoiceLineIds: string[] = [];
  const createdSalesOrderIds: string[] = [];
  const createdSalesInvoiceIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdUserIds: string[] = [];

  afterEach(async () => {
    for (const id of createdSalesOrderItemIds.splice(0)) {
      await db.delete(salesOrderItems).where(eq(salesOrderItems.id, id)).catch(() => {});
    }
    for (const id of createdSalesInvoiceLineIds.splice(0)) {
      await db.delete(salesInvoiceLines).where(eq(salesInvoiceLines.id, id)).catch(() => {});
    }
    for (const id of createdSalesOrderIds.splice(0)) {
      await db.delete(salesOrders).where(eq(salesOrders.id, id)).catch(() => {});
    }
    for (const id of createdSalesInvoiceIds.splice(0)) {
      await db.delete(salesInvoices).where(eq(salesInvoices.id, id)).catch(() => {});
    }
    for (const id of createdProductIds.splice(0)) {
      await db.delete(products).where(eq(products.id, id)).catch(() => {});
    }
    for (const id of createdUserIds.splice(0)) {
      await db.delete(users).where(eq(users.id, id)).catch(() => {});
    }
  });

  async function seedRepresentative() {
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      username: `dbr1b4-${userId.slice(0, 8)}`,
      email: `dbr1b4-${userId.slice(0, 8)}@test.local`,
      password: "x",
      fullName: "DB-R1 C4.6B.4 Representative",
      role: "representative",
    });
    createdUserIds.push(userId);
    return userId;
  }

  async function seedProduct() {
    const productId = randomUUID();
    await db.insert(products).values({
      id: productId,
      productCode: `DBR1B4-${productId.slice(0, 8)}`,
      barcode: `DBR1B4-BAR-${productId.slice(0, 8)}`,
      nameAr: "منتج",
      nameEn: "Product",
    });
    createdProductIds.push(productId);
    return productId;
  }

  async function seedSalesOrder(representativeId: string) {
    const orderId = randomUUID();
    await db.insert(salesOrders).values({
      id: orderId,
      representativeId,
      orderNo: `SO-${orderId.slice(0, 8)}`,
      idempotencyKey: `idem-${orderId}`,
    });
    createdSalesOrderIds.push(orderId);
    return orderId;
  }

  async function seedSalesInvoice() {
    const invoiceId = randomUUID();
    await db.insert(salesInvoices).values({
      id: invoiceId,
      invoiceNo: `INV-${invoiceId.slice(0, 8)}`,
    });
    createdSalesInvoiceIds.push(invoiceId);
    return invoiceId;
  }

  const ALL_CONSTRAINT_NAMES = [
    "sales_order_items_quantity_positive_check",
    "sales_invoice_lines_qty_before_sale_nonnegative_check",
    "sales_invoice_lines_qty_after_sale_nonnegative_check",
  ];

  it("all 3 target constraints exist and are fully validated", async () => {
    for (const name of ALL_CONSTRAINT_NAMES) {
      const rows = await db.execute(
        sql`select convalidated from pg_constraint where conname = ${name}`
      );
      const convalidated = (rows as any).rows?.[0]?.convalidated ?? (rows as any)[0]?.convalidated;
      expect(convalidated, `constraint ${name} must exist and be validated`).toBe(true);
    }
  });

  it("rejects sales_order_items.quantity = -1 and = 0, accepts positive", async () => {
    const representativeId = await seedRepresentative();
    const orderId = await seedSalesOrder(representativeId);
    const productId = await seedProduct();

    for (const quantity of [-1, 0]) {
      await expect(
        db.insert(salesOrderItems).values({
          orderId,
          productId,
          quantity,
          unitPrice: 10,
          lineTaxAmount: 1.5,
        })
      ).rejects.toThrow();
    }

    const [row] = await db
      .insert(salesOrderItems)
      .values({ orderId, productId, quantity: 1, unitPrice: 10, lineTaxAmount: 1.5 })
      .returning({ id: salesOrderItems.id });
    createdSalesOrderItemIds.push(row!.id);
  });

  it("rejects negative sales_invoice_lines.qtyBeforeSale/qtyAfterSale, accepts zero and positive", async () => {
    const invoiceId = await seedSalesInvoice();

    await expect(
      db.insert(salesInvoiceLines).values({ invoiceId, qty: 1, qtyBeforeSale: -1 })
    ).rejects.toThrow();

    const invoiceId2 = await seedSalesInvoice();
    await expect(
      db.insert(salesInvoiceLines).values({ invoiceId: invoiceId2, qty: 1, qtyAfterSale: -1 })
    ).rejects.toThrow();

    const invoiceId3 = await seedSalesInvoice();
    const [row] = await db
      .insert(salesInvoiceLines)
      .values({ invoiceId: invoiceId3, qty: 1, qtyBeforeSale: 0, qtyAfterSale: 0 })
      .returning({ id: salesInvoiceLines.id });
    createdSalesInvoiceLineIds.push(row!.id);

    const invoiceId4 = await seedSalesInvoice();
    const [row2] = await db
      .insert(salesInvoiceLines)
      .values({ invoiceId: invoiceId4, qty: 1, qtyBeforeSale: 5, qtyAfterSale: 4 })
      .returning({ id: salesInvoiceLines.id });
    createdSalesInvoiceLineIds.push(row2!.id);
  });

  it("rejects a negative sales_order_items.quantity on UPDATE, with no partial write", async () => {
    const representativeId = await seedRepresentative();
    const orderId = await seedSalesOrder(representativeId);
    const productId = await seedProduct();

    const [row] = await db
      .insert(salesOrderItems)
      .values({ orderId, productId, quantity: 3, unitPrice: 10, lineTaxAmount: 1.5 })
      .returning({ id: salesOrderItems.id });
    createdSalesOrderItemIds.push(row!.id);

    await expect(
      db.update(salesOrderItems).set({ quantity: -1 }).where(eq(salesOrderItems.id, row!.id))
    ).rejects.toThrow();

    const [after] = await db.select().from(salesOrderItems).where(eq(salesOrderItems.id, row!.id));
    expect(after!.quantity).toBe(3);
  });

  it("STILL allows a negative sales_invoice_lines.qty (credit-note reversal path, intentionally unconstrained)", async () => {
    const invoiceId = await seedSalesInvoice();
    const [row] = await db
      .insert(salesInvoiceLines)
      .values({ invoiceId, qty: -1 })
      .returning({ id: salesInvoiceLines.id });
    createdSalesInvoiceLineIds.push(row!.id);
    expect(row).toBeDefined();
  });
});
