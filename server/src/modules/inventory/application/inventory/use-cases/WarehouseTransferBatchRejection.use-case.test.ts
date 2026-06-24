import { describe, expect, it, vi } from 'vitest';
import type { WarehouseTransfer } from '@shared/schema';
import type { IInventoryUnitOfWork, InventoryTransactionalContext } from '../contracts/IInventoryUnitOfWork';
import type { IWarehouseTransferBatchRepository } from '../contracts/IWarehouseTransferBatchRepository';
import { AcceptWarehouseTransferBatchUseCase } from './AcceptWarehouseTransferBatch.use-case';
import {
  AcceptWarehouseTransferByRequestIdUseCase,
  RejectBulkWarehouseTransfersUseCase,
  RejectWarehouseTransferBatchUseCase,
  RejectWarehouseTransferByRequestIdUseCase,
} from './WarehouseTransferBatchRejection.use-case';

function transferFixture(overrides: Partial<WarehouseTransfer> = {}): WarehouseTransfer {
  return {
    id: 't-1',
    requestId: 'req-1',
    warehouseId: 'w-1',
    technicianId: 'tech-1',
    itemType: 'n950',
    packagingType: 'box',
    quantity: 2,
    performedBy: 'admin-1',
    notes: null,
    status: 'pending',
    rejectionReason: null,
    respondedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

class FakeInventoryUnitOfWork implements IInventoryUnitOfWork {
  constructor(private readonly context: InventoryTransactionalContext) {}

  async execute<T>(work: (context: InventoryTransactionalContext) => Promise<T>): Promise<T> {
    return work(this.context);
  }
}

function createBatchRepository(
  overrides: Partial<IWarehouseTransferBatchRepository> = {}
): IWarehouseTransferBatchRepository {
  return {
    async findPendingTransferIdsByCriteria() {
      return [];
    },
    async getTransfersByIds() {
      return [];
    },
    async getWarehouseBalance() {
      return { boxes: 0, units: 0, source: 'entries' };
    },
    async setWarehouseBalance() {
      return;
    },
    async getTechnicianMovingBalance() {
      return { boxes: 0, units: 0 };
    },
    async setTechnicianMovingBalance() {
      return;
    },
    async markTransfersApproved() {
      return [];
    },
    ...overrides,
  };
}

describe('WarehouseTransferBatchRejection use cases', () => {
  it('rejects transfer ids with default reason', async () => {
    const repository = createBatchRepository({
      markTransfersRejected: vi.fn().mockResolvedValue([transferFixture({ status: 'rejected' })]),
    });
    const useCase = new RejectWarehouseTransferBatchUseCase(
      new FakeInventoryUnitOfWork({
        inventoryRepository: {} as any,
        transactionLogRepository: {} as any,
        warehouseTransferBatchRepository: repository,
      })
    );

    const result = await useCase.execute({ transferIds: ['t-1'] });

    expect(result[0].status).toBe('rejected');
    expect(repository.markTransfersRejected).toHaveBeenCalledWith(['t-1'], 'Rejected');
  });

  it('rejects pending transfers in bulk by criteria', async () => {
    const repository = createBatchRepository({
      findPendingTransferIdsByCriteria: vi.fn().mockResolvedValue(['t-1', 't-2']),
      markTransfersRejected: vi.fn().mockResolvedValue([
        transferFixture({ id: 't-1', status: 'rejected' }),
        transferFixture({ id: 't-2', status: 'rejected' }),
      ]),
    });
    const useCase = new RejectBulkWarehouseTransfersUseCase(
      new FakeInventoryUnitOfWork({
        inventoryRepository: {} as any,
        transactionLogRepository: {} as any,
        warehouseTransferBatchRepository: repository,
      })
    );

    const result = await useCase.execute({ criteria: { warehouseId: 'w-1', limit: 2 } });

    expect(result).toHaveLength(2);
    expect(repository.findPendingTransferIdsByCriteria).toHaveBeenCalledWith({ warehouseId: 'w-1', limit: 2 });
    expect(repository.markTransfersRejected).toHaveBeenCalledWith(['t-1', 't-2'], 'Rejected');
  });

  it('accepts transfer by request id using shared batch accept use case', async () => {
    const repository = createBatchRepository({
      findLatestTransferIdByRequestId: vi.fn().mockResolvedValue('t-9'),
    });
    const acceptBatchUseCase = new AcceptWarehouseTransferBatchUseCase({
      execute: async () => [],
    } as IInventoryUnitOfWork);
    vi.spyOn(acceptBatchUseCase, 'execute').mockResolvedValue([
      transferFixture({ id: 't-9', status: 'accepted' }),
    ]);
    const useCase = new AcceptWarehouseTransferByRequestIdUseCase(
      new FakeInventoryUnitOfWork({
        inventoryRepository: {} as any,
        transactionLogRepository: {} as any,
        warehouseTransferBatchRepository: repository,
      }),
      acceptBatchUseCase
    );

    const result = await useCase.execute({ requestId: 'req-9' });

    expect(result.id).toBe('t-9');
    expect(result.status).toBe('accepted');
    expect(repository.findLatestTransferIdByRequestId).toHaveBeenCalledWith('req-9');
    expect(acceptBatchUseCase.execute).toHaveBeenCalledWith(['t-9']);
  });

  it('rejects transfer by request id using shared batch reject use case', async () => {
    const repository = createBatchRepository({
      findLatestTransferIdByRequestId: vi.fn().mockResolvedValue('t-4'),
    });
    const rejectBatchUseCase = new RejectWarehouseTransferBatchUseCase(
      new FakeInventoryUnitOfWork({
        inventoryRepository: {} as any,
        transactionLogRepository: {} as any,
        warehouseTransferBatchRepository: createBatchRepository({
          markTransfersRejected: vi.fn().mockResolvedValue([transferFixture({ id: 't-4', status: 'rejected' })]),
        }),
      })
    );
    vi.spyOn(rejectBatchUseCase, 'execute').mockResolvedValue([
      transferFixture({ id: 't-4', status: 'rejected' }),
    ]);
    const useCase = new RejectWarehouseTransferByRequestIdUseCase(
      new FakeInventoryUnitOfWork({
        inventoryRepository: {} as any,
        transactionLogRepository: {} as any,
        warehouseTransferBatchRepository: repository,
      }),
      rejectBatchUseCase
    );

    const result = await useCase.execute({ requestId: 'req-4', reason: 'duplicate' });

    expect(result.id).toBe('t-4');
    expect(result.status).toBe('rejected');
    expect(repository.findLatestTransferIdByRequestId).toHaveBeenCalledWith('req-4');
    expect(rejectBatchUseCase.execute).toHaveBeenCalledWith({
      transferIds: ['t-4'],
      reason: 'duplicate',
    });
  });

  it('throws not-found for request-id operations when lookup fails', async () => {
    const repository = createBatchRepository({
      findLatestTransferIdByRequestId: vi.fn().mockResolvedValue(undefined),
    });
    const acceptBatchUseCase = new AcceptWarehouseTransferBatchUseCase({
      execute: async () => [],
    } as IInventoryUnitOfWork);
    const rejectBatchUseCase = new RejectWarehouseTransferBatchUseCase(
      new FakeInventoryUnitOfWork({
        inventoryRepository: {} as any,
        transactionLogRepository: {} as any,
        warehouseTransferBatchRepository: createBatchRepository({
          markTransfersRejected: vi.fn().mockResolvedValue([]),
        }),
      })
    );

    const acceptByRequestId = new AcceptWarehouseTransferByRequestIdUseCase(
      new FakeInventoryUnitOfWork({
        inventoryRepository: {} as any,
        transactionLogRepository: {} as any,
        warehouseTransferBatchRepository: repository,
      }),
      acceptBatchUseCase
    );
    const rejectByRequestId = new RejectWarehouseTransferByRequestIdUseCase(
      new FakeInventoryUnitOfWork({
        inventoryRepository: {} as any,
        transactionLogRepository: {} as any,
        warehouseTransferBatchRepository: repository,
      }),
      rejectBatchUseCase
    );

    await expect(acceptByRequestId.execute({ requestId: 'missing' })).rejects.toThrow(
      'Warehouse transfer with request id missing not found'
    );
    await expect(rejectByRequestId.execute({ requestId: 'missing' })).rejects.toThrow(
      'Warehouse transfer with request id missing not found'
    );
  });
});