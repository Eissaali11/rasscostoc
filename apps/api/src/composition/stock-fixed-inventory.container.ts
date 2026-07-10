import { StockFixedInventoryUseCase } from "@modules/inventory/application/inventory/use-cases/StockFixedInventory.use-case";
import { CreateSystemLogUseCase } from "@modules/inventory/application/system-logs/use-cases/CreateSystemLog.use-case";
import { UserManagementUseCase } from "@modules/identity/application/users/use-cases/UserManagement.use-case";
import { DrizzleStockFixedInventoryRepository } from "@modules/inventory/infrastructure/database/DrizzleStockFixedInventoryRepository";
import { SystemLogsRepository } from "@modules/inventory/infrastructure/database/SystemLogsRepository";
import { UserRepository } from "@modules/identity/infrastructure/database/UserRepository";

class StockFixedInventoryContainer {
  private readonly repository = new DrizzleStockFixedInventoryRepository();
  private readonly usersRepository = new UserRepository();
  private readonly systemLogsRepository = new SystemLogsRepository();

  readonly stockFixedInventoryUseCase = new StockFixedInventoryUseCase(this.repository);
  readonly userManagementUseCase = new UserManagementUseCase(this.usersRepository);
  readonly createSystemLogUseCase = new CreateSystemLogUseCase(this.systemLogsRepository);
}

export const stockFixedInventoryContainer = new StockFixedInventoryContainer();
