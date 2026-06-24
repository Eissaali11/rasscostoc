import { WithdrawTechnicianInventoryToWarehouseUseCase } from "@modules/inventory/application/inventory/use-cases/WithdrawTechnicianInventoryToWarehouse.use-case";
import { DrizzleWithdrawTechnicianInventoryToWarehouseRepository } from "@modules/inventory/infrastructure/database/DrizzleWithdrawTechnicianInventoryToWarehouseRepository";

export function createWithdrawTechnicianInventoryToWarehouseUseCase(): WithdrawTechnicianInventoryToWarehouseUseCase {
  const repository = new DrizzleWithdrawTechnicianInventoryToWarehouseRepository();
  return new WithdrawTechnicianInventoryToWarehouseUseCase(repository);
}
