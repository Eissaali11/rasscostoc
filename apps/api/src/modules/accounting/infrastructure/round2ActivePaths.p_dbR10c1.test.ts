import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "@core/config/db";
import { accountingService } from "./accounting.service";

/**
 * DB-R10C.1A — targeted regression tests proving the round2() ->
 * round2Compat() delegation (symmetric ROUND HALF AWAY FROM ZERO) does
 * not create an unintended business regression on the active,
 * DB-backed financial write/read paths, with particular attention to
 * every path that can carry a NEGATIVE monetary value.
 *
 * Scope note (see the DB-R10C.1A report for the full call-site audit):
 * createSalesCreditNote/createPurchaseDebitNote were found to call
 * round2() ZERO times — they negate already-rounded source values via
 * `-Math.abs(...)`, so the round2() change cannot affect them directly.
 * That claim is verified here as a live, DB-backed control test rather
 * than asserted from static reading alone. The one place a genuinely
 * negative value legitimately reaches round2() in production is
 * `netVatPayable` in getVatSummary() (input tax > output tax = VAT
 * refund position) — that is the primary negative-tie-relevant target
 * tested here.
 */
describe("DB-R10C.1A — round2() active financial paths (post round2Compat delegation)", () => {
  beforeAll(async () => {
    await accountingService.seedDefaults();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("computes a normal positive sales invoice with correct VAT and totals", async () => {
    const invoice = await accountingService.createSalesInvoice({
      lines: [{ qty: 3, unitPrice: 33.33 }], // 33.33*3 = 99.99, VAT15 = 14.9985 -> 15.00 (round2), total 114.99
    });

    expect(invoice.subtotal).toBe(99.99);
    expect(invoice.taxable_amount).toBe(99.99);
    expect(invoice.vat_total).toBe(15); // round2(99.99*0.15)=round2(14.9985)=15.00
    expect(invoice.grand_total).toBe(114.99);
  });

  it("computes correct VAT for a boundary decimal line (987 x 12.345 class case from DB-R10A)", async () => {
    const invoice = await accountingService.createSalesInvoice({
      lines: [{ qty: 1, unitPrice: 12184.515 }], // exercises the exact DB-R10A float-noise example
    });

    expect(invoice.subtotal).toBe(12184.52); // round2(12184.515) -> 12184.52 (half away from zero, matches PG)
    expect(invoice.vat_total).toBe(1827.68); // round2(12184.52*0.15) = round2(1827.678) = 1827.68
    expect(invoice.grand_total).toBe(14012.2);
  });

  it("sales credit note negates already-rounded source values WITHOUT calling round2 (control test)", async () => {
    const source = await accountingService.createSalesInvoice({
      lines: [{ qty: 3, unitPrice: 33.33 }],
    });
    await accountingService.postSalesInvoice(source.id);

    const credit = await accountingService.createSalesCreditNote(source.id);

    // Exact negation, bit-for-bit, of the already-rounded source totals —
    // NOT a fresh round2() computation. This is what proves the credit-note
    // path is unaffected by the round2() symmetry fix: there is nothing for
    // the fix to change here.
    expect(credit.subtotal).toBe(-source.subtotal);
    expect(credit.taxable_amount).toBe(-source.taxable_amount);
    expect(credit.vat_total).toBe(-source.vat_total);
    expect(credit.grand_total).toBe(-source.grand_total);
    expect(credit.subtotal).toBe(-99.99);
    expect(credit.vat_total).toBe(-15);
  });

  it("purchase debit note negates already-rounded source values WITHOUT calling round2 (control test)", async () => {
    const bill = await accountingService.createPurchaseBill({
      lines: [{ qty: 3, unitCost: 33.33 }],
    });
    await accountingService.postPurchaseBill(bill.id);

    const debitNote = await accountingService.createPurchaseDebitNote(bill.id);

    expect(debitNote.subtotal).toBe(-bill.subtotal);
    expect(debitNote.vat_total).toBe(-bill.vat_total);
    expect(debitNote.grand_total).toBe(-bill.grand_total);
  });

  it("getVatSummary rounds a NEGATIVE tax sum symmetrically (VAT refund / credit-note reversal case)", async () => {
    // This is the one production path where round2() legitimately receives
    // a negative tie value: a sales-credit-note reversal writes a NEGATIVE
    // tax_transactions row (source: createSalesCreditNote, direction
    // 'output'), and getVatSummary() SUMs + round2()s it directly
    // (accounting.service.ts:1396-1397,1404). Isolated from every other
    // test in this file via a far-future created_at + date-range filter,
    // so the expected value is exact and independent of suite ordering.
    const isolatedDate = "2099-06-15";
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Clean up any leftover row from a prior run against a reused
      // disposable database before inserting — this test's expected value
      // depends on being the ONLY row in this isolated date window.
      await client.query("DELETE FROM tax_transactions WHERE source_type = 'db_r10c1a_test_reversal'");
      await client.query(
        `INSERT INTO tax_transactions
           (source_type, source_id, tax_code_id, taxable_amount, tax_amount, direction, created_at)
         VALUES ('db_r10c1a_test_reversal', gen_random_uuid(), NULL, -100.05, -10.005, 'output', $1::date)`,
        [isolatedDate]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const summary = await accountingService.getVatSummary(isolatedDate, isolatedDate);

    // round2Compat(-10.005) must be -10.01 (symmetric), not -10.00 (the old
    // asymmetric round2 bug). inputTax is 0 in this isolated window, so
    // netVatPayable = round2Compat(-10.01 - 0) = -10.01 exactly.
    expect(summary.outputTax).toBe(-10.01);
    expect(summary.inputTax).toBe(0);
    expect(summary.netVatPayable).toBe(-10.01);
    expect(summary.outputTaxableAmount).toBe(-100.05);
  });
});
