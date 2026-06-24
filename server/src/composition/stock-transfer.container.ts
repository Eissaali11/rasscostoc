import { StockTransferUseCase } from "@modules/inventory/application/inventory/use-cases/StockTransfer.use-case";
import { CreateSystemLogUseCase } from "@modules/inventory/application/system-logs/use-cases/CreateSystemLog.use-case";
import { SystemLogsRepository } from "@modules/inventory/infrastructure/database/SystemLogsRepository";
import { DrizzleStockTransferRepository } from "@modules/inventory/infrastructure/database/DrizzleStockTransferRepository";

class StockTransferContainer {
  private readonly repository = new DrizzleStockTransferRepository();
  private readonly systemLogsRepository = new SystemLogsRepository();

  readonly stockTransferUseCase = new StockTransferUseCase(this.repository);
  readonly createSystemLogUseCase = new CreateSystemLogUseCase(this.systemLogsRepository);
}

export const stockTransferContainer = new StockTransferContainer();
