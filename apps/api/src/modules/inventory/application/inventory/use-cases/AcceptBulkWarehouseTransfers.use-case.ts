import type { WarehouseTransfer } from '@shared/schema';
import type { IInventoryUnitOfWork } from '../contracts/IInventoryUnitOfWork';
import type { WarehouseTransferBatchCriteria } from '../contracts/IWarehouseTransferBatchRepository';
import { processWarehouseTransferBatch } from './warehouse-transfer-batch.processor';

export class AcceptBulkWarehouseTransfersUseCase {
  constructor(private readonly unitOfWork: IInventoryUnitOfWork) {}

  async execute(criteria?: WarehouseTransferBatchCriteria): Promise<WarehouseTransfer[]> {
    return this.unitOfWork.execute(async (context) => {
      if (!context.warehouseTransferBatchRepository) {
        throw new Error('Warehouse batch dependencies are not configured in UnitOfWork');
      }

      const pendingTransferIds = await context.warehouseTransferBatchRepository.findPendingTransferIdsByCriteria(
        criteria
      );

      return processWarehouseTransferBatch(context, pendingTransferIds);
    });
  }
}
