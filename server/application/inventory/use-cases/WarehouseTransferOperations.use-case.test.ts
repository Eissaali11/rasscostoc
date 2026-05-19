import { describe, expect, it } from 'vitest';
import type { WarehouseTransfer, WarehouseTransferWithDetails } from '@shared/schema';
import type {
  CreateWarehouseTransferOperationInput,
  IWarehouseTransferOperationsRepository,
  WarehouseTransferQueryFilters,
} from '../contracts/IWarehouseTransferOperationsRepository';
import {
  AcceptWarehouseTransferUseCase,
  CreateWarehouseTransfersUseCase,
  GetWarehouseTransfersUseCase,
  RejectWarehouseTransferUseCase,
  normalizeCreateWarehouseTransferPayload,
} from './WarehouseTransferOperations.use-case';

function transferFixture(overrides: Partial<WarehouseTransfer> = {}): WarehouseTransfer {
  return {
    id: 't-1',
    requestId: null,
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

function transferDetailsFixture(overrides: Partial<WarehouseTransferWithDetails> = {}): WarehouseTransferWithDetails {
  return {
    ...transferFixture(),
    warehouseName: 'Warehouse 1',
    technicianName: 'Tech One',
    performedByName: 'Admin',
    itemNameAr: 'N950',
    ...overrides,
  };
}

class InMemoryWarehouseTransferOperationsRepository implements IWarehouseTransferOperationsRepository {
  readonly createCalls: CreateWarehouseTransferOperationInput[] = [];
  readonly acceptCalls: Array<{ transferId: string; performedBy?: string }> = [];
  readonly rejectCalls: Array<{ transferId: string; reason: string; performedBy?: string }> = [];
  readonly listCalls: WarehouseTransferQueryFilters[] = [];

  constructor(private readonly transfers: WarehouseTransferWithDetails[] = [transferDetailsFixture()]) {}

  async getWarehouseTransfers(filters?: WarehouseTransferQueryFilters): Promise<WarehouseTransferWithDetails[]> {
    this.listCalls.push(filters || {});
    return this.transfers;
  }

  async createWarehouseTransfer(input: CreateWarehouseTransferOperationInput): Promise<WarehouseTransfer> {
    this.createCalls.push(input);
    return transferFixture({
      id: `created-${this.createCalls.length}`,
      warehouseId: input.warehouseId,
      technicianId: input.technicianId,
      itemType: input.itemType,
      packagingType: input.packagingType,
      quantity: input.quantity,
      performedBy: input.performedBy,
      notes: input.notes || null,
    });
  }

  async acceptWarehouseTransfer(transferId: string, performedBy?: string): Promise<WarehouseTransfer> {
    this.acceptCalls.push({ transferId, performedBy });
    return transferFixture({ id: transferId, status: 'accepted', performedBy: performedBy || 'admin-1' });
  }

  async rejectWarehouseTransfer(transferId: string, reason: string, performedBy?: string): Promise<WarehouseTransfer> {
    this.rejectCalls.push({ transferId, reason, performedBy });
    return transferFixture({
      id: transferId,
      status: 'rejected',
      rejectionReason: reason,
      performedBy: performedBy || 'admin-1',
    });
  }
}

describe('WarehouseTransferOperations use cases', () => {
  it('normalizes modern transfer payload', () => {
    const result = normalizeCreateWarehouseTransferPayload({
      warehouseId: 'w-1',
      technicianId: 'tech-1',
      notes: 'n',
      items: [{ itemType: 'n950', packagingType: 'box', quantity: 2 }],
    });

    expect(result).toEqual({
      warehouseId: 'w-1',
      technicianId: 'tech-1',
      notes: 'n',
      items: [{ itemType: 'n950', packagingType: 'box', quantity: 2 }],
    });
  });

  it('normalizes legacy transfer payload', () => {
    const result = normalizeCreateWarehouseTransferPayload({
      warehouseId: 'w-1',
      technicianId: 'tech-1',
      n950: 2,
      n950PackagingType: 'box',
      zainSim: 3,
      zainSimPackagingType: 'unit',
    });

    expect(result.items).toEqual([
      { itemType: 'n950', packagingType: 'box', quantity: 2 },
      { itemType: 'zainSim', packagingType: 'unit', quantity: 3 },
    ]);
  });

  it('normalizes legacy lebaraSim transfer payload', () => {
    const result = normalizeCreateWarehouseTransferPayload({
      warehouseId: 'w-1',
      technicianId: 'tech-1',
      lebaraSim: 4,
      lebaraSimPackagingType: 'unit',
    });

    expect(result.items).toEqual([
      { itemType: 'lebaraSim', packagingType: 'unit', quantity: 4 },
    ]);
  });

  it('creates multiple transfers and returns expected summary', async () => {
    const repository = new InMemoryWarehouseTransferOperationsRepository();
    const useCase = new CreateWarehouseTransfersUseCase(repository);

    const result = await useCase.execute({
      warehouseId: 'w-1',
      technicianId: 'tech-1',
      notes: 'test',
      performedBy: 'admin-1',
      items: [
        { itemType: 'n950', packagingType: 'box', quantity: 2 },
        { itemType: 'i9100', packagingType: 'unit', quantity: 3 },
      ],
    });

    expect(result).toEqual({ success: true, message: 'Transfer created', itemsCount: 2 });
    expect(repository.createCalls).toHaveLength(2);
  });

  it('lists warehouse transfers through repository', async () => {
    const repository = new InMemoryWarehouseTransferOperationsRepository([
      transferDetailsFixture({ id: 't-1' }),
      transferDetailsFixture({ id: 't-2' }),
    ]);
    const useCase = new GetWarehouseTransfersUseCase(repository);

    const result = await useCase.execute({ limit: 2 });

    expect(result).toHaveLength(2);
    expect(repository.listCalls).toEqual([{ limit: 2 }]);
  });

  it('accepts transfer through repository', async () => {
    const repository = new InMemoryWarehouseTransferOperationsRepository();
    const useCase = new AcceptWarehouseTransferUseCase(repository);

    const result = await useCase.execute({ transferId: 't-accept' });

    expect(result.status).toBe('accepted');
    expect(repository.acceptCalls).toEqual([{ transferId: 't-accept', performedBy: undefined }]);
  });

  it('rejects transfer with default reason when reason is missing', async () => {
    const repository = new InMemoryWarehouseTransferOperationsRepository();
    const useCase = new RejectWarehouseTransferUseCase(repository);

    const result = await useCase.execute({ transferId: 't-reject' });

    expect(result.status).toBe('rejected');
    expect(repository.rejectCalls).toEqual([
      { transferId: 't-reject', reason: 'Rejected', performedBy: undefined },
    ]);
  });
});