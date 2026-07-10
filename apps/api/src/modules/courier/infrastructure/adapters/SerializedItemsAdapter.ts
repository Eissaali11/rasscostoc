/**
 * SerializedItemsAdapter
 *
 * Implements ISerializedInventoryRepository by wrapping serializedItemsService.
 * This is the only file that knows about serializedItemsService in the Inventory layer.
 */

import { db } from "@server/core/config/db";
import { items } from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { ISerializedInventoryRepository } from "../../application/inventory/ISerializedInventoryRepository";

export class SerializedItemsAdapter implements ISerializedInventoryRepository {
  async scanOut(
    technicianId: string,
    serialNumber: string,
    customerName: string,
    referenceNumber: string
  ): Promise<boolean> {
    // Confirm custody before delegating to service
    const [item] = await db
      .select({ id: items.id })
      .from(items)
      .where(
        and(
          eq(items.serialNumber, serialNumber),
          eq(items.currentOwnerId, technicianId),
          inArray(items.status, ["IN_TRANSIT_CUSTODY", "RECEIVED_BY_TECHNICIAN"])
        )
      )
      .limit(1);

    if (!item) return false;

    const { serializedItemsService } = await import(
      "../../../inventory/infrastructure/services/serialized-items.service"
    );

    await serializedItemsService.scanOut(
      technicianId,
      serialNumber,
      customerName,
      referenceNumber,
      undefined,
      undefined
    );

    return true;
  }
}
