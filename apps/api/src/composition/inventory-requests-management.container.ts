import { InventoryRequestsManagementUseCase } from "@modules/inventory/application/inventory-requests/use-cases/InventoryRequestsManagement.use-case";
import { CreateSystemLogUseCase } from "@modules/inventory/application/system-logs/use-cases/CreateSystemLog.use-case";
import { SystemLogsRepository } from "@modules/inventory/infrastructure/database/SystemLogsRepository";
import { DrizzleInventoryRequestsManagementRepository } from "@modules/inventory/infrastructure/database/DrizzleInventoryRequestsManagementRepository";

class InventoryRequestsManagementContainer {
  private readonly requestsRepository = new DrizzleInventoryRequestsManagementRepository();
  private readonly systemLogsRepository = new SystemLogsRepository();

  readonly inventoryRequestsManagementUseCase = new InventoryRequestsManagementUseCase(this.requestsRepository);
  readonly createSystemLogUseCase = new CreateSystemLogUseCase(this.systemLogsRepository);
}

export const inventoryRequestsManagementContainer = new InventoryRequestsManagementContainer();
