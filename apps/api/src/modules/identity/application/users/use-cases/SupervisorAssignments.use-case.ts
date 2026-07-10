import type { SupervisorTechnician, SupervisorWarehouse } from "@shared/schema";
import type { ISupervisorAssignmentsRepository } from '@stockpro/contracts';

export class SupervisorAssignmentsUseCase {
  constructor(private readonly repository: ISupervisorAssignmentsRepository) {}

  async getTechnicianIdsBySupervisor(supervisorId: string): Promise<string[]> {
    const technicians = await this.repository.getSupervisorTechnicians(supervisorId);
    return technicians.map((technician) => technician.id);
  }

  async assignTechnician(supervisorId: string, technicianId: string): Promise<SupervisorTechnician> {
    return this.repository.assignTechnicianToSupervisor(supervisorId, technicianId);
  }

  async removeTechnician(supervisorId: string, technicianId: string): Promise<boolean> {
    return this.repository.removeTechnicianFromSupervisor(supervisorId, technicianId);
  }

  async getWarehouseIdsBySupervisor(supervisorId: string): Promise<string[]> {
    const warehouses = await this.repository.getSupervisorWarehouses(supervisorId);
    return warehouses.map((warehouse) => warehouse.warehouseId);
  }

  async assignWarehouse(supervisorId: string, warehouseId: string): Promise<SupervisorWarehouse> {
    return this.repository.assignWarehouseToSupervisor(supervisorId, warehouseId);
  }

  async removeWarehouse(supervisorId: string, warehouseId: string): Promise<boolean> {
    return this.repository.removeWarehouseFromSupervisor(supervisorId, warehouseId);
  }
}
