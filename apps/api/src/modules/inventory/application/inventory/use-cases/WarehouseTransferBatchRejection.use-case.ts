import type { WarehouseTransfer } from '@shared/schema';
import type { IInventoryUnitOfWork } from '../contracts/IInventoryUnitOfWork';
import type { WarehouseTransferBatchCriteria } from '../contracts/IWarehouseTransferBatchRepository';
import type { AcceptWarehouseTransferBatchUseCase } from './AcceptWarehouseTransferBatch.use-case';

export type RejectWarehouseTransferBatchInput = {
  transferIds: string[];
  reason?: string;
};

export type RejectWarehouseTransfersBulkInput = {
  criteria?: WarehouseTransferBatchCriteria;
  reason?: string;
};

export class RejectWarehouseTransferBatchUseCase {
  constructor(private readonly unitOfWork: IInventoryUnitOfWork) {}

  async execute(input: RejectWarehouseTransferBatchInput): Promise<WarehouseTransfer[]> {
    if (input.transferIds.length === 0) {
      return [];
    }

    return this.unitOfWork.execute(async (context) => {
      if (!context.warehouseTransferBatchRepository?.markTransfersRejected) {
        throw new Error('Warehouse batch rejection dependencies are not configured in UnitOfWork');
      }

      return context.warehouseTransferBatchRepository.markTransfersRejected(
        input.transferIds,
        input.reason || 'Rejected'
      );
    });
  }
}

export class RejectBulkWarehouseTransfersUseCase {
  constructor(private readonly unitOfWork: IInventoryUnitOfWork) {}

  async execute(input?: RejectWarehouseTransfersBulkInput): Promise<WarehouseTransfer[]> {
    return this.unitOfWork.execute(async (context) => {
      if (
        !context.warehouseTransferBatchRepository ||
        !context.warehouseTransferBatchRepository.markTransfersRejected
      ) {
        throw new Error('Warehouse batch rejection dependencies are not configured in UnitOfWork');
      }

      const pendingTransferIds = await context.warehouseTransferBatchRepository.findPendingTransferIdsByCriteria(
        input?.criteria
      );

      if (pendingTransferIds.length === 0) {
        return [];
      }

      return context.warehouseTransferBatchRepository.markTransfersRejected(
        pendingTransferIds,
        input?.reason || 'Rejected'
      );
    });
  }
}

export class AcceptWarehouseTransferByRequestIdUseCase {
  constructor(
    private readonly unitOfWork: IInventoryUnitOfWork,
    private readonly acceptWarehouseTransferBatchUseCase: AcceptWarehouseTransferBatchUseCase
  ) {}

  async execute(input: { requestId: string }): Promise<WarehouseTransfer> {
    const transferId = await this.unitOfWork.execute(async (context) => {
      if (!context.warehouseTransferBatchRepository?.findLatestTransferIdByRequestId) {
        throw new Error('Warehouse request-id lookup dependencies are not configured in UnitOfWork');
      }

      return context.warehouseTransferBatchRepository.findLatestTransferIdByRequestId(input.requestId);
    });

    if (!transferId) {
      throw new Error(`Warehouse transfer with request id ${input.requestId} not found`);
    }

    const accepted = await this.acceptWarehouseTransferBatchUseCase.execute([transferId]);
    if (!accepted[0]) {
      throw new Error(`Warehouse transfer with request id ${input.requestId} not found`);
    }

    return accepted[0];
  }
}

export class RejectWarehouseTransferByRequestIdUseCase {
  constructor(
    private readonly unitOfWork: IInventoryUnitOfWork,
    private readonly rejectWarehouseTransferBatchUseCase: RejectWarehouseTransferBatchUseCase
  ) {}

  async execute(input: { requestId: string; reason?: string }): Promise<WarehouseTransfer> {
    const transferId = await this.unitOfWork.execute(async (context) => {
      if (!context.warehouseTransferBatchRepository?.findLatestTransferIdByRequestId) {
        throw new Error('Warehouse request-id lookup dependencies are not configured in UnitOfWork');
      }

      return context.warehouseTransferBatchRepository.findLatestTransferIdByRequestId(input.requestId);
    });

    if (!transferId) {
      throw new Error(`Warehouse transfer with request id ${input.requestId} not found`);
    }

    const rejected = await this.rejectWarehouseTransferBatchUseCase.execute({
      transferIds: [transferId],
      reason: input.reason,
    });

    if (!rejected[0]) {
      throw new Error(`Warehouse transfer with request id ${input.requestId} not found`);
    }

    return rejected[0];
  }
}