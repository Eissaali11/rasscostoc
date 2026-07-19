import { eq, desc, and, or, inArray } from "drizzle-orm";
import { getDatabase } from "@core/database/connection";
import {
  warehouses,
  warehouseInventory,
  warehouseInventoryEntries,
  warehouseTransfers,
  inventoryRequests,
  supervisorTechnicians,
  supervisorWarehouses,
  Warehouse,
  InsertWarehouse,
  WarehouseInventory,
  InsertWarehouseInventory,
  WarehouseWithInventory,
  WarehouseWithStats,
  WarehouseTransfer,
  InsertWarehouseTransfer,
  WarehouseTransferWithDetails,
  InventoryRequest,
  InsertInventoryRequest,
  WarehouseInventoryEntry,
  InsertWarehouseInventoryEntry
} from "@shared/schema";
import { getInventoryIdentityPorts } from "../adapters/identity/identity-ports.registry";

/**
 * Warehouse Repository Implementation
 * Handles all warehouse-related database operations
 */
export class WarehouseRepository {
  private get db() {
    return getDatabase();
  }

  async getWarehouses(): Promise<WarehouseWithStats[]> {
    const warehouseRows = await this.db
      .select({
        id: warehouses.id,
        name: warehouses.name,
        location: warehouses.location,
        description: warehouses.description,
        isActive: warehouses.isActive,
        createdBy: warehouses.createdBy,
        regionId: warehouses.regionId,
        createdAt: warehouses.createdAt,
        updatedAt: warehouses.updatedAt,
      })
      .from(warehouses)
      .orderBy(desc(warehouses.createdAt));

    const creatorIds = [...new Set(warehouseRows.map((w) => w.createdBy).filter(Boolean))];
    const creatorsById = await getInventoryIdentityPorts().getUsersByIds(creatorIds as string[]);
    const warehouseList = warehouseRows.map((w) => ({
      ...w,
      creatorName: (w.createdBy && creatorsById.get(w.createdBy)?.fullName) || undefined,
    }));

    const result: WarehouseWithStats[] = [];
    
    for (const warehouse of warehouseList) {
      const [inventory] = await this.db
        .select()
        .from(warehouseInventory)
        .where(eq(warehouseInventory.warehouseId, warehouse.id));

      // Fetch dynamic entries (per item type) so the UI/export can show updated quantities
      const entries = await this.db
        .select()
        .from(warehouseInventoryEntries)
        .where(eq(warehouseInventoryEntries.warehouseId, warehouse.id));

      let totalItems = 0;
      let lowStockItemsCount = 0;
      
      if (inventory) {
        // Calculate totals from legacy inventory
        const itemTypes = [
          { boxes: inventory.n950Boxes, units: inventory.n950Units },
          { boxes: inventory.i9000sBoxes, units: inventory.i9000sUnits },
          { boxes: inventory.i9100Boxes, units: inventory.i9100Units },
          { boxes: inventory.rollPaperBoxes, units: inventory.rollPaperUnits },
          { boxes: inventory.stickersBoxes, units: inventory.stickersUnits },
          { boxes: inventory.newBatteriesBoxes, units: inventory.newBatteriesUnits },
          { boxes: inventory.mobilySimBoxes, units: inventory.mobilySimUnits },
          { boxes: inventory.stcSimBoxes, units: inventory.stcSimUnits },
          { boxes: inventory.zainSimBoxes, units: inventory.zainSimUnits },
          { boxes: inventory.lebaraBoxes, units: inventory.lebaraUnits }
        ];

        for (const item of itemTypes) {
          const total = (item.boxes * 10) + item.units; // Assume 10 units per box
          totalItems += total;
          if (total <= 50) lowStockItemsCount++; // Threshold for low stock
        }
      }

      // Attach entries onto inventory so frontend can prefer dynamic values over legacy
      const inventoryWithEntries = inventory
        ? { ...inventory, entries }
        : (entries.length > 0 ? ({ entries } as any) : null);

      result.push({
        ...warehouse,
        inventory: inventoryWithEntries,
        totalItems,
        lowStockItemsCount,
        creatorName: warehouse.creatorName || undefined,
      });
    }

    return result;
  }

  async getWarehouse(id: string): Promise<WarehouseWithInventory | undefined> {
    const [warehouseRow] = await this.db
      .select({
        id: warehouses.id,
        name: warehouses.name,
        location: warehouses.location,
        description: warehouses.description,
        isActive: warehouses.isActive,
        createdBy: warehouses.createdBy,
        regionId: warehouses.regionId,
        createdAt: warehouses.createdAt,
        updatedAt: warehouses.updatedAt,
      })
      .from(warehouses)
      .where(eq(warehouses.id, id));

    if (!warehouseRow) {
      return undefined;
    }

    const ports = getInventoryIdentityPorts();
    const creator = warehouseRow.createdBy ? await ports.getUserById(warehouseRow.createdBy) : null;
    const warehouse = { ...warehouseRow, creatorName: creator?.fullName || undefined };

    const [inventory] = await this.db
      .select()
      .from(warehouseInventory)
      .where(eq(warehouseInventory.warehouseId, id));

    // Fetch technicians related to this warehouse: in the warehouse's region,
    // OR supervised by a supervisor assigned to this warehouse.
    const supervisorRows = await this.db
      .select({ supervisorId: supervisorWarehouses.supervisorId })
      .from(supervisorWarehouses)
      .where(eq(supervisorWarehouses.warehouseId, id));
    const supervisorIds = supervisorRows.map((r) => r.supervisorId);

    let supervisedTechnicianIds: string[] = [];
    if (supervisorIds.length > 0) {
      const rows = await this.db
        .select({ technicianId: supervisorTechnicians.technicianId })
        .from(supervisorTechnicians)
        .where(inArray(supervisorTechnicians.supervisorId, supervisorIds));
      supervisedTechnicianIds = rows.map((r) => r.technicianId);
    }

    const regionTechnicianIds = warehouseRow.regionId
      ? await ports.getUserIdsByRegion(warehouseRow.regionId)
      : [];

    const candidateIds = [...new Set([...supervisedTechnicianIds, ...regionTechnicianIds])];
    const candidatesById = await ports.getUsersByIds(candidateIds);
    const technicians = [...candidatesById.values()].filter((u) => u.role === 'technician');

    return {
      ...warehouse,
      inventory: inventory || null,
      creatorName: warehouse.creatorName || undefined,
      technicians,
    };
  }

  async createWarehouse(insertWarehouse: InsertWarehouse, createdBy: string): Promise<Warehouse> {
    const [warehouse] = await this.db
      .insert(warehouses)
      .values({
        ...insertWarehouse,
        createdBy,
        isActive: insertWarehouse.isActive ?? true,
      })
      .returning();

    await this.db
      .insert(warehouseInventory)
      .values({
        warehouseId: warehouse.id,
        n950Boxes: 0,
        n950Units: 0,
        i9000sBoxes: 0,
        i9000sUnits: 0,
        i9100Boxes: 0,
        i9100Units: 0,
        rollPaperBoxes: 0,
        rollPaperUnits: 0,
        stickersBoxes: 0,
        stickersUnits: 0,
        newBatteriesBoxes: 0,
        newBatteriesUnits: 0,
        mobilySimBoxes: 0,
        mobilySimUnits: 0,
        stcSimBoxes: 0,
        stcSimUnits: 0,
        zainSimBoxes: 0,
        zainSimUnits: 0,
      });

    return warehouse;
  }

  async updateWarehouse(id: string, updates: Partial<InsertWarehouse>): Promise<Warehouse> {
    const [warehouse] = await this.db
      .update(warehouses)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(warehouses.id, id))
      .returning();

    if (!warehouse) {
      throw new Error(`Warehouse with id ${id} not found`);
    }
    return warehouse;
  }

  async deleteWarehouse(id: string): Promise<boolean> {
    // Delete warehouse transfers first
    await this.db
      .delete(warehouseTransfers)
      .where(eq(warehouseTransfers.warehouseId, id));
    
    // Delete warehouse inventory
    await this.db
      .delete(warehouseInventory)
      .where(eq(warehouseInventory.warehouseId, id));
    
    // Delete inventory requests
    await this.db
      .delete(inventoryRequests)
      .where(eq(inventoryRequests.warehouseId, id));
    
    // Delete the warehouse
    const result = await this.db
      .delete(warehouses)
      .where(eq(warehouses.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getWarehouseInventory(warehouseId: string): Promise<WarehouseInventory | null> {
    const [inventory] = await this.db
      .select()
      .from(warehouseInventory)
      .where(eq(warehouseInventory.warehouseId, warehouseId));
    return inventory || null;
  }

  async updateWarehouseInventory(warehouseId: string, updates: Partial<InsertWarehouseInventory>): Promise<WarehouseInventory> {
    const [inventory] = await this.db
      .update(warehouseInventory)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(warehouseInventory.warehouseId, warehouseId))
      .returning();

    if (!inventory) {
      throw new Error(`Warehouse inventory for warehouse ${warehouseId} not found`);
    }
    return inventory;
  }

}
