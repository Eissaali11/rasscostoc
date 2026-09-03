/**
 * OPS-PERM-S1-F4 §0/§7 — last active admin protection.
 *
 * Frozen owner decision: the system may never reach a state with zero active
 * admins. No prior code in the repository enforces this — it is a genuinely
 * new invariant, not a formalization of an existing one (confirmed absent by
 * search before this file was written).
 *
 * Pure predicate, no I/O: the caller counts active admins (excluding the
 * target row, since the target's own current state is what is about to
 * change) and hands in that count plus what the transition would do to the
 * target. Kept separate from any repository so it is trivially unit-testable
 * and so the exact same rule can guard every place a role or active-status
 * change could remove the last admin — the permission-override write path in
 * this module, and (per OPS-PERM-S1-F4 §0's admin section) the existing
 * user-deactivation/role-change path in the identity module.
 *
 * LastActiveAdminError extends the project's own ConflictError (@core/errors/AppError) rather
 * than a bare Error — the same pattern UserManagement.use-case.ts already uses for NotFoundError
 * — so it reaches the client as 409 through the existing errorHandler without every call site
 * needing its own translation layer.
 */
import { ConflictError } from "@core/errors/AppError";

/**
 * OPS-PERM-S1-F4-R2 — the transaction-scoped Postgres advisory-lock key every
 * admin-membership-changing transaction acquires (via
 * IdentityTransactionalContext.acquireAdminMembershipLock) before reading the
 * active-admin roster. A single, fixed, arbitrary bigint — its only
 * requirement is being unique within this application's advisory-lock key
 * space and stable across deploys (never derived from request/row data).
 *
 * R1 proved (empirically, 10/10 trials against real Postgres) that a plain
 * "count other active admins, then update" — with no shared lock — lets two
 * transactions targeting different admin rows both read a safe count and
 * both commit, leaving zero active admins. This key is what closes that gap:
 * see the doc comment on acquireAdminMembershipLock itself for the mechanism.
 *
 * A plain `number`, not a `bigint` — well inside Number.MAX_SAFE_INTEGER, so
 * it round-trips through the pg driver with no precision loss, and avoids
 * BigInt/parameter-serialization edge cases for no benefit (the function
 * accepts any value that fits in a Postgres bigint, which this does).
 */
export const ADMIN_MEMBERSHIP_ADVISORY_LOCK_KEY = 279_146_213_871;

export interface LastActiveAdminTransition {
  /** Is the row being changed currently an active admin? */
  targetIsCurrentlyActiveAdmin: boolean;
  /** How many OTHER rows (i.e. excluding the target) are active admins right now. */
  otherActiveAdminCount: number;
  /** What the target's role/active state will be immediately after the transition. */
  targetWillBeActiveAdminAfter: boolean;
}

/**
 * True when applying this transition would leave the system with zero active admins.
 * A transition that does not touch an active admin, or that keeps the target an active admin,
 * or that still leaves at least one OTHER active admin standing, is always safe.
 */
export function wouldRemoveLastActiveAdmin(t: LastActiveAdminTransition): boolean {
  if (!t.targetIsCurrentlyActiveAdmin) return false;
  if (t.targetWillBeActiveAdminAfter) return false;
  return t.otherActiveAdminCount === 0;
}

export class LastActiveAdminError extends ConflictError {
  constructor() {
    super("لا يمكن إزالة صلاحية آخر مدير نظام نشط");
    this.name = "LastActiveAdminError";
  }
}

export function assertLastActiveAdminSurvives(t: LastActiveAdminTransition): void {
  if (wouldRemoveLastActiveAdmin(t)) {
    throw new LastActiveAdminError();
  }
}

/**
 * OPS-PERM-S1-F4-R3 — SET-aware form of wouldRemoveLastActiveAdmin.
 *
 * R2's per-row check (above) is correct for a single canonical transition,
 * but a multi-row operation — a backup restore updating several users in one
 * transaction is the motivating case — must validate the COMBINED effect of
 * every proposed change at once, not one row at a time. Row-at-a-time
 * checking against live, sequentially-mutating in-transaction state has two
 * distinct failure modes: it can wrongly ALLOW a batch whose rows are each
 * "safe" in isolation but zero out the total together (exactly the pattern
 * this function exists to catch), or it can wrongly REJECT a batch that is
 * only safe once every row is considered together (e.g. one admin demoted
 * while a different user is promoted to admin in the very same restore) —
 * purely because of row-processing order, not because the batch is actually
 * unsafe. Computing the resulting SET once, from every proposed change
 * simultaneously, has neither failure mode.
 *
 * `currentActiveAdminIds` — every row currently `role='admin' AND isActive`,
 * read fresh, under the SAME advisory lock every other admin-membership
 * mutation acquires (ADMIN_MEMBERSHIP_ADVISORY_LOCK_KEY) — untouched rows in
 * this set always remain active admins after the batch.
 * `proposedFinalActiveAdminByUserId` — for every row this batch actually
 * changes (only rows whose role and/or isActive genuinely differs from its
 * current value belong here — an unchanged or merely-re-stated value is not
 * "proposed"), whether it will be an active admin afterward. A row present
 * here always overrides its current-set membership, whether or not it was in
 * `currentActiveAdminIds` to begin with (covers promotion of a non-admin to
 * admin within the same batch, not just demotions).
 */
export function wouldBatchLeaveZeroActiveAdmins(
  currentActiveAdminIds: ReadonlySet<string>,
  proposedFinalActiveAdminByUserId: ReadonlyMap<string, boolean>
): boolean {
  const resultingActiveAdminIds = new Set(currentActiveAdminIds);
  for (const [userId, willBeActiveAdmin] of proposedFinalActiveAdminByUserId) {
    if (willBeActiveAdmin) {
      resultingActiveAdminIds.add(userId);
    } else {
      resultingActiveAdminIds.delete(userId);
    }
  }
  return resultingActiveAdminIds.size === 0;
}
