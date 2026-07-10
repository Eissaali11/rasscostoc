import { and, or, eq, desc, sql } from 'drizzle-orm';
import { getDatabase } from "@core/database/connection";
import {
  warehouses,
  warehouseInventory,
  warehouseTransfers,
  warehouseInventoryEntries,
  regions,
  users,
  itemTypes,
  inventoryRequests,
  supervisorTechnicians,
  supervisorWarehouses,
  type Warehouse,
  type WarehouseInventory,
  type WarehouseTransfer,
  type WarehouseInventoryEntry,
  type InsertWarehouse,
  type InsertWarehouseInventory,
  type InsertWarehouseTransfer,
  type WarehouseWithStats,
  type WarehouseWithInventory,
  type WarehouseTransferWithDetails
} from "@shared/schema";
import type { IWarehouseRepository } from "@modules/inventory/application/warehouse/contracts/IWarehouseRepository";

export class DrizzleWarehouseRepository implements IWarehouseRepository {
  private get db() {
    return getDatabase();
  }

  async getWarehouses(): Promise<WarehouseWithStats[]> {
    const warehouseList = await this.db
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
        creatorName: users.fullName,
        regionName: regions.name,
      })
      .from(warehouses)
      .leftJoin(users, eq(warehouses.createdBy, users.id))
      .leftJoin(regions, eq(warehouses.regionId, regions.id))
      .orderBy(desc(warehouses.createdAt));

    const result: WarehouseWithStats[] = [];
    
    for (const warehouse of warehouseList) {
      const [inventory] = await this.db
        .select()
        .from(warehouseInventory)
        .where(eq(warehouseInventory.warehouseId, warehouse.id));

      const entries = await this.db
        .select({
          id: warehouseInventoryEntries.id,
          warehouseId: warehouseInventoryEntries.warehouseId,
          itemTypeId: warehouseInventoryEntries.itemTypeId,
          boxes: warehouseInventoryEntries.boxes,
          units: warehouseInventoryEntries.units,
          updatedAt: warehouseInventoryEntries.updatedAt,
          itemName: itemTypes.nameAr,
          itemNameEn: itemTypes.nameEn,
          unitsPerBox: itemTypes.unitsPerBox
        })
        .from(warehouseInventoryEntries)
        .leftJoin(itemTypes, eq(warehouseInventoryEntries.itemTypeId, itemTypes.id))
        .where(eq(warehouseInventoryEntries.warehouseId, warehouse.id));

      let totalItems = 0;
      let lowStockItemsCount = 0;
      
      if (inventory) {
        const itemTypesArray = [
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

        for (const item of itemTypesArray) {
          const total = (item.boxes * 10) + item.units;
          totalItems += total;
          if (total <= 50) lowStockItemsCount++;
        }
      }

      const inventoryWithEntries = inventory
        ? { ...inventory, entries }
        : (entries.length > 0 ? ({ entries } as any) : null);

      result.push({
        ...warehouse,
        inventory: inventoryWithEntries,
        totalItems,
        lowStockItemsCount,
        creatorName: warehouse.creatorName || undefined,
        regionName: warehouse.regionName || null
      } as any);
    }

    return result;
  }

  async getWarehouse(id: string): Promise<WarehouseWithInventory | undefined> {
    const [warehouse] = await this.db
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
        creatorName: users.fullName,
        regionName: regions.name,
      })
      .from(warehouses)
      .leftJoin(users, eq(warehouses.createdBy, users.id))
      .leftJoin(regions, eq(warehouses.regionId, regions.id))
      .where(eq(warehouses.id, id));

    if (!warehouse) {
      return undefined;
    }

    const [inventory] = await this.db
      .select()
      .from(warehouseInventory)
      .where(eq(warehouseInventory.warehouseId, id));

    const technicianScopeCondition = warehouse.regionId
      ? or(
          eq(users.regionId, warehouse.regionId),
          eq(supervisorWarehouses.warehouseId, id)
        )
      : eq(supervisorWarehouses.warehouseId, id);

    const techRows = await this.db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        profileImage: users.profileImage,
        city: users.city,
        role: users.role,
        regionId: users.regionId,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .leftJoin(supervisorTechnicians, eq(users.id, supervisorTechnicians.technicianId))
      .leftJoin(supervisorWarehouses, eq(supervisorTechnicians.supervisorId, supervisorWarehouses.supervisorId))
      .where(and(
        eq(users.role, 'technician'),
        technicianScopeCondition
      ));

    const techById: Record<string, any> = {};
    for (const t of techRows) {
      if (!t) continue;
      techById[t.id] = {
        id: t.id,
        username: t.username,
        email: t.email,
        fullName: t.fullName,
        profileImage: t.profileImage,
        city: t.city,
        role: t.role,
        regionId: t.regionId,
        isActive: t.isActive,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    }

    const technicians = Object.values(techById) as any[];

    return {
      ...warehouse,
      inventory: inventory || null,
      creatorName: warehouse.creatorName || undefined,
      technicians,
    } as any;
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
    await this.db
      .delete(warehouseTransfers)
      .where(eq(warehouseTransfers.warehouseId, id));
    
    await this.db
      .delete(warehouseInventory)
      .where(eq(warehouseInventory.warehouseId, id));
    
    await this.db
      .delete(inventoryRequests)
      .where(eq(inventoryRequests.warehouseId, id));
    
    const result = await this.db
      .delete(warehouses)
      .where(eq(warehouses.id, id));
    return ((result as any).rowCount || (result as any).changes || 0) > 0;
  }

  async getWarehouseInventory(warehouseId: string): Promise<WarehouseInventory | undefined> {
    const [inventory] = await this.db
      .select()
      .from(warehouseInventory)
      .where(eq(warehouseInventory.warehouseId, warehouseId))
      .limit(1);

    return inventory || undefined;
  }

  async updateWarehouseInventory(warehouseId: string, updates: Partial<InsertWarehouseInventory>): Promise<WarehouseInventory> {
    const existing = await this.getWarehouseInventory(warehouseId);

    if (existing) {
      const [updated] = await this.db
        .update(warehouseInventory)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(warehouseInventory.warehouseId, warehouseId))
        .returning();

      if (!updated) {
        throw new Error("Failed to update warehouse inventory");
      }

      return updated;
    } else {
      const [created] = await this.db
        .insert(warehouseInventory)
        .values({
          warehouseId,
          ...updates,
          updatedAt: new Date()
        })
        .returning();

      if (!created) {
        throw new Error("Failed to create warehouse inventory");
      }

      return created;
    }
  }

  async getWarehouseInventoryEntries(warehouseId: string): Promise<WarehouseInventoryEntry[]> {
    const entries = await this.db
      .select({
        id: warehouseInventoryEntries.id,
        warehouseId: warehouseInventoryEntries.warehouseId,
        itemTypeId: warehouseInventoryEntries.itemTypeId,
        boxes: warehouseInventoryEntries.boxes,
        units: warehouseInventoryEntries.units,
        updatedAt: warehouseInventoryEntries.updatedAt,
        itemName: itemTypes.nameAr,
        itemNameEn: itemTypes.nameEn,
        unitsPerBox: itemTypes.unitsPerBox
      })
      .from(warehouseInventoryEntries)
      .leftJoin(itemTypes, eq(warehouseInventoryEntries.itemTypeId, itemTypes.id))
      .where(eq(warehouseInventoryEntries.warehouseId, warehouseId));

    return entries;
  }

  async upsertWarehouseInventoryEntry(
    warehouseId: string, 
    itemTypeId: string, 
    boxes: number, 
    units: number
  ): Promise<WarehouseInventoryEntry> {
    const [existing] = await this.db
      .select()
      .from(warehouseInventoryEntries)
      .where(
        and(
          eq(warehouseInventoryEntries.warehouseId, warehouseId),
          eq(warehouseInventoryEntries.itemTypeId, itemTypeId)
        )
      )
      .limit(1);

    if (existing) {
      const [updated] = await this.db
        .update(warehouseInventoryEntries)
        .set({
          boxes,
          units,
          updatedAt: new Date()
        })
        .where(eq(warehouseInventoryEntries.id, existing.id))
        .returning();

      if (!updated) {
        throw new Error("Failed to update warehouse inventory entry");
      }

      return updated;
    } else {
      const [created] = await this.db
        .insert(warehouseInventoryEntries)
        .values({
          warehouseId,
          itemTypeId,
          boxes,
          units,
          updatedAt: new Date()
        })
        .returning();

      if (!created) {
        throw new Error("Failed to create warehouse inventory entry");
      }

      return created;
    }
  }

  async getWarehouseTransfers(
    warehouseId?: string, 
    technicianId?: string, 
    regionId?: string, 
    limit?: number
  ): Promise<WarehouseTransferWithDetails[]> {
    let query = this.db
      .select({
        id: warehouseTransfers.id,
        warehouseId: warehouseTransfers.warehouseId,
        technicianId: warehouseTransfers.technicianId,
        requestId: warehouseTransfers.requestId,
        itemType: warehouseTransfers.itemType,
        packagingType: warehouseTransfers.packagingType,
        quantity: warehouseTransfers.quantity,
        performedBy: warehouseTransfers.performedBy,
        respondedAt: warehouseTransfers.respondedAt,
        status: warehouseTransfers.status,
        notes: warehouseTransfers.notes,
        rejectionReason: warehouseTransfers.rejectionReason,
        createdAt: warehouseTransfers.createdAt,
        warehouseName: warehouses.name,
        technicianName: users.fullName,
        technicianCity: users.city,
        regionName: regions.name
      })
      .from(warehouseTransfers)
      .leftJoin(warehouses, eq(warehouseTransfers.warehouseId, warehouses.id))
      .leftJoin(users, eq(warehouseTransfers.technicianId, users.id))
      .leftJoin(regions, eq(warehouses.regionId, regions.id))
      .$dynamic();

    const conditions = [];
    if (warehouseId) {
      conditions.push(eq(warehouseTransfers.warehouseId, warehouseId));
    }
    if (technicianId) {
      conditions.push(eq(warehouseTransfers.technicianId, technicianId));
    }
    if (regionId) {
      conditions.push(eq(warehouses.regionId, regionId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(warehouseTransfers.createdAt));

    if (limit) {
      query = query.limit(limit);
    }

    return query as any;
  }

  async createWarehouseTransfer(data: InsertWarehouseTransfer): Promise<WarehouseTransfer> {
    const [newTransfer] = await this.db
      .insert(warehouseTransfers)
      .values(data)
      .returning();

    if (!newTransfer) {
      throw new Error("Failed to create warehouse transfer");
    }

    return newTransfer;
  }

  async updateWarehouseTransferStatus(id: string, status: string): Promise<WarehouseTransfer> {
    const [updatedTransfer] = await this.db
      .update(warehouseTransfers)
      .set({
        status,
      })
      .where(eq(warehouseTransfers.id, id))
      .returning();

    if (!updatedTransfer) {
      throw new Error("Transfer not found");
    }

    return updatedTransfer;
  }

  async rejectWarehouseTransfer(id: string, reason?: string): Promise<WarehouseTransfer> {
    const [updatedTransfer] = await this.db
      .update(warehouseTransfers)
      .set({
        status: "rejected",
        rejectionReason: reason,
        respondedAt: new Date(),
      })
      .where(eq(warehouseTransfers.id, id))
      .returning();

    if (!updatedTransfer) {
      throw new Error("Transfer not found");
    }

    return updatedTransfer;
  }

  async getWarehousesByRegion(regionId: string): Promise<Warehouse[]> {
    return this.db
      .select()
      .from(warehouses)
      .where(eq(warehouses.regionId, regionId));
  }

  async getActiveWarehouses(): Promise<Warehouse[]> {
    return this.db
      .select()
      .from(warehouses)
      .where(eq(warehouses.isActive, true));
  }

  async searchWarehouses(query: string): Promise<WarehouseWithStats[]> {
    const warehousesWithStats = await this.db
      .select({
        id: warehouses.id,
        name: warehouses.name,
        location: warehouses.location,
        description: warehouses.description,
        createdBy: warehouses.createdBy,
        regionId: warehouses.regionId,
        isActive: warehouses.isActive,
        createdAt: warehouses.createdAt,
        updatedAt: warehouses.updatedAt,
        regionName: regions.name,
        totalItems: sql<number>`COALESCE(COUNT(${warehouseInventory.id}), 0)`,
        lowStockItemsCount: sql<number>`0`,
        inventory: sql<any>`NULL`
      })
      .from(warehouses)
      .leftJoin(regions, eq(warehouses.regionId, regions.id))
      .leftJoin(warehouseInventory, eq(warehouses.id, warehouseInventory.warehouseId))
      .where(
        or(
          sql`${warehouses.name} ILIKE ${`%${query}%`}`,
          sql`${warehouses.location} ILIKE ${`%${query}%`}`
        )
      )
      .groupBy(warehouses.id, regions.name);

    return warehousesWithStats as any;
  }
}
