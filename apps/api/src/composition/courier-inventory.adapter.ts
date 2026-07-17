/**
 * Composition-root adapter: implements courier's ICourierInventoryPort using
 * inventory-owned public services + courier repo for identity/courier-owned lookups.
 *
 * Courier module code must not import inventory tables from @shared/schema.
 */

import { serializedItemsContainer } from "@server/composition/serialized-items.container";
import { itemTypesContainer } from "@server/composition/item-types.container";
import { SerialRecognitionService } from "@core/serial/serial-recognition.service";
import type { ICourierInventoryPort } from "@modules/courier/domain/repositories/ICourierInventoryPort";
import type { DrizzleCourierRepository } from "@modules/courier/infrastructure/repositories/drizzle-courier.repository";

export class CourierInventoryPortAdapter implements ICourierInventoryPort {
  constructor(
    private readonly techLookup: Pick<
      DrizzleCourierRepository,
      | "findUserById"
      | "findUserByCodeOrUsername"
      | "findUserByFuzzyName"
      | "findLinkedRequestItemBySerial"
    >,
    private readonly tx?: any
  ) {}

  private inventory() {
    return serializedItemsContainer.serializedItemsService;
  }

  async transferCustodyToTechnician(
    params: {
      itemId: string;
      technicianId: string;
      requestId: number;
      oldStatus: string;
      newStatus: "RECEIVED_BY_TECHNICIAN" | "IN_TRANSIT";
    },
    tx?: any
  ): Promise<void> {
    await this.inventory().transferCustodyToTechnician(params, tx ?? this.tx);
  }

  async mintAndAssignToTechnician(
    params: {
      serial: string;
      itemTypeId: string;
      carrierName: string | null;
      technicianId: string;
      requestId: number;
    },
    tx?: any
  ): Promise<{ id: string; serialNumber: string }> {
    return this.inventory().mintAndAssignToTechnician(params, tx ?? this.tx);
  }

  async normalizeSerial(
    serial: string,
    hintItemTypeId: string,
    tx?: any
  ): Promise<{
    normalizedSerial: string;
    itemTypeId: string;
    carrierName: string | null;
  }> {
    const client = tx ?? this.tx;
    const result = await SerialRecognitionService.normalizeForStorage(serial, hintItemTypeId, client);
    return {
      normalizedSerial: result.normalizedSerial,
      itemTypeId: result.itemTypeId,
      carrierName: result.carrierName,
    };
  }

  async findItemBySerial(serial: string, tx?: any): Promise<any | null> {
    return this.inventory().findBySerial(serial, tx ?? this.tx);
  }

  async findItemTypeById(
    itemTypeId: string,
    _tx?: any
  ): Promise<{ id: string; nameAr: string; nameEn: string; category: string } | null> {
    const row = await itemTypesContainer.itemTypesService.getItemTypeById(itemTypeId);
    if (!row) return null;
    return {
      id: row.id,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      category: row.category,
    };
  }

  async buildStoredSerialCandidates(
    serial: string,
    hintItemTypeId?: string,
    tx?: any
  ): Promise<string[]> {
    return SerialRecognitionService.buildStoredSerialCandidates(
      serial,
      hintItemTypeId,
      tx ?? this.tx
    );
  }

  async recognizeSerial(
    rawSerial: string,
    hintItemTypeId?: string,
    tx?: any
  ): Promise<{
    itemTypeId: string;
    normalizedSerial: string;
    nameAr: string;
    category: string;
    carrierName: string | null;
  } | null> {
    try {
      const recognition = await SerialRecognitionService.recognize(
        rawSerial,
        hintItemTypeId,
        tx ?? this.tx
      );
      return {
        itemTypeId: recognition.itemTypeId,
        normalizedSerial: recognition.normalizedSerial,
        nameAr: recognition.nameAr,
        category: recognition.category,
        carrierName: recognition.carrierName,
      };
    } catch {
      return null;
    }
  }

  resolveCarrierName(itemTypeId: string, nameEn: string, nameAr: string): string | null {
    return SerialRecognitionService.resolveCarrierName(itemTypeId, nameEn, nameAr);
  }

  findUserById(userId: string, tx?: any) {
    return this.techLookup.findUserById(userId, tx ?? this.tx);
  }

  findUserByCodeOrUsername(code: string, tx?: any) {
    return this.techLookup.findUserByCodeOrUsername(code, tx ?? this.tx);
  }

  findUserByFuzzyName(name: string, tx?: any) {
    return this.techLookup.findUserByFuzzyName(name, tx ?? this.tx);
  }

  findLinkedRequestItemBySerial(serial: string, tx?: any) {
    return this.techLookup.findLinkedRequestItemBySerial(serial, tx ?? this.tx);
  }
}
