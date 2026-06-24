import type { InsertTechnicianFixedInventory, TechnicianFixedInventory } from "@shared/schema";
import type { IStockFixedInventoryRepository } from "@modules/inventory/application/inventory/contracts/IStockFixedInventoryRepository";
import { eq } from 'drizzle-orm';
import { getDatabase } from "@core/database/connection";
import { technicianFixedInventories } from "@shared/schema";

export class DrizzleStockFixedInventoryRepository implements IStockFixedInventoryRepository {
  private get db() {
    return getDatabase();
  }

  async getTechnicianFixedInventory(technicianId: string): Promise<TechnicianFixedInventory | undefined> {
    const [inventory] = await this.db
      .select()
      .from(technicianFixedInventories)
      .where(eq(technicianFixedInventories.technicianId, technicianId));

    return inventory || undefined;
  }

  async updateTechnicianFixedInventory(
    technicianId: string,
    updates: Partial<InsertTechnicianFixedInventory>,
  ): Promise<TechnicianFixedInventory> {
    const [inventory] = await this.db
      .update(technicianFixedInventories)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(technicianFixedInventories.technicianId, technicianId))
      .returning();

    if (!inventory) {
      throw new Error(`Technician fixed inventory for technician ${technicianId} not found`);
    }

    return inventory;
  }

  async deleteTechnicianFixedInventory(technicianId: string): Promise<boolean> {
    const result = await this.db
      .delete(technicianFixedInventories)
      .where(eq(technicianFixedInventories.technicianId, technicianId));

    return (result.rowCount || 0) > 0;
  }
}
