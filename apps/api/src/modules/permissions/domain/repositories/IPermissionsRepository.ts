import type { PermissionOverride } from "../types";

export interface PermissionChangeAuditEntry {
  id: string;
  changedBy: string;
  targetUserId: string;
  page: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  changedAt: Date;
}

export interface ApplyOverrideChangeInput {
  targetUserId: string;
  page: string;
  action: string;
  /** null = reset (delete the override row, fall back to the default role template). */
  newValue: "grant" | "revoke" | null;
  grantedBy: string;
  reason?: string;
  /** Optimistic concurrency: required when updating/deleting an existing override; the write is
   * rejected if the row's current version does not match (see OPS-PERM-S1-F4 §7). Omitted when
   * no prior override row exists for this (user, page, action). */
  expectedVersion?: number;
}

/**
 * Repository boundary for the Permission Engine's writable state. Deliberately narrow — the
 * evaluator itself never calls this; only the application-layer service that loads overrides for
 * a decision, and the admin write use cases, do.
 */
export interface IPermissionsRepository {
  getOverridesForUser(userId: string): Promise<PermissionOverride[]>;

  /** Loads the target's current override for (page, action) if any, applies the requested change,
   * and appends one audit row — all inside a single transaction. Throws OverrideVersionConflictError
   * if `expectedVersion` is supplied and does not match the row's current version. */
  applyOverrideChange(input: ApplyOverrideChangeInput): Promise<PermissionOverride | null>;

  getAuditHistory(targetUserId: string, limit?: number): Promise<PermissionChangeAuditEntry[]>;
}

export class OverrideVersionConflictError extends Error {
  constructor() {
    super("تم تعديل هذه الصلاحية من جلسة أخرى، يرجى إعادة التحميل والمحاولة مرة أخرى");
    this.name = "OverrideVersionConflictError";
  }
}
