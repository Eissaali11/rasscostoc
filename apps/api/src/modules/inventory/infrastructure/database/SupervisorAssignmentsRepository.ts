import { eq, and } from "drizzle-orm";
import { getDatabase } from "@core/database/connection";
import {
  supervisorTechnicians,
  supervisorWarehouses,
  UserSafe,
  SupervisorTechnician,
  InsertSupervisorTechnician,
  SupervisorWarehouse,
  InsertSupervisorWarehouse
} from "@shared/schema";
import { getInventoryIdentityPorts } from "../adapters/identity/identity-ports.registry";

export interface ISupervisorRepository {
  getSupervisorTechnicians(supervisorId: string): Promise<UserSafe[]>;
  assignTechnicianToSupervisor(supervisorId: string, technicianId: string): Promise<SupervisorTechnician>;
  removeTechnicianFromSupervisor(supervisorId: string, technicianId: string): Promise<boolean>;
  getSupervisorWarehouses(supervisorId: string): Promise<SupervisorWarehouse[]>;
  assignWarehouseToSupervisor(supervisorId: string, warehouseId: string): Promise<SupervisorWarehouse>;
  removeWarehouseFromSupervisor(supervisorId: string, warehouseId: string): Promise<boolean>;
}

/**
 * ERP-005A-4 Phase 4B — relocated from identity (git rename) since this
 * repository's entire logic and majority of its callers already belonged
 * to inventory (supervisor_technicians/supervisor_warehouses are inventory
 * concepts; its routes already live under inventory/presentation).
 *
 * Handles supervisor-technician and supervisor-warehouse relationships.
 */
export class SupervisorAssignmentsRepository implements ISupervisorRepository {
  private get db() {
    return getDatabase();
  }

  async getSupervisorTechnicians(supervisorId: string): Promise<UserSafe[]> {
    const assignments = await this.db
      .select({ technicianId: supervisorTechnicians.technicianId })
      .from(supervisorTechnicians)
      .where(eq(supervisorTechnicians.supervisorId, supervisorId));

    if (assignments.length === 0) return [];

    return getInventoryIdentityPorts().getUserSafeRowsByIds(
      assignments.map((assignment) => assignment.technicianId),
    );
  }

  async assignTechnicianToSupervisor(supervisorId: string, technicianId: string): Promise<SupervisorTechnician> {
    // Check if relationship already exists
    const [existing] = await this.db
      .select()
      .from(supervisorTechnicians)
      .where(and(
        eq(supervisorTechnicians.supervisorId, supervisorId),
        eq(supervisorTechnicians.technicianId, technicianId)
      ));

    if (existing) {
      throw new Error("Technician is already assigned to this supervisor");
    }

    const [assignment] = await this.db
      .insert(supervisorTechnicians)
      .values({
        supervisorId,
        technicianId,
      })
      .returning();

    return assignment;
  }

  async removeTechnicianFromSupervisor(supervisorId: string, technicianId: string): Promise<boolean> {
    const result = await this.db
      .delete(supervisorTechnicians)
      .where(and(
        eq(supervisorTechnicians.supervisorId, supervisorId),
        eq(supervisorTechnicians.technicianId, technicianId)
      ));

    return (result.rowCount || 0) > 0;
  }

  async getSupervisorWarehouses(supervisorId: string): Promise<SupervisorWarehouse[]> {
    return await this.db
      .select()
      .from(supervisorWarehouses)
      .where(eq(supervisorWarehouses.supervisorId, supervisorId));
  }

  async assignWarehouseToSupervisor(supervisorId: string, warehouseId: string): Promise<SupervisorWarehouse> {
    // Check if relationship already exists
    const [existing] = await this.db
      .select()
      .from(supervisorWarehouses)
      .where(and(
        eq(supervisorWarehouses.supervisorId, supervisorId),
        eq(supervisorWarehouses.warehouseId, warehouseId)
      ));

    if (existing) {
      throw new Error("Warehouse is already assigned to this supervisor");
    }

    const [assignment] = await this.db
      .insert(supervisorWarehouses)
      .values({
        supervisorId,
        warehouseId,
      })
      .returning();

    return assignment;
  }

  async removeWarehouseFromSupervisor(supervisorId: string, warehouseId: string): Promise<boolean> {
    const result = await this.db
      .delete(supervisorWarehouses)
      .where(and(
        eq(supervisorWarehouses.supervisorId, supervisorId),
        eq(supervisorWarehouses.warehouseId, warehouseId)
      ));

    return (result.rowCount || 0) > 0;
  }
}