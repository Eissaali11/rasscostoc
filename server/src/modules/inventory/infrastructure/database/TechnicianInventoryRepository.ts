import { eq, and } from "drizzle-orm";
import { getDatabase } from "@core/database/connection";
import {
  technicianMovingInventoryEntries,
  techniciansInventory,
  TechnicianMovingInventoryEntry,
  InsertTechnicianMovingInventoryEntry,
  TechnicianInventory,
  InsertTechnicianInventory,
} from "@shared/schema";

export interface ITechnicianInventoryRepository {
  getTechnicianMovingInventoryEntries(technicianId: string): Promise<TechnicianMovingInventoryEntry[]>;
  createTechnicianMovingInventoryEntry(entry: InsertTechnicianMovingInventoryEntry): Promise<TechnicianMovingInventoryEntry>;
  updateTechnicianMovingInventoryEntry(id: string, updates: Partial<InsertTechnicianMovingInventoryEntry>): Promise<TechnicianMovingInventoryEntry>;
  deleteTechnicianMovingInventoryEntry(id: string): Promise<boolean>;
  upsertTechnicianMovingInventoryEntry(technicianId: string, itemTypeId: string, boxes: number, units: number): Promise<TechnicianMovingInventoryEntry>;
  getTechnicianInventory(technicianId: string): Promise<TechnicianInventory | undefined>;
  updateTechnicianInventory(technicianId: string, updates: Partial<InsertTechnicianInventory>): Promise<TechnicianInventory>;
}

/**
 * Technician Inventory Repository Implementation
 * Handles all technician inventory (both new moving entries and legacy inventory)
 */
export class TechnicianInventoryRepository implements ITechnicianInventoryRepository {
  private get db() {
    return getDatabase();
  }

  // Moving Inventory Entries (New System)
  async getTechnicianMovingInventoryEntries(technicianId: string): Promise<TechnicianMovingInventoryEntry[]> {
    return await this.db
      .select()
      .from(technicianMovingInventoryEntries)
      .where(eq(technicianMovingInventoryEntries.technicianId, technicianId));
  }

  async createTechnicianMovingInventoryEntry(entry: InsertTechnicianMovingInventoryEntry): Promise<TechnicianMovingInventoryEntry> {
    const [created] = await this.db
      .insert(technicianMovingInventoryEntries)
      .values(entry)
      .returning();
    return created;
  }

  async updateTechnicianMovingInventoryEntry(id: string, updates: Partial<InsertTechnicianMovingInventoryEntry>): Promise<TechnicianMovingInventoryEntry> {
    const [updated] = await this.db
      .update(technicianMovingInventoryEntries)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(technicianMovingInventoryEntries.id, id))
      .returning();
    
    if (!updated) {
      throw new Error(`Technician moving inventory entry with id ${id} not found`);
    }
    return updated;
  }

  async deleteTechnicianMovingInventoryEntry(id: string): Promise<boolean> {
    const result = await this.db
      .delete(technicianMovingInventoryEntries)
      .where(eq(technicianMovingInventoryEntries.id, id));
    return (result.rowCount || 0) > 0;
  }

  async upsertTechnicianMovingInventoryEntry(technicianId: string, itemTypeId: string, boxes: number, units: number): Promise<TechnicianMovingInventoryEntry> {
    const [existing] = await this.db
      .select()
      .from(technicianMovingInventoryEntries)
      .where(and(
        eq(technicianMovingInventoryEntries.technicianId, technicianId),
        eq(technicianMovingInventoryEntries.itemTypeId, itemTypeId)
      ));

    if (existing) {
      return await this.updateTechnicianMovingInventoryEntry(existing.id, { boxes, units });
    } else {
      return await this.createTechnicianMovingInventoryEntry({ technicianId, itemTypeId, boxes, units });
    }
  }

  // Legacy Technicians Inventory (Backward Compatibility)
  async getTechnicianInventory(technicianId: string): Promise<TechnicianInventory | undefined> {
    const [inventory] = await this.db
      .select()
      .from(techniciansInventory)
      .where(eq(techniciansInventory.createdBy, technicianId));
    return inventory || undefined;
  }

  async updateTechnicianInventory(technicianId: string, updates: Partial<InsertTechnicianInventory>): Promise<TechnicianInventory> {
    const [updated] = await this.db
      .update(techniciansInventory)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(techniciansInventory.createdBy, technicianId))
      .returning();
    
    if (!updated) {
      throw new Error(`Technician inventory for technician ${technicianId} not found`);
    }
    return updated;
  }
}