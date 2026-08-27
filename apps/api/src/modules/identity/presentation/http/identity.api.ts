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
  type StatusTransitionActor,
} from "@modules/identity/application/users/use-cases/UserManagement.use-case";
export { buildIdentityTransactionalContext } from "@modules/identity/infrastructure/repositories/DrizzleIdentityUnitOfWork";
