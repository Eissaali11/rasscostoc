import { getDatabase } from "@core/database/connection";
import type {
  IInventoryUnitOfWork,
  InventoryTransactionalContext,
} from "@modules/inventory/application/inventory/contracts/IInventoryUnitOfWork";
import { DrizzleInventoryRepository } from './DrizzleInventoryRepository';
import { DrizzleInventoryTransactionLogRepository } from './DrizzleInventoryTransactionLogRepository';
import { DrizzleTechnicianInventoryTransferRepository } from './DrizzleTechnicianInventoryTransferRepository';
import { DrizzleStockMovementRepository } from './DrizzleStockMovementRepository';
import { DrizzleWarehouseTransferBatchRepository } from './DrizzleWarehouseTransferBatchRepository';
import { DrizzleWarehouseTransferAdminRepository } from './DrizzleWarehouseTransferAdminRepository';
import { DrizzleWarehouseStockMovementsRepository } from './DrizzleWarehouseStockMovementsRepository';

export class DrizzleInventoryUnitOfWork implements IInventoryUnitOfWork {
  private get db() {
    return getDatabase();
  }

  async execute<T>(work: (context: InventoryTransactionalContext) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      const context: InventoryTransactionalContext = {
        inventoryRepository: new DrizzleInventoryRepository(tx),
        transactionLogRepository: new DrizzleInventoryTransactionLogRepository(tx),
        technicianInventoryTransferRepository: new DrizzleTechnicianInventoryTransferRepository(tx),
        stockMovementRepository: new DrizzleStockMovementRepository(tx),
        warehouseTransferBatchRepository: new DrizzleWarehouseTransferBatchRepository(tx),
        warehouseTransferAdminRepository: new DrizzleWarehouseTransferAdminRepository(tx),
        warehouseStockMovementsRepository: new DrizzleWarehouseStockMovementsRepository(tx),
      };

      return work(context);
    });
  }
}
