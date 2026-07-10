import { WithdrawTechnicianInventoryToWarehouseUseCase } from "@modules/inventory/application/inventory/use-cases/WithdrawTechnicianInventoryToWarehouse.use-case";
import { DrizzleWithdrawTechnicianInventoryToWarehouseRepository } from "@modules/inventory/infrastructure/database/DrizzleWithdrawTechnicianInventoryToWarehouseRepository";
import { identityRepositories } from "@modules/identity/infrastructure/database";

export function createWithdrawTechnicianInventoryToWarehouseUseCase(): WithdrawTechnicianInventoryToWarehouseUseCase {
  const repository = new DrizzleWithdrawTechnicianInventoryToWarehouseRepository(identityRepositories.user);
  return new WithdrawTechnicianInventoryToWarehouseUseCase(repository);
}
