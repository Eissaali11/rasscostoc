import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, doublePrecision, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users, warehouses } from "./organization.schema";

// 1. Products table
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productCode: text("product_code").notNull().unique(),
  barcode: text("barcode").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  defaultPrice: doublePrecision("default_price").notNull().default(0),
  defaultTaxRate: doublePrecision("default_tax_rate").notNull().default(15.0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  productsBarcodeIdx: index("products_barcode_idx").on(table.barcode),
  productsCodeIdx: index("products_code_idx").on(table.productCode),
}));

// 2. Sales Orders (Representative moped/field sales invoices)
export const salesOrders = pgTable("sales_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  representativeId: varchar("representative_id").notNull().references(() => users.id),
  orderNo: text("order_no").notNull().unique(),
  amountBeforeTax: doublePrecision("amount_before_tax").notNull().default(0),
  taxAmount: doublePrecision("tax_amount").notNull().default(0),
  totalAmount: doublePrecision("total_amount").notNull().default(0),
  idempotencyKey: varchar("idempotency_key").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  salesOrdersRepIdx: index("sales_orders_rep_idx").on(table.representativeId),
  salesOrdersIdempotencyIdx: index("sales_orders_idempotency_idx").on(table.idempotencyKey),
}));

// 3. Sales Order Items
export const salesOrderItems = pgTable("sales_order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => salesOrders.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull().default(0),
  unitPrice: doublePrecision("unit_price").notNull(),
  lineTaxAmount: doublePrecision("line_tax_amount").notNull(),
}, (table) => ({
  orderItemsOrderIdIdx: index("order_items_order_id_idx").on(table.orderId),
  orderItemsProductIdIdx: index("order_items_product_id_idx").on(table.productId),
}));

// 4. Product Transfers (Between warehouses/vans/representatives)
export const productTransfers = pgTable("product_transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceWarehouseId: varchar("source_warehouse_id").references(() => warehouses.id),
  destinationWarehouseId: varchar("destination_warehouse_id").references(() => warehouses.id),
  sourceRepresentativeId: varchar("source_representative_id").references(() => users.id),
  destinationRepresentativeId: varchar("destination_representative_id").references(() => users.id),
  responsibleRepresentativeId: varchar("responsible_representative_id").references(() => users.id),
  affectedAccount: text("affected_account"),
  status: text("status").notNull().default("pending"), // 'pending' | 'completed' | 'cancelled'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  transfersSourceWhIdx: index("transfers_source_wh_idx").on(table.sourceWarehouseId),
  transfersDestWhIdx: index("transfers_dest_wh_idx").on(table.destinationWarehouseId),
  transfersSourceRepIdx: index("transfers_source_rep_idx").on(table.sourceRepresentativeId),
  transfersDestRepIdx: index("transfers_dest_rep_idx").on(table.destinationRepresentativeId),
}));

// 5. Representative Product Stock (Custody balances per technician/representative)
export const technicianProductStock = pgTable("technician_product_stock", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  technicianId: varchar("technician_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  techProductStockIdx: index("tech_prod_stock_idx").on(table.technicianId, table.productId),
  uniqueTechProductIdx: uniqueIndex("tech_product_unique").on(table.technicianId, table.productId),
}));

// Insert schemas for validations
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSalesOrderSchema = createInsertSchema(salesOrders).omit({
  id: true,
  createdAt: true,
});

export const insertSalesOrderItemSchema = createInsertSchema(salesOrderItems).omit({
  id: true,
});

export const insertProductTransferSchema = createInsertSchema(productTransfers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTechnicianProductStockSchema = createInsertSchema(technicianProductStock).omit({
  id: true,
  updatedAt: true,
});

// TypeScript Types
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
export type InsertSalesOrder = z.infer<typeof insertSalesOrderSchema>;
export type SalesOrder = typeof salesOrders.$inferSelect;
export type InsertSalesOrderItem = z.infer<typeof insertSalesOrderItemSchema>;
export type SalesOrderItem = typeof salesOrderItems.$inferSelect;
export type InsertProductTransfer = z.infer<typeof insertProductTransferSchema>;
export type ProductTransfer = typeof productTransfers.$inferSelect;
export type InsertTechnicianProductStock = z.infer<typeof insertTechnicianProductStockSchema>;
export type TechnicianProductStock = typeof technicianProductStock.$inferSelect;
