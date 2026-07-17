/**
 * ERP-005A-4 Phase 0.4 — Characterization tests for accounting.service.ts's
 * cross-module raw SQL (references to `users` and `item_types`, tables owned
 * by identity/inventory respectively — see docs/architecture/ACCOUNTING-CROSS-MODULE-SQL-AUDIT.md).
 *
 * These tests run against a real local Postgres instance (the same one used
 * by the rest of npm run test:unit) and lock in the CURRENT result shape of
 * every accounting.service READ function that joins users/item_types, so
 * Phase 5 (routing those joins through AccountingIdentityPort /
 * InventoryCatalogPort) can be verified to produce byte-for-byte identical
 * output.
 *
 * Note: fixture rows are inserted directly via SQL rather than through
 * accountingService.createSalesInvoice()/createPurchaseBill(). Those methods
 * currently fail on a freshly-migrated database — see the
 * "known pre-existing defect" note in ACCOUNTING-CROSS-MODULE-SQL-AUDIT.md
 * (number_sequences has no unique constraint on (scope, year), but
 * nextSequence() relies on ON CONFLICT (scope, year)). That defect is
 * out of scope for ERP-005A-4 and is not touched here; this suite only
 * needs the READ paths, which do not go through nextSequence().
 *
 * All seeded rows are created and torn down per-suite; nothing here mutates
 * pre-existing data.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@core/config/db";
import { accountingService } from "./accounting.service";

describe("accounting.service — characterization (cross-module SQL baseline)", () => {
  let regionId: string;
  let otherRegionId: string;
  let technicianId: string;
  let itemTypeId: string;
  let invoiceId: string;
  let noTechInvoiceId: string;
  let purchaseBillId: string;

  beforeAll(async () => {
    const region = await pool.query(
      `INSERT INTO regions (name) VALUES ($1) RETURNING id`,
      ["ERP-005A-4 Characterization Region"]
    );
    regionId = region.rows[0].id;

    const otherRegion = await pool.query(
      `INSERT INTO regions (name) VALUES ($1) RETURNING id`,
      ["ERP-005A-4 Other Region"]
    );
    otherRegionId = otherRegion.rows[0].id;

    const tech = await pool.query(
      `INSERT INTO users (username, email, password, full_name, role, region_id)
       VALUES ($1, $2, $3, $4, 'technician', $5) RETURNING id`,
      [
        `erp005a4-tech-${Date.now()}`,
        `erp005a4-tech-${Date.now()}@characterization.local`,
        "not-a-real-password-hash",
        "ERP-005A-4 Characterization Technician",
        regionId,
      ]
    );
    technicianId = tech.rows[0].id;

    const itemType = await pool.query(
      `INSERT INTO item_types (name_ar, name_en, category)
       VALUES ($1, $2, 'devices') RETURNING id`,
      ["جهاز اختبار توصيف", "Characterization Test Device"]
    );
    itemTypeId = itemType.rows[0].id;

    const invoice = await pool.query(
      `INSERT INTO sales_invoices (invoice_no, status, subtotal, taxable_amount, vat_total, grand_total)
       VALUES ($1, 'posted', 300, 300, 0, 300) RETURNING id`,
      [`ERP005A4-SI-${Date.now()}`]
    );
    invoiceId = invoice.rows[0].id;

    await pool.query(
      `INSERT INTO sales_invoice_lines
        (invoice_id, item_type_id, technician_id, qty, unit_price, line_total, qty_before_sale, qty_after_sale)
       VALUES ($1, $2, $3, 3, 100, 300, 10, 7)`,
      [invoiceId, itemTypeId, technicianId]
    );

    // technician_sales_metrics_daily is normally populated by postSalesInvoice()'s
    // users-join write path (see finding below) — inserted directly here since
    // that write path shares the same broken nextSequence() dependency.
    await pool.query(
      `INSERT INTO technician_sales_metrics_daily
        (sales_date, technician_id, item_type_id, region_id, sold_qty, sold_amount, invoices_count, avg_selling_price)
       VALUES (CURRENT_DATE, $1, $2, $3, 3, 300, 1, 100)`,
      [technicianId, itemTypeId, regionId]
    );

    const noTechInvoice = await pool.query(
      `INSERT INTO sales_invoices (invoice_no, status, subtotal, taxable_amount, vat_total, grand_total)
       VALUES ($1, 'posted', 50, 50, 7.5, 57.5) RETURNING id`,
      [`ERP005A4-SI-NOTECH-${Date.now()}`]
    );
    noTechInvoiceId = noTechInvoice.rows[0].id;
    await pool.query(
      `INSERT INTO sales_invoice_lines (invoice_id, item_type_id, qty, unit_price, line_total)
       VALUES ($1, $2, 1, 50, 57.5)`,
      [noTechInvoiceId, itemTypeId]
    );

    const bill = await pool.query(
      `INSERT INTO purchase_bills (bill_no, issue_date, status, subtotal, taxable_amount, vat_total, grand_total)
       VALUES ($1, CURRENT_DATE, 'posted', 200, 200, 0, 200) RETURNING id`,
      [`ERP005A4-PB-${Date.now()}`]
    );
    purchaseBillId = bill.rows[0].id;
    await pool.query(
      `INSERT INTO purchase_bill_lines (bill_id, item_type_id, qty, unit_cost, line_total)
       VALUES ($1, $2, 5, 40, 200)`,
      [purchaseBillId, itemTypeId]
    );
  }, 30000);

  afterAll(async () => {
    await pool.query(`DELETE FROM technician_sales_metrics_daily WHERE technician_id = $1`, [technicianId]);
    await pool.query(`DELETE FROM purchase_bill_lines WHERE bill_id = $1`, [purchaseBillId]);
    await pool.query(`DELETE FROM purchase_bills WHERE id = $1`, [purchaseBillId]);
    await pool.query(`DELETE FROM sales_invoice_lines WHERE invoice_id IN ($1, $2)`, [invoiceId, noTechInvoiceId]);
    await pool.query(`DELETE FROM sales_invoices WHERE id IN ($1, $2)`, [invoiceId, noTechInvoiceId]);
    await pool.query(`DELETE FROM item_types WHERE id = $1`, [itemTypeId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [technicianId]);
    await pool.query(`DELETE FROM regions WHERE id IN ($1, $2)`, [regionId, otherRegionId]);
    await pool.end();
  }, 30000);

  // --- listSalesInvoices: item_types join (line ~442) ---
  it("listSalesInvoices includes the seeded invoice", async () => {
    const invoices = await accountingService.listSalesInvoices();
    expect(invoices.find((inv: any) => inv.id === invoiceId)).toBeTruthy();
  });

  // --- getSalesInvoice: item_types + users join (lines ~470-471) ---
  // Note: unlike the report-style functions below, this query does not use
  // quoted aliases, so pg returns the literal snake_case names as written:
  // item_name_ar / technician_name (NOT itemTypeName/technicianName).
  it("getSalesInvoice returns item_name_ar and technician_name joined from item_types/users", async () => {
    const invoice = await accountingService.getSalesInvoice(invoiceId);
    expect(invoice).toBeTruthy();
    expect(Array.isArray(invoice.lines)).toBe(true);
    expect(invoice.lines.length).toBe(1);

    const line = invoice.lines[0];
    expect(line).toHaveProperty("item_name_ar");
    expect(line).toHaveProperty("technician_name");
    expect(line.item_name_ar).toBe("جهاز اختبار توصيف");
    expect(line.technician_name).toBe("ERP-005A-4 Characterization Technician");
  });

  // --- Edge case: LEFT JOIN users tolerates a line with no technician ---
  it("getSalesInvoice tolerates a line with no technician (LEFT JOIN users returns null, not an error)", async () => {
    const fetched = await accountingService.getSalesInvoice(noTechInvoiceId);
    expect(fetched.lines[0].technician_name ?? null).toBeNull();
    expect(fetched.lines[0].item_name_ar).toBe("جهاز اختبار توصيف");
  });

  // --- listPurchaseBills / getPurchaseBill: item_types join (lines ~888, ~914) ---
  it("listPurchaseBills and getPurchaseBill include the joined item_types display name (item_name_ar)", async () => {
    const bills = await accountingService.listPurchaseBills();
    expect(bills.find((b: any) => b.id === purchaseBillId)).toBeTruthy();

    const bill = await accountingService.getPurchaseBill(purchaseBillId);
    expect(bill.lines.length).toBe(1);
    expect(bill.lines[0]).toHaveProperty("item_name_ar");
    expect(bill.lines[0].item_name_ar).toBe("جهاز اختبار توصيف");
  });

  // --- getTechniciansPerformance: users + item_types join (lines ~1565-1566) ---
  it("getTechniciansPerformance returns technicianName and regionId sourced from users", async () => {
    const rows = await accountingService.getTechniciansPerformance({ regionId });
    const mine = rows.find((r: any) => r.technicianId === technicianId);
    expect(mine).toBeTruthy();
    expect(mine.technicianName).toBe("ERP-005A-4 Characterization Technician");
    expect(mine.regionId).toBe(regionId);
    expect(Number(mine.soldQty)).toBe(3);
    expect(Number(mine.soldAmount)).toBe(300);
  });

  // --- getTopTechnicians: wraps getTechniciansPerformance, no direct SQL ---
  it("getTopTechnicians ranks the seeded technician using the same users-sourced fields", async () => {
    const rows = await accountingService.getTopTechnicians({ regionId, limit: 10 });
    const mine = rows.find((r: any) => r.technicianId === technicianId);
    expect(mine).toBeTruthy();
    expect(mine.technicianName).toBe("ERP-005A-4 Characterization Technician");
  });

  // --- getTopItems: users join (region filter) + item_types join (display name) (lines ~1658-1659) ---
  it("getTopItems filters by the technician's region (via users) and includes item_types display name", async () => {
    const rows = await accountingService.getTopItems({ regionId, limit: 10 });
    const mine = rows.find((r: any) => r.itemTypeId === itemTypeId);
    expect(mine).toBeTruthy();
    expect(mine.itemTypeName).toBe("جهاز اختبار توصيف");
    expect(Number(mine.soldQty)).toBe(3);

    const filteredByTech = await accountingService.getTopItems({ technicianId, limit: 10 });
    expect(filteredByTech.find((r: any) => r.itemTypeId === itemTypeId)).toBeTruthy();

    const rowsForOtherRegion = await accountingService.getTopItems({ regionId: otherRegionId, limit: 10 });
    expect(rowsForOtherRegion.find((r: any) => r.itemTypeId === itemTypeId)).toBeUndefined();
  });
});
