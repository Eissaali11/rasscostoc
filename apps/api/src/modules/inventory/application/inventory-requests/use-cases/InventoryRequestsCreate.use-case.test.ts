import { describe, expect, it, vi } from 'vitest';
import type { InventoryRequest, InsertInventoryRequest } from "@shared/schema";
import type { IInventoryRequestsCreateRepository } from '../contracts/IInventoryRequestsCreateRepository';
import { InventoryRequestsCreateUseCase } from './InventoryRequestsCreate.use-case';

type MockRepository = {
  [K in keyof IInventoryRequestsCreateRepository]: ReturnType<typeof vi.fn>;
};

function createRepositoryMock(): MockRepository {
  return {
    getByTechnicianId: vi.fn(),
    create: vi.fn(),
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

describe('InventoryRequestsCreateUseCase', () => {
  it('returns current user requests', async () => {
    const repository = createRepositoryMock();
    const useCase = new InventoryRequestsCreateUseCase(repository);
    repository.getByTechnicianId.mockResolvedValue([
      inventoryRequestFixture({ id: 'req-1' }),
      inventoryRequestFixture({ id: 'req-2' }),
    ]);

    const result = await useCase.getUserRequests('tech-1');

    expect(result).toHaveLength(2);
    expect(repository.getByTechnicianId).toHaveBeenCalledWith('tech-1');
  });

  it('creates pending request for technician with timestamp', async () => {
    const repository = createRepositoryMock();
    const useCase = new InventoryRequestsCreateUseCase(repository);
    repository.create.mockResolvedValue(inventoryRequestFixture({ id: 'req-9', technicianId: 'tech-9' }));

    const data = {
      technicianId: 'ignored-client-value',
      warehouseId: null,
      n950Boxes: 1,
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
      status: 'approved',
      adminNotes: null,
      respondedBy: null,
      respondedAt: null,
    } as unknown as InsertInventoryRequest;

    const result = await useCase.createForTechnician({
      technicianId: 'tech-9',
      data,
    });

    expect(result.id).toBe('req-9');
    expect(repository.create).toHaveBeenCalledTimes(1);

    const createInput = repository.create.mock.calls[0][0];
    expect(createInput.technicianId).toBe('tech-9');
    expect(createInput.status).toBe('pending');
    expect(createInput.createdAt).toBeInstanceOf(Date);
  });
});
