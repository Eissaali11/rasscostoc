/**
 * ISerializedInventoryRepository
 *
 * Contract for performing ScanOut on serialized custody items.
 * InventoryEngine depends on this interface — not on serializedItemsService directly.
 */

import type { InventoryTransactionContext } from "./inventory.engine.types";

export interface ISerializedInventoryRepository {
  /**
   * Resolve a raw serial input to the exact physical item it refers to,
   * without writing anything. OPS-REMED-E3: used to canonicalize
   * `serialsForCustody` by resolved item.id BEFORE the deduction write loop,
   * so one physical asset is never processed twice under different string
   * representations, and a candidate set matching more than one distinct
   * item is detected and rejected before any write.
   * @returns the resolved item's id, or null if no item matches.
   * @throws if the candidate set matches more than one distinct item.
   */
  resolveItemId(rawSerial: string, ctx?: InventoryTransactionContext): Promise<string | null>;

  /**
   * Mark a serialized item as delivered (IN_TRANSIT_CUSTODY → DELIVERED).
   * OPS-REMED-E3: an optional transaction context may be supplied so this
   * write joins an existing request-wide transaction. When omitted, this
   * method opens its own transaction (unchanged legacy behavior, used by
   * the standalone /api/serialized-items/scan-out HTTP endpoint).
   * @returns true if item was found and updated, false if not in active custody.
   */
  scanOut(
    technicianId: string,
    serialNumber: string,
    customerName: string,
    referenceNumber: string,
    ctx?: InventoryTransactionContext
  ): Promise<boolean>;
}
