import type { IInventoryUnitOfWork } from '../contracts/IInventoryUnitOfWork';
import type { StockMovementWithDetails } from '@shared/schema';

export type GetStockMovementsInput = {
  actor: {
    id: string;
    role: string;
    regionId: string | null;
  };
};

export class GetStockMovementsUseCase {
  constructor(private readonly unitOfWork: IInventoryUnitOfWork) {}

  async execute(input: GetStockMovementsInput): Promise<StockMovementWithDetails[]> {
    return this.unitOfWork.execute(async (context) => {
      if (!context.warehouseStockMovementsRepository) {
        throw new Error('Warehouse stock movements dependencies are not configured in UnitOfWork');
      }

      if (input.actor.role === 'admin') {
        return context.warehouseStockMovementsRepository.getStockMovements();
      }

      if (input.actor.role === 'supervisor') {
        return context.warehouseStockMovementsRepository.getStockMovementsByRegion(input.actor.regionId);
      }

      return context.warehouseStockMovementsRepository.getStockMovementsByTechnician(input.actor.id);
    });
  }
}