import type {
  FixedInventorySummary,
  InventoryRequest,
  TechnicianWithBothInventories,
  TechnicianWithFixedInventory,
} from '@shared/schema';
import type { IAdminDashboardRepository } from '../contracts/IAdminDashboardRepository';

export type FixedInventoryDashboardOutput = {
  technicians: TechnicianWithFixedInventory[];
  summary: FixedInventorySummary;
};

export class GetFixedInventoryDashboardUseCase {
  constructor(private readonly repository: IAdminDashboardRepository) {}

  async execute(): Promise<FixedInventoryDashboardOutput> {
    const technicians = await this.repository.getAllTechniciansWithFixedInventory();
    const summary = await this.repository.getFixedInventorySummary();

    return { technicians, summary };
  }
}

export type AllTechniciansInventoryOutput = {
  technicians: TechnicianWithBothInventories[];
};

export class GetAllTechniciansInventoryUseCase {
  constructor(private readonly repository: IAdminDashboardRepository) {}

  async execute(): Promise<AllTechniciansInventoryOutput> {
    const technicians = await this.repository.getAllTechniciansWithBothInventories();
    return { technicians };
  }
}

export class GetAdminInventoryRequestsUseCase {
  constructor(private readonly repository: IAdminDashboardRepository) {}

  async execute(): Promise<InventoryRequest[]> {
    return this.repository.getInventoryRequests();
  }
}

export type PendingInventoryRequestsCountOutput = {
  count: number;
};

export class GetPendingInventoryRequestsCountUseCase {
  constructor(private readonly repository: IAdminDashboardRepository) {}

  async execute(): Promise<PendingInventoryRequestsCountOutput> {
    const count = await this.repository.getPendingInventoryRequestsCount();
    return { count };
  }
}
