import {
  decideTransferMutation,
  transferMutationDenialStatus,
  transferMutationDenialMessage,
  type WarehouseScopeActor,
} from "../../../domain/warehouse-scope.policy";
import type { WarehouseTransfer } from "@shared/schema";

/** Narrow ports for a transfer-bound mutation: load the transfer (which carries
 * the warehouseId the scope decision is made against), resolve the warehouse
 * itself, then hand the warehouse + actor + relation rows to the single seam.
 *
 * On warehouseId stability: this seam does NOT rely on warehouseId being
 * immutable, and warehouseId is not immutable. ImportSystemBackupUseCase
 * upserts warehouse_transfers with onConflictDoUpdate on the id, and its set
 * object assigns warehouseId — so an administrative restore can change the
 * column on an existing row. Nothing at the schema level prevents that either:
 * there is no constraint or trigger enforcing immutability.
 *
 * The authorization remains sound because it resolves the warehouse and the
 * actor's relation/region from CURRENT state on every request, and the decision
 * is used only within the request that made it. A later write to warehouseId
 * cannot retroactively widen an already-completed decision; the next request
 * simply gets re-evaluated against the new value. */
export interface AuthorizeWarehouseTransferMutationWarehousePort {
  getWarehouse(id: string): Promise<{ id: string; regionId: string | null } | undefined>;
}

export interface AuthorizeWarehouseTransferMutationTransferPort {
  getWarehouseTransferById(id: string): Promise<WarehouseTransfer | null>;
}

export interface AuthorizeWarehouseTransferMutationSupervisorRelationPort {
  getSupervisorWarehouseIds(supervisorId: string): Promise<string[]>;
}

export type AuthorizeWarehouseTransferMutationDeps = {
  warehouseRepository: AuthorizeWarehouseTransferMutationWarehousePort;
  warehouseTransferRepository: AuthorizeWarehouseTransferMutationTransferPort;
  supervisorAssignmentsRepository: AuthorizeWarehouseTransferMutationSupervisorRelationPort;
};

export class AuthorizeWarehouseTransferMutationError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthorizeWarehouseTransferMutationError";
  }
}

export type AuthorizeWarehouseTransferMutationInput =
  | { actor: WarehouseScopeActor; transferId: string };

export class AuthorizeWarehouseTransferMutationUseCase {
  constructor(private readonly deps: AuthorizeWarehouseTransferMutationDeps) {}

  /**
   * OPS-PERM-S1-F1.R2.SR3 — THE single authorization entry point for every
   * transfer mutation, for EVERY role. Returns the loaded transfer (carrying
   * the warehouseId the decision was made against) on allow; throws on deny.
   *
   * The role decision lives entirely in the pure policy
   * (decideTransferMutation), which dispatches positively over
   * admin/supervisor/technician and denies anything else. Callers do NOT
   * pre-filter by role — an earlier version let the controller handle
   * "non-admin, non-supervisor" as a technician, which silently granted the
   * technician own-transfer path to viewer/warehouse/courier_supervisor. That
   * branch no longer exists anywhere.
   */
  async execute(input: AuthorizeWarehouseTransferMutationInput): Promise<WarehouseTransfer> {
    const { actor, transferId } = input;

    const transfer = await this.deps.warehouseTransferRepository.getWarehouseTransferById(transferId);

    // Only the supervisor branch consults the warehouse and the relation rows;
    // loading them for other roles would be wasted queries and would widen the
    // surface for no benefit.
    const needsWarehouseScope = actor.role === "admin" || actor.role === "supervisor";
    const warehouse =
      needsWarehouseScope && transfer
        ? (await this.deps.warehouseRepository.getWarehouse(transfer.warehouseId)) ?? null
        : null;
    const assignedWarehouseIds =
      actor.role === "supervisor"
        ? await this.deps.supervisorAssignmentsRepository.getSupervisorWarehouseIds(actor.id)
        : [];

    const decision = decideTransferMutation({ actor, transfer, warehouse, assignedWarehouseIds });

    if (!decision.allowed) {
      throw new AuthorizeWarehouseTransferMutationError(
        transferMutationDenialStatus(decision.reason),
        transferMutationDenialMessage(decision.reason),
      );
    }

    return transfer as WarehouseTransfer;
  }
}
