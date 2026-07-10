/**
 * Inventory Engine Types
 *
 * The Inventory Engine knows NOTHING about courier requests or workflow decisions.
 * It only understands: technician, serial numbers, and deduction commands.
 */

export interface DeductionContext {
  requestId: number;
  actorId: string;
  technicianCode: string;
  /** Device SNs for general inventory deduction */
  devices: DeviceEntry[];
  /** All serials (SN + SIM) for serialized custody ScanOut */
  serialsForCustody: string[];
  /** Customer info for ScanOut audit trail */
  customerName: string;
  /** Reference number (incident/request) for ScanOut audit trail */
  referenceNumber: string;
  /** Vendor/model type for general inventory */
  vendorType?: string | null;
  /** Free-text notes for general deduction log */
  notes?: string;
}

export interface DeviceEntry {
  serialNumber: string;
  model?: string;
}

export interface DeductionResult {
  requestId: number;
  generalInventoryDeducted: boolean;
  custodyItemsDeducted: string[];
  errors: string[];
}
