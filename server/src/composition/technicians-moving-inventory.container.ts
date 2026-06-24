import { GetTechnicianMovingInventoryUseCase } from "@modules/inventory/application/technicians/use-cases/GetTechnicianMovingInventory.use-case";
import { DrizzleTechnicianMovingInventoryReadRepository } from "@modules/inventory/infrastructure/database/DrizzleTechnicianMovingInventoryReadRepository";

export function createGetTechnicianMovingInventoryUseCase(): GetTechnicianMovingInventoryUseCase {
  const repository = new DrizzleTechnicianMovingInventoryReadRepository();
  return new GetTechnicianMovingInventoryUseCase(repository);
}
