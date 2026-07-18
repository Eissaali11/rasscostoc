import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./organization.schema";
import { itemTypes, regions } from "./catalog.schema";

export const chartOfAccounts = pgTable("chart_of_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  accountType: text("account_type").notNull(),
  parentId: varchar("parent_id"),
  isPostable: boolean("is_postable").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  parentIdIdx: index("coa_parent_id_idx").on(table.parentId),
}));

export const journalEntries = pgTable("journal_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entryNo: text("entry_no").notNull().unique(),
  postingDate: date("posting_date").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: varchar("source_id"),
  status: text("status").notNull().default("draft"),
  currency: text("currency").notNull().default("SAR"),
  exchangeRate: doublePrecision("exchange_rate").notNull().default(1),
  createdBy: varchar("created_by").references(() => users.id),
  postedBy: varchar("posted_by").references(() => users.id),
  postedAt: timestamp("posted_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  createdByIdx: index("journal_entries_created_by_idx").on(table.createdBy),
  postedByIdx: index("journal_entries_posted_by_idx").on(table.postedBy),
  sourceIdx: index("journal_entries_source_idx").on(table.sourceType, table.sourceId),
}));

export const journalEntryLines = pgTable("journal_entry_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entryId: varchar("entry_id").notNull().references(() => journalEntries.id, { onDelete: "cascade" }),
  accountId: varchar("account_id").notNull().references(() => chartOfAccounts.id),
  debit: doublePrecision("debit").notNull().default(0),
  credit: doublePrecision("credit").notNull().default(0),
  description: text("description"),
  costCenter: text("cost_center"),
  regionId: varchar("region_id").references(() => regions.id),
}, (table) => ({
  entryIdIdx: index("journal_entry_lines_entry_id_idx").on(table.entryId),
  accountIdIdx: index("journal_entry_lines_account_id_idx").on(table.accountId),
  regionIdIdx: index("journal_entry_lines_region_id_idx").on(table.regionId),
}));

export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  vatNumber: text("vat_number"),
  address: text("address"),
  city: text("city"),
  creditLimit: doublePrecision("credit_limit").notNull().default(0),
  paymentTermsDays: integer("payment_terms_days").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  vatNumber: text("vat_number"),
  address: text("address"),
  city: text("city"),
  paymentTermsDays: integer("payment_terms_days").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const salesInvoices = pgTable("sales_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNo: text("invoice_no").notNull().unique(),
  invoiceType: text("invoice_type").notNull().default("standard"),
  customerId: varchar("customer_id").references(() => customers.id),
  issueDatetime: timestamp("issue_datetime").notNull().defaultNow(),
  dueDate: date("due_date"),
  status: text("status").notNull().default("draft"),
  subtotal: doublePrecision("subtotal").notNull().default(0),
  discountTotal: doublePrecision("discount_total").notNull().default(0),
  taxableAmount: doublePrecision("taxable_amount").notNull().default(0),
  vatTotal: doublePrecision("vat_total").notNull().default(0),
  grandTotal: doublePrecision("grand_total").notNull().default(0),
  currency: text("currency").notNull().default("SAR"),
  notes: text("notes"),
  postedAt: timestamp("posted_at"),
  postedBy: varchar("posted_by").references(() => users.id),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  customerIdIdx: index("sales_invoices_customer_id_idx").on(table.customerId),
  postedByIdx: index("sales_invoices_posted_by_idx").on(table.postedBy),
  createdByIdx: index("sales_invoices_created_by_idx").on(table.createdBy),
  issueDatetimeIdx: index("sales_invoices_issue_datetime_idx").on(table.issueDatetime),
}));

export const salesInvoiceLines = pgTable("sales_invoice_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => salesInvoices.id, { onDelete: "cascade" }),
  itemTypeId: varchar("item_type_id").references(() => itemTypes.id),
  description: text("description"),
  qty: doublePrecision("qty").notNull().default(0),
  unitPrice: doublePrecision("unit_price").notNull().default(0),
  discount: doublePrecision("discount").notNull().default(0),
  taxCodeId: varchar("tax_code_id"),
  lineTotal: doublePrecision("line_total").notNull().default(0),
  warehouseId: varchar("warehouse_id"),
  technicianId: varchar("technician_id").references(() => users.id),
  sourceInventoryType: text("source_inventory_type"),
  qtyBeforeSale: doublePrecision("qty_before_sale"),
  qtyAfterSale: doublePrecision("qty_after_sale"),
}, (table) => ({
  invoiceIdIdx: index("sales_invoice_lines_invoice_id_idx").on(table.invoiceId),
  itemTypeIdIdx: index("sales_invoice_lines_item_type_id_idx").on(table.itemTypeId),
  technicianIdIdx: index("sales_invoice_lines_technician_id_idx").on(table.technicianId),
}));

export const technicianSalesMetricsDaily = pgTable("technician_sales_metrics_daily", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  salesDate: date("sales_date").notNull(),
  technicianId: varchar("technician_id").notNull().references(() => users.id),
  itemTypeId: varchar("item_type_id").references(() => itemTypes.id),
  regionId: varchar("region_id").references(() => regions.id),
  soldQty: doublePrecision("sold_qty").notNull().default(0),
  soldAmount: doublePrecision("sold_amount").notNull().default(0),
  remainingQtyEndOfDay: doublePrecision("remaining_qty_end_of_day").notNull().default(0),
  invoicesCount: integer("invoices_count").notNull().default(0),
  returnsQty: doublePrecision("returns_qty").notNull().default(0),
  avgSellingPrice: doublePrecision("avg_selling_price").notNull().default(0),
  lastSaleAt: timestamp("last_sale_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  techSalesMetricsTechIdx: index("tech_sales_metrics_tech_idx").on(table.technicianId),
  techSalesMetricsRegionIdx: index("tech_sales_metrics_region_idx").on(table.regionId),
  techSalesMetricsItemIdx: index("tech_sales_metrics_item_idx").on(table.itemTypeId),
}));

export const purchaseBills = pgTable("purchase_bills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  billNo: text("bill_no").notNull().unique(),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date"),
  status: text("status").notNull().default("draft"),
  subtotal: doublePrecision("subtotal").notNull().default(0),
  discountTotal: doublePrecision("discount_total").notNull().default(0),
  taxableAmount: doublePrecision("taxable_amount").notNull().default(0),
  vatTotal: doublePrecision("vat_total").notNull().default(0),
  grandTotal: doublePrecision("grand_total").notNull().default(0),
  currency: text("currency").notNull().default("SAR"),
  postedAt: timestamp("posted_at"),
  postedBy: varchar("posted_by").references(() => users.id),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  supplierIdIdx: index("purchase_bills_supplier_id_idx").on(table.supplierId),
  postedByIdx: index("purchase_bills_posted_by_idx").on(table.postedBy),
  createdByIdx: index("purchase_bills_created_by_idx").on(table.createdBy),
}));

export const purchaseBillLines = pgTable("purchase_bill_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  billId: varchar("bill_id").notNull().references(() => purchaseBills.id, { onDelete: "cascade" }),
  itemTypeId: varchar("item_type_id").references(() => itemTypes.id),
  description: text("description"),
  qty: doublePrecision("qty").notNull().default(0),
  unitCost: doublePrecision("unit_cost").notNull().default(0),
  discount: doublePrecision("discount").notNull().default(0),
  taxCodeId: varchar("tax_code_id"),
  lineTotal: doublePrecision("line_total").notNull().default(0),
  warehouseId: varchar("warehouse_id"),
}, (table) => ({
  billIdIdx: index("purchase_bill_lines_bill_id_idx").on(table.billId),
  itemTypeIdIdx: index("purchase_bill_lines_item_type_id_idx").on(table.itemTypeId),
}));

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voucherNo: text("voucher_no").notNull().unique(),
  partyType: text("party_type").notNull(),
  partyId: varchar("party_id"),
  method: text("method").notNull(),
  amount: doublePrecision("amount").notNull().default(0),
  paymentDate: date("payment_date").notNull(),
  referenceNo: text("reference_no"),
  status: text("status").notNull().default("posted"),
  paymentType: text("payment_type").notNull().default("receipt"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  partyIdx: index("payments_party_idx").on(table.partyType, table.partyId),
  createdByIdx: index("payments_created_by_idx").on(table.createdBy),
}));

export const paymentAllocations = pgTable("payment_allocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentId: varchar("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull(),
  documentId: varchar("document_id").notNull(),
  allocatedAmount: doublePrecision("allocated_amount").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  paymentIdIdx: index("payment_allocations_payment_id_idx").on(table.paymentId),
  documentIdx: index("payment_allocations_document_idx").on(table.documentType, table.documentId),
}));

export const taxCodes = pgTable("tax_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  rate: doublePrecision("rate").notNull().default(0),
  category: text("category").notNull().default("vat"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taxTransactions = pgTable("tax_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceType: text("source_type").notNull(),
  sourceId: varchar("source_id").notNull(),
  taxCodeId: varchar("tax_code_id").references(() => taxCodes.id),
  taxableAmount: doublePrecision("taxable_amount").notNull().default(0),
  taxAmount: doublePrecision("tax_amount").notNull().default(0),
  direction: text("direction").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  taxCodeIdIdx: index("tax_transactions_tax_code_id_idx").on(table.taxCodeId),
  sourceIdx: index("tax_transactions_source_idx").on(table.sourceType, table.sourceId),
}));

export const einvoiceDocuments = pgTable("einvoice_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceType: text("source_type").notNull(),
  sourceId: varchar("source_id").notNull(),
  invoiceUuid: text("invoice_uuid").notNull().unique(),
  invoiceHash: text("invoice_hash"),
  previousHash: text("previous_hash"),
  qrPayload: text("qr_payload"),
  xmlPayload: text("xml_payload"),
  signedXmlPayload: text("signed_xml_payload"),
  zatcaStatus: text("zatca_status").notNull().default("draft"),
  clearanceStatus: text("clearance_status").notNull().default("pending"),
  reportingStatus: text("reporting_status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at"),
  acknowledgedAt: timestamp("acknowledged_at"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  sourceIdx: index("einvoice_documents_source_idx").on(table.sourceType, table.sourceId),
}));

export const numberSequences = pgTable("number_sequences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scope: text("scope").notNull(),
  year: integer("year").notNull(),
  prefix: text("prefix").notNull(),
  nextNumber: integer("next_number").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // ERP-008-P2.1: match accounting.service nextSequence ON CONFLICT (scope, year)
  scopeYearUnique: unique("number_sequences_scope_year_unique").on(table.scope, table.year),
}));

export const insertChartOfAccountSchema = createInsertSchema(chartOfAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({
  id: true,
  createdAt: true,
  postedAt: true,
  postedBy: true,
});

export const insertSalesInvoiceSchema = createInsertSchema(salesInvoices).omit({
  id: true,
  createdAt: true,
  postedAt: true,
  postedBy: true,
});

export const insertPurchaseBillSchema = createInsertSchema(purchaseBills).omit({
  id: true,
  createdAt: true,
  postedAt: true,
  postedBy: true,
});

export const insertTaxCodeSchema = createInsertSchema(taxCodes).omit({
  id: true,
  createdAt: true,
});

export const financeRoleSchema = z.enum(["admin", "accountant", "finance_manager", "auditor"]);

export type ChartOfAccount = typeof chartOfAccounts.$inferSelect;
export type InsertChartOfAccount = z.infer<typeof insertChartOfAccountSchema>;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type JournalEntryLine = typeof journalEntryLines.$inferSelect;
export type SalesInvoice = typeof salesInvoices.$inferSelect;
export type SalesInvoiceLine = typeof salesInvoiceLines.$inferSelect;
export type PurchaseBill = typeof purchaseBills.$inferSelect;
export type PurchaseBillLine = typeof purchaseBillLines.$inferSelect;
export type TaxCode = typeof taxCodes.$inferSelect;
export type TaxTransaction = typeof taxTransactions.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type PaymentAllocation = typeof paymentAllocations.$inferSelect;
export type EinvoiceDocument = typeof einvoiceDocuments.$inferSelect;
