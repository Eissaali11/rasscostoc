/**
 * Consumer-owned port: courier needs for serialized inventory / catalog.
 * Implemented in composition by adapting inventory public services.
 */

import type {
  CourierItemTypeView,
  DeductCourierCustodyCommand,
  MintCourierCustodyCommand,
  TransferCourierCustodyCommand,
} from "./courier-inventory.types";

export interface CourierSerializedInventoryPort {
  findBySerial(serialNumber: string, tx?: unknown): Promise<any | null>;

  findItemTypeById(itemTypeId: string, tx?: unknown): Promise<CourierItemTypeView | null>;

  normalizeSerial(
    serial: string,
    hintItemTypeId: string,
    tx?: unknown
  ): Promise<{
    normalizedSerial: string;
    itemTypeId: string;
    carrierName: string | null;
  }>;

  transferCustodyToTechnician(command: TransferCourierCustodyCommand, tx?: unknown): Promise<void>;

  mintAndAssignToTechnician(
    command: MintCourierCustodyCommand,
    tx?: unknown
  ): Promise<{ id: string; serialNumber: string }>;

  deductFromTechnicianCustody(command: DeductCourierCustodyCommand): Promise<boolean>;
}
