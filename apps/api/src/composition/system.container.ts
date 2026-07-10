import { ExportSystemBackupUseCase } from "@modules/inventory/infrastructure/system/use-cases/ExportSystemBackup.use-case";
import { ImportSystemBackupUseCase } from "@modules/inventory/infrastructure/system/use-cases/ImportSystemBackup.use-case";
import { GetBackupHistoryUseCase } from "@modules/inventory/infrastructure/system/use-cases/GetBackupHistory.use-case";
import { GetBackupStorageStatsUseCase } from "@modules/inventory/infrastructure/system/use-cases/GetBackupStorageStats.use-case";
import { GetSystemLogsUseCase } from "@modules/inventory/application/system-logs/use-cases/GetSystemLogs.use-case";
import { repositories } from "@modules/inventory/infrastructure/database";
import { SystemController } from "@modules/inventory/presentation/controllers/system.controller";

class SystemContainer {
  readonly exportSystemBackupUseCase = new ExportSystemBackupUseCase();
  readonly importSystemBackupUseCase = new ImportSystemBackupUseCase();
  readonly getBackupHistoryUseCase = new GetBackupHistoryUseCase();
  readonly getBackupStorageStatsUseCase = new GetBackupStorageStatsUseCase();
  readonly getSystemLogsUseCase = new GetSystemLogsUseCase(repositories.systemLogs);

  readonly systemController = new SystemController(
    repositories.systemLogs,
    this.exportSystemBackupUseCase,
    this.importSystemBackupUseCase,
    this.getBackupHistoryUseCase,
    this.getBackupStorageStatsUseCase,
    this.getSystemLogsUseCase
  );
}

export const systemContainer = new SystemContainer();
export default systemContainer;
