import type { StockMovementWithDetails } from '@shared/schema';
import type {
  IStockTransferRepository,
  StockTransferInput,
  StockTransferOutput,
} from "@modules/inventory/application/inventory/contracts/IStockTransferRepository";
import { TransferStockUseCase } from "@modules/inventory/application/inventory/use-cases/TransferStock.use-case";
import { DrizzleInventoryUnitOfWork } from './DrizzleInventoryUnitOfWork';
import { DrizzleWarehouseStockMovementsRepository } from './DrizzleWarehouseStockMovementsRepository';
import { getDatabase } from "@core/database/connection";

export class DrizzleStockTransferRepository implements IStockTransferRepository {
  private readonly transferStockUseCase = new TransferStockUseCase(new DrizzleInventoryUnitOfWork());
  private readonly stockMovements = new DrizzleWarehouseStockMovementsRepository(getDatabase());

  async transferStock(input: StockTransferInput): Promise<StockTransferOutput> {
    return this.transferStockUseCase.execute(input);
  }

  async getStockMovements(technicianId?: string, limit?: number): Promise<StockMovementWithDetails[]> {
    if (technicianId) {
      return this.stockMovements.getStockMovementsByTechnician(technicianId, limit);
    }

    return this.stockMovements.getStockMovements(limit);
  }
}
