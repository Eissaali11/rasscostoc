import type { ITechniciansInventoryReadRepository } from '../contracts/ITechniciansInventoryReadRepository';

export class GetTechniciansInventoryByActorUseCaseError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'GetTechniciansInventoryByActorUseCaseError';
  }
}

export type GetTechniciansInventoryByActorInput = {
  actor: {
    role: string;
    regionId?: string | null;
  };
};

export type GetTechniciansInventoryByActorOutput = {
  technicians: any[];
};

export class GetTechniciansInventoryByActorUseCase {
  constructor(private readonly repository: ITechniciansInventoryReadRepository) {}

  async execute(input: GetTechniciansInventoryByActorInput): Promise<GetTechniciansInventoryByActorOutput> {
    if (input.actor.role === 'admin') {
      const technicians = await this.repository.getAllTechniciansWithBothInventories();
      return { technicians };
    }

    if (!input.actor.regionId) {
      throw new GetTechniciansInventoryByActorUseCaseError(
        400,
        'المشرف يجب أن يكون مرتبط بمنطقة لعرض البيانات'
      );
    }

    const technicians = await this.repository.getRegionTechniciansWithInventories(input.actor.regionId);
    return { technicians };
  }
}

export class GetAllTechniciansInventoryUseCase {
  constructor(private readonly repository: ITechniciansInventoryReadRepository) {}

  async execute(): Promise<{ technicians: any[] }> {
    const technicians = await this.repository.getAllTechniciansWithBothInventories();
    return { technicians };
  }
}
