import type { SupervisorWarehouse } from "@shared/schema";

export interface ISupervisorWarehouseAssignmentsRepository {
  getSupervisorWarehouses(supervisorId: string): Promise<SupervisorWarehouse[]>;
  assignWarehouseToSupervisor(supervisorId: string, warehouseId: string): Promise<SupervisorWarehouse>;
  removeWarehouseFromSupervisor(supervisorId: string, warehouseId: string): Promise<boolean>;
}
