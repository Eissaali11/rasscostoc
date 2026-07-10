/**
 * Guard Validation Types
 * Shared types and errors for the Guard Validation Layer.
 */

/**
 * Context passed to all guards during execution validation.
 */
export interface GuardContext {
  requestId: number;
  enteredBy: string;
  /** The raw execution data submitted by the user */
  executionData: ExecutionInput;
  /** The original courier request from DB */
  request: RequestRecord;
  /** The existing execution record if any (for update path) */
  existingExecution?: ExistingExecution | null;
}

export interface ExecutionInput {
  installationStatus?: string;
  technicianCode?: string;
  salesTechnician?: string;
  sn?: string;
  simSerial?: string;
  extraField1?: string;
  extraField2?: string;
  [key: string]: any;
}

export interface RequestRecord {
  id: number;
  tecName?: string | null;
  customerName?: string | null;
  incidentNumber?: string | null;
  [key: string]: any;
}

export interface ExistingExecution {
  installationStatus?: string | null;
  [key: string]: any;
}

export interface TechUser {
  id: string;
  username: string;
  fullName: string;
}

/**
 * Thrown when a guard rejects the request.
 * No data should be written to DB after this error is thrown.
 */
export class GuardValidationError extends Error {
  public readonly field?: string;
  public readonly auditAction: string = "verification_failed";

  constructor(message: string, field?: string) {
    super(message);
    this.name = "GuardValidationError";
    this.field = field;
  }
}

/** Statuses that trigger inventory deduction and full guard validation */
export const COMPLETED_STATUSES = new Set([
  "Installation Completed",
  "Installation Completed - NL",
]);

export function isCompletedStatus(status?: string): boolean {
  return !!status && COMPLETED_STATUSES.has(status);
}
