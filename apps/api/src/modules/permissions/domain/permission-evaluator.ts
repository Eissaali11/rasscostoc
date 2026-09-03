/**
 * OPS-PERM-S1-F4 — the canonical Permission Engine evaluator.
 *
 * `evaluatePermission()` is the ONE function every route/service asks for an
 * authorization decision. It is a pure function of its input — no database
 * call, no clock, no frontend state — so every branch is deterministic and
 * unit-testable without mocks.
 *
 * Evaluation order (OPS-PERM-S1-F3 §0, frozen):
 *   1. actor active
 *   2. permission is a real, cataloged capability (default = deny otherwise, for every role)
 *   3. hard role ceiling
 *   4. per-employee override (explicit deny always wins over any grant)
 *   5. default role template (only consulted when no override exists)
 *   6. data scope, resolved against the actor's REAL assigned region/relations at call time —
 *      never a region baked into a template (OPS-PERM-S1-F4 §4)
 *
 * Positive, exhaustive dispatch throughout — a role reaches an `allowed: true` branch only by
 * being named in ROLE_HARD_CEILING, never via a negative check a future role could fall through.
 * Deliberately does NOT use ROLE_ORDER, hasRoleOrAbove(), or isSupervisor() anywhere — role
 * identity is always an exact string match, which is the specific fix for the courier_supervisor /
 * ROLE_ORDER‑tier‑3 conflation documented in OPS-PERM-S1-F3 §3.
 */
import { ROLE_HARD_CEILING, DEFAULT_ROLE_TEMPLATE, isCatalogedPermission, permissionKeyString } from "./permission-catalog";
import type { ActorRole, DataScope, EvaluationContext, PermissionActor, PermissionDecision, PermissionKey, PermissionOverride } from "./types";

const NON_ADMIN_ROLES = new Set<string>(["supervisor", "technician", "viewer", "courier_supervisor", "warehouse"]);

function isNonAdminRole(role: string): role is Exclude<ActorRole, "admin"> {
  return NON_ADMIN_ROLES.has(role);
}

export interface EvaluatePermissionInput {
  actor: PermissionActor;
  permission: PermissionKey;
  context: EvaluationContext;
  /** This actor's own override rows, pre-loaded by the caller (application layer). The evaluator
   * never fetches these itself — see the module doc comment on why it stays pure. */
  overrides: readonly PermissionOverride[];
}

export function evaluatePermission(input: EvaluatePermissionInput): PermissionDecision {
  const { actor, permission, context, overrides } = input;

  // 1. Active actor. `isActive` is optional — requireAuth already implies a currently-valid,
  // non-revoked credential (see auth-generation binding), so a caller that has no fresher signal
  // may omit it. A caller that DOES hold fresher target-row state (e.g. an admin write use case
  // re-reading the target from the DB in the same transaction) should always pass it.
  if (actor.isActive === false) {
    return { allowed: false, reason: "actor-inactive" };
  }

  // 2. Default = deny for every role, including admin, for anything not in the catalog. This is
  // what keeps Accounting (never cataloged here) untouched by this engine at all, and what
  // guarantees there is no free-text/undefined capability path.
  if (!isCatalogedPermission(permission.page, permission.action)) {
    return { allowed: false, reason: "no-grant" };
  }

  // 3. Admin: system-wide for anything reaching this point (already proven cataloged above).
  // Isolated domains (Accounting) are excluded structurally, not by a role-specific carve-out.
  if (actor.role === "admin") {
    return { allowed: true, reason: "admin", scope: "GLOBAL" };
  }

  if (!isNonAdminRole(actor.role)) {
    return { allowed: false, reason: "unknown-role" };
  }

  const permKey = permissionKeyString(permission.page, permission.action);
  const ceiling = ROLE_HARD_CEILING[actor.role];

  // 4. Hard ceiling. No override or template entry below can ever move past this.
  if (!ceiling.grants.has(permKey)) {
    return { allowed: false, reason: "role-ceiling" };
  }

  const override = overrides.find((o) => o.userId === actor.id && o.page === permission.page && o.action === permission.action);

  let grantSource: "override" | "role-template" | null = null;
  if (override) {
    // Explicit deny always wins over a grant, and over the default template — OPS-PERM-S1-F3 §4.
    if (override.value === "revoke") {
      return { allowed: false, reason: "explicit-deny" };
    }
    grantSource = "override";
  } else if (DEFAULT_ROLE_TEMPLATE[actor.role].has(permKey)) {
    grantSource = "role-template";
  }

  if (!grantSource) {
    return { allowed: false, reason: "no-grant" };
  }

  // 5. Data scope — resolved against real, current actor state, never a stored region.
  const scopeDecision = resolveScope(ceiling.scope, actor, context);
  if (!scopeDecision.allowed) {
    return scopeDecision;
  }

  return { allowed: true, reason: grantSource, scope: ceiling.scope };
}

function resolveScope(scope: DataScope, actor: PermissionActor, context: EvaluationContext): PermissionDecision {
  switch (scope) {
    case "REGION": {
      if (!actor.regionId) {
        return { allowed: false, reason: "actor-region-missing" };
      }
      if (!context.regionId) {
        return { allowed: false, reason: "resource-region-missing" };
      }
      if (actor.regionId !== context.regionId) {
        return { allowed: false, reason: "scope-mismatch" };
      }
      return { allowed: true, reason: "role-template", scope: "REGION" };
    }
    case "SELF": {
      if (!context.resourceOwnerId) {
        return { allowed: false, reason: "scope-unresolved" };
      }
      if (context.resourceOwnerId !== actor.id) {
        return { allowed: false, reason: "not-own-resource" };
      }
      return { allowed: true, reason: "role-template", scope: "SELF" };
    }
    case "WAREHOUSE": {
      if (!context.warehouseId || !context.assignedWarehouseIds) {
        return { allowed: false, reason: "scope-unresolved" };
      }
      if (!context.assignedWarehouseIds.includes(context.warehouseId)) {
        return { allowed: false, reason: "scope-mismatch" };
      }
      return { allowed: true, reason: "role-template", scope: "WAREHOUSE" };
    }
    default:
      // GLOBAL/RELATION are not assigned as a role's default scope for any non-admin role in V1
      // (see ROLE_HARD_CEILING) — reaching here would mean a future role addition forgot to wire
      // its scope. Fail closed rather than silently allowing.
      return { allowed: false, reason: "scope-unresolved" };
  }
}
