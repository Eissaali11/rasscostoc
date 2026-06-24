import { describe, expect, it } from 'vitest';
import type {
  FixedInventorySummary,
  InventoryRequest,
  TechnicianWithBothInventories,
  TechnicianWithFixedInventory,
} from '@shared/schema';
import type { IAdminDashboardRepository } from '../contracts/IAdminDashboardRepository';
import {
  GetAdminInventoryRequestsUseCase,
  GetAllTechniciansInventoryUseCase,
  GetFixedInventoryDashboardUseCase,
  GetPendingInventoryRequestsCountUseCase,
} from './AdminDashboard.use-case';

function fixedSummaryFixture(overrides: Partial<FixedInventorySummary> = {}): FixedInventorySummary {
  return {
    totalN950: 0,
    totalI9000s: 0,
    totalI9100: 0,
    totalRollPaper: 0,
    totalStickers: 0,
    totalNewBatteries: 0,
    totalMobilySim: 0,
    totalStcSim: 0,
    totalZainSim: 0,
    techniciansWithCriticalStock: 0,
    techniciansWithWarningStock: 0,
    techniciansWithGoodStock: 0,
    ...overrides,
  };
}

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

class InMemoryAdminDashboardRepository implements IAdminDashboardRepository {
  constructor(
    private readonly fixedTechnicians: TechnicianWithFixedInventory[] = [],
    private readonly summary: FixedInventorySummary = fixedSummaryFixture(),
    private readonly techniciansWithBoth: TechnicianWithBothInventories[] = [],
    private readonly inventoryRequests: InventoryRequest[] = [],
    private readonly pendingCount: number = 0
  ) {}

  async getAllTechniciansWithFixedInventory(): Promise<TechnicianWithFixedInventory[]> {
    return this.fixedTechnicians;
  }

  async getFixedInventorySummary(): Promise<FixedInventorySummary> {
    return this.summary;
  }

  async getAllTechniciansWithBothInventories(): Promise<TechnicianWithBothInventories[]> {
    return this.techniciansWithBoth;
  }

  async getInventoryRequests(): Promise<InventoryRequest[]> {
    return this.inventoryRequests;
  }

  async getPendingInventoryRequestsCount(): Promise<number> {
    return this.pendingCount;
  }
}

describe('Admin dashboard use cases', () => {
  it('returns fixed inventory dashboard payload with technicians and summary', async () => {
    const repository = new InMemoryAdminDashboardRepository(
      [
        {
          technicianId: 'tech-1',
          technicianName: 'Tech One',
          city: 'Riyadh',
          fixedInventory: null,
          alertLevel: 'warning',
        },
      ],
      fixedSummaryFixture({ totalN950: 12, techniciansWithGoodStock: 1 })
    );

    const useCase = new GetFixedInventoryDashboardUseCase(repository);
    const result = await useCase.execute();

    expect(result.technicians).toHaveLength(1);
    expect(result.summary.totalN950).toBe(12);
  });

  it('returns empty fixed inventory dashboard safely when no technicians exist', async () => {
    const repository = new InMemoryAdminDashboardRepository([], fixedSummaryFixture());

    const useCase = new GetFixedInventoryDashboardUseCase(repository);
    const result = await useCase.execute();

    expect(result.technicians).toEqual([]);
    expect(result.summary).toEqual(fixedSummaryFixture());
  });

  it('returns all technicians inventory payload shape', async () => {
    const repository = new InMemoryAdminDashboardRepository(
      [],
      fixedSummaryFixture(),
      [
        {
          technicianId: 'tech-1',
          technicianName: 'Tech One',
          city: 'Riyadh',
          regionId: 'region-1',
          fixedInventory: null,
          movingInventory: null,
          alertLevel: 'good',
        },
      ]
    );

    const useCase = new GetAllTechniciansInventoryUseCase(repository);
    const result = await useCase.execute();

    expect(result.technicians).toHaveLength(1);
    expect(result.technicians[0].technicianId).toBe('tech-1');
  });

  it('returns inventory requests list and pending count', async () => {
    const repository = new InMemoryAdminDashboardRepository(
      [],
      fixedSummaryFixture(),
      [],
      [inventoryRequestFixture({ id: 'req-1' }), inventoryRequestFixture({ id: 'req-2' })],
      2
    );

    const requestsUseCase = new GetAdminInventoryRequestsUseCase(repository);
    const countUseCase = new GetPendingInventoryRequestsCountUseCase(repository);

    const requests = await requestsUseCase.execute();
    const count = await countUseCase.execute();

    expect(requests).toHaveLength(2);
    expect(count).toEqual({ count: 2 });
  });
});
