import type { SupervisorWarehouse } from "@shared/schema";
import type { ISupervisorWarehouseAssignmentsRepository } from '@stockpro/contracts';

export class SupervisorWarehouseAssignmentsUseCase {
  constructor(private readonly repository: ISupervisorWarehouseAssignmentsRepository) {}

  async getAssignedWarehouseIds(supervisorId: string): Promise<string[]> {
    const assignments = await this.repository.getSupervisorWarehouses(supervisorId);
    return assignments.map((assignment) => assignment.warehouseId);
  }

  async assignWarehouse(supervisorId: string, warehouseId: string): Promise<SupervisorWarehouse> {
    return this.repository.assignWarehouseToSupervisor(supervisorId, warehouseId);
  }

  async removeWarehouse(supervisorId: string, warehouseId: string): Promise<boolean> {
    return this.repository.removeWarehouseFromSupervisor(supervisorId, warehouseId);
  }
}
