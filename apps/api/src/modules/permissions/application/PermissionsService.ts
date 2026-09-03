/**
 * OPS-PERM-S1-F4 — Permission Engine application service.
 *
 * Orchestrates the pure domain evaluator with the I/O the evaluator itself
 * deliberately never performs: loading an actor's overrides, and — for the
 * admin write use cases — validating and persisting a change, atomically,
 * with its audit row.
 *
 * V1 SCOPE: the write use cases (grant/revoke/reset) only ever target a
 * supervisor-role employee — "Admin manages SUPERVISOR permissions" is the
 * V1 target (OPS-PERM-S1-F4 §8). `can()` itself stays fully general (any
 * role), because a decision may legitimately be asked about any actor even
 * though only supervisor's assigned state is admin-editable in V1.
 */
import { evaluatePermission } from "../domain/permission-evaluator";
import { CATALOG_KEYS, DEFAULT_ROLE_TEMPLATE, PERMISSION_CATALOG, ROLE_HARD_CEILING, isCatalogedPermission, permissionKeyString } from "../domain/permission-catalog";
import type { EvaluationContext, OverrideValue, PermissionActor, PermissionDecision, PermissionKey } from "../domain/types";
import type { IPermissionsRepository } from "../domain/repositories/IPermissionsRepository";

export class SelfPermissionEditError extends Error {
  constructor() {
    super("لا يمكنك تعديل صلاحياتك الأمنية الخاصة");
    this.name = "SelfPermissionEditError";
  }
}

export class UnsupportedTargetRoleError extends Error {
  constructor(role: string) {
    super(`إدارة الصلاحيات من هذه اللوحة متاحة حاليًا لدور المشرف فقط (الدور الحالي: ${role})`);
    this.name = "UnsupportedTargetRoleError";
  }
}

export class UnknownPermissionError extends Error {
  constructor(page: string, action: string) {
    super(`صلاحية غير معروفة: ${page}:${action}`);
    this.name = "UnknownPermissionError";
  }
}

export class OutsideRoleCeilingError extends Error {
  constructor() {
    super("هذه الصلاحية تتجاوز الحد الأقصى المسموح به لهذا الدور");
    this.name = "OutsideRoleCeilingError";
  }
}

export interface EmployeePermissionRow {
  page: string;
  action: string;
  defaultGrant: boolean;
  assigned: OverrideValue | null;
  effective: PermissionDecision;
}

export interface EmployeePermissionSnapshot {
  userId: string;
  role: string;
  isActive: boolean;
  regionId: string | null;
  hardCeilingScope: string | null;
  permissions: EmployeePermissionRow[];
}

/** Minimal actor-lookup boundary this service needs from the identity module — deliberately
 * narrower than the full IUserRepository so this module does not take on identity's whole surface. */
export interface IActorLookup {
  getActor(userId: string): Promise<PermissionActor | undefined>;
}

export class PermissionsService {
  constructor(private readonly repo: IPermissionsRepository, private readonly actors: IActorLookup) {}

  /** The one call every route/service makes to ask a yes/no question. */
  async can(actor: PermissionActor, permission: PermissionKey, context: EvaluationContext): Promise<PermissionDecision> {
    const overrides = await this.repo.getOverridesForUser(actor.id);
    return evaluatePermission({ actor, permission, context, overrides });
  }

  /** Full read model for the Permissions Center — one employee's default, assigned, and effective
   * state across the whole catalog. Region-scoped rows are evaluated against the employee's OWN
   * region as context, matching "supervisor managing their own region" rather than an arbitrary
   * resource. */
  async getEmployeePermissionSnapshot(targetUserId: string): Promise<EmployeePermissionSnapshot> {
    const actor = await this.actors.getActor(targetUserId);
    if (!actor) {
      throw new UnknownPermissionError("employee", "not-found");
    }
    const overrides = await this.repo.getOverridesForUser(targetUserId);
    const overrideByKey = new Map(overrides.map((o) => [permissionKeyString(o.page, o.action), o.value]));

    const ceiling = actor.role === "admin" ? null : ROLE_HARD_CEILING[actor.role as keyof typeof ROLE_HARD_CEILING];
    const template = actor.role === "admin" ? null : DEFAULT_ROLE_TEMPLATE[actor.role as keyof typeof DEFAULT_ROLE_TEMPLATE];

    const rows: EmployeePermissionRow[] = PERMISSION_CATALOG.map((perm) => {
      const permKey = permissionKeyString(perm.page, perm.action);
      const assigned = (overrideByKey.get(permKey) as OverrideValue | undefined) ?? null;
      const effective = evaluatePermission({
        actor,
        permission: perm,
        context: { regionId: actor.regionId ?? null, resourceOwnerId: actor.id },
        overrides,
      });
      return {
        page: perm.page,
        action: perm.action,
        defaultGrant: actor.role === "admin" ? true : Boolean(template?.has(permKey)),
        assigned,
        effective,
      };
    });

    return {
      userId: actor.id,
      role: actor.role,
      isActive: actor.isActive ?? true,
      regionId: actor.regionId ?? null,
      hardCeilingScope: actor.role === "admin" ? "GLOBAL" : ceiling?.scope ?? null,
      permissions: rows,
    };
  }

  async getAuditHistory(targetUserId: string, limit?: number) {
    return this.repo.getAuditHistory(targetUserId, limit);
  }

  async grantPermission(adminActorId: string, targetUserId: string, page: string, action: string, reason?: string) {
    return this.writeOverride(adminActorId, targetUserId, page, action, "grant", reason);
  }

  async revokePermission(adminActorId: string, targetUserId: string, page: string, action: string, reason?: string) {
    return this.writeOverride(adminActorId, targetUserId, page, action, "revoke", reason);
  }

  async resetPermission(adminActorId: string, targetUserId: string, page: string, action: string, reason?: string) {
    return this.writeOverride(adminActorId, targetUserId, page, action, null, reason);
  }

  private async writeOverride(
    adminActorId: string,
    targetUserId: string,
    page: string,
    action: string,
    newValue: OverrideValue | null,
    reason?: string
  ) {
    // No self security administration — not even admin, not even a "harmless" reset.
    if (adminActorId === targetUserId) {
      throw new SelfPermissionEditError();
    }

    if (!isCatalogedPermission(page, action)) {
      throw new UnknownPermissionError(page, action);
    }

    const target = await this.actors.getActor(targetUserId);
    if (!target) {
      throw new UnknownPermissionError(page, action);
    }

    // V1 target: Admin manages SUPERVISOR permissions only (OPS-PERM-S1-F4 §8).
    if (target.role !== "supervisor") {
      throw new UnsupportedTargetRoleError(target.role);
    }

    // Validate against the target's hard ceiling server-side — frontend validation is
    // insufficient (OPS-PERM-S1-F4 §8). A reset (newValue === null) is always safe to validate
    // the same way: it can only ever narrow toward the default template, never exceed it.
    const permKey = permissionKeyString(page, action);
    if (!CATALOG_KEYS.has(permKey) || !ROLE_HARD_CEILING.supervisor.grants.has(permKey)) {
      throw new OutsideRoleCeilingError();
    }

    const existing = (await this.repo.getOverridesForUser(targetUserId)).find((o) => o.page === page && o.action === action);

    return this.repo.applyOverrideChange({
      targetUserId,
      page,
      action,
      newValue,
      grantedBy: adminActorId,
      reason,
      expectedVersion: existing?.version,
    });
  }
}
