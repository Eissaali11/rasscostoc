import { and, or, eq, inArray, desc, sql } from 'drizzle-orm';
import { getDatabase } from "@core/database/connection";
import {
  warehouses,
  warehouseInventory,
  warehouseTransfers,
  warehouseInventoryEntries,
  regions,
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
import { getInventoryIdentityPorts } from "../adapters/identity/identity-ports.registry";

export class DrizzleWarehouseRepository implements IWarehouseRepository {
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
        regionName: regions.name,
      })
      .from(warehouses)
      .leftJoin(regions, eq(warehouses.regionId, regions.id))
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
        regionName: regions.name,
      })
      .from(warehouses)
      .leftJoin(regions, eq(warehouses.regionId, regions.id))
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

    // Technician scope = technicians in the warehouse's region OR technicians
    // supervised by a supervisor assigned to this warehouse (two-hop via
    // supervisorTechnicians -> supervisorWarehouses, both inventory-permitted
    // tables — only the `users` lookup itself goes through the identity port).
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
        regionName: regions.name
      })
      .from(warehouseTransfers)
      .leftJoin(warehouses, eq(warehouseTransfers.warehouseId, warehouses.id))
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

    const rows = await query;
    const technicianIds = [...new Set(rows.map((r: any) => r.technicianId).filter(Boolean))];
    const techsById = await getInventoryIdentityPorts().getUsersByIds(technicianIds);

    return rows.map((row: any) => ({
      ...row,
      technicianName: techsById.get(row.technicianId)?.fullName,
      technicianCity: techsById.get(row.technicianId)?.city,
    })) as any;
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
