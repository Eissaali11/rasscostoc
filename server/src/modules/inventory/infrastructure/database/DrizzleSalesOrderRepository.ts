import type { ISalesOrderRepository, CreateSalesOrderInput, CreateSalesOrderItemInput } from '../../application/inventory/contracts/ISalesOrderRepository';
import type { SalesOrder } from '../../../../../../shared/schema';
import { eq } from 'drizzle-orm';
import { salesOrders, salesOrderItems } from '../../../../../../shared/schema';

export class DrizzleSalesOrderRepository implements ISalesOrderRepository {
  constructor(private readonly executor: any) {}

  async existsByIdempotencyKey(key: string): Promise<boolean> {
    const [row] = await this.executor
      .select({ id: salesOrders.id })
      .from(salesOrders)
      .where(eq(salesOrders.idempotencyKey, key))
      .limit(1);
    return !!row;
  }

  async findByIdempotencyKey(key: string): Promise<SalesOrder | undefined> {
    const [row] = await this.executor
      .select()
      .from(salesOrders)
      .where(eq(salesOrders.idempotencyKey, key))
      .limit(1);
    return row || undefined;
  }

  async create(order: CreateSalesOrderInput, items: CreateSalesOrderItemInput[]): Promise<SalesOrder> {
    const [insertedOrder] = await this.executor
      .insert(salesOrders)
      .values({
        representativeId: order.representativeId,
        orderNo: order.orderNo,
        amountBeforeTax: order.amountBeforeTax,
        taxAmount: order.taxAmount,
        totalAmount: order.totalAmount,
        idempotencyKey: order.idempotencyKey,
      })
      .returning();

    if (!insertedOrder) {
      throw new Error("Failed to insert sales order");
    }

    if (items.length > 0) {
      await this.executor
        .insert(salesOrderItems)
        .values(
          items.map((item) => ({
            orderId: insertedOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTaxAmount: item.lineTaxAmount,
          }))
        );
    }

    return insertedOrder;
  }
}
