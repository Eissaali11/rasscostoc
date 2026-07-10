import { eq, and } from "drizzle-orm";
import { getDatabase } from "@core/database/connection";
import {
  supervisorTechnicians,
  supervisorWarehouses,
  users,
  UserSafe,
  SupervisorTechnician,
  InsertSupervisorTechnician,
  SupervisorWarehouse,
  InsertSupervisorWarehouse
} from "@shared/schema";

export interface ISupervisorRepository {
  getSupervisorTechnicians(supervisorId: string): Promise<UserSafe[]>;
  assignTechnicianToSupervisor(supervisorId: string, technicianId: string): Promise<SupervisorTechnician>;
  removeTechnicianFromSupervisor(supervisorId: string, technicianId: string): Promise<boolean>;
  getSupervisorWarehouses(supervisorId: string): Promise<SupervisorWarehouse[]>;
  assignWarehouseToSupervisor(supervisorId: string, warehouseId: string): Promise<SupervisorWarehouse>;
  removeWarehouseFromSupervisor(supervisorId: string, warehouseId: string): Promise<boolean>;
}

/**
 * Supervisor Repository Implementation
 * Handles supervisor-technician and supervisor-warehouse relationships
 */
export class SupervisorRepository implements ISupervisorRepository {
  private get db() {
    return getDatabase();
  }

  async getSupervisorTechnicians(supervisorId: string): Promise<UserSafe[]> {
    const technicians = await this.db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        profileImage: users.profileImage,
        city: users.city,
        role: users.role,
        regionId: users.regionId,
        employeeCode: users.employeeCode,
        technicianCode: users.technicianCode,
        department: users.department,
        permissions: users.permissions,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .innerJoin(supervisorTechnicians, eq(users.id, supervisorTechnicians.technicianId))
      .where(eq(supervisorTechnicians.supervisorId, supervisorId));
    
    return technicians;
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