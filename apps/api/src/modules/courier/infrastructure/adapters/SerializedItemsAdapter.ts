/**
 * SerializedItemsAdapter
 *
 * Implements ISerializedInventoryRepository by wrapping inventory's public
 * serializedItemsService. No direct access to inventory-owned tables.
 */

import type { ISerializedInventoryRepository } from "../../application/inventory/ISerializedInventoryRepository";
import { serializedItemsContainer } from "@server/composition/serialized-items.container";

export class SerializedItemsAdapter implements ISerializedInventoryRepository {
  async scanOut(
    technicianId: string,
    serialNumber: string,
    customerName: string,
    referenceNumber: string
  ): Promise<boolean> {
    return serializedItemsContainer.serializedItemsService.tryScanOut(
      technicianId,
      serialNumber,
      customerName,
      referenceNumber
    );
  }
}
