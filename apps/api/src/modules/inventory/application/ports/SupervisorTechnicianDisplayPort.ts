import type { UserSafe } from "@shared/schema";

/**
 * ERP-005A-4 Phase 4B — narrow, single-purpose port backing the relocated
 * SupervisorAssignmentsRepository.getSupervisorTechnicians, whose published
 * contract (ISupervisorAssignmentsRepository in @stockpro/contracts) already
 * commits callers to full UserSafe rows and is out of scope to change in
 * this phase. Unlike IdentityUserReadPort's UserDisplayView, this
 * intentionally returns the full identity-safe row because the existing
 * contract requires it — do not reuse this port for new call sites that
 * could work with the narrower UserDisplayView instead.
 */
export interface SupervisorTechnicianDisplayPort {
  getUserSafeRowsByIds(ids: readonly string[]): Promise<UserSafe[]>;
}
