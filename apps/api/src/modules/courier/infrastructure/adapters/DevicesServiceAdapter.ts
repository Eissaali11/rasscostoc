/**
 * DevicesServiceAdapter
 *
 * Implements IGeneralInventoryRepository by wrapping devicesContainer.devicesService.
 * This is the only file that knows about devicesContainer in the Inventory layer.
 */

import { devicesContainer } from "@server/composition/devices.container";
import type { IGeneralInventoryRepository, DeductInventoryCommand } from "../../application/inventory/IGeneralInventoryRepository";

export class DevicesServiceAdapter implements IGeneralInventoryRepository {
  async deductTechnicianInventory(command: DeductInventoryCommand): Promise<void> {
    await devicesContainer.devicesService.deductTechnicianInventory({
      technicianCode: command.technicianCode,
      devices: command.devices,
      notes: command.notes,
      actor: command.actor,
    });
  }
}
