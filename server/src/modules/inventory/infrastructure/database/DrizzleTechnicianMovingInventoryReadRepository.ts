import type { TechnicianInventory, TechnicianMovingInventoryEntry } from "@shared/schema";
import type { ITechnicianMovingInventoryReadRepository } from "@modules/inventory/application/technicians/contracts/ITechnicianMovingInventoryReadRepository";
import { TechnicianInventoryRepository } from "@modules/inventory/infrastructure/database/TechnicianInventoryRepository";

export class DrizzleTechnicianMovingInventoryReadRepository implements ITechnicianMovingInventoryReadRepository {
  private readonly technicianInventory = new TechnicianInventoryRepository();

  async getTechnicianInventory(technicianId: string): Promise<TechnicianInventory | undefined> {
    return this.technicianInventory.getTechnicianInventory(technicianId);
  }

  async getTechnicianMovingInventoryEntries(
    technicianId: string,
  ): Promise<TechnicianMovingInventoryEntry[]> {
    return this.technicianInventory.getTechnicianMovingInventoryEntries(technicianId);
  }
}
