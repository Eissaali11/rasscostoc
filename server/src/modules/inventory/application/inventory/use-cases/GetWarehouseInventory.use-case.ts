import type { IInventoryUnitOfWork } from '../contracts/IInventoryUnitOfWork';
import type { WarehouseInventory } from '@shared/schema';

export type GetWarehouseInventoryInput = {
  actor: {
    id: string;
    role: string;
  };
  warehouseId: string;
};

export class GetWarehouseInventoryUseCaseError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'GetWarehouseInventoryUseCaseError';
  }
}

export class GetWarehouseInventoryUseCase {
  constructor(private readonly unitOfWork: IInventoryUnitOfWork) {}

  async execute(input: GetWarehouseInventoryInput): Promise<WarehouseInventory[]> {
    return this.unitOfWork.execute(async (context) => {
      if (!context.warehouseStockMovementsRepository) {
        throw new Error('Warehouse stock movements dependencies are not configured in UnitOfWork');
      }

      const repository = context.warehouseStockMovementsRepository;

      if (input.actor.role !== 'admin') {
        const supervisorWarehouses = await repository.getSupervisorWarehouseIds(input.actor.id);
        if (!supervisorWarehouses.includes(input.warehouseId)) {
          throw new GetWarehouseInventoryUseCaseError(403, 'Access denied to this warehouse');
        }
      }

      return repository.getWarehouseInventoryByWarehouseId(input.warehouseId);
    });
  }
}