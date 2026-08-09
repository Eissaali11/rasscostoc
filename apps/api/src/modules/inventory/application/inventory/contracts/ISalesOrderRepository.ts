import type { SalesOrder } from '@shared/schema';

/**
 * DB-R10C.3: amountBeforeTax/taxAmount/totalAmount/unitPrice/lineTaxAmount
 * are now exact decimal STRINGS (matching the NUMERIC columns these
 * persist into — drizzle-orm@0.39.1's numeric() has no `mode` option and
 * is always inferred as `string`, see DB-R10C.1B). Callers must supply
 * an exact decimal string (e.g. "99.99") produced by the decimal-safe
 * primitives in @core/finance/decimal, never a JS `number`, for these
 * authoritative financial fields.
 */
export type CreateSalesOrderInput = {
  representativeId: string;
  orderNo: string;
  amountBeforeTax: string;
  taxAmount: string;
  totalAmount: string;
  idempotencyKey: string;
};

export type CreateSalesOrderItemInput = {
  productId: string;
  quantity: number;
  unitPrice: string;
  lineTaxAmount: string;
};

export interface ISalesOrderRepository {
  existsByIdempotencyKey(key: string): Promise<boolean>;
  findByIdempotencyKey(key: string): Promise<SalesOrder | undefined>;
  create(order: CreateSalesOrderInput, items: CreateSalesOrderItemInput[]): Promise<SalesOrder>;
}
