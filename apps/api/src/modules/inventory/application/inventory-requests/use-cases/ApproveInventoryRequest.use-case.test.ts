import { describe, expect, it, vi } from 'vitest';
import type { InventoryRequest, WarehouseInventory } from "@shared/schema";
import type {
  IInventoryRequestApprovalUnitOfWork,
  InventoryRequestApprovalTransactionalContext,
} from '../contracts/IInventoryRequestApprovalUnitOfWork';
import { InventoryRequestApprovalError } from './InventoryRequestApproval.errors';
import { ApproveInventoryRequestUseCase } from './ApproveInventoryRequest.use-case';

function inventoryRequestFixture(overrides: Partial<InventoryRequest> = {}): InventoryRequest {
  return {
    id: 'req-1',
    technicianId: 'tech-1',
    warehouseId: null,
    n950Boxes: 0,
    n950Units: 0,
    i9000sBoxes: 0,
    i9000sUnits: 0,
    i9100Boxes: 0,
    i9100Units: 0,
    rollPaperBoxes: 0,
    rollPaperUnits: 0,
    stickersBoxes: 0,
    stickersUnits: 0,
    newBatteriesBoxes: 0,
    newBatteriesUnits: 0,
    mobilySimBoxes: 0,
    mobilySimUnits: 0,
    stcSimBoxes: 0,
    stcSimUnits: 0,
    zainSimBoxes: 0,
    zainSimUnits: 0,
    lebaraBoxes: 0,
    lebaraUnits: 0,
    notes: 'note',
    status: 'pending',
    adminNotes: null,
    respondedBy: null,
    respondedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function warehouseInventoryFixture(overrides: Partial<WarehouseInventory> = {}): WarehouseInventory {
  return {
    id: 'inv-1',
    warehouseId: 'wh-1',
    n950Boxes: 10,
    n950Units: 10,
    i9000sBoxes: 10,
    i9000sUnits: 10,
    i9100Boxes: 10,
    i9100Units: 10,
    rollPaperBoxes: 10,
    rollPaperUnits: 10,
    stickersBoxes: 10,
    stickersUnits: 10,
    newBatteriesBoxes: 10,
    newBatteriesUnits: 10,
    mobilySimBoxes: 10,
    mobilySimUnits: 10,
    stcSimBoxes: 10,
    stcSimUnits: 10,
    zainSimBoxes: 10,
    zainSimUnits: 10,
    lebaraBoxes: 10,
    lebaraUnits: 10,
    updatedAt: new Date(),
    ...overrides,
  };
}

function createContextMock(): InventoryRequestApprovalTransactionalContext {
  return {
    inventoryRequestRepository: {
      getById: vi.fn(),
      markApproved: vi.fn(),
      markRejected: vi.fn(),
    },
    userRegionLookupRepository: {
      getById: vi.fn(),
    },
    warehouseInventoryRepository: {
      getByWarehouseId: vi.fn(),
      updateByWarehouseId: vi.fn(),
    },
    warehouseTransferRepository: {
      create: vi.fn(),
    },
  };
}

function createUnitOfWorkMock(context: InventoryRequestApprovalTransactionalContext): IInventoryRequestApprovalUnitOfWork {
  return {
    execute: vi.fn(async (work) => work(context)),
  };
}

describe('ApproveInventoryRequestUseCase', () => {
  it('approves request, creates transfers, and deducts warehouse stock', async () => {
    const context = createContextMock();
    const request = inventoryRequestFixture({ n950Boxes: 1, n950Units: 2, notes: 'urgent' });
    const inventory = warehouseInventoryFixture({ n950Boxes: 5, n950Units: 5 });

    (context.inventoryRequestRepository.getById as any).mockResolvedValue(request);
    (context.userRegionLookupRepository.getById as any).mockResolvedValue({ id: 'tech-1', regionId: 'region-1' });
    (context.warehouseInventoryRepository.getByWarehouseId as any).mockResolvedValue(inventory);
    (context.inventoryRequestRepository.markApproved as any).mockResolvedValue(
      inventoryRequestFixture({ id: 'req-1', status: 'approved', warehouseId: 'wh-1' })
    );

    const useCase = new ApproveInventoryRequestUseCase(createUnitOfWorkMock(context));

    const result = await useCase.execute({
      requestId: 'req-1',
      warehouseId: 'wh-1',
      adminNotes: 'ok',
      actor: { id: 'sup-1', role: 'supervisor', regionId: 'region-1' },
    });

    expect(result.status).toBe('approved');
    expect(context.inventoryRequestRepository.markApproved).toHaveBeenCalledTimes(1);
    expect(context.warehouseTransferRepository.create).toHaveBeenCalledTimes(2);
    expect(context.warehouseInventoryRepository.updateByWarehouseId).toHaveBeenCalledWith('wh-1', expect.objectContaining({
      n950Boxes: 4,
      n950Units: 3,
    }));
  });

  it('returns 403 for supervisor outside region', async () => {
    const context = createContextMock();
    (context.inventoryRequestRepository.getById as any).mockResolvedValue(
      inventoryRequestFixture({ technicianId: 'tech-1' })
    );
    (context.userRegionLookupRepository.getById as any).mockResolvedValue({ id: 'tech-1', regionId: 'region-x' });

    const useCase = new ApproveInventoryRequestUseCase(createUnitOfWorkMock(context));

    await expect(
      useCase.execute({
        requestId: 'req-1',
        warehouseId: 'wh-1',
        actor: { id: 'sup-1', role: 'supervisor', regionId: 'region-1' },
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'لا يمكنك معالجة طلبات من خارج منطقتك',
    } satisfies Partial<InventoryRequestApprovalError>);
  });

  it('fails on insufficient stock and performs no writes (rollback scenario)', async () => {
    const context = createContextMock();
    const request = inventoryRequestFixture({ n950Boxes: 2 });
    const inventory = warehouseInventoryFixture({ n950Boxes: 1 });

    (context.inventoryRequestRepository.getById as any).mockResolvedValue(request);
    (context.warehouseInventoryRepository.getByWarehouseId as any).mockResolvedValue(inventory);

    const useCase = new ApproveInventoryRequestUseCase(createUnitOfWorkMock(context));

    await expect(
      useCase.execute({
        requestId: 'req-1',
        warehouseId: 'wh-1',
        actor: { id: 'admin-1', role: 'admin', regionId: null },
      })
    ).rejects.toThrow('Insufficient stock in warehouse');

    expect(context.inventoryRequestRepository.markApproved).not.toHaveBeenCalled();
    expect(context.warehouseTransferRepository.create).not.toHaveBeenCalled();
    expect(context.warehouseInventoryRepository.updateByWarehouseId).not.toHaveBeenCalled();
  });
});
