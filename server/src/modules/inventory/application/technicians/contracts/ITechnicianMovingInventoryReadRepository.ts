import type {
  TechnicianInventory,
  TechnicianMovingInventoryEntry,
} from "@shared/schema";

export interface ITechnicianMovingInventoryReadRepository {
  getTechnicianInventory(technicianId: string): Promise<TechnicianInventory | undefined>;
  getTechnicianMovingInventoryEntries(technicianId: string): Promise<TechnicianMovingInventoryEntry[]>;
}
