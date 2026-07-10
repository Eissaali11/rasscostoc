import { randomUUID, createHash } from "crypto";
import type { PoolClient, QueryResult } from "pg";
import { pool } from "@core/config/db";
import { ConflictError, NotFoundError, ValidationError } from "@core/errors/AppError";

type CoaInput = {
  code: string;
  nameAr: string;
  nameEn?: string;
  accountType: string;
  parentId?: string | null;
  isPostable?: boolean;
  isActive?: boolean;
};

type JournalLineInput = {
  accountId: string;
  debit?: number;
  credit?: number;
  description?: string;
  costCenter?: string;
  regionId?: string | null;
};

type JournalInput = {
  postingDate: string;
  sourceType: string;
  sourceId?: string;
  currency?: string;
  exchangeRate?: number;
  lines: JournalLineInput[];
};

type SalesLineInput = {
  itemTypeId?: string;
  description?: string;
  qty: number;
  unitPrice: number;
  discount?: number;
  taxCodeId?: string;
  warehouseId?: string;
  technicianId?: string;
  sourceInventoryType?: string;
  qtyBeforeSale?: number;
  qtyAfterSale?: number;
};

type SalesInvoiceInput = {
  invoiceType?: string;
  customerId?: string;
  issueDatetime?: string;
  dueDate?: string;
  currency?: string;
  notes?: string;
  lines: SalesLineInput[];
};

type PurchaseLineInput = {
  itemTypeId?: string;
  description?: string;
  qty: number;
  unitCost: number;
  discount?: number;
  taxCodeId?: string;
  warehouseId?: string;
};

type PurchaseBillInput = {
  supplierId?: string;
  issueDate?: string;
  dueDate?: string;
  currency?: string;
  lines: PurchaseLineInput[];
};

type PaymentInput = {
  partyType: "customer" | "supplier";
  partyId?: string;
  method: string;
  amount: number;
  paymentDate?: string;
  referenceNo?: string;
};

type AllocationInput = {
  documentType: string;
  documentId: string;
  allocatedAmount: number;
};

type TopMetric = "soldQty" | "soldAmount";

const DEFAULT_COA: Array<Omit<CoaInput, "parentId"> & { parentCode?: string }> = [
  { code: "1000", nameAr: "الصندوق/البنك", nameEn: "Cash and Bank", accountType: "asset", isPostable: true },
  { code: "1100", nameAr: "ذمم العملاء", nameEn: "Accounts Receivable", accountType: "asset", isPostable: true },
  { code: "1200", nameAr: "المخزون", nameEn: "Inventory", accountType: "asset", isPostable: true },
  { code: "2000", nameAr: "ذمم الموردين", nameEn: "Accounts Payable", accountType: "liability", isPostable: true },
  { code: "2101", nameAr: "ضريبة مدخلات VAT", nameEn: "VAT Input", accountType: "liability", isPostable: true },
  { code: "2102", nameAr: "ضريبة مخرجات VAT", nameEn: "VAT Output", accountType: "liability", isPostable: true },
  { code: "4100", nameAr: "إيرادات المبيعات", nameEn: "Sales Revenue", accountType: "revenue", isPostable: true },
  { code: "5100", nameAr: "تكلفة/مشتريات", nameEn: "Purchases/Cost", accountType: "expense", isPostable: true },
];

const DEFAULT_TAX_CODES = [
  { code: "VAT15", name: "VAT 15%", rate: 0.15, category: "vat", isActive: true },
  { code: "VAT0", name: "VAT 0%", rate: 0, category: "vat", isActive: true },
];

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function assertNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new ValidationError(`القيمة غير صحيحة للحقل: ${field}`);
  }
}

function normalizeDate(value?: string): string {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError("تنسيق تاريخ غير صالح");
  }
  return parsed.toISOString().slice(0, 10);
}

export class AccountingService {
  private initialized = false;

  async seedDefaults(): Promise<void> {
    if (this.initialized) return;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const account of DEFAULT_COA) {
        await client.query(
          `INSERT INTO chart_of_accounts (code, name_ar, name_en, account_type, is_postable, is_active)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (code) DO NOTHING`,
          [
            account.code,
            account.nameAr,
            account.nameEn ?? null,
            account.accountType,
            account.isPostable ?? true,
            account.isActive ?? true,
          ]
        );
      }

      for (const taxCode of DEFAULT_TAX_CODES) {
        await client.query(
          `INSERT INTO tax_codes (code, name, rate, category, is_active)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (code) DO UPDATE
           SET name = EXCLUDED.name,
               rate = EXCLUDED.rate,
               category = EXCLUDED.category,
               is_active = EXCLUDED.is_active`,
          [taxCode.code, taxCode.name, taxCode.rate, taxCode.category, taxCode.isActive]
        );
      }

      await client.query("COMMIT");
      this.initialized = true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async nextSequence(client: PoolClient, scope: string, prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const result = await client.query<{ prefix: string; current_number: number }>(
      `INSERT INTO number_sequences (scope, year, prefix, next_number)
       VALUES ($1, $2, $3, 2)
       ON CONFLICT (scope, year)
       DO UPDATE SET next_number = number_sequences.next_number + 1, updated_at = NOW()
       RETURNING prefix, next_number - 1 AS current_number`,
      [scope, year, prefix]
    );

    const row = result.rows[0];
    return `${row.prefix}${year}${String(row.current_number).padStart(6, "0")}`;
  }

  private async getTaxRateByCode(client: PoolClient, taxCodeId?: string): Promise<number> {
    if (!taxCodeId) return 0.15;
    const result = await client.query<{ rate: number }>(
      "SELECT rate FROM tax_codes WHERE id = $1 AND is_active = TRUE LIMIT 1",
      [taxCodeId]
    );
    return Number(result.rows[0]?.rate ?? 0.15);
  }

  private async getAccountIdByCode(client: PoolClient, code: string): Promise<string> {
    const result = await client.query<{ id: string }>(
      "SELECT id FROM chart_of_accounts WHERE code = $1 LIMIT 1",
      [code]
    );
    if (!result.rows[0]) {
      throw new NotFoundError(`الحساب ${code} غير موجود في دليل الحسابات`);
    }
    return result.rows[0].id;
  }

  async listCoa(): Promise<any[]> {
    const result = await pool.query("SELECT * FROM chart_of_accounts ORDER BY code ASC");
    return result.rows;
  }

  async createCoa(input: CoaInput): Promise<any> {

    const result = await pool.query(
      `INSERT INTO chart_of_accounts (code, name_ar, name_en, account_type, parent_id, is_postable, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.code,
        input.nameAr,
        input.nameEn ?? null,
        input.accountType,
        input.parentId ?? null,
        input.isPostable ?? true,
        input.isActive ?? true,
      ]
    );

    return result.rows[0];
  }

  async updateCoa(id: string, input: Partial<CoaInput>): Promise<any> {

    const existing = await pool.query("SELECT id FROM chart_of_accounts WHERE id = $1 LIMIT 1", [id]);
    if (!existing.rows[0]) throw new NotFoundError("الحساب غير موجود");

    const result = await pool.query(
      `UPDATE chart_of_accounts
       SET code = COALESCE($2, code),
           name_ar = COALESCE($3, name_ar),
           name_en = COALESCE($4, name_en),
           account_type = COALESCE($5, account_type),
           parent_id = COALESCE($6, parent_id),
           is_postable = COALESCE($7, is_postable),
           is_active = COALESCE($8, is_active),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        input.code ?? null,
        input.nameAr ?? null,
        input.nameEn ?? null,
        input.accountType ?? null,
        input.parentId ?? null,
        input.isPostable ?? null,
        input.isActive ?? null,
      ]
    );

    return result.rows[0];
  }

  async listJournalEntries(): Promise<any[]> {
    const result = await pool.query(
      `SELECT je.*,
              COALESCE(SUM(jel.debit), 0) AS total_debit,
              COALESCE(SUM(jel.credit), 0) AS total_credit
       FROM journal_entries je
       LEFT JOIN journal_entry_lines jel ON jel.entry_id = je.id
       GROUP BY je.id
       ORDER BY je.created_at DESC`
    );
    return result.rows;
  }

  async createJournalEntry(input: JournalInput, userId?: string): Promise<any> {

    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      throw new ValidationError("يجب إرسال سطور القيد");
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const entryNo = await this.nextSequence(client, "journal_entries", "JE-");
      const postingDate = normalizeDate(input.postingDate);

      const entryResult = await client.query(
        `INSERT INTO journal_entries
          (entry_no, posting_date, source_type, source_id, status, currency, exchange_rate, created_by)
         VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7)
         RETURNING *`,
        [
          entryNo,
          postingDate,
          input.sourceType,
          input.sourceId ?? null,
          input.currency ?? "SAR",
          input.exchangeRate ?? 1,
          userId ?? null,
        ]
      );

      const entry = entryResult.rows[0];

      for (const line of input.lines) {
        const debit = round2(Number(line.debit ?? 0));
        const credit = round2(Number(line.credit ?? 0));

        if (debit < 0 || credit < 0) {
          throw new ValidationError("قيم المدين/الدائن لا يمكن أن تكون سالبة");
        }

        if (debit === 0 && credit === 0) {
          throw new ValidationError("لا يمكن إضافة سطر بقيم صفرية");
        }

        await client.query(
          `INSERT INTO journal_entry_lines
             (entry_id, account_id, debit, credit, description, cost_center, region_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            entry.id,
            line.accountId,
            debit,
            credit,
            line.description ?? null,
            line.costCenter ?? null,
            line.regionId ?? null,
          ]
        );
      }

      await client.query("COMMIT");
      return this.getJournalEntryById(entry.id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getJournalEntryById(id: string): Promise<any> {

    const entry = await pool.query("SELECT * FROM journal_entries WHERE id = $1 LIMIT 1", [id]);
    if (!entry.rows[0]) throw new NotFoundError("القيد غير موجود");

    const lines = await pool.query(
      `SELECT jel.*, coa.code AS account_code, coa.name_ar AS account_name_ar
       FROM journal_entry_lines jel
       INNER JOIN chart_of_accounts coa ON coa.id = jel.account_id
       WHERE jel.entry_id = $1
       ORDER BY jel.id ASC`,
      [id]
    );

    return {
      ...entry.rows[0],
      lines: lines.rows,
    };
  }

  async postJournalEntry(id: string, userId?: string): Promise<any> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const entryResult = await client.query(
        "SELECT * FROM journal_entries WHERE id = $1 FOR UPDATE",
        [id]
      );

      if (!entryResult.rows[0]) {
        throw new NotFoundError("القيد غير موجود");
      }

      const entry = entryResult.rows[0];
      if (entry.status === "posted") {
        await client.query("COMMIT");
        return this.getJournalEntryById(id);
      }

      const totals = await client.query<{ total_debit: number; total_credit: number }>(
        `SELECT COALESCE(SUM(debit), 0) AS total_debit,
                COALESCE(SUM(credit), 0) AS total_credit
         FROM journal_entry_lines
         WHERE entry_id = $1`,
        [id]
      );

      const totalDebit = round2(Number(totals.rows[0]?.total_debit ?? 0));
      const totalCredit = round2(Number(totals.rows[0]?.total_credit ?? 0));

      if (totalDebit === 0 && totalCredit === 0) {
        throw new ValidationError("لا يمكن ترحيل قيد بلا سطور");
      }

      if (Math.abs(totalDebit - totalCredit) > 0.009) {
        throw new ConflictError("القيد غير متوازن (debit != credit)");
      }

      await client.query(
        `UPDATE journal_entries
         SET status = 'posted',
             posted_at = NOW(),
             posted_by = COALESCE($2, posted_by)
         WHERE id = $1`,
        [id, userId ?? null]
      );

      await client.query("COMMIT");
      return this.getJournalEntryById(id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listSalesInvoices(): Promise<any[]> {
    const result = await pool.query(
      `SELECT si.*, c.name AS customer_name,
              COALESCE(line_preview.items_summary, '-') AS items_summary
       FROM sales_invoices si
       LEFT JOIN customers c ON c.id = si.customer_id
       LEFT JOIN LATERAL (
         SELECT string_agg(COALESCE(NULLIF(TRIM(sil.description), ''), it.name_ar, 'بند'), ' | ' ORDER BY sil.id) AS items_summary
         FROM sales_invoice_lines sil
         LEFT JOIN item_types it ON it.id = sil.item_type_id
         WHERE sil.invoice_id = si.id
       ) line_preview ON true
       ORDER BY si.issue_datetime DESC`
    );
    return result.rows;
  }

  async getSalesInvoice(id: string): Promise<any> {

    const invoiceResult = await pool.query(
      `SELECT si.*, c.name AS customer_name
       FROM sales_invoices si
       LEFT JOIN customers c ON c.id = si.customer_id
       WHERE si.id = $1
       LIMIT 1`,
      [id]
    );

    if (!invoiceResult.rows[0]) {
      throw new NotFoundError("فاتورة المبيعات غير موجودة");
    }

    const linesResult = await pool.query(
      `SELECT sil.*,
              it.name_ar AS item_name_ar,
              u.full_name AS technician_name
       FROM sales_invoice_lines sil
       LEFT JOIN item_types it ON it.id = sil.item_type_id
       LEFT JOIN users u ON u.id = sil.technician_id
       WHERE sil.invoice_id = $1
       ORDER BY sil.id ASC`,
      [id]
    );

    return {
      ...invoiceResult.rows[0],
      lines: linesResult.rows,
    };
  }

  async createSalesInvoice(input: SalesInvoiceInput, userId?: string): Promise<any> {

    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      throw new ValidationError("يجب إضافة بنود الفاتورة");
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const invoiceNo = await this.nextSequence(client, "sales_invoices", "SI-");
      const issueDatetime = input.issueDatetime ? new Date(input.issueDatetime) : new Date();
      if (Number.isNaN(issueDatetime.getTime())) {
        throw new ValidationError("تاريخ الإصدار غير صالح");
      }

      let subtotal = 0;
      let discountTotal = 0;
      let taxableAmount = 0;
      let vatTotal = 0;

      const normalizedLines: Array<SalesLineInput & { lineTotal: number }> = [];

      for (const line of input.lines) {
        assertNonNegative(line.qty, "qty");
        assertNonNegative(line.unitPrice, "unitPrice");
        assertNonNegative(line.discount ?? 0, "discount");

        const gross = round2(line.qty * line.unitPrice);
        const discount = round2(line.discount ?? 0);
        const taxable = round2(Math.max(0, gross - discount));
        const taxRate = await this.getTaxRateByCode(client, line.taxCodeId);
        const tax = round2(taxable * taxRate);
        const total = round2(taxable + tax);

        subtotal += gross;
        discountTotal += discount;
        taxableAmount += taxable;
        vatTotal += tax;

        normalizedLines.push({ ...line, discount, lineTotal: total });
      }

      subtotal = round2(subtotal);
      discountTotal = round2(discountTotal);
      taxableAmount = round2(taxableAmount);
      vatTotal = round2(vatTotal);
      const grandTotal = round2(taxableAmount + vatTotal);

      const invoiceResult = await client.query(
        `INSERT INTO sales_invoices
          (invoice_no, invoice_type, customer_id, issue_datetime, due_date, status,
           subtotal, discount_total, taxable_amount, vat_total, grand_total,
           currency, notes, created_by)
         VALUES
          ($1, $2, $3, $4, $5, 'draft',
           $6, $7, $8, $9, $10,
           $11, $12, $13)
         RETURNING *`,
        [
          invoiceNo,
          input.invoiceType ?? "standard",
          input.customerId ?? null,
          issueDatetime.toISOString(),
          input.dueDate ? normalizeDate(input.dueDate) : null,
          subtotal,
          discountTotal,
          taxableAmount,
          vatTotal,
          grandTotal,
          input.currency ?? "SAR",
          input.notes ?? null,
          userId ?? null,
        ]
      );

      const invoice = invoiceResult.rows[0];

      for (const line of normalizedLines) {
        await client.query(
          `INSERT INTO sales_invoice_lines
            (invoice_id, item_type_id, description, qty, unit_price, discount, tax_code_id,
             line_total, warehouse_id, technician_id, source_inventory_type, qty_before_sale, qty_after_sale)
           VALUES ($1, $2, $3, $4, $5, $6, $7,
                   $8, $9, $10, $11, $12, $13)`,
          [
            invoice.id,
            line.itemTypeId ?? null,
            line.description ?? null,
            line.qty,
            line.unitPrice,
            line.discount ?? 0,
            line.taxCodeId ?? null,
            line.lineTotal,
            line.warehouseId ?? null,
            line.technicianId ?? null,
            line.sourceInventoryType ?? null,
            line.qtyBeforeSale ?? null,
            line.qtyAfterSale ?? null,
          ]
        );
      }

      await client.query("COMMIT");
      return this.getSalesInvoice(invoice.id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async createPostedJournalForSalesInvoice(client: PoolClient, invoiceId: string, userId?: string): Promise<string> {
    const invoiceResult = await client.query(
      "SELECT * FROM sales_invoices WHERE id = $1 LIMIT 1",
      [invoiceId]
    );

    if (!invoiceResult.rows[0]) throw new NotFoundError("فاتورة المبيعات غير موجودة");
    const invoice = invoiceResult.rows[0];

    const arId = await this.getAccountIdByCode(client, "1100");
    const revenueId = await this.getAccountIdByCode(client, "4100");
    const vatOutId = await this.getAccountIdByCode(client, "2102");

    const entryNo = await this.nextSequence(client, "journal_entries", "JE-");

    const entryResult = await client.query(
      `INSERT INTO journal_entries
         (entry_no, posting_date, source_type, source_id, status, currency, exchange_rate, created_by, posted_by, posted_at)
       VALUES
         ($1, CURRENT_DATE, 'sales_invoice', $2, 'posted', $3, 1, $4, $4, NOW())
       RETURNING id`,
      [entryNo, invoiceId, invoice.currency ?? "SAR", userId ?? null]
    );

    const entryId = entryResult.rows[0].id as string;

    await client.query(
      `INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit, description)
       VALUES ($1, $2, $3, 0, $4)`,
      [entryId, arId, round2(Number(invoice.grand_total ?? 0)), `فاتورة مبيعات ${invoice.invoice_no}`]
    );

    await client.query(
      `INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit, description)
       VALUES ($1, $2, 0, $3, $4)`,
      [entryId, revenueId, round2(Number(invoice.taxable_amount ?? 0)), `إيراد مبيعات ${invoice.invoice_no}`]
    );

    const vatValue = round2(Number(invoice.vat_total ?? 0));
    if (vatValue > 0) {
      await client.query(
        `INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit, description)
         VALUES ($1, $2, 0, $3, $4)`,
        [entryId, vatOutId, vatValue, `ضريبة مخرجات ${invoice.invoice_no}`]
      );
    }

    return entryId;
  }

  async postSalesInvoice(id: string, userId?: string): Promise<any> {

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const invoiceResult = await client.query(
        "SELECT * FROM sales_invoices WHERE id = $1 FOR UPDATE",
        [id]
      );

      if (!invoiceResult.rows[0]) {
        throw new NotFoundError("فاتورة المبيعات غير موجودة");
      }

      const invoice = invoiceResult.rows[0];
      if (invoice.status === "posted") {
        await client.query("COMMIT");
        return this.getSalesInvoice(id);
      }

      await this.createPostedJournalForSalesInvoice(client, id, userId);

      await client.query(
        `INSERT INTO tax_transactions (source_type, source_id, tax_code_id, taxable_amount, tax_amount, direction)
         VALUES ('sales_invoice', $1, NULL, $2, $3, 'output')`,
        [id, round2(Number(invoice.taxable_amount ?? 0)), round2(Number(invoice.vat_total ?? 0))]
      );

      await client.query(
        `UPDATE sales_invoices
         SET status = 'posted', posted_at = NOW(), posted_by = COALESCE($2, posted_by)
         WHERE id = $1`,
        [id, userId ?? null]
      );

      await client.query(
        `WITH line_data AS (
            SELECT
              DATE(si.issue_datetime) AS sales_date,
              sil.technician_id,
              sil.item_type_id,
              u.region_id,
              COALESCE(SUM(sil.qty), 0) AS sold_qty,
              COALESCE(SUM(sil.line_total), 0) AS sold_amount,
              COALESCE(MAX(sil.qty_after_sale), 0) AS remaining_qty_end_of_day,
              COALESCE(COUNT(DISTINCT sil.invoice_id), 0) AS invoices_count,
              COALESCE(CASE WHEN SUM(sil.qty) = 0 THEN 0 ELSE SUM(sil.line_total) / SUM(sil.qty) END, 0) AS avg_price
            FROM sales_invoice_lines sil
            INNER JOIN sales_invoices si ON si.id = sil.invoice_id
            LEFT JOIN users u ON u.id = sil.technician_id
            WHERE sil.invoice_id = $1 AND sil.technician_id IS NOT NULL
            GROUP BY DATE(si.issue_datetime), sil.technician_id, sil.item_type_id, u.region_id
          )
          INSERT INTO technician_sales_metrics_daily (
            sales_date,
            technician_id,
            item_type_id,
            region_id,
            sold_qty,
            sold_amount,
            remaining_qty_end_of_day,
            invoices_count,
            returns_qty,
            avg_selling_price,
            last_sale_at
          )
          SELECT
            ld.sales_date,
            ld.technician_id,
            ld.item_type_id,
            ld.region_id,
            ld.sold_qty,
            ld.sold_amount,
            ld.remaining_qty_end_of_day,
            ld.invoices_count,
            0,
            ld.avg_price,
            NOW()
          FROM line_data ld
          ON CONFLICT (sales_date, technician_id, item_type_id, region_id)
          DO UPDATE SET
            sold_qty = technician_sales_metrics_daily.sold_qty + EXCLUDED.sold_qty,
            sold_amount = technician_sales_metrics_daily.sold_amount + EXCLUDED.sold_amount,
            remaining_qty_end_of_day = EXCLUDED.remaining_qty_end_of_day,
            invoices_count = technician_sales_metrics_daily.invoices_count + EXCLUDED.invoices_count,
            avg_selling_price = CASE
              WHEN (technician_sales_metrics_daily.sold_qty + EXCLUDED.sold_qty) = 0 THEN 0
              ELSE (technician_sales_metrics_daily.sold_amount + EXCLUDED.sold_amount)
                   / (technician_sales_metrics_daily.sold_qty + EXCLUDED.sold_qty)
            END,
            last_sale_at = NOW()`,
        [id]
      );

      await client.query("COMMIT");
      return this.getSalesInvoice(id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async createSalesCreditNote(invoiceId: string, userId?: string): Promise<any> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const sourceInvoiceResult = await client.query(
        "SELECT * FROM sales_invoices WHERE id = $1 LIMIT 1",
        [invoiceId]
      );
      if (!sourceInvoiceResult.rows[0]) {
        throw new NotFoundError("الفاتورة الأصلية غير موجودة");
      }

      const source = sourceInvoiceResult.rows[0];
      const linesResult = await client.query(
        "SELECT * FROM sales_invoice_lines WHERE invoice_id = $1",
        [invoiceId]
      );

      const creditInvoiceNo = await this.nextSequence(client, "sales_invoices", "SCN-");

      const creditResult = await client.query(
        `INSERT INTO sales_invoices
          (invoice_no, invoice_type, customer_id, issue_datetime, due_date, status,
           subtotal, discount_total, taxable_amount, vat_total, grand_total,
           currency, notes, posted_at, posted_by, created_by)
         VALUES
          ($1, 'credit_note', $2, NOW(), NULL, 'posted',
           $3, $4, $5, $6, $7,
           $8, $9, NOW(), $10, $10)
         RETURNING *`,
        [
          creditInvoiceNo,
          source.customer_id,
          -Math.abs(Number(source.subtotal ?? 0)),
          -Math.abs(Number(source.discount_total ?? 0)),
          -Math.abs(Number(source.taxable_amount ?? 0)),
          -Math.abs(Number(source.vat_total ?? 0)),
          -Math.abs(Number(source.grand_total ?? 0)),
          source.currency ?? "SAR",
          `إشعار دائن للفاتورة ${source.invoice_no}`,
          userId ?? null,
        ]
      );

      const creditInvoice = creditResult.rows[0];

      for (const line of linesResult.rows) {
        await client.query(
          `INSERT INTO sales_invoice_lines
            (invoice_id, item_type_id, description, qty, unit_price, discount, tax_code_id,
             line_total, warehouse_id, technician_id, source_inventory_type, qty_before_sale, qty_after_sale)
           VALUES ($1, $2, $3, $4, $5, $6, $7,
                   $8, $9, $10, $11, $12, $13)`,
          [
            creditInvoice.id,
            line.item_type_id,
            line.description,
            -Math.abs(Number(line.qty ?? 0)),
            Number(line.unit_price ?? 0),
            Number(line.discount ?? 0),
            line.tax_code_id,
            -Math.abs(Number(line.line_total ?? 0)),
            line.warehouse_id,
            line.technician_id,
            line.source_inventory_type,
            line.qty_before_sale,
            line.qty_after_sale,
          ]
        );
      }

      const arId = await this.getAccountIdByCode(client, "1100");
      const revenueId = await this.getAccountIdByCode(client, "4100");
      const vatOutId = await this.getAccountIdByCode(client, "2102");
      const entryNo = await this.nextSequence(client, "journal_entries", "JE-");

      const entryResult = await client.query(
        `INSERT INTO journal_entries
          (entry_no, posting_date, source_type, source_id, status, currency, exchange_rate, created_by, posted_by, posted_at)
         VALUES
          ($1, CURRENT_DATE, 'sales_credit_note', $2, 'posted', $3, 1, $4, $4, NOW())
         RETURNING id`,
        [entryNo, creditInvoice.id, creditInvoice.currency ?? "SAR", userId ?? null]
      );

      const entryId = entryResult.rows[0].id as string;
      const taxable = Math.abs(Number(source.taxable_amount ?? 0));
      const vat = Math.abs(Number(source.vat_total ?? 0));
      const total = Math.abs(Number(source.grand_total ?? 0));

      await client.query(
        `INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit, description)
         VALUES ($1, $2, $3, 0, $4)`,
        [entryId, revenueId, taxable, `عكس إيراد ${source.invoice_no}`]
      );

      if (vat > 0) {
        await client.query(
          `INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit, description)
           VALUES ($1, $2, $3, 0, $4)`,
          [entryId, vatOutId, vat, `عكس VAT مخرجات ${source.invoice_no}`]
        );
      }

      await client.query(
        `INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit, description)
         VALUES ($1, $2, 0, $3, $4)`,
        [entryId, arId, total, `عكس ذمم العملاء ${source.invoice_no}`]
      );

      await client.query(
        `INSERT INTO tax_transactions (source_type, source_id, tax_code_id, taxable_amount, tax_amount, direction)
         VALUES ('sales_credit_note', $1, NULL, $2, $3, 'output')`,
        [creditInvoice.id, -taxable, -vat]
      );

      await client.query("COMMIT");
      return this.getSalesInvoice(creditInvoice.id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listPurchaseBills(): Promise<any[]> {
    const result = await pool.query(
      `SELECT pb.*, s.name AS supplier_name,
              COALESCE(line_preview.items_summary, '-') AS items_summary
       FROM purchase_bills pb
       LEFT JOIN suppliers s ON s.id = pb.supplier_id
       LEFT JOIN LATERAL (
         SELECT string_agg(COALESCE(NULLIF(TRIM(pbl.description), ''), it.name_ar, 'بند'), ' | ' ORDER BY pbl.id) AS items_summary
         FROM purchase_bill_lines pbl
         LEFT JOIN item_types it ON it.id = pbl.item_type_id
         WHERE pbl.bill_id = pb.id
       ) line_preview ON true
       ORDER BY pb.issue_date DESC, pb.created_at DESC`
    );
    return result.rows;
  }

  async getPurchaseBill(id: string): Promise<any> {

    const billResult = await pool.query(
      `SELECT pb.*, s.name AS supplier_name
       FROM purchase_bills pb
       LEFT JOIN suppliers s ON s.id = pb.supplier_id
       WHERE pb.id = $1
       LIMIT 1`,
      [id]
    );

    if (!billResult.rows[0]) {
      throw new NotFoundError("فاتورة المشتريات غير موجودة");
    }

    const linesResult = await pool.query(
      `SELECT pbl.*, it.name_ar AS item_name_ar
       FROM purchase_bill_lines pbl
       LEFT JOIN item_types it ON it.id = pbl.item_type_id
       WHERE pbl.bill_id = $1
       ORDER BY pbl.id ASC`,
      [id]
    );

    return {
      ...billResult.rows[0],
      lines: linesResult.rows,
    };
  }

  async createPurchaseBill(input: PurchaseBillInput, userId?: string): Promise<any> {

    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      throw new ValidationError("يجب إضافة بنود الفاتورة");
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const billNo = await this.nextSequence(client, "purchase_bills", "PB-");

      let subtotal = 0;
      let discountTotal = 0;
      let taxableAmount = 0;
      let vatTotal = 0;

      const normalizedLines: Array<PurchaseLineInput & { lineTotal: number }> = [];

      for (const line of input.lines) {
        assertNonNegative(line.qty, "qty");
        assertNonNegative(line.unitCost, "unitCost");
        assertNonNegative(line.discount ?? 0, "discount");

        const gross = round2(line.qty * line.unitCost);
        const discount = round2(line.discount ?? 0);
        const taxable = round2(Math.max(0, gross - discount));
        const taxRate = await this.getTaxRateByCode(client, line.taxCodeId);
        const tax = round2(taxable * taxRate);
        const total = round2(taxable + tax);

        subtotal += gross;
        discountTotal += discount;
        taxableAmount += taxable;
        vatTotal += tax;

        normalizedLines.push({ ...line, discount, lineTotal: total });
      }

      subtotal = round2(subtotal);
      discountTotal = round2(discountTotal);
      taxableAmount = round2(taxableAmount);
      vatTotal = round2(vatTotal);
      const grandTotal = round2(taxableAmount + vatTotal);

      const billResult = await client.query(
        `INSERT INTO purchase_bills
          (bill_no, supplier_id, issue_date, due_date, status,
           subtotal, discount_total, taxable_amount, vat_total, grand_total,
           currency, created_by)
         VALUES
          ($1, $2, $3, $4, 'draft',
           $5, $6, $7, $8, $9,
           $10, $11)
         RETURNING *`,
        [
          billNo,
          input.supplierId ?? null,
          normalizeDate(input.issueDate),
          input.dueDate ? normalizeDate(input.dueDate) : null,
          subtotal,
          discountTotal,
          taxableAmount,
          vatTotal,
          grandTotal,
          input.currency ?? "SAR",
          userId ?? null,
        ]
      );

      const bill = billResult.rows[0];

      for (const line of normalizedLines) {
        await client.query(
          `INSERT INTO purchase_bill_lines
            (bill_id, item_type_id, description, qty, unit_cost, discount, tax_code_id, line_total, warehouse_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            bill.id,
            line.itemTypeId ?? null,
            line.description ?? null,
            line.qty,
            line.unitCost,
            line.discount ?? 0,
            line.taxCodeId ?? null,
            line.lineTotal,
            line.warehouseId ?? null,
          ]
        );
      }

      await client.query("COMMIT");
      return this.getPurchaseBill(bill.id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async postPurchaseBill(id: string, userId?: string): Promise<any> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const billResult = await client.query(
        "SELECT * FROM purchase_bills WHERE id = $1 FOR UPDATE",
        [id]
      );

      if (!billResult.rows[0]) {
        throw new NotFoundError("فاتورة المشتريات غير موجودة");
      }

      const bill = billResult.rows[0];
      if (bill.status === "posted") {
        await client.query("COMMIT");
        return this.getPurchaseBill(id);
      }

      const inventoryAccountId = await this.getAccountIdByCode(client, "1200");
      const vatInputId = await this.getAccountIdByCode(client, "2101");
      const apId = await this.getAccountIdByCode(client, "2000");
      const entryNo = await this.nextSequence(client, "journal_entries", "JE-");

      const entryResult = await client.query(
        `INSERT INTO journal_entries
          (entry_no, posting_date, source_type, source_id, status, currency, exchange_rate, created_by, posted_by, posted_at)
         VALUES
          ($1, CURRENT_DATE, 'purchase_bill', $2, 'posted', $3, 1, $4, $4, NOW())
         RETURNING id`,
        [entryNo, id, bill.currency ?? "SAR", userId ?? null]
      );

      const entryId = entryResult.rows[0].id as string;

      await client.query(
        `INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit, description)
         VALUES ($1, $2, $3, 0, $4)`,
        [entryId, inventoryAccountId, round2(Number(bill.taxable_amount ?? 0)), `فاتورة مشتريات ${bill.bill_no}`]
      );

      const vatValue = round2(Number(bill.vat_total ?? 0));
      if (vatValue > 0) {
        await client.query(
          `INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit, description)
           VALUES ($1, $2, $3, 0, $4)`,
          [entryId, vatInputId, vatValue, `VAT مدخلات ${bill.bill_no}`]
        );
      }

      await client.query(
        `INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit, description)
         VALUES ($1, $2, 0, $3, $4)`,
        [entryId, apId, round2(Number(bill.grand_total ?? 0)), `ذمم موردين ${bill.bill_no}`]
      );

      await client.query(
        `INSERT INTO tax_transactions (source_type, source_id, tax_code_id, taxable_amount, tax_amount, direction)
         VALUES ('purchase_bill', $1, NULL, $2, $3, 'input')`,
        [id, round2(Number(bill.taxable_amount ?? 0)), vatValue]
      );

      await client.query(
        `UPDATE purchase_bills
         SET status = 'posted', posted_at = NOW(), posted_by = COALESCE($2, posted_by)
         WHERE id = $1`,
        [id, userId ?? null]
      );

      await client.query("COMMIT");
      return this.getPurchaseBill(id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async createPurchaseDebitNote(id: string, userId?: string): Promise<any> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const sourceResult = await client.query("SELECT * FROM purchase_bills WHERE id = $1 LIMIT 1", [id]);
      if (!sourceResult.rows[0]) throw new NotFoundError("الفاتورة الأصلية غير موجودة");

      const source = sourceResult.rows[0];
      const linesResult = await client.query("SELECT * FROM purchase_bill_lines WHERE bill_id = $1", [id]);

      const noteNo = await this.nextSequence(client, "purchase_bills", "PDN-");

      const noteResult = await client.query(
        `INSERT INTO purchase_bills
          (bill_no, supplier_id, issue_date, status,
           subtotal, discount_total, taxable_amount, vat_total, grand_total,
           currency, posted_at, posted_by, created_by)
         VALUES
          ($1, $2, CURRENT_DATE, 'posted',
           $3, $4, $5, $6, $7,
           $8, NOW(), $9, $9)
         RETURNING *`,
        [
          noteNo,
          source.supplier_id,
          -Math.abs(Number(source.subtotal ?? 0)),
          -Math.abs(Number(source.discount_total ?? 0)),
          -Math.abs(Number(source.taxable_amount ?? 0)),
          -Math.abs(Number(source.vat_total ?? 0)),
          -Math.abs(Number(source.grand_total ?? 0)),
          source.currency ?? "SAR",
          userId ?? null,
        ]
      );

      const note = noteResult.rows[0];
      for (const line of linesResult.rows) {
        await client.query(
          `INSERT INTO purchase_bill_lines
            (bill_id, item_type_id, description, qty, unit_cost, discount, tax_code_id, line_total, warehouse_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            note.id,
            line.item_type_id,
            line.description,
            -Math.abs(Number(line.qty ?? 0)),
            Number(line.unit_cost ?? 0),
            Number(line.discount ?? 0),
            line.tax_code_id,
            -Math.abs(Number(line.line_total ?? 0)),
            line.warehouse_id,
          ]
        );
      }

      const inventoryAccountId = await this.getAccountIdByCode(client, "1200");
      const vatInputId = await this.getAccountIdByCode(client, "2101");
      const apId = await this.getAccountIdByCode(client, "2000");
      const entryNo = await this.nextSequence(client, "journal_entries", "JE-");

      const entryResult = await client.query(
        `INSERT INTO journal_entries
          (entry_no, posting_date, source_type, source_id, status, currency, exchange_rate, created_by, posted_by, posted_at)
         VALUES
          ($1, CURRENT_DATE, 'purchase_debit_note', $2, 'posted', $3, 1, $4, $4, NOW())
         RETURNING id`,
        [entryNo, note.id, note.currency ?? "SAR", userId ?? null]
      );

      const entryId = entryResult.rows[0].id as string;
      const taxable = Math.abs(Number(source.taxable_amount ?? 0));
      const vat = Math.abs(Number(source.vat_total ?? 0));
      const total = Math.abs(Number(source.grand_total ?? 0));

      await client.query(
        `INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit, description)
         VALUES ($1, $2, 0, $3, $4)`,
        [entryId, inventoryAccountId, taxable, `عكس مشتريات ${source.bill_no}`]
      );

      if (vat > 0) {
        await client.query(
          `INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit, description)
           VALUES ($1, $2, 0, $3, $4)`,
          [entryId, vatInputId, vat, `عكس VAT مدخلات ${source.bill_no}`]
        );
      }

      await client.query(
        `INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit, description)
         VALUES ($1, $2, $3, 0, $4)`,
        [entryId, apId, total, `عكس ذمم موردين ${source.bill_no}`]
      );

      await client.query(
        `INSERT INTO tax_transactions (source_type, source_id, tax_code_id, taxable_amount, tax_amount, direction)
         VALUES ('purchase_debit_note', $1, NULL, $2, $3, 'input')`,
        [note.id, -taxable, -vat]
      );

      await client.query("COMMIT");
      return this.getPurchaseBill(note.id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async createPayment(input: PaymentInput, paymentType: "receipt" | "disbursement", userId?: string): Promise<any> {
    assertNonNegative(input.amount, "amount");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const voucherNo = await this.nextSequence(
        client,
        "payments",
        paymentType === "receipt" ? "RCPT-" : "PAY-"
      );

      const paymentDate = normalizeDate(input.paymentDate);

      const paymentResult = await client.query(
        `INSERT INTO payments
          (voucher_no, party_type, party_id, method, amount, payment_date, reference_no, status, payment_type, created_by)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, 'posted', $8, $9)
         RETURNING *`,
        [
          voucherNo,
          input.partyType,
          input.partyId ?? null,
          input.method,
          round2(input.amount),
          paymentDate,
          input.referenceNo ?? null,
          paymentType,
          userId ?? null,
        ]
      );

      const payment = paymentResult.rows[0];

      const cashAccountId = await this.getAccountIdByCode(client, "1000");
      const arId = await this.getAccountIdByCode(client, "1100");
      const apId = await this.getAccountIdByCode(client, "2000");

      const entryNo = await this.nextSequence(client, "journal_entries", "JE-");
      const entryResult = await client.query(
        `INSERT INTO journal_entries
          (entry_no, posting_date, source_type, source_id, status, currency, exchange_rate, created_by, posted_by, posted_at)
         VALUES
          ($1, CURRENT_DATE, 'payment', $2, 'posted', 'SAR', 1, $3, $3, NOW())
         RETURNING id`,
        [entryNo, payment.id, userId ?? null]
      );

      const entryId = entryResult.rows[0].id as string;
      const amount = round2(Number(payment.amount));

      if (paymentType === "receipt") {
        await client.query(
          `INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit, description)
           VALUES ($1, $2, $3, 0, $4),
                  ($1, $5, 0, $3, $6)`,
          [
            entryId,
            cashAccountId,
            amount,
            `تحصيل ${payment.voucher_no}`,
            arId,
            `تخفيض ذمم العملاء ${payment.voucher_no}`,
          ]
        );
      } else {
        await client.query(
          `INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit, description)
           VALUES ($1, $2, $3, 0, $4),
                  ($1, $5, 0, $3, $6)`,
          [
            entryId,
            apId,
            amount,
            `سداد مورد ${payment.voucher_no}`,
            cashAccountId,
            `خروج نقدية ${payment.voucher_no}`,
          ]
        );
      }

      await client.query("COMMIT");
      return payment;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async createReceipt(input: PaymentInput, userId?: string): Promise<any> {
    return this.createPayment(input, "receipt", userId);
  }

  async createDisbursement(input: PaymentInput, userId?: string): Promise<any> {
    return this.createPayment(input, "disbursement", userId);
  }

  async allocatePayment(paymentId: string, input: AllocationInput): Promise<any> {

    const paymentResult = await pool.query("SELECT * FROM payments WHERE id = $1 LIMIT 1", [paymentId]);
    if (!paymentResult.rows[0]) throw new NotFoundError("سند الدفع/التحصيل غير موجود");

    assertNonNegative(input.allocatedAmount, "allocatedAmount");

    const allocationResult = await pool.query(
      `INSERT INTO payment_allocations (payment_id, document_type, document_id, allocated_amount)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [paymentId, input.documentType, input.documentId, round2(input.allocatedAmount)]
    );

    return allocationResult.rows[0];
  }

  async listPayments(): Promise<any[]> {

    const result = await pool.query(
      `SELECT *
       FROM payments
       ORDER BY payment_date DESC, created_at DESC
       LIMIT 200`
    );

    return result.rows;
  }

  async listPaymentAllocations(paymentId: string): Promise<any[]> {

    const paymentResult = await pool.query("SELECT id FROM payments WHERE id = $1 LIMIT 1", [paymentId]);
    if (!paymentResult.rows[0]) {
      throw new NotFoundError("سند الدفع/التحصيل غير موجود");
    }

    const result = await pool.query(
      `SELECT *
       FROM payment_allocations
       WHERE payment_id = $1
       ORDER BY created_at DESC`,
      [paymentId]
    );

    return result.rows;
  }

  async getVatSummary(from?: string, to?: string): Promise<any> {

    const fromDate = from ? normalizeDate(from) : "2000-01-01";
    const toDate = to ? normalizeDate(to) : "2999-12-31";

    const result = await pool.query(
      `SELECT direction,
              COALESCE(SUM(taxable_amount), 0) AS taxable_amount,
              COALESCE(SUM(tax_amount), 0) AS tax_amount
       FROM tax_transactions
       WHERE DATE(created_at) BETWEEN $1 AND $2
       GROUP BY direction`,
      [fromDate, toDate]
    );

    const output = result.rows.find((row) => row.direction === "output");
    const input = result.rows.find((row) => row.direction === "input");

    const outputTax = round2(Number(output?.tax_amount ?? 0));
    const inputTax = round2(Number(input?.tax_amount ?? 0));

    return {
      from: fromDate,
      to: toDate,
      outputTax,
      inputTax,
      netVatPayable: round2(outputTax - inputTax),
      outputTaxableAmount: round2(Number(output?.taxable_amount ?? 0)),
      inputTaxableAmount: round2(Number(input?.taxable_amount ?? 0)),
    };
  }

  async getVatTransactions(from?: string, to?: string): Promise<any[]> {

    const fromDate = from ? normalizeDate(from) : "2000-01-01";
    const toDate = to ? normalizeDate(to) : "2999-12-31";

    const result = await pool.query(
      `SELECT tt.*, tc.code AS tax_code, tc.name AS tax_name
       FROM tax_transactions tt
       LEFT JOIN tax_codes tc ON tc.id = tt.tax_code_id
       WHERE DATE(tt.created_at) BETWEEN $1 AND $2
       ORDER BY tt.created_at DESC`,
      [fromDate, toDate]
    );

    return result.rows;
  }

  async generateEinvoice(sourceType: string, sourceId: string): Promise<any> {

    const basePayload = `${sourceType}:${sourceId}:${new Date().toISOString()}`;
    const invoiceUuid = randomUUID();
    const invoiceHash = createHash("sha256").update(basePayload).digest("hex");
    const qrPayload = Buffer.from(basePayload).toString("base64");
    const xmlPayload = `<Invoice><SourceType>${sourceType}</SourceType><SourceId>${sourceId}</SourceId><UUID>${invoiceUuid}</UUID></Invoice>`;

    const result = await pool.query(
      `INSERT INTO einvoice_documents
        (source_type, source_id, invoice_uuid, invoice_hash, previous_hash, qr_payload, xml_payload, signed_xml_payload,
         zatca_status, clearance_status, reporting_status)
       VALUES
        ($1, $2, $3, $4, NULL, $5, $6, $6,
         'generated', 'pending', 'pending')
       RETURNING *`,
      [sourceType, sourceId, invoiceUuid, invoiceHash, qrPayload, xmlPayload]
    );

    return result.rows[0];
  }

  async submitEinvoice(id: string): Promise<any> {

    const existing = await pool.query("SELECT * FROM einvoice_documents WHERE id = $1 LIMIT 1", [id]);
    if (!existing.rows[0]) throw new NotFoundError("مستند e-invoice غير موجود");

    const result = await pool.query(
      `UPDATE einvoice_documents
       SET zatca_status = 'submitted',
           clearance_status = 'acknowledged',
           reporting_status = 'acknowledged',
           submitted_at = NOW(),
           acknowledged_at = NOW(),
           error_code = NULL,
           error_message = NULL
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return result.rows[0];
  }

  async getEinvoiceStatus(id: string): Promise<any> {
    const result = await pool.query("SELECT * FROM einvoice_documents WHERE id = $1 LIMIT 1", [id]);
    if (!result.rows[0]) throw new NotFoundError("مستند e-invoice غير موجود");
    return result.rows[0];
  }

  async retryEinvoice(id: string): Promise<any> {

    const updateResult = await pool.query(
      `UPDATE einvoice_documents
       SET zatca_status = 'retrying',
           error_code = NULL,
           error_message = NULL
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (!updateResult.rows[0]) {
      throw new NotFoundError("مستند e-invoice غير موجود");
    }

    return this.submitEinvoice(id);
  }

  async listEinvoices(filters?: { sourceType?: string; sourceId?: string; limit?: number }): Promise<any[]> {

    const whereParts: string[] = ["1=1"];
    const values: any[] = [];

    if (filters?.sourceType) {
      values.push(filters.sourceType);
      whereParts.push(`source_type = $${values.length}`);
    }

    if (filters?.sourceId) {
      values.push(filters.sourceId);
      whereParts.push(`source_id = $${values.length}`);
    }

    const limit = Math.max(1, Math.min(Number(filters?.limit ?? 100), 500));

    const result = await pool.query(
      `SELECT *
       FROM einvoice_documents
       WHERE ${whereParts.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT ${limit}`,
      values
    );

    return result.rows;
  }

  async getTechniciansPerformance(filters: {
    from?: string;
    to?: string;
    technicianId?: string;
    regionId?: string;
    itemTypeId?: string;
  }): Promise<any[]> {

    const whereParts: string[] = ["si.status = 'posted'"];
    const values: any[] = [];

    if (filters.from) {
      values.push(normalizeDate(filters.from));
      whereParts.push(`DATE(si.issue_datetime) >= $${values.length}`);
    }

    if (filters.to) {
      values.push(normalizeDate(filters.to));
      whereParts.push(`DATE(si.issue_datetime) <= $${values.length}`);
    }

    if (filters.technicianId) {
      values.push(filters.technicianId);
      whereParts.push(`sil.technician_id = $${values.length}`);
    }

    if (filters.regionId) {
      values.push(filters.regionId);
      whereParts.push(`u.region_id = $${values.length}`);
    }

    if (filters.itemTypeId) {
      values.push(filters.itemTypeId);
      whereParts.push(`sil.item_type_id = $${values.length}`);
    }

    const sql = `
      SELECT
        sil.technician_id AS "technicianId",
        u.full_name AS "technicianName",
        sil.item_type_id AS "itemTypeId",
        it.name_ar AS "itemTypeName",
        u.region_id AS "regionId",
        COALESCE(SUM(sil.qty), 0) AS "soldQty",
        COALESCE(SUM(sil.line_total), 0) AS "soldAmount",
        COALESCE(MAX(sil.qty_after_sale), 0) AS "remainingQty",
        COUNT(DISTINCT sil.invoice_id) AS "invoiceCount",
        0::DOUBLE PRECISION AS "returnQty"
      FROM sales_invoice_lines sil
      INNER JOIN sales_invoices si ON si.id = sil.invoice_id
      LEFT JOIN users u ON u.id = sil.technician_id
      LEFT JOIN item_types it ON it.id = sil.item_type_id
      WHERE ${whereParts.join(" AND ")}
      GROUP BY sil.technician_id, u.full_name, sil.item_type_id, it.name_ar, u.region_id
      ORDER BY "soldAmount" DESC
    `;

    const result = await pool.query(sql, values);
    return result.rows;
  }

  async getTopTechnicians(filters: {
    from?: string;
    to?: string;
    regionId?: string;
    limit?: number;
    metric?: TopMetric;
  }): Promise<any[]> {

    const metric: TopMetric = filters.metric === "soldQty" ? "soldQty" : "soldAmount";
    const rows = await this.getTechniciansPerformance({
      from: filters.from,
      to: filters.to,
      regionId: filters.regionId,
    });

    const grouped = new Map<string, any>();

    for (const row of rows) {
      const key = row.technicianId ?? "unknown";
      if (!grouped.has(key)) {
        grouped.set(key, {
          technicianId: row.technicianId,
          technicianName: row.technicianName,
          regionId: row.regionId,
          soldQty: 0,
          soldAmount: 0,
          invoiceCount: 0,
        });
      }

      const current = grouped.get(key)!;
      current.soldQty += Number(row.soldQty ?? 0);
      current.soldAmount += Number(row.soldAmount ?? 0);
      current.invoiceCount += Number(row.invoiceCount ?? 0);
    }

    const sorted = Array.from(grouped.values()).sort((a, b) => Number(b[metric]) - Number(a[metric]));
    const limit = Math.max(1, Math.min(Number(filters.limit ?? 10), 100));

    return sorted.slice(0, limit);
  }

  async getTopItems(filters: {
    from?: string;
    to?: string;
    regionId?: string;
    technicianId?: string;
    limit?: number;
  }): Promise<any[]> {

    const whereParts: string[] = ["si.status = 'posted'"];
    const values: any[] = [];

    if (filters.from) {
      values.push(normalizeDate(filters.from));
      whereParts.push(`DATE(si.issue_datetime) >= $${values.length}`);
    }

    if (filters.to) {
      values.push(normalizeDate(filters.to));
      whereParts.push(`DATE(si.issue_datetime) <= $${values.length}`);
    }

    if (filters.regionId) {
      values.push(filters.regionId);
      whereParts.push(`u.region_id = $${values.length}`);
    }

    if (filters.technicianId) {
      values.push(filters.technicianId);
      whereParts.push(`sil.technician_id = $${values.length}`);
    }

    const sql = `
      SELECT
        sil.item_type_id AS "itemTypeId",
        it.name_ar AS "itemTypeName",
        COALESCE(SUM(sil.qty), 0) AS "soldQty",
        COALESCE(SUM(sil.line_total), 0) AS "soldAmount",
        COALESCE(MAX(sil.qty_after_sale), 0) AS "remainingQty"
      FROM sales_invoice_lines sil
      INNER JOIN sales_invoices si ON si.id = sil.invoice_id
      LEFT JOIN users u ON u.id = sil.technician_id
      LEFT JOIN item_types it ON it.id = sil.item_type_id
      WHERE ${whereParts.join(" AND ")}
      GROUP BY sil.item_type_id, it.name_ar
      ORDER BY "soldQty" DESC, "soldAmount" DESC
      LIMIT ${Math.max(1, Math.min(Number(filters.limit ?? 10), 100))}
    `;

    const result = await pool.query(sql, values);
    return result.rows;
  }
}

export const accountingService = new AccountingService();
