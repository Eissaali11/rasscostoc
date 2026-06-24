import { eq, and } from "drizzle-orm";
import { getDatabase } from "@core/database/connection";
import {
  warehouseInventoryEntries,
  WarehouseInventoryEntry,
  InsertWarehouseInventoryEntry,
} from "@shared/schema";

export interface IWarehouseInventoryRepository {
  getWarehouseInventoryEntries(warehouseId: string): Promise<WarehouseInventoryEntry[]>;
  createWarehouseInventoryEntry(entry: InsertWarehouseInventoryEntry): Promise<WarehouseInventoryEntry>;
  updateWarehouseInventoryEntry(id: string, updates: Partial<InsertWarehouseInventoryEntry>): Promise<WarehouseInventoryEntry>;
  deleteWarehouseInventoryEntry(id: string): Promise<boolean>;
  upsertWarehouseInventoryEntry(warehouseId: string, itemTypeId: string, boxes: number, units: number): Promise<WarehouseInventoryEntry>;
}

/**
 * Warehouse Inventory Repository Implementation
 * Handles all warehouse inventory entries (new system)
 */
export class WarehouseInventoryRepository implements IWarehouseInventoryRepository {
  private get db() {
    return getDatabase();
  }

  async getWarehouseInventoryEntries(warehouseId: string): Promise<WarehouseInventoryEntry[]> {
    return await this.db
      .select()
      .from(warehouseInventoryEntries)
      .where(eq(warehouseInventoryEntries.warehouseId, warehouseId));
  }

  async createWarehouseInventoryEntry(entry: InsertWarehouseInventoryEntry): Promise<WarehouseInventoryEntry> {
    const [created] = await this.db
      .insert(warehouseInventoryEntries)
      .values(entry)
      .returning();
    return created;
  }

  async updateWarehouseInventoryEntry(id: string, updates: Partial<InsertWarehouseInventoryEntry>): Promise<WarehouseInventoryEntry> {
    const [updated] = await this.db
      .update(warehouseInventoryEntries)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(warehouseInventoryEntries.id, id))
      .returning();
    
    if (!updated) {
      throw new Error(`Warehouse inventory entry with id ${id} not found`);
    }
    return updated;
  }

  async deleteWarehouseInventoryEntry(id: string): Promise<boolean> {
    const result = await this.db
      .delete(warehouseInventoryEntries)
      .where(eq(warehouseInventoryEntries.id, id));
    return (result.rowCount || 0) > 0;
  }

  async upsertWarehouseInventoryEntry(warehouseId: string, itemTypeId: string, boxes: number, units: number): Promise<WarehouseInventoryEntry> {
    // Atomic upsert relying on UNIQUE(warehouse_id, item_type_id) constraint.
    // Prevents the race condition that previously created duplicate rows.
    const [result] = await this.db
      .insert(warehouseInventoryEntries)
      .values({ warehouseId, itemTypeId, boxes, units })
      .onConflictDoUpdate({
        target: [warehouseInventoryEntries.warehouseId, warehouseInventoryEntries.itemTypeId],
        set: { boxes, units, updatedAt: new Date() },
      })
      .returning();
    return result;
  }
}