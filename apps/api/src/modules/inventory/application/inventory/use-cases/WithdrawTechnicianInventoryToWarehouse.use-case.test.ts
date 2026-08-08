import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from "@core/errors/AppError";
import {
  WithdrawTechnicianInventoryToWarehouseUseCase,
  WithdrawToWarehouseUseCaseError,
  type IWithdrawTechnicianInventoryToWarehouseLookupRepository,
  type IWithdrawSystemLogRepository,
  type WithdrawTechnicianInventoryToWarehouseInput,
} from './WithdrawTechnicianInventoryToWarehouse.use-case';
import type {
  IWithdrawTechnicianInventoryToWarehouseUnitOfWork,
  WithdrawTechnicianInventoryToWarehouseTransactionalContext,
} from '@modules/inventory/application/inventory/contracts/IWithdrawTechnicianInventoryToWarehouseUnitOfWork';

type MockLookupRepo = {
  [K in keyof IWithdrawTechnicianInventoryToWarehouseLookupRepository]: ReturnType<typeof vi.fn>;
};

function createMockLookupRepository(): MockLookupRepo {
  return {
    getUser: vi.fn(),
    getWarehouse: vi.fn(),
  };
}

/**
 * In-memory fake unit of work: behaves like a single locked transaction
 * over the four representations, so the use case's aggregation/
 * insufficient-stock/legacy-sync logic can be unit tested without a real
 * database. Real concurrency (locking, forced overlap, rollback) is
 * covered separately by the DB-backed regression test
 * (withdrawTechnicianInventoryToWarehouseConcurrency.test.ts).
 */
function createFakeUnitOfWork(state: {
  technicianEntries: Map<string, { boxes: number; units: number }>;
  warehouseEntries: Map<string, { boxes: number; units: number }>;
  legacyTechnician?: Record<string, unknown>;
  legacyWarehouse?: Record<string, unknown>;
}): IWithdrawTechnicianInventoryToWarehouseUnitOfWork & { calls: Record<string, any[]> } {
  const calls: Record<string, any[]> = {
    setTechnicianEntry: [],
    setWarehouseEntry: [],
    updateLegacyTechnician: [],
    updateLegacyWarehouse: [],
  };

  const context: WithdrawTechnicianInventoryToWarehouseTransactionalContext = {
    warehouseLock: {
      lockWarehouse: vi.fn().mockResolvedValue({ id: 'warehouse-1' }),
    },
    technicianMovingInventory: {
      lockOrCreateEntry: vi.fn(async (_technicianId: string, itemTypeId: string) => {
        const existing = state.technicianEntries.get(itemTypeId) ?? { boxes: 0, units: 0 };
        state.technicianEntries.set(itemTypeId, existing);
        return { itemTypeId, ...existing };
      }),
      setEntry: vi.fn(async (_technicianId: string, itemTypeId: string, boxes: number, units: number) => {
        calls.setTechnicianEntry.push([itemTypeId, boxes, units]);
        state.technicianEntries.set(itemTypeId, { boxes, units });
      }),
    },
    warehouseMovingInventory: {
      lockOrCreateEntry: vi.fn(async (_warehouseId: string, itemTypeId: string) => {
        const existing = state.warehouseEntries.get(itemTypeId) ?? { boxes: 0, units: 0 };
        state.warehouseEntries.set(itemTypeId, existing);
        return { itemTypeId, ...existing };
      }),
      setEntry: vi.fn(async (_warehouseId: string, itemTypeId: string, boxes: number, units: number) => {
        calls.setWarehouseEntry.push([itemTypeId, boxes, units]);
        state.warehouseEntries.set(itemTypeId, { boxes, units });
      }),
    },
    legacyTechnicianInventory: {
      lockLegacyInventory: vi.fn(async () => state.legacyTechnician),
      updateLegacyInventory: vi.fn(async (_technicianId: string, updates: Record<string, number>) => {
        calls.updateLegacyTechnician.push([updates]);
      }),
    },
    legacyWarehouseInventory: {
      lockLegacyInventory: vi.fn(async () => state.legacyWarehouse),
      updateLegacyInventory: vi.fn(async (_warehouseId: string, updates: Record<string, number>) => {
        calls.updateLegacyWarehouse.push([updates]);
      }),
    },
  };

  return {
    calls,
    execute: vi.fn(async (work) => work(context)),
  };
}

function buildValidInput(overrides: Partial<WithdrawTechnicianInventoryToWarehouseInput> = {}): WithdrawTechnicianInventoryToWarehouseInput {
  return {
    actor: {
      id: 'admin-1',
      username: 'admin',
      role: 'admin',
      regionId: 'region-a',
    },
    technicianId: 'tech-1',
    warehouseId: 'warehouse-1',
    notes: 'test notes',
    items: [
      { itemTypeId: 'n950', packagingType: 'box', quantity: 2 },
      { itemTypeId: 'n950', packagingType: 'box', quantity: 1 },
      { itemTypeId: 'n950', packagingType: 'unit', quantity: 2 },
    ],
    ...overrides,
  };
}

describe('WithdrawTechnicianInventoryToWarehouseUseCase', () => {
  it('withdraws successfully, aggregates duplicated items, updates dynamic+legacy stock and logs activity AFTER the transaction commits', async () => {
    const lookup = createMockLookupRepository();
    const logRepo: IWithdrawSystemLogRepository = { logSystemActivity: vi.fn() };
    const unitOfWork = createFakeUnitOfWork({
      technicianEntries: new Map([['n950', { boxes: 5, units: 4 }]]),
      warehouseEntries: new Map([['n950', { boxes: 1, units: 2 }]]),
      legacyTechnician: { n950Boxes: 5, n950Units: 4 },
      legacyWarehouse: { n950Boxes: 1, n950Units: 2 },
    });
    const useCase = new WithdrawTechnicianInventoryToWarehouseUseCase(lookup, unitOfWork, logRepo);

    lookup.getUser.mockResolvedValue({ id: 'tech-1', role: 'technician', fullName: 'Tech One', regionId: 'region-a' });
    lookup.getWarehouse.mockResolvedValue({ id: 'warehouse-1', name: 'WH-1', regionId: 'region-a' });

    const result = await useCase.execute(buildValidInput());

    expect(result).toEqual({
      success: true,
      message: 'تم سحب المخزون إلى المستودع بنجاح',
      itemsCount: 2,
      totalQuantity: 5,
    });

    expect(unitOfWork.calls.setTechnicianEntry).toContainEqual(['n950', 2, 2]);
    expect(unitOfWork.calls.setWarehouseEntry).toContainEqual(['n950', 4, 4]);
    expect(unitOfWork.calls.updateLegacyTechnician).toEqual([[{ n950Boxes: 2, n950Units: 2 }]]);
    expect(unitOfWork.calls.updateLegacyWarehouse).toEqual([[{ n950Boxes: 4, n950Units: 4 }]]);

    expect(logRepo.logSystemActivity).toHaveBeenCalledTimes(1);
    expect((logRepo.logSystemActivity as any).mock.calls[0][0].description).toContain('تم سحب 5 من مخزون المندوب Tech One إلى المستودع WH-1');

    // Log must be called strictly after unitOfWork.execute() has resolved.
    const uowOrder = (unitOfWork.execute as any).mock.invocationCallOrder[0];
    const logOrder = (logRepo.logSystemActivity as any).mock.invocationCallOrder[0];
    expect(logOrder).toBeGreaterThan(uowOrder);
  });

  it('throws NotFoundError when technician does not exist', async () => {
    const lookup = createMockLookupRepository();
    const logRepo: IWithdrawSystemLogRepository = { logSystemActivity: vi.fn() };
    const unitOfWork = createFakeUnitOfWork({ technicianEntries: new Map(), warehouseEntries: new Map() });
    const useCase = new WithdrawTechnicianInventoryToWarehouseUseCase(lookup, unitOfWork, logRepo);

    lookup.getUser.mockResolvedValue(undefined);

    await expect(useCase.execute(buildValidInput())).rejects.toThrowError(NotFoundError);
    expect(unitOfWork.execute).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when warehouse does not exist', async () => {
    const lookup = createMockLookupRepository();
    const logRepo: IWithdrawSystemLogRepository = { logSystemActivity: vi.fn() };
    const unitOfWork = createFakeUnitOfWork({ technicianEntries: new Map(), warehouseEntries: new Map() });
    const useCase = new WithdrawTechnicianInventoryToWarehouseUseCase(lookup, unitOfWork, logRepo);

    lookup.getUser.mockResolvedValue({ id: 'tech-1', role: 'technician', fullName: 'Tech One', regionId: 'region-a' });
    lookup.getWarehouse.mockResolvedValue(undefined);

    await expect(useCase.execute(buildValidInput())).rejects.toThrowError(NotFoundError);
    expect(unitOfWork.execute).not.toHaveBeenCalled();
  });

  it('throws 403 when supervisor withdraws to warehouse outside supervisor region', async () => {
    const lookup = createMockLookupRepository();
    const logRepo: IWithdrawSystemLogRepository = { logSystemActivity: vi.fn() };
    const unitOfWork = createFakeUnitOfWork({ technicianEntries: new Map(), warehouseEntries: new Map() });
    const useCase = new WithdrawTechnicianInventoryToWarehouseUseCase(lookup, unitOfWork, logRepo);

    lookup.getUser.mockResolvedValue({ id: 'tech-1', role: 'technician', fullName: 'Tech One', regionId: 'region-a' });
    lookup.getWarehouse.mockResolvedValue({ id: 'warehouse-1', name: 'WH-1', regionId: 'region-b' });

    await expect(
      useCase.execute(
        buildValidInput({
          actor: { id: 'sup-1', username: 'sup', role: 'supervisor', regionId: 'region-a' },
        })
      )
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'لا يمكنك السحب إلى مستودع خارج منطقتك',
    } satisfies Partial<WithdrawToWarehouseUseCaseError>);

    expect(unitOfWork.execute).not.toHaveBeenCalled();
  });

  it('throws 400 on insufficient technician moving stock and performs no writes (transaction rolled back, no log)', async () => {
    const lookup = createMockLookupRepository();
    const logRepo: IWithdrawSystemLogRepository = { logSystemActivity: vi.fn() };
    const unitOfWork = createFakeUnitOfWork({
      technicianEntries: new Map([['n950', { boxes: 1, units: 0 }]]),
      warehouseEntries: new Map(),
      legacyTechnician: { n950Boxes: 1, n950Units: 0 },
      legacyWarehouse: { n950Boxes: 0, n950Units: 0 },
    });
    const useCase = new WithdrawTechnicianInventoryToWarehouseUseCase(lookup, unitOfWork, logRepo);

    lookup.getUser.mockResolvedValue({ id: 'tech-1', role: 'technician', fullName: 'Tech One', regionId: 'region-a' });
    lookup.getWarehouse.mockResolvedValue({ id: 'warehouse-1', name: 'WH-1', regionId: 'region-a' });

    await expect(
      useCase.execute(
        buildValidInput({ items: [{ itemTypeId: 'n950', packagingType: 'box', quantity: 2 }] })
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'الكمية غير كافية للصنف n950. المتاح: 1 كرتون',
    } satisfies Partial<WithdrawToWarehouseUseCaseError>);

    expect(unitOfWork.calls.setTechnicianEntry).toHaveLength(0);
    expect(unitOfWork.calls.setWarehouseEntry).toHaveLength(0);
    expect(unitOfWork.calls.updateLegacyTechnician).toHaveLength(0);
    expect(unitOfWork.calls.updateLegacyWarehouse).toHaveLength(0);
    expect(logRepo.logSystemActivity).not.toHaveBeenCalled();
  });
});
