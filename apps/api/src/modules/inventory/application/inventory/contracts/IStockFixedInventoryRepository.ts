import type { InsertTechnicianFixedInventory, TechnicianFixedInventory } from "@shared/schema";

export interface IStockFixedInventoryRepository {
  getTechnicianFixedInventory(technicianId: string): Promise<TechnicianFixedInventory | undefined>;
  updateTechnicianFixedInventory(
    technicianId: string,
    updates: Partial<InsertTechnicianFixedInventory>,
  ): Promise<TechnicianFixedInventory>;
  deleteTechnicianFixedInventory(technicianId: string): Promise<boolean>;
}
