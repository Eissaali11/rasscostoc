import { InventoryRequestsCreateUseCase } from "@modules/inventory/application/inventory-requests/use-cases/InventoryRequestsCreate.use-case";
import { CreateSystemLogUseCase } from "@modules/inventory/application/system-logs/use-cases/CreateSystemLog.use-case";
import { SystemLogsRepository } from "@modules/inventory/infrastructure/database/SystemLogsRepository";
import { DrizzleInventoryRequestsCreateRepository } from "@modules/inventory/infrastructure/database/DrizzleInventoryRequestsCreateRepository";

class InventoryRequestsCreateContainer {
  private readonly requestsRepository = new DrizzleInventoryRequestsCreateRepository();
  private readonly systemLogsRepository = new SystemLogsRepository();

  readonly inventoryRequestsCreateUseCase = new InventoryRequestsCreateUseCase(this.requestsRepository);
  readonly createSystemLogUseCase = new CreateSystemLogUseCase(this.systemLogsRepository);
}

export const inventoryRequestsCreateContainer = new InventoryRequestsCreateContainer();
