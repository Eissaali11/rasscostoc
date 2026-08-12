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
  /** Consumable quantities */
  paperRollQty?: number;
  stickersQty?: number;
  nulipCardsQty?: number;
  /** Free-text notes for general deduction log */
  notes?: string;
  /**
   * OPS-REMED-E3: explicit device/SIM pairs as authoritatively submitted at
   * report-approval time (body.devices), preserved end-to-end — NOT the
   * flattened devices[]/serialsForCustody[] lists. Used to validate the
   * approved pairing rule (complete pairs only; single-sided entries fail
   * closed) before any write. Optional for backward compatibility with any
   * caller that has not yet been migrated to supply it.
   */
  pairs?: DevicePair[];
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

/**
 * OPS-REMED-E3 — opaque transaction-context marker.
 *
 * The application layer never sees the concrete Drizzle transaction shape.
 * Only infrastructure-layer adapters (SerializedItemsAdapter,
 * DevicesServiceAdapter, DrizzleInventoryTransactionRunner) are permitted to
 * cast to/from the real transaction object. This satisfies the
 * architecture-lint rule "application-should-not-depend-on-presentation-
 * infrastructure-or-drizzle" (.dependency-cruiser.cjs) without using `any`.
 */
export interface InventoryTransactionContext {
  readonly __brand: unique symbol;
}

export interface IInventoryTransactionRunner {
  run<T>(work: (ctx: InventoryTransactionContext) => Promise<T>): Promise<T>;
}

/**
 * OPS-REMED-E3 — structured deduction error codes (replaces free-text error
 * strings for the retry/idempotency-relevant classification).
 */
export type DeductionErrorCode =
  | "DEDUCT_INFRA_TRANSIENT"
  | "DEDUCT_ASSET_MISSING"
  | "DEDUCT_WRONG_TECHNICIAN"
  | "DEDUCT_INTEGRITY_CONFLICT"
  | "DEDUCT_PAIR_INCOMPLETE"
  | "DEDUCT_INSUFFICIENT_STOCK"
  | "DEDUCT_SERIAL_CONFLICT";

/** Every code except DEDUCT_INFRA_TRANSIENT is a permanent business rejection. */
export const PERMANENT_DEDUCTION_ERROR_CODES: ReadonlySet<DeductionErrorCode> = new Set([
  "DEDUCT_ASSET_MISSING",
  "DEDUCT_WRONG_TECHNICIAN",
  "DEDUCT_INTEGRITY_CONFLICT",
  "DEDUCT_PAIR_INCOMPLETE",
  "DEDUCT_INSUFFICIENT_STOCK",
  "DEDUCT_SERIAL_CONFLICT",
]);

export class DeductionError extends Error {
  readonly code: DeductionErrorCode;
  readonly requestId: number;
  constructor(code: DeductionErrorCode, requestId: number, message: string) {
    super(message);
    this.name = "DeductionError";
    this.code = code;
    this.requestId = requestId;
  }
}

/**
 * OPS-REMED-E3 — an explicit device/SIM pair (or standalone-rejected entry)
 * as authoritatively submitted at report-approval time (body.devices).
 * Preserved end-to-end from courier-pdf-extraction.adapter.ts through
 * ExecutionCompletedEvent to InventoryEngine — never flattened into
 * unrelated parallel arrays.
 */
export interface DevicePair {
  sn: string | null;
  simSerial: string | null;
}
