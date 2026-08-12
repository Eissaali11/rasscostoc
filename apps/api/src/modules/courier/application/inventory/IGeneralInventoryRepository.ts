/**
 * IGeneralInventoryRepository
 *
 * Contract for deducting device units from a technician's general inventory pool.
 * InventoryEngine depends on this interface — not on a concrete service.
 */

import type { InventoryTransactionContext } from "./inventory.engine.types";

export interface DeductInventoryCommand {
  technicianCode: string;
  devices: { serialNumber: string; model?: string }[];
  notes: string;
  actor: {
    id: string;
    username: string;
    role: string;
    regionId: string | null;
  };
}

export interface IGeneralInventoryRepository {
  /**
   * OPS-REMED-E3: optional transaction context so this batch join an existing
   * request-wide transaction. When omitted, opens its own transaction
   * (unchanged legacy behavior, used by the standalone
   * /api/technicians/deduct-inventory HTTP endpoint).
   */
  deductTechnicianInventory(
    command: DeductInventoryCommand,
    ctx?: InventoryTransactionContext
  ): Promise<void>;
}
