import type { WarehouseWithStats } from "@shared/schema";
import type { ISupervisorWarehouseAssignmentsRepository } from "@modules/identity/application/users/contracts/ISupervisorWarehouseAssignmentsRepository";
import type { IWarehouseRepository } from '../contracts/IWarehouseRepository';

export type GetSupervisorWarehousesInput = {
  supervisorId: string;
  regionId?: string | null;
};

export class GetSupervisorWarehousesUseCase {
  constructor(
    private readonly warehouseRepository: IWarehouseRepository,
    private readonly supervisorWarehouseAssignmentsRepository: ISupervisorWarehouseAssignmentsRepository,
  ) {}

  async execute(input: GetSupervisorWarehousesInput): Promise<WarehouseWithStats[]> {
    const allWarehouses = await this.warehouseRepository.getWarehouses();
    const assignments = await this.supervisorWarehouseAssignmentsRepository.getSupervisorWarehouses(input.supervisorId);

    const assignedWarehouseIds = new Set(assignments.map((assignment) => assignment.warehouseId));
    const assignedWarehouses = allWarehouses.filter((warehouse) => assignedWarehouseIds.has(warehouse.id));

    if (!input.regionId) {
      return assignedWarehouses;
    }

    const mergedById = new Map<string, WarehouseWithStats>();
    for (const warehouse of allWarehouses) {
      if (warehouse.regionId === input.regionId) {
        mergedById.set(warehouse.id, warehouse);
      }
    }

    for (const warehouse of assignedWarehouses) {
      mergedById.set(warehouse.id, warehouse);
    }

    return Array.from(mergedById.values());
  }
}
