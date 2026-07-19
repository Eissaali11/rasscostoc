import { repositories } from "@modules/inventory/infrastructure/database";
import { GetSupervisorWarehousesUseCase } from "@modules/inventory/application/warehouses/use-cases/GetSupervisorWarehouses.use-case";
import { WarehousesController } from "@modules/inventory/presentation/controllers/warehouses.controller";

class WarehousesContainer {
  readonly getSupervisorWarehousesUseCase = new GetSupervisorWarehousesUseCase(
    repositories.warehouse,
    repositories.supervisorAssignments
  );

  readonly warehousesController = new WarehousesController(
    repositories.warehouse,
    repositories.warehouseInventory,
    repositories.systemLogs,
    this.getSupervisorWarehousesUseCase
  );
}

export const warehousesContainer = new WarehousesContainer();
export default warehousesContainer;
