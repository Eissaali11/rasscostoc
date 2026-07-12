/**
 * SerializedItemsAdapter
 *
 * Implements ISerializedInventoryRepository by wrapping serializedItemsService.
 * This is the only file that knows about serializedItemsService in the Inventory layer.
 * Serials are resolved via Central Serial Engine before custody checks.
 */

import { db } from "@server/core/config/db";
import { items } from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { ISerializedInventoryRepository } from "../../application/inventory/ISerializedInventoryRepository";
import { SerialRecognitionService } from "@core/serial/serial-recognition.service";

export class SerializedItemsAdapter implements ISerializedInventoryRepository {
  async scanOut(
    technicianId: string,
    serialNumber: string,
    customerName: string,
    referenceNumber: string
  ): Promise<boolean> {
    const candidates = await SerialRecognitionService.buildStoredSerialCandidates(serialNumber);

    const [item] = await db
      .select({ id: items.id, serialNumber: items.serialNumber })
      .from(items)
      .where(
        and(
          inArray(items.serialNumber, candidates),
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
      item.serialNumber,
      customerName,
      referenceNumber,
      undefined,
      undefined
    );

    return true;
  }
}
