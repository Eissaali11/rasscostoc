import { describe, expect, it, vi } from 'vitest';
import type { InventoryRequest } from "@shared/schema";
import type {
  IInventoryRequestApprovalUnitOfWork,
  InventoryRequestApprovalTransactionalContext,
} from '../contracts/IInventoryRequestApprovalUnitOfWork';
import { InventoryRequestApprovalError } from './InventoryRequestApproval.errors';
import { RejectInventoryRequestUseCase } from './RejectInventoryRequest.use-case';

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
    notes: null,
    status: 'pending',
    adminNotes: null,
    respondedBy: null,
    respondedAt: null,
    createdAt: new Date(),
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

describe('RejectInventoryRequestUseCase', () => {
  it('rejects request successfully', async () => {
    const context = createContextMock();
    (context.inventoryRequestRepository.markRejected as any).mockResolvedValue(
      inventoryRequestFixture({ status: 'rejected' })
    );

    const useCase = new RejectInventoryRequestUseCase(createUnitOfWorkMock(context));

    const result = await useCase.execute({
      requestId: 'req-1',
      adminNotes: 'رفض',
      actor: { id: 'admin-1', role: 'admin', regionId: null },
    });

    expect(result.status).toBe('rejected');
    expect(context.inventoryRequestRepository.markRejected).toHaveBeenCalledTimes(1);
  });

  it('returns 403 for supervisor outside region', async () => {
    const context = createContextMock();
    (context.inventoryRequestRepository.getById as any).mockResolvedValue(
      inventoryRequestFixture({ technicianId: 'tech-1' })
    );
    (context.userRegionLookupRepository.getById as any).mockResolvedValue({ id: 'tech-1', regionId: 'other-region' });

    const useCase = new RejectInventoryRequestUseCase(createUnitOfWorkMock(context));

    await expect(
      useCase.execute({
        requestId: 'req-1',
        adminNotes: 'رفض',
        actor: { id: 'sup-1', role: 'supervisor', regionId: 'region-1' },
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'لا يمكنك معالجة طلبات من خارج منطقتك',
    } satisfies Partial<InventoryRequestApprovalError>);
  });

  it('returns 404 when request does not exist', async () => {
    const context = createContextMock();
    (context.inventoryRequestRepository.markRejected as any).mockResolvedValue(undefined);

    const useCase = new RejectInventoryRequestUseCase(createUnitOfWorkMock(context));

    await expect(
      useCase.execute({
        requestId: 'missing',
        adminNotes: 'رفض',
        actor: { id: 'admin-1', role: 'admin', regionId: null },
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Request not found',
    } satisfies Partial<InventoryRequestApprovalError>);
  });
});
