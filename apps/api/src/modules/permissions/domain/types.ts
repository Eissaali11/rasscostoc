/**
 * OPS-PERM-S1-F4 — canonical Permission Engine types.
 *
 * Frozen against the OPS-PERM-S1-F3 design contract. A permission decision is
 * always a pure function of these three inputs — nothing hidden, nothing read
 * from frontend state, nothing cached across the call.
 */

/** The six roles the production `users.role` column carries today (packages/shared-types/roles.ts).
 * Deliberately a closed union, not `string` — an unrecognized role must fail a type check before
 * it can ever reach a runtime "unknown role → deny" branch. */
export type ActorRole =
  | "admin"
  | "supervisor"
  | "technician"
  | "viewer"
  | "courier_supervisor"
  | "warehouse";

export interface PermissionActor {
  id: string;
  role: string;
  /** null/undefined is a legitimate, common state (no region assigned yet) — never coerced to a
   * sentinel that could accidentally compare equal to another actor's missing region. */
  regionId: string | null | undefined;
  isActive?: boolean;
}

/** One grantable capability. Page and action are independent — see OPS-PERM-S1-F3 §2. */
export interface PermissionKey {
  page: string;
  action: string;
}

/** What the evaluator is being asked to decide about. Only the fields relevant to the scope
 * types actually implemented in V1 (GLOBAL, REGION, SELF) are consumed; WAREHOUSE/RELATION
 * fields are accepted so the shape is forward-compatible but are not yet resolved — see
 * DataScope's own doc comment. */
export interface EvaluationContext {
  resourceId?: string;
  /** id of the actor who owns/created the resource — required for SELF-scoped permissions. */
  resourceOwnerId?: string;
  /** authoritative region of the resource being acted on (never client-supplied — callers must
   * resolve this from the loaded resource, exactly as warehouse-scope.policy.ts does for warehouses). */
  regionId?: string | null;
  warehouseId?: string;
  /** Caller-resolved relation rows (e.g. from the existing SupervisorWarehouseAssignmentsUseCase) —
   * the evaluator never queries a repository itself. Required only when the actor's role scope
   * is WAREHOUSE; absent for any other scope type. */
  assignedWarehouseIds?: readonly string[];
}

export type DataScope = "GLOBAL" | "REGION" | "WAREHOUSE" | "RELATION" | "SELF";

export type GrantSource = "admin" | "role-template" | "override";

export type DenyReason =
  | "actor-inactive"
  | "unknown-role"
  | "role-ceiling"
  | "no-grant"
  | "explicit-deny"
  | "scope-unresolved"
  | "scope-mismatch"
  | "actor-region-missing"
  | "resource-region-missing"
  | "not-own-resource";

export type PermissionDecision =
  | { allowed: true; reason: GrantSource; scope: DataScope }
  | { allowed: false; reason: DenyReason };

/** One row of "what this employee has on record" for one permission — the Assigned Permissions
 * concept from OPS-PERM-S1-F3 §4. Distinct from the resolved PermissionDecision (Effective). */
export type OverrideValue = "grant" | "revoke";

export interface PermissionOverride {
  id: string;
  userId: string;
  page: string;
  action: string;
  value: OverrideValue;
  grantedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
