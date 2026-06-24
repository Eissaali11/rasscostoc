import {
  GetAdminInventoryRequestsUseCase,
  GetAllTechniciansInventoryUseCase,
  GetFixedInventoryDashboardUseCase,
  GetPendingInventoryRequestsCountUseCase,
} from '@modules/identity/application/admin/use-cases/AdminDashboard.use-case';
import { DrizzleAdminDashboardRepository } from '@modules/identity/infrastructure/database/DrizzleAdminDashboardRepository';

class AdminDashboardContainer {
  private readonly repository = new DrizzleAdminDashboardRepository();

  readonly getFixedInventoryDashboardUseCase = new GetFixedInventoryDashboardUseCase(this.repository);
  readonly getAllTechniciansInventoryUseCase = new GetAllTechniciansInventoryUseCase(this.repository);
  readonly getAdminInventoryRequestsUseCase = new GetAdminInventoryRequestsUseCase(this.repository);
  readonly getPendingInventoryRequestsCountUseCase = new GetPendingInventoryRequestsCountUseCase(this.repository);
}

export const adminDashboardContainer = new AdminDashboardContainer();
