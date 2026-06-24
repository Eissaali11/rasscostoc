import { db } from "@core/config/db";
import { 
  warehouses,
  warehouseInventory,
  warehouseTransfers,
  warehouseInventoryEntries,
  regions,
  users,
  itemTypes,
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
import { eq, and, or, desc, sql, count } from "drizzle-orm";
import { randomUUID } from "crypto";

/**
 * Warehouse Management Service
 * Handles all warehouse-related operations including inventory and transfers
 */
export class WarehouseService {

  /**
   * Get all warehouses with statistics
   */
  async getWarehouses(): Promise<WarehouseWithStats[]> {
    const warehousesWithStats = await db
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
      .groupBy(warehouses.id, regions.name);

    return warehousesWithStats as any;
  }

  /**
   * Get single warehouse with inventory
   */
  async getWarehouse(id: string): Promise<WarehouseWithInventory | undefined> {
    const [warehouse] = await db
      .select()
      .from(warehouses)
      .leftJoin(regions, eq(warehouses.regionId, regions.id))
      .where(eq(warehouses.id, id))
      .limit(1);

    if (!warehouse) return undefined;

    const [inventory] = await db
      .select()
      .from(warehouseInventory)
      .where(eq(warehouseInventory.warehouseId, id));

    return {
      ...warehouse.warehouses,
      inventory
    };
  }

  /**
   * Create new warehouse
   */
  async createWarehouse(insertWarehouse: InsertWarehouse, createdBy: string): Promise<Warehouse> {
    const [newWarehouse] = await db
      .insert(warehouses)
      .values({
        ...insertWarehouse,
        createdBy,
      })
      .returning();

    if (!newWarehouse) {
      throw new Error("Failed to create warehouse");
    }

    return newWarehouse;
  }

  /**
   * Update warehouse
   */
  async updateWarehouse(id: string, updates: Partial<InsertWarehouse>): Promise<Warehouse> {
    const [updatedWarehouse] = await db
      .update(warehouses)
      .set({ 
        ...updates, 
        updatedAt: new Date() 
      })
      .where(eq(warehouses.id, id))
      .returning();

    if (!updatedWarehouse) {
      throw new Error("Warehouse not found");
    }

    return updatedWarehouse;
  }

  /**
   * Delete warehouse
   */
  async deleteWarehouse(id: string): Promise<boolean> {
    const result = await db
      .delete(warehouses)
      .where(eq(warehouses.id, id));

    return (result as any).changes > 0;
  }

  /**
   * Get warehouse inventory
   */
  async getWarehouseInventory(warehouseId: string): Promise<WarehouseInventory | undefined> {
    const [inventory] = await db
      .select()
      .from(warehouseInventory)
      .where(eq(warehouseInventory.warehouseId, warehouseId))
      .limit(1);

    return inventory || undefined;
  }

  /**
   * Update warehouse inventory
   */
  async updateWarehouseInventory(warehouseId: string, updates: Partial<InsertWarehouseInventory>): Promise<WarehouseInventory> {
    // Check if inventory exists
    const existing = await this.getWarehouseInventory(warehouseId);

    if (existing) {
      // Update existing
      const [updated] = await db
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
      // Create new
      const [created] = await db
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

  /**
   * Get warehouse inventory entries
   */
  async getWarehouseInventoryEntries(warehouseId: string): Promise<WarehouseInventoryEntry[]> {
    const entries = await db
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

  /**
   * Upsert warehouse inventory entry
   */
  async upsertWarehouseInventoryEntry(
    warehouseId: string, 
    itemTypeId: string, 
    boxes: number, 
    units: number
  ): Promise<WarehouseInventoryEntry> {
    // Check if entry exists
    const [existing] = await db
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
      // Update existing
      const [updated] = await db
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
      // Create new
      const [created] = await db
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

  /**
   * Get warehouse transfers
   */
  async getWarehouseTransfers(
    warehouseId?: string, 
    technicianId?: string, 
    regionId?: string, 
    limit?: number
  ): Promise<WarehouseTransferWithDetails[]> {
    let query = db
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

    // Apply filters
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

  /**
   * Create warehouse transfer
   */
  async createWarehouseTransfer(data: InsertWarehouseTransfer): Promise<WarehouseTransfer> {
    const [newTransfer] = await db
      .insert(warehouseTransfers)
      .values(data)
      .returning();

    if (!newTransfer) {
      throw new Error("Failed to create warehouse transfer");
    }

    return newTransfer;
  }

  /**
   * Update warehouse transfer status
   */
  async updateWarehouseTransferStatus(id: string, status: string): Promise<WarehouseTransfer> {
    const [updatedTransfer] = await db
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

  /**
   * Accept warehouse transfer
   */
  async acceptWarehouseTransfer(id: string): Promise<WarehouseTransfer> {
    return this.updateWarehouseTransferStatus(id, "accepted");
  }

  /**
   * Reject warehouse transfer
   */
  async rejectWarehouseTransfer(id: string, reason?: string): Promise<WarehouseTransfer> {
    const [updatedTransfer] = await db
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

  /**
   * Get warehouses by region
   */
  async getWarehousesByRegion(regionId: string): Promise<Warehouse[]> {
    return db
      .select()
      .from(warehouses)
      .where(eq(warehouses.regionId, regionId));
  }

  /**
   * Get active warehouses
   */
  async getActiveWarehouses(): Promise<Warehouse[]> {
    return db
      .select()
      .from(warehouses)
      .where(eq(warehouses.isActive, true));
  }

  /**
   * Search warehouses
   */
  async searchWarehouses(query: string): Promise<WarehouseWithStats[]> {
    const warehousesWithStats = await db
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