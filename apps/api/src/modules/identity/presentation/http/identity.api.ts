/**
 * Identity module's public cross-module API surface (see
 * .dependency-cruiser.cjs's no-cross-module-internal-imports rule — a module
 * may only reach another module's behavior through a file matching this
 * exact path pattern, never its internal application/infrastructure
 * directories directly).
 *
 * Re-exports exactly the pieces another module's own already-open database
 * transaction needs to route a security-state change through the same
 * canonical transition every identity-owned action uses, without duplicating
 * that transition's algorithm or opening a second, independent transaction.
 */
export {
  applyCanonicalStatusTransition,
  // OPS-PERM-S1-F4-R3 — the primitives a multi-row caller (backup restore)
  // needs to validate a whole batch's combined effect on active-Admin
  // membership up front, then apply each already-validated row through the
  // exact same write/audit path applyCanonicalStatusTransition itself uses —
  // see ImportSystemBackup.use-case.ts and computeMembershipDiff/
  // applyMembershipMutation's own doc comments for why a second per-row
  // canonical check at write time is not equivalent to a batch's own
  // up-front validation.
  computeMembershipDiff,
  applyMembershipMutation,
  type StatusTransitionActor,
  type AdminMembershipChange,
  type MembershipDiff,
} from "@modules/identity/application/users/use-cases/UserManagement.use-case";
export {
  buildIdentityTransactionalContext,
  // OPS-PERM-S1-F4-R3 — a fully-wired UserManagementUseCase, for another
  // module's real-Postgres concurrency proof that needs to drive a genuine
  // PATCH-path mutation concurrently with its own operation (see
  // ImportSystemBackup.admin-invariant.test.ts §8-10 and this factory's own
  // doc comment for why it — not a raw repository/use-case export — is the
  // cross-module surface: presentation/ may not import infrastructure/
  // database/ directly, controller-should-not-depend-on-repository-or-drizzle).
  createUserManagementUseCase,
} from "@modules/identity/infrastructure/repositories/DrizzleIdentityUnitOfWork";
