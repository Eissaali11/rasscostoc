import { GetSupervisorRequestsUseCase } from "@modules/inventory/application/inventory-requests/use-cases/GetSupervisorRequests.use-case";
import { InventoryRequestsRepository } from "@modules/inventory/infrastructure/database/InventoryRequestsRepository";

class SupervisorRequestsContainer {
  private readonly repository = new InventoryRequestsRepository();

  readonly getSupervisorRequestsUseCase = new GetSupervisorRequestsUseCase(this.repository);
}

export const supervisorRequestsContainer = new SupervisorRequestsContainer();
