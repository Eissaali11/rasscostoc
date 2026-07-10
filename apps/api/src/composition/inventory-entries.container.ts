import { InventoryEntriesUseCase } from "@modules/inventory/application/inventory/use-cases/InventoryEntries.use-case";
import { DrizzleInventoryEntriesRepository } from "@modules/inventory/infrastructure/database/DrizzleInventoryEntriesRepository";

class InventoryEntriesContainer {
  private readonly repository = new DrizzleInventoryEntriesRepository();

  readonly inventoryEntriesUseCase = new InventoryEntriesUseCase(this.repository);
}

export const inventoryEntriesContainer = new InventoryEntriesContainer();
