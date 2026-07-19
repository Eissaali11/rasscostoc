import type {
  TechnicianFixedInventory,
  TechnicianFixedInventoryEntry,
  TechnicianMovingInventoryEntry,
  TechnicianInventory,
  InventoryRequest,
} from "@shared/schema";

/**
 * ERP-005A-4 Phase 4B — consumer-owned port for identity's reverse
 * dependency on inventory-owned technician-stock tables (the admin
 * dashboard and supervisor drill-down views need this data; the tables
 * themselves — technician_fixed_inventories, technician_fixed_inventory_entries,
 * technician_moving_inventory_entries, technicians_inventory, inventory_requests —
 * are owned by inventory).
 *
 * Return types reference @shared/schema's row *types* (type-only, erased at
 * compile time) rather than re-declaring parallel DTOs for pure data-tally
 * rows — this is the same shape inventory's own code already works with, and
 * referencing a shared type is not the same violation as importing and
 * querying the table itself.
 */
export interface InventoryTechnicianDataPort {
  getFixedInventoryByTechnicianId(technicianId: string): Promise<TechnicianFixedInventory | null>;

  getFixedInventorySummaryTotals(): Promise<{
    totalN950: number;
    totalI9000s: number;
    totalI9100: number;
    totalRollPaper: number;
    totalStickers: number;
    totalNewBatteries: number;
    totalMobilySim: number;
    totalStcSim: number;
    totalZainSim: number;
    totalLebaraSim: number;
    technicianCount: number;
  }>;

  /**
   * Batch lookup — always use this instead of one call per technician.
   */
  getFixedAndMovingEntriesByTechnicianIds(technicianIds: readonly string[]): Promise<{
    fixedByTechnicianId: ReadonlyMap<string, TechnicianFixedInventoryEntry[]>;
    movingByTechnicianId: ReadonlyMap<string, TechnicianMovingInventoryEntry[]>;
  }>;

  getAllInventoryRequests(): Promise<InventoryRequest[]>;

  getPendingInventoryRequestsCount(): Promise<number>;

  /**
   * technicians_inventory row for one technician, looked up by createdBy
   * (matches the existing query semantics in
   * DrizzleSupervisorUsersReadRepository.ts — that table's "owner" column
   * is createdBy, not technicianId).
   */
  getMovingInventoryByCreatedBy(technicianId: string): Promise<TechnicianInventory | null>;
}
