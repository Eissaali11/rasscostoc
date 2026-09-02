/**
 * OPS-PERM-S1-F1.R2.SR2 — central warehouse scope policy.
 *
 * Single source of truth for "may this actor act on this warehouse?". Every
 * warehouse-scoped route resolves the AUTHORITATIVE warehouse (loaded from the
 * database by id — never a client-supplied region) plus the actor's relation
 * rows, and hands both to this pure function. Controllers do not re-derive
 * relation/region logic themselves.
 *
 * The supervisor ceiling is a conjunction, not a disjunction: a supervisor
 * needs BOTH the supervisor_warehouses relation AND a region equal to the
 * warehouse's region. Historical cross-region relation rows written before the
 * assignment invariant existed therefore grant nothing — the region half of the
 * conjunction still fails at read/mutation time, which is why no destructive
 * data migration is required.
 *
 * This is deliberately NOT the future global Permissions Center evaluator: it
 * answers one question about one resource type.
 */

/** Roles that may reach warehouse-scoped resources at all. The "Regional
 * Supervisor" ceiling is specifically the `supervisor` role. `courier_supervisor`
 * is a distinct courier-module role with no warehouse mandate, and every other
 * role (technician, viewer, warehouse) is outside the supervisor scope — all of
 * them fail closed via "role-not-scoped". Technicians act on transfers through
 * the separate own-transfer contract, not this seam. */
const SUPERVISOR_SCOPED_ROLES = new Set(["supervisor"]);

export type WarehouseScopeActor = {
  id: string;
  role: string;
  regionId: string | null | undefined;
};

/** The warehouse as loaded from the database — the authoritative record. */
export type WarehouseScopeResource = {
  id: string;
  regionId: string | null | undefined;
};

export type WarehouseScopeDecision =
  | { allowed: true; reason: "admin" | "supervisor-in-region" }
  | { allowed: false; reason: WarehouseScopeDenialReason };

export type WarehouseScopeDenialReason =
  | "warehouse-not-found"
  | "role-not-scoped"
  | "actor-region-missing"
  | "warehouse-region-missing"
  | "relation-missing"
  | "region-mismatch";

export function isAdminRole(role: string): boolean {
  return role === "admin";
}

/**
 * Fail-closed warehouse scope decision.
 *
 * `assignedWarehouseIds` must be the actor's own supervisor_warehouses rows.
 * A missing warehouse, a missing region on either side, a missing relation, or
 * a region mismatch all deny — there is no fallback branch that allows.
 */
export function decideWarehouseScope(input: {
  actor: WarehouseScopeActor;
  warehouse: WarehouseScopeResource | null | undefined;
  assignedWarehouseIds: readonly string[];
}): WarehouseScopeDecision {
  const { actor, warehouse, assignedWarehouseIds } = input;

  if (isAdminRole(actor.role)) {
    // Admin is explicit and global, but still requires the warehouse to exist
    // so that callers cannot use a bogus id to probe for 200-vs-404 behavior.
    if (!warehouse) {
      return { allowed: false, reason: "warehouse-not-found" };
    }
    return { allowed: true, reason: "admin" };
  }

  if (!warehouse) {
    return { allowed: false, reason: "warehouse-not-found" };
  }

  if (!SUPERVISOR_SCOPED_ROLES.has(actor.role)) {
    return { allowed: false, reason: "role-not-scoped" };
  }

  if (!assignedWarehouseIds.includes(warehouse.id)) {
    return { allowed: false, reason: "relation-missing" };
  }

  // Region is required on BOTH sides. A null on either side is treated as
  // "unknown scope", which fails closed rather than matching another null.
  if (!actor.regionId) {
    return { allowed: false, reason: "actor-region-missing" };
  }

  if (!warehouse.regionId) {
    return { allowed: false, reason: "warehouse-region-missing" };
  }

  if (actor.regionId !== warehouse.regionId) {
    // Legacy cross-region relation row: relation present, region differs.
    return { allowed: false, reason: "region-mismatch" };
  }

  return { allowed: true, reason: "supervisor-in-region" };
}

/**
 * OPS-PERM-S1-F1.R2.SR3 — transfer-mutation role contract.
 *
 * Dispatch is POSITIVE and exhaustive: a role reaches a transfer mutation only
 * by being named here. There is no `else` that allows, and no negative check
 * such as `role !== "admin" && role !== "supervisor"` — under a negative check
 * every role the system gains later would silently inherit the technician
 * own-transfer path, which is exactly the gap this closes.
 *
 * The contract is technician-own, NOT any-role-own. `viewer`, `warehouse`,
 * `courier_supervisor`, and any role not listed here are denied even when the
 * actor's id happens to equal transfer.technicianId. Note that
 * `courier_supervisor` shares ROLE_ORDER 3 with `supervisor`, so route-level
 * `requireSupervisor` admits it — this policy is what actually stops it.
 */
export type TransferMutationActorRole = "admin" | "supervisor" | "technician";

/** The three roles with ANY path to a transfer mutation. Membership here is a
 * deliberate grant, never an accident of role ordering or a fallthrough. */
const TRANSFER_MUTATION_ROLES: readonly string[] = ["admin", "supervisor", "technician"];

export function isTransferMutationRole(role: string): role is TransferMutationActorRole {
  return TRANSFER_MUTATION_ROLES.includes(role);
}

export type TransferMutationDecision =
  | { allowed: true; reason: "admin" | "supervisor-in-region" | "technician-own-transfer" }
  | { allowed: false; reason: TransferMutationDenialReason };

export type TransferMutationDenialReason =
  | "transfer-not-found"
  | "role-not-permitted"
  | "not-own-transfer"
  | WarehouseScopeDenialReason;

/**
 * Pure decision for "may this actor mutate this transfer?".
 *
 * The decision is made against `transfer.warehouseId`, which is NOT immutable:
 * an administrative backup restore upserts warehouse_transfers and assigns that
 * column, and no schema constraint or trigger forbids it. This policy therefore
 * does not depend on immutability — the caller resolves the warehouse and the
 * actor's relation/region from current state per request, so each request is
 * decided against the value in effect at that moment.
 */
export function decideTransferMutation(input: {
  actor: WarehouseScopeActor;
  transfer: { technicianId: string; warehouseId: string } | null | undefined;
  warehouse: WarehouseScopeResource | null | undefined;
  assignedWarehouseIds: readonly string[];
}): TransferMutationDecision {
  const { actor, transfer, warehouse, assignedWarehouseIds } = input;

  if (!transfer) {
    return { allowed: false, reason: "transfer-not-found" };
  }

  // Positive, exhaustive dispatch. An unrecognized role never reaches a branch
  // that can allow.
  if (!isTransferMutationRole(actor.role)) {
    return { allowed: false, reason: "role-not-permitted" };
  }

  switch (actor.role) {
    case "admin": {
      // Admin is explicit and global, but the warehouse must exist so a bogus
      // id cannot be used to probe 200-vs-404.
      if (!warehouse) {
        return { allowed: false, reason: "warehouse-not-found" };
      }
      return { allowed: true, reason: "admin" };
    }

    case "supervisor": {
      const decision = decideWarehouseScope({ actor, warehouse, assignedWarehouseIds });
      if (!decision.allowed) {
        return { allowed: false, reason: decision.reason };
      }
      return { allowed: true, reason: "supervisor-in-region" };
    }

    case "technician": {
      // Own-transfer contract. Ownership is the ONLY thing that admits a
      // technician; it grants nothing on any other technician's transfer.
      if (transfer.technicianId !== actor.id) {
        return { allowed: false, reason: "not-own-transfer" };
      }
      return { allowed: true, reason: "technician-own-transfer" };
    }
  }
}

/** Client-facing message for a transfer-mutation denial. Does not reveal which
 * branch failed, nor whether the transfer belongs to someone else. */
export function transferMutationDenialMessage(reason: TransferMutationDenialReason): string {
  if (reason === "transfer-not-found") {
    return "الطلب غير موجود";
  }
  if (reason === "not-own-transfer" || reason === "role-not-permitted") {
    return "غير مصرح لك بالوصول إلى هذا الطلب";
  }
  return warehouseScopeDenialMessage(reason);
}

/** HTTP status for a transfer-mutation denial. Only a genuinely absent transfer
 * or warehouse is a 404. */
export function transferMutationDenialStatus(reason: TransferMutationDenialReason): 403 | 404 {
  if (reason === "transfer-not-found") {
    return 404;
  }
  if (reason === "not-own-transfer" || reason === "role-not-permitted") {
    return 403;
  }
  return warehouseScopeDenialStatus(reason);
}

/** Client-facing message for a denial. Deliberately does not leak whether the
 * warehouse exists or which half of the conjunction failed. */
export function warehouseScopeDenialMessage(reason: WarehouseScopeDenialReason): string {
  if (reason === "warehouse-not-found") {
    return "المستودع غير موجود";
  }
  return "غير مصرح لك بالوصول إلى هذا المستودع";
}

/** HTTP status for a denial. Only a genuinely absent warehouse is a 404. */
export function warehouseScopeDenialStatus(reason: WarehouseScopeDenialReason): 403 | 404 {
  return reason === "warehouse-not-found" ? 404 : 403;
}
