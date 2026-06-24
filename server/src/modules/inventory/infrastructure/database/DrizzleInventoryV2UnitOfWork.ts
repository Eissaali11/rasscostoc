import { getDatabase } from "../../../../core/database/connection";
import type { IInventoryV2UnitOfWork, InventoryV2TransactionalContext } from '../../application/inventory/contracts/IInventoryV2UnitOfWork';
import { DrizzleProductRepository } from './DrizzleProductRepository';
import { DrizzleSalesOrderRepository } from './DrizzleSalesOrderRepository';
import { DrizzleTechnicianProductStockRepository } from './DrizzleTechnicianProductStockRepository';

export class DrizzleInventoryV2UnitOfWork implements IInventoryV2UnitOfWork {
  private get db() {
    return getDatabase();
  }

  async execute<T>(work: (context: InventoryV2TransactionalContext) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      const context: InventoryV2TransactionalContext = {
        productRepository: new DrizzleProductRepository(tx),
        salesOrderRepository: new DrizzleSalesOrderRepository(tx),
        technicianProductStockRepository: new DrizzleTechnicianProductStockRepository(tx),
      };
      return work(context);
    });
  }
}
