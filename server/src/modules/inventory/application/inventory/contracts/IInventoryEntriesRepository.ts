import type {
  TechnicianFixedInventoryEntry,
  TechnicianMovingInventoryEntry,
  WarehouseInventoryEntry,
} from "@shared/schema";

export type InventoryEntryInput = {
  itemTypeId: string;
  boxes: number;
  units: number;
};

export interface IInventoryEntriesRepository {
  getWarehouseEntries(warehouseId: string): Promise<WarehouseInventoryEntry[]>;
  upsertWarehouseEntry(warehouseId: string, input: InventoryEntryInput): Promise<WarehouseInventoryEntry>;

  getTechnicianFixedEntries(technicianId: string): Promise<TechnicianFixedInventoryEntry[]>;
  upsertTechnicianFixedEntry(technicianId: string, input: InventoryEntryInput): Promise<TechnicianFixedInventoryEntry>;

  getTechnicianMovingEntries(technicianId: string): Promise<TechnicianMovingInventoryEntry[]>;
  upsertTechnicianMovingEntry(technicianId: string, input: InventoryEntryInput): Promise<TechnicianMovingInventoryEntry>;
}
