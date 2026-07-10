/**
 * ISerializedInventoryRepository
 *
 * Contract for performing ScanOut on serialized custody items.
 * InventoryEngine depends on this interface — not on serializedItemsService directly.
 */

export interface ISerializedInventoryRepository {
  /**
   * Mark a serialized item as delivered (IN_TRANSIT_CUSTODY → DELIVERED).
   * @returns true if item was found and updated, false if not in active custody.
   */
  scanOut(
    technicianId: string,
    serialNumber: string,
    customerName: string,
    referenceNumber: string
  ): Promise<boolean>;
}
