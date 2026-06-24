import type { InsertTechnicianFixedInventory, TechnicianFixedInventory } from "@shared/schema";
import type { IStockFixedInventoryRepository } from '../contracts/IStockFixedInventoryRepository';

export class StockFixedInventoryUseCase {
  constructor(private readonly repository: IStockFixedInventoryRepository) {}

  async get(technicianId: string): Promise<TechnicianFixedInventory | undefined> {
    return this.getByTechnicianId(technicianId);
  }

  async update(
    technicianId: string,
    updates: Partial<InsertTechnicianFixedInventory>,
  ): Promise<TechnicianFixedInventory> {
    return this.updateByTechnicianId(technicianId, updates);
  }

  async delete(technicianId: string): Promise<boolean> {
    return this.deleteByTechnicianId(technicianId);
  }

  async getByTechnicianId(technicianId: string): Promise<TechnicianFixedInventory | undefined> {
    return this.repository.getTechnicianFixedInventory(technicianId);
  }

  async updateByTechnicianId(
    technicianId: string,
    updates: Partial<InsertTechnicianFixedInventory>,
  ): Promise<TechnicianFixedInventory> {
    return this.repository.updateTechnicianFixedInventory(technicianId, updates);
  }

  async deleteByTechnicianId(technicianId: string): Promise<boolean> {
    return this.repository.deleteTechnicianFixedInventory(technicianId);
  }
}
