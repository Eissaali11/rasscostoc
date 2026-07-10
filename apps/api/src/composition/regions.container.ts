import { GetRegionsWithStatsUseCase } from "@modules/inventory/application/regions/use-cases/GetRegionsWithStats.use-case";
import { repositories } from "@modules/inventory/infrastructure/database";
import { RegionsController } from "@modules/inventory/presentation/controllers/regions.controller";

class RegionsContainer {
  readonly getRegionsWithStatsUseCase = new GetRegionsWithStatsUseCase(repositories.region);

  readonly regionsController = new RegionsController(
    repositories.region,
    repositories.systemLogs,
    this.getRegionsWithStatsUseCase
  );
}

export const regionsContainer = new RegionsContainer();
export default regionsContainer;
