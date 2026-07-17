/**
 * ERP-005A-4 Phase 4 — Type B (business decision) consumer-owned port.
 *
 * Covers the identity-owned facts inventory needs to make authorization /
 * eligibility / regional-scoping decisions — never the raw users row, and
 * never a live SQL join against the users table.
 */
export interface TechnicianDirectoryView {
  id: string;
  fullName: string;
  username: string;
  city: string | null;
  regionId: string | null;
}

export interface TechnicianEligibilityResult {
  userId: string;
  eligible: boolean;
  role: string | null;
}

export interface TechnicianEligibilityPort {
  /**
   * True if the user exists and holds one of the given roles.
   * Replaces: `SELECT ... FROM users WHERE id = ? AND role IN (...)`.
   */
  verifyTechnicianEligibility(
    userId: string,
    allowedRoles: readonly string[]
  ): Promise<TechnicianEligibilityResult>;

  /**
   * Technician directory, optionally scoped to a region.
   * Replaces direct `WHERE role = 'technician' [AND regionId = ?]` queries.
   */
  listTechnicians(filters?: { regionId?: string }): Promise<ReadonlyArray<TechnicianDirectoryView>>;

  /**
   * Ids of all users assigned to a region — for filtering inventory's own
   * records (transactions, movements, requests) by "technician's region"
   * without joining the users table.
   */
  getUserIdsByRegion(regionId: string): Promise<ReadonlyArray<string>>;

  getUserRegionId(userId: string): Promise<string | null>;

  /**
   * True if any user is currently assigned to this region — used as a
   * deletion guard.
   */
  regionHasAssignedUsers(regionId: string): Promise<boolean>;

  /**
   * Case-insensitive exact match on username or fullName — for "enter a
   * technician code or name" lookup fields. Not a substring search (see
   * IdentityUserReadPort.searchUserIdsByName for that).
   */
  findTechnicianByCodeOrName(code: string): Promise<TechnicianDirectoryView | null>;
}
