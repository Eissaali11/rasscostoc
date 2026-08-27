import type { IUserRepository, IRefreshTokenRepository, UserAuthState } from "@stockpro/contracts";

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
   * isActive/authGeneration state. Deliberately not exposed on IUserRepository
   * itself — only code already inside an open identity transaction (i.e.
   * holding this context) may perform an authentication-state-transition
   * read/write; a bare IUserRepository reference cannot.
   */
  lockUserForUpdate(id: string): Promise<UserAuthState | undefined>;

  /**
   * Persistence primitive for a status transition: sets isActive and
   * authGeneration in one statement. Does not revoke tokens, delete sessions,
   * or write audit — those are orchestrated by the application layer via the
   * Identity Unit of Work. Same containment reasoning as lockUserForUpdate.
   */
  updateUserState(id: string, state: UserAuthState): Promise<void>;

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
