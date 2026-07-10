/**
 * IGeneralInventoryRepository
 *
 * Contract for deducting device units from a technician's general inventory pool.
 * InventoryEngine depends on this interface — not on a concrete service.
 */

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
  deductTechnicianInventory(command: DeductInventoryCommand): Promise<void>;
}
