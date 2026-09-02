import {
  decideWarehouseScope,
  warehouseScopeDenialStatus,
  warehouseScopeDenialMessage,
  type WarehouseScopeActor,
} from "../../../domain/warehouse-scope.policy";

/**
 * OPS-PERM-S1-F1.R2.SR2 — the single warehouse-scope authorization entry point
 * for every warehouse-keyed read and mutation. Callers pass the actor and a
 * warehouseId; this use-case loads the AUTHORITATIVE warehouse record (region
 * included) and the actor's own relation rows, then defers the decision to the
 * pure policy. No controller re-derives relation/region logic.
 */
export interface WarehouseScopeWarehousePort {
  getWarehouse(id: string): Promise<{ id: string; regionId: string | null } | undefined>;
}

export interface WarehouseScopeSupervisorRelationPort {
  getSupervisorWarehouseIds(supervisorId: string): Promise<string[]>;
}

export type AuthorizeWarehouseScopeDeps = {
  warehouseRepository: WarehouseScopeWarehousePort;
  supervisorAssignmentsRepository: WarehouseScopeSupervisorRelationPort;
};

export class AuthorizeWarehouseScopeError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthorizeWarehouseScopeError";
  }
}

export type AuthorizeWarehouseScopeInput = {
  actor: WarehouseScopeActor;
  warehouseId: string;
};

export class AuthorizeWarehouseScopeUseCase {
  constructor(private readonly deps: AuthorizeWarehouseScopeDeps) {}

  /** Returns the authoritative warehouse on allow; throws
   * AuthorizeWarehouseScopeError on deny. Fails closed on every unknown case. */
  async execute(input: AuthorizeWarehouseScopeInput): Promise<{ id: string; regionId: string | null }> {
    const { actor, warehouseId } = input;

    const warehouse = (await this.deps.warehouseRepository.getWarehouse(warehouseId)) ?? null;
    const assignedWarehouseIds = await this.resolveAssignedIds(actor);
    const decision = decideWarehouseScope({ actor, warehouse, assignedWarehouseIds });

    if (!decision.allowed) {
      throw new AuthorizeWarehouseScopeError(
        warehouseScopeDenialStatus(decision.reason),
        warehouseScopeDenialMessage(decision.reason),
      );
    }

    return warehouse as { id: string; regionId: string | null };
  }

  /** Relation rows are only meaningful for the supervisor ceiling. Admin is
   * decided by role; every other role is denied by the policy regardless. */
  private async resolveAssignedIds(actor: WarehouseScopeActor): Promise<string[]> {
    if (actor.role !== "supervisor") {
      return [];
    }
    return this.deps.supervisorAssignmentsRepository.getSupervisorWarehouseIds(actor.id);
  }
}
