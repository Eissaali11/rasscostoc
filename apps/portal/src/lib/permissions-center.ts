/**
 * OPS-PERM-S1-F5 — Permissions Center UI: response types and label lookups.
 *
 * These types mirror the frozen OPS-PERM-S1-F4 backend contract
 * (apps/api/src/modules/permissions/{domain/types.ts,application/PermissionsService.ts,
 * domain/repositories/IPermissionsRepository.ts}) rather than importing it — apps/portal is a
 * separate deployable frontend and never imports apps/api internals. Keep this file's shapes in
 * sync with that module if the backend contract ever changes.
 *
 * V1 SCOPE (unchanged from F4): the Permissions Center only manages employees whose role is
 * "supervisor" — see PermissionsService's own "Admin manages SUPERVISOR permissions" comment.
 */
/** Matches LanguageContextType["t"] from src/i18n/provider.tsx without importing React context
 * plumbing into this plain-data module. */
export type TFunction = (key: string, options?: { ar?: string; en?: string } & Record<string, any>) => string;

export type OverrideValue = "grant" | "revoke";
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

export interface PermissionChangeAuditEntry {
  id: string;
  changedBy: string;
  targetUserId: string;
  page: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  changedAt: string;
}

export interface WriteOverrideResult {
  success: boolean;
  override?: {
    id: string;
    userId: string;
    page: string;
    action: string;
    value: OverrideValue;
    grantedBy: string;
    version: number;
    createdAt: string;
    updatedAt: string;
  } | null;
}

/** A row is off-limits for this admin panel exactly when the evaluator's effective decision says
 * so via "role-ceiling" — never re-derived from a locally duplicated ceiling set, so this stays
 * correct even if the backend catalog/ceiling changes without a matching frontend edit. */
export function isRowEditable(row: EmployeePermissionRow): boolean {
  return !(row.effective.allowed === false && row.effective.reason === "role-ceiling");
}

/** i18n key segment for a catalog page string — the locale JSON stores nested keys with
 * underscores (e.g. "courier_requests"), never a literal "." (the i18n lookup path splits on
 * every dot, so a dotted key like "courier.requests" could never be addressed as one segment). */
function pageKeySegment(page: string): string {
  return page.replace(/\./g, "_");
}

export function pageLabel(t: TFunction, page: string): string {
  const key = `permissions_center.pages.${pageKeySegment(page)}`;
  const label = t(key);
  return label === key ? page : label;
}

export function actionLabel(t: TFunction, action: string): string {
  const key = `permissions_center.actions.${action}`;
  const label = t(key);
  return label === key ? action : label;
}

export function permissionLabel(t: TFunction, page: string, action: string): string {
  return `${pageLabel(t, page)} · ${actionLabel(t, action)}`;
}

export function grantSourceLabel(t: TFunction, source: GrantSource): string {
  return t(`permissions_center.sources.${source}`);
}

export function denyReasonLabel(t: TFunction, reason: DenyReason): string {
  return t(`permissions_center.reasons.${reason}`);
}

export function dataScopeLabel(t: TFunction, scope: DataScope): string {
  return t(`permissions_center.scopes.${scope}`);
}

export function overrideValueLabel(t: TFunction, value: OverrideValue | null): string {
  return t(`permissions_center.override_values.${value ?? "reset"}`);
}
