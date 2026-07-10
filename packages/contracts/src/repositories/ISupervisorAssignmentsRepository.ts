import type { SupervisorTechnician, SupervisorWarehouse, UserSafe } from "@shared/schema";

export interface ISupervisorAssignmentsRepository {
  getSupervisorTechnicians(supervisorId: string): Promise<UserSafe[]>;
  assignTechnicianToSupervisor(supervisorId: string, technicianId: string): Promise<SupervisorTechnician>;
  removeTechnicianFromSupervisor(supervisorId: string, technicianId: string): Promise<boolean>;
  getSupervisorWarehouses(supervisorId: string): Promise<SupervisorWarehouse[]>;
  assignWarehouseToSupervisor(supervisorId: string, warehouseId: string): Promise<SupervisorWarehouse>;
  removeWarehouseFromSupervisor(supervisorId: string, warehouseId: string): Promise<boolean>;
}
