/**
 * ERP-005A-4 Phase 4 — Type A (display-only) consumer-owned port.
 *
 * Inventory-owned view of identity's users, scoped to what inventory
 * actually displays (name/city/username/avatar) — never the full users row.
 */
export interface UserDisplayView {
  id: string;
  fullName: string;
  username: string;
  city: string | null;
  profileImage: string | null;
  regionId: string | null;
  role: string | null;
}

export interface IdentityUserReadPort {
  /**
   * Batch lookup — always use this instead of one call per id.
   */
  getUsersByIds(ids: readonly string[]): Promise<ReadonlyMap<string, UserDisplayView>>;

  getUserById(id: string): Promise<UserDisplayView | null>;

  /**
   * User ids whose fullName or username matches the search term
   * (case-insensitive substring match) — for search filters that used to
   * `ilike(users.fullName, ...)` inline in a cross-module JOIN.
   */
  searchUserIdsByName(term: string): Promise<ReadonlyArray<string>>;
}
