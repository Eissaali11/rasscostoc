import type {
  IWithdrawTechnicianInventoryToWarehouseRepository,
} from "@modules/inventory/application/inventory/use-cases/WithdrawTechnicianInventoryToWarehouse.use-case";
import { repositories } from "@modules/inventory/infrastructure/database";
import { UserRepository } from "@modules/identity/infrastructure/database/UserRepository";
import { WarehouseRepository } from "@modules/inventory/infrastructure/database/WarehouseRepository";
import { WarehouseInventoryRepository } from "@modules/inventory/infrastructure/database/WarehouseInventoryRepository";
import { TechnicianInventoryRepository } from "@modules/inventory/infrastructure/database/TechnicianInventoryRepository";

export class DrizzleWithdrawTechnicianInventoryToWarehouseRepository
  implements IWithdrawTechnicianInventoryToWarehouseRepository
{
  private readonly users = new UserRepository();
  private readonly warehouses = new WarehouseRepository();
  private readonly warehouseInventory = new WarehouseInventoryRepository();
  private readonly technicianInventory = new TechnicianInventoryRepository();

  getUser(id: string) {
    return this.users.getUser(id);
  }

  getWarehouse(id: string) {
    return this.warehouses.getWarehouse(id);
  }

  getTechnicianMovingInventoryEntries(technicianId: string) {
    return this.technicianInventory.getTechnicianMovingInventoryEntries(technicianId);
  }

  getWarehouseInventoryEntries(warehouseId: string) {
    return this.warehouseInventory.getWarehouseInventoryEntries(warehouseId);
  }

  getTechnicianInventory(technicianId: string) {
    return this.technicianInventory.getTechnicianInventory(technicianId) as Promise<Record<string, unknown> | undefined>;
  }

  getWarehouseInventory(warehouseId: string) {
    return this.warehouses.getWarehouseInventory(warehouseId) as Promise<Record<string, unknown> | null | undefined>;
  }

  upsertTechnicianMovingInventoryEntry(technicianId: string, itemTypeId: string, boxes: number, units: number) {
    return this.technicianInventory.upsertTechnicianMovingInventoryEntry(technicianId, itemTypeId, boxes, units);
  }

  upsertWarehouseInventoryEntry(warehouseId: string, itemTypeId: string, boxes: number, units: number) {
    return this.warehouseInventory.upsertWarehouseInventoryEntry(warehouseId, itemTypeId, boxes, units);
  }

  updateTechnicianInventory(technicianId: string, updates: Record<string, number>) {
    return this.technicianInventory.updateTechnicianInventory(technicianId, updates as any);
  }

  updateWarehouseInventory(warehouseId: string, updates: Record<string, number>) {
    return this.warehouses.updateWarehouseInventory(warehouseId, updates as any);
  }

  logSystemActivity(payload: {
    userId: string;
    userName: string;
    userRole: string;
    regionId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    entityName: string;
    description: string;
    details?: string;
    severity: string;
    success: boolean;
  }) {
    return repositories.systemLogs.createSystemLog(payload as any);
  }
}
