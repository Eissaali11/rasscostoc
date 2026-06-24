import type { InventoryRequest, InsertInventoryRequest } from "@shared/schema";
import type { IInventoryRequestsCreateRepository } from '../contracts/IInventoryRequestsCreateRepository';

export class InventoryRequestsCreateUseCase {
  constructor(private readonly repository: IInventoryRequestsCreateRepository) {}

  async getUserRequests(userId: string): Promise<InventoryRequest[]> {
    return this.repository.getByTechnicianId(userId);
  }

  async createForTechnician(input: {
    technicianId: string;
    data: InsertInventoryRequest;
  }): Promise<InventoryRequest> {
    const requestData = {
      ...input.data,
      technicianId: input.technicianId,
      createdAt: new Date(),
      status: 'pending' as const,
    };

    return this.repository.create(requestData);
  }
}
