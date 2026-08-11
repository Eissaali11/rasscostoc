/**
 * DB-R10C.5b regression — sales invoice exact financial precision.
 *
 * Runs only via a real disposable Postgres test database (guarded
 * below, same pattern as the other DB-R database-invariant regression
 * tests).
 *
 * Root cause (Phase C — Database Certification, DB-R10C.5b): before
 * migration 0048, the 8 authorized sales-invoice financial fields
 * (sales_invoices.{subtotal,discount_total,taxable_amount,vat_total,
 * grand_total}, sales_invoice_lines.{unit_price,discount,line_total})
 * were doublePrecision, AND the authoritative calculation in
 * createSalesInvoice()/createSalesCreditNote() computed them using
 * binary-float Number arithmetic (round2()) rather than exact decimal
 * primitives — a schema-only conversion would not have been sufficient.
 *
 * Fix (migration 0048 + accounting.service.ts rewrite): NUMERIC(14,4)
 * for unit_price (proven business behavior: up to 4 meaningful decimal
 * digits already accepted and persisted), NUMERIC(14,2) for the other 7
 * fields; the authoritative calculation now uses the DB-R10C.1 exact
 * decimal primitives (toPlainDecimalString/multiplyDecimal/addDecimal/
 * subtractDecimal/roundHalfAwayFromZero/maxDecimalWithZero) end to end,
 * and the credit-note reversal uses negateDecimal(absDecimal(...))
 * instead of -Math.abs(Number(...)).
 */
import { describe, expect, it, beforeAll } from "vitest";
import { pool } from "@core/config/db";
import { accountingService } from "./accounting.service";

describe("DB-R10C.5b — sales invoice exact financial precision (migration 0048)", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.includes("test")) {
      throw new Error(
        "Refusing to run: DATABASE_URL does not look like an isolated test database " +
          "(must contain 'test' in the database name). See scripts/test-database.mjs."
      );
    }
  });

  beforeAll(async () => {
    await accountingService.seedDefaults();
  });

  it("computes a normal invoice with correct VAT and exact string totals", async () => {
    const invoice = await accountingService.createSalesInvoice({
      lines: [{ qty: 3, unitPrice: 33.33 }],
    });
    expect(invoice.subtotal).toBe("99.99");
    expect(invoice.taxable_amount).toBe("99.99");
    expect(invoice.vat_total).toBe("15.00");
    expect(invoice.grand_total).toBe("114.99");
  });

  it("preserves the exact DB-R10A float-noise example: 12184.515 unit price", async () => {
    const invoice = await accountingService.createSalesInvoice({
      lines: [{ qty: 1, unitPrice: 12184.515 }],
    });
    // unitPrice preserved exactly to 4 decimals (not rounded to 2)
    expect(invoice.lines[0].unit_price).toBe("12184.5150");
    // the monetary boundary result IS rounded to 2 decimals, exactly
    expect(invoice.subtotal).toBe("12184.52");
    expect(invoice.vat_total).toBe("1827.68");
    expect(invoice.grand_total).toBe("14012.20");
  });

  it("preserves a legitimate 4-decimal unit price exactly", async () => {
    const invoice = await accountingService.createSalesInvoice({
      lines: [{ qty: 2, unitPrice: 10.1234 }],
    });
    expect(invoice.lines[0].unit_price).toBe("10.1234");
    expect(invoice.subtotal).toBe("20.25"); // exact 20.2468 -> round2 -> 20.25
  });

  it("rejects a unit price with more than 4 meaningful decimal digits, without silently rounding it", async () => {
    await expect(
      accountingService.createSalesInvoice({ lines: [{ qty: 1, unitPrice: 1.23456 }] })
    ).rejects.toThrow(/سعر الوحدة/);
  });

  it("applies a monetary discount exactly, never as a percentage", async () => {
    const invoice = await accountingService.createSalesInvoice({
      lines: [{ qty: 2, unitPrice: 50, discount: 5 }],
    });
    // gross=100, discount=5, taxable=95, vat=14.25, total=109.25
    expect(invoice.taxable_amount).toBe("95.00");
    expect(invoice.vat_total).toBe("14.25");
    expect(invoice.lines[0].line_total).toBe("109.25");
  });

  it("aggregates multi-line totals exactly", async () => {
    const invoice = await accountingService.createSalesInvoice({
      lines: [
        { qty: 2, unitPrice: 50, discount: 5 },
        { qty: 1, unitPrice: 25.5 },
      ],
    });
    expect(invoice.subtotal).toBe("125.50");
    expect(invoice.discount_total).toBe("5.00");
    expect(invoice.taxable_amount).toBe("120.50");
  });

  it("zero-discount line still computes exact taxable/VAT amounts", async () => {
    const invoice = await accountingService.createSalesInvoice({
      lines: [{ qty: 1, unitPrice: 100 }],
    });
    expect(invoice.taxable_amount).toBe("100.00");
    expect(invoice.vat_total).toBe("15.00");
  });

  it("credit note negates already-computed totals exactly via decimal sign inversion, not a fresh calculation", async () => {
    const source = await accountingService.createSalesInvoice({
      lines: [{ qty: 3, unitPrice: 33.33 }],
    });
    await accountingService.postSalesInvoice(source.id);
    const credit = await accountingService.createSalesCreditNote(source.id);

    expect(credit.subtotal).toBe("-99.99");
    expect(credit.taxable_amount).toBe("-99.99");
    expect(credit.vat_total).toBe("-15.00");
    expect(credit.grand_total).toBe("-114.99");
    // unit price is preserved, NOT negated (same per-unit price)
    expect(credit.lines[0].unit_price).toBe("33.3300");
  });

  it("readback: NUMERIC columns are decoded as decimal strings by pg", async () => {
    const invoice = await accountingService.createSalesInvoice({
      lines: [{ qty: 1, unitPrice: 100 }],
    });
    const row = await pool.query(
      `SELECT subtotal, unit_price FROM sales_invoices si
       JOIN sales_invoice_lines sil ON sil.invoice_id = si.id
       WHERE si.id = $1`,
      [invoice.id]
    );
    expect(typeof row.rows[0].subtotal).toBe("string");
    expect(typeof row.rows[0].unit_price).toBe("string");
  });

  it("negative unit price / qty / discount is rejected before any calculation", async () => {
    await expect(
      accountingService.createSalesInvoice({ lines: [{ qty: -1, unitPrice: 10 }] })
    ).rejects.toThrow();
    await expect(
      accountingService.createSalesInvoice({ lines: [{ qty: 1, unitPrice: -10 }] })
    ).rejects.toThrow();
  });
});
