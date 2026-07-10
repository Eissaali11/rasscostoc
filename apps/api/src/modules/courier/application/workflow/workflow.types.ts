/**
 * Workflow Engine Types
 *
 * Defines the decisions, context, and results of the Courier Workflow Engine.
 * The engine knows NOTHING about inventory internals — it only decides WHAT to do.
 */

/** All possible workflow decisions based on installation status */
export enum WorkflowDecision {
  /** Trigger inventory deduction + close request */
  TRIGGER_INVENTORY_DEDUCTION = "TRIGGER_INVENTORY_DEDUCTION",
  /** Close the request without touching inventory */
  CLOSE_WITHOUT_DEDUCTION = "CLOSE_WITHOUT_DEDUCTION",
  /** Mark as in-progress, no terminal action */
  MARK_IN_PROGRESS = "MARK_IN_PROGRESS",
  /** Unknown/unrecognized status — log and skip */
  UNKNOWN = "UNKNOWN",
}

/** The context provided to the Workflow Engine after guards pass */
export interface WorkflowContext {
  requestId: number;
  actorId: string;
  execution: ExecutionSnapshot;
  request: RequestSnapshot;
}

export interface ExecutionSnapshot {
  installationStatus?: string | null;
  technicianCode?: string | null;
  salesTechnician?: string | null;
  sn?: string | null;
  simSerial?: string | null;
  extraField1?: string | null;
  extraField2?: string | null;
  [key: string]: any;
}

export interface RequestSnapshot {
  id: number;
  vendorType?: string | null;
  customerName?: string | null;
  incidentNumber?: string | null;
  tecName?: string | null;
  [key: string]: any;
}

/** Result returned by the Workflow Engine after execution */
export interface WorkflowResult {
  decision: WorkflowDecision;
  requestId: number;
  actorId: string;
  /** True if inventory deduction was attempted */
  inventoryDeducted: boolean;
  /** Any errors during post-decision side effects (non-fatal) */
  sideEffectErrors: string[];
}
