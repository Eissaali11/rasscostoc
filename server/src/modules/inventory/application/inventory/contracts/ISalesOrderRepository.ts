import type { SalesOrder } from '@shared/schema';

export type CreateSalesOrderInput = {
  representativeId: string;
  orderNo: string;
  amountBeforeTax: number;
  taxAmount: number;
  totalAmount: number;
  idempotencyKey: string;
};

export type CreateSalesOrderItemInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTaxAmount: number;
};

export interface ISalesOrderRepository {
  existsByIdempotencyKey(key: string): Promise<boolean>;
  findByIdempotencyKey(key: string): Promise<SalesOrder | undefined>;
  create(order: CreateSalesOrderInput, items: CreateSalesOrderItemInput[]): Promise<SalesOrder>;
}
