import type { WarehouseTransfer } from '@shared/schema';
import type { IInventoryUnitOfWork } from '../contracts/IInventoryUnitOfWork';
import { processWarehouseTransferBatch } from './warehouse-transfer-batch.processor';

export class AcceptWarehouseTransferBatchUseCase {
  constructor(private readonly unitOfWork: IInventoryUnitOfWork) {}

  async execute(transferIds: string[]): Promise<WarehouseTransfer[]> {
    return this.unitOfWork.execute((context) => processWarehouseTransferBatch(context, transferIds));
  }
}
