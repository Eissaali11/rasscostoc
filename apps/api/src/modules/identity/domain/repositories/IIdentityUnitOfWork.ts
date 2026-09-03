import type { IUserRepository, IRefreshTokenRepository, UserAuthState, UserSecurityState } from "@stockpro/contracts";

/** One record written to system_logs for a canonical status transition. */
export type IdentityAuditEntry = {
  userId: string | null;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  description: string;
  severity: "info" | "warn" | "error";
  success: boolean;
};

export type IdentityTransactionalContext = {
  userRepository: IUserRepository;
  refreshTokenRepository: IRefreshTokenRepository;

  /**
   * Locks the user row (SELECT ... FOR UPDATE) and returns its current
   * isActive/authGeneration/role state. Deliberately not exposed on
   * IUserRepository itself — only code already inside an open identity
   * transaction (i.e. holding this context) may perform an
   * authentication-state-transition read/write; a bare IUserRepository
   * reference cannot.
   */
  lockUserForUpdate(id: string): Promise<UserSecurityState | undefined>;

  /**
   * Persistence primitive for a status transition: sets isActive and
   * authGeneration in one statement. Does not revoke tokens, delete sessions,
   * or write audit — those are orchestrated by the application layer via the
   * Identity Unit of Work. Same containment reasoning as lockUserForUpdate.
   */
  updateUserState(id: string, state: UserAuthState): Promise<void>;

  /**
   * OPS-PERM-S1-F4-R2 — persistence primitive for a role transition: sets
   * `role` in one statement. Same containment reasoning as updateUserState —
   * `role` is deliberately absent from OrdinaryUserFieldUpdate, so this is the
   * only way to persist it, and only from inside the canonical admin-
   * membership transition (see UserManagement.use-case.ts), never a bare
   * ordinary-field writer.
   */
  updateUserRole(id: string, role: string): Promise<void>;

  /**
   * OPS-PERM-S1-F4-R2 — acquires a transaction-scoped Postgres advisory lock
   * (`pg_advisory_xact_lock`) shared by every mutation that can change
   * whether the system has zero active Admins: a role change away from
   * `admin`, or an isActive true→false transition on an admin row. Auto-
   * released on commit or rollback — never held past this transaction.
   *
   * This is what makes the last-active-admin check safe under concurrency:
   * two transactions racing to remove DIFFERENT admin rows would otherwise
   * both read "at least one other admin is active" from an unlocked SELECT
   * and both proceed, since a plain SELECT under READ COMMITTED is never
   * blocked by another transaction's row-level FOR UPDATE lock on a
   * different row. Serializing on this single, well-known key forces the
   * second transaction's admin-roster read to happen only after the first
   * commits, so it always sees the first's result.
   */
  acquireAdminMembershipLock(): Promise<void>;

  /** Deletes every bearer_sessions row for the given user, inside this transaction. */
  deleteBearerSessionsForUser(userId: string): Promise<void>;

  /** Deletes every Express session row (connect-pg-simple's `session` table) whose
   * stored sess.user.id matches, inside this transaction. */
  deleteExpressSessionsForUser(userId: string): Promise<void>;

  /** Writes one system_logs row as part of this same transaction. */
  writeAudit(entry: IdentityAuditEntry): Promise<void>;
};

export interface IIdentityUnitOfWork {
  execute<T>(work: (context: IdentityTransactionalContext) => Promise<T>): Promise<T>;
}
