import { describe, expect, it } from 'vitest';
import type { ITechniciansInventoryReadRepository } from '../contracts/ITechniciansInventoryReadRepository';
import {
  GetAllTechniciansInventoryUseCase,
  GetTechniciansInventoryByActorUseCase,
  GetTechniciansInventoryByActorUseCaseError,
} from './GetTechniciansInventoryByActor.use-case';

class InMemoryTechniciansInventoryReadRepository implements ITechniciansInventoryReadRepository {
  constructor(
    private readonly allTechnicians: any[] = [],
    private readonly regionTechniciansByRegionId: Map<string, any[]> = new Map()
  ) {}

  async getAllTechniciansWithBothInventories(): Promise<any[]> {
    return this.allTechnicians;
  }

  async getRegionTechniciansWithInventories(regionId: string): Promise<any[]> {
    return this.regionTechniciansByRegionId.get(regionId) || [];
  }
}

describe('GetTechniciansInventoryByActor use cases', () => {
  it('returns all technicians for admin actor', async () => {
    const repository = new InMemoryTechniciansInventoryReadRepository([
      { technicianId: 'tech-1' },
      { technicianId: 'tech-2' },
    ]);
    const useCase = new GetTechniciansInventoryByActorUseCase(repository);

    const result = await useCase.execute({
      actor: { role: 'admin', regionId: null },
    });

    expect(result.technicians).toHaveLength(2);
  });

  it('returns region technicians for supervisor actor', async () => {
    const repository = new InMemoryTechniciansInventoryReadRepository(
      [],
      new Map([
        ['region-1', [{ technicianId: 'tech-r1' }]],
      ])
    );
    const useCase = new GetTechniciansInventoryByActorUseCase(repository);

    const result = await useCase.execute({
      actor: { role: 'supervisor', regionId: 'region-1' },
    });

    expect(result).toEqual({ technicians: [{ technicianId: 'tech-r1' }] });
  });

  it('throws 400 with the same Arabic message when supervisor has no region', async () => {
    const repository = new InMemoryTechniciansInventoryReadRepository();
    const useCase = new GetTechniciansInventoryByActorUseCase(repository);

    await expect(
      useCase.execute({
        actor: { role: 'supervisor', regionId: null },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'المشرف يجب أن يكون مرتبط بمنطقة لعرض البيانات',
    } satisfies Partial<GetTechniciansInventoryByActorUseCaseError>);
  });

  it('returns all technicians through dedicated all-technicians use case', async () => {
    const repository = new InMemoryTechniciansInventoryReadRepository([{ technicianId: 'tech-1' }]);
    const useCase = new GetAllTechniciansInventoryUseCase(repository);

    const result = await useCase.execute();

    expect(result).toEqual({ technicians: [{ technicianId: 'tech-1' }] });
  });
});
