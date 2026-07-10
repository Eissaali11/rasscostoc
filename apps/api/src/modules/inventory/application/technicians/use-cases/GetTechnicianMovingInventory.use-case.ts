import type { TechnicianMovingInventoryEntry } from "@shared/schema";
import type { TechnicianInventory } from "@shared/schema";
import type { ITechnicianMovingInventoryReadRepository } from '../contracts/ITechnicianMovingInventoryReadRepository';

export type TechnicianMovingInventoryOutput = Partial<TechnicianInventory> & {
  entries: TechnicianMovingInventoryEntry[];
};

export class GetTechnicianMovingInventoryUseCase {
  constructor(private readonly repository: ITechnicianMovingInventoryReadRepository) {}

  async execute(technicianId: string): Promise<TechnicianMovingInventoryOutput> {
    const legacyInventory = await this.repository.getTechnicianInventory(technicianId);
    const entries = await this.repository.getTechnicianMovingInventoryEntries(technicianId);

    return {
      ...(legacyInventory || {}),
      entries,
    };
  }
}
