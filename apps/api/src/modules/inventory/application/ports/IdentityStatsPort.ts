/**
 * ERP-005A-4 Phase 4 — Type C (aggregate statistics) consumer-owned port.
 *
 * Dashboard-only counts. Region names are NOT resolved here — regions are
 * owned by inventory itself, so the port returns raw regionId counts and
 * inventory's own analytics code enriches them with region names locally
 * (avoids creating a new identity -> inventory violation).
 */
export interface IdentityStatsPort {
  getUserCountsByRole(): Promise<Readonly<Record<string, number>>>;
  getActiveUserStats(): Promise<{ total: number; active: number }>;
  getUserCountsByRegion(): Promise<ReadonlyArray<{ regionId: string | null; count: number }>>;
  getUserCountsByRegionAndRole(): Promise<ReadonlyArray<{ regionId: string | null; role: string; count: number }>>;
  getDistinctUserCityCount(): Promise<number>;
}
