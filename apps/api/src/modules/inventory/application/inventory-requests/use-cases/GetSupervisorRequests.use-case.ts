import type { IInventoryRequestsRepository } from '../contracts/IInventoryRequestsRepository';

export class GetSupervisorRequestsUseCase {
  constructor(private readonly repository: IInventoryRequestsRepository) {}

  async execute(regionId: string, status?: string): Promise<any[]> {
    if (!regionId) {
      throw new Error("Region ID is required");
    }
    return this.repository.getSupervisorRequestsByRegion(regionId, status);
  }
}
