import {
  GetAllTechniciansInventoryUseCase,
  GetTechniciansInventoryByActorUseCase,
} from "@modules/inventory/application/technicians/use-cases/GetTechniciansInventoryByActor.use-case";
import { DrizzleTechniciansInventoryReadRepository } from "@modules/inventory/infrastructure/database/DrizzleTechniciansInventoryReadRepository";

class TechniciansContainer {
  private readonly repository = new DrizzleTechniciansInventoryReadRepository();

  readonly getAllTechniciansInventoryUseCase = new GetAllTechniciansInventoryUseCase(this.repository);
  readonly getTechniciansInventoryByActorUseCase = new GetTechniciansInventoryByActorUseCase(this.repository);
}

export const techniciansContainer = new TechniciansContainer();
